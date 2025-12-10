from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import paho.mqtt.client as mqtt
import numpy as np
from datetime import datetime
from pytz import timezone
import os
import time
import threading
import random
import json
from collections import deque
from dotenv import load_dotenv

# Import MongoDB models and client
from db_client import mongodb
from db_models import (
    SensorDataModel,
    EnvironmentalDataModel,
    GateDataModel,
    FeedMonitorModel,
    HealthDataModel
)

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Configure CORS for production
cors_origins = os.getenv('CORS_ORIGINS', '*')
if cors_origins == '*':
    CORS(app)
else:
    CORS(app, origins=cors_origins.split(','))

# Determine the best async_mode based on installed packages and environment
async_mode = 'threading'  # Default fallback
try:
    import eventlet
    async_mode = 'eventlet'
    print("Using Eventlet async mode")
except (ImportError, AttributeError):
    # AttributeError can happen on Python 3.12+ because eventlet uses removed ssl.wrap_socket
    print("Eventlet not compatible or not installed, falling back to threading")
    pass

socketio = SocketIO(app, 
                   cors_allowed_origins=cors_origins, 
                   async_mode=async_mode,
                   ping_timeout=60, 
                   ping_interval=25)

# MQTT Configuration
MQTT_BROKER = os.getenv('MQTT_BROKER', "broker.emqx.io")
MQTT_PORT = int(os.getenv('MQTT_PORT', 1883))
MQTT_USERNAME = os.getenv('MQTT_USERNAME', '')
MQTT_PASSWORD = os.getenv('MQTT_PASSWORD', '')

MQTT_TOPICS = {
    "cattle_data": "farm/sensor1",           # Specific topic for farm sensor data
    "cattle_sensors": "farm/+",             # Topic pattern for multiple farm sensors
    "cattle_health": "cattle/health/+",     # Topic pattern for health data
    "environment": "farm/environment",       # Environmental data (LDR, DHT11, presence)
    "gate": "farm/gate",                    # Gate data (RFID + load cell)
    "feed_monitor": "farm/feed_monitor",    # Feed and water consumption data
}

# Initialize MQTT Client with authentication if provided
import uuid
mqtt_client = mqtt.Client(client_id=f"cattlenet-backend-{uuid.uuid4().hex[:8]}")
if MQTT_USERNAME and MQTT_PASSWORD:
    mqtt_client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

# Data storage (in-memory for now)
# Using deque for efficient FIFO operations
cattle_data_buffer = deque(maxlen=100)  # Store last 100 readings
environmental_data_buffer = deque(maxlen=50)  # Store last 50 environmental readings
gate_data_buffer = deque(maxlen=200)  # Store last 200 gate readings
feed_monitor_buffer = deque(maxlen=100)  # Store last 100 feed monitor readings
latest_data = {}
latest_environmental_data = {}
latest_gate_data = {}
latest_feed_data = {}  # Latest feed monitor data
cattle_registry = {}  # Maps RFID tags to cattle information

# Track unique RFID tags for IN (5 AM - 4 PM) and OUT (4 PM - 5 AM) periods
unique_rfid_in = set()  # Unique RFIDs for entries (morning: 5 AM - 4 PM)
unique_rfid_out = set()  # Unique RFIDs for exits (evening: 4 PM - 5 AM)
last_date_in = None  # Track date for IN period
last_date_out = None  # Track date for OUT period

# Map sensor IDs to RFID tags (so sensor1 and E3882528 are recognized as same cattle)
SENSOR_TO_RFID = {
    'sensor1': 'E3882528',  # Sensor 1 is attached to cattle with RFID E3882528
    # Add more mappings here as needed:
    # 'sensor2': 'RFID_TAG_2',
}

# Deduplication: Track recently processed MQTT messages to prevent duplicates
processed_messages = set()  # Store (topic, timestamp, cattle_id) tuples to detect duplicates
MAX_MESSAGE_HISTORY = 500  # Keep track of last N messages

mqtt_connected = False

# Rule-based detection parameters
ACTIVITY_THRESHOLD_LOW = 200   # Normal behavior threshold
ACTIVITY_THRESHOLD_MED = 400   # Medium activity threshold
ACTIVITY_THRESHOLD_HIGH = 600  # High activity/potential anomaly threshold

# Feature importance (simulated)
FEATURE_IMPORTANCE = {
    "acc_x": 0.35,
    "acc_y": 0.20,
    "acc_z": 0.15,
    "gyro_x": 0.12,
    "gyro_y": 0.10,
    "gyro_z": 0.08
}

def detect_anomaly(features):
    """
    Simplified rule-based anomaly detection
    
    Args:
        features: List containing [acc_x, acc_y, acc_z, gyro_x, gyro_y, gyro_z]
        
    Returns:
        dict with prediction, confidence, and important features
    """
    # Extract features
    acc_x, acc_y, acc_z, gyro_x, gyro_y, gyro_z = features
    
    # Calculate activity level (weighted by importance)
    activity_level = (
        abs(acc_x) * FEATURE_IMPORTANCE["acc_x"] + 
        abs(acc_y) * FEATURE_IMPORTANCE["acc_y"] + 
        abs(acc_z) * FEATURE_IMPORTANCE["acc_z"] +
        abs(gyro_x) * FEATURE_IMPORTANCE["gyro_x"] * 10 +  # Scale gyro values
        abs(gyro_y) * FEATURE_IMPORTANCE["gyro_y"] * 10 + 
        abs(gyro_z) * FEATURE_IMPORTANCE["gyro_z"] * 10
    )
    
    # Add some randomness for demonstration (simulate model uncertainty)
    random_factor = random.uniform(0.8, 1.2)
    activity_level *= random_factor
    
    # Determine prediction and confidence based on activity level
    if activity_level > ACTIVITY_THRESHOLD_HIGH:
        prediction = "Anomaly"
        confidence = min(95, 70 + (activity_level - ACTIVITY_THRESHOLD_HIGH) / 10)
    elif activity_level > ACTIVITY_THRESHOLD_MED:
        # Borderline case - could be normal or anomaly
        if random.random() < 0.3:  # 30% chance of being anomaly in this range
            prediction = "Anomaly"
            confidence = random.uniform(60, 75)
        else:
            prediction = "Normal"
            confidence = random.uniform(65, 85)
    else:
        prediction = "Normal"
        confidence = min(98, 80 + (ACTIVITY_THRESHOLD_LOW - activity_level) / 20)
    
    # Find top 3 contributing features
    feature_values = {
        "acc_x": abs(acc_x) * FEATURE_IMPORTANCE["acc_x"],
        "acc_y": abs(acc_y) * FEATURE_IMPORTANCE["acc_y"],
        "acc_z": abs(acc_z) * FEATURE_IMPORTANCE["acc_z"],
        "gyro_x": abs(gyro_x) * FEATURE_IMPORTANCE["gyro_x"] * 10,
        "gyro_y": abs(gyro_y) * FEATURE_IMPORTANCE["gyro_y"] * 10,
        "gyro_z": abs(gyro_z) * FEATURE_IMPORTANCE["gyro_z"] * 10
    }
    
    sorted_features = sorted(feature_values.items(), key=lambda x: x[1], reverse=True)
    important_features = [f[0] for f in sorted_features[:3]]
    
    return {
        "prediction": prediction,
        "confidence": round(confidence, 2),
        "important_features": important_features,
        "activity_level": round(activity_level, 2)
    }

# MQTT Event Handlers
def on_connect(client, userdata, flags, rc):
    """Callback for when the MQTT client connects to the broker"""
    global mqtt_connected
    if rc == 0:
        mqtt_connected = True
        print(f"Connected to MQTT broker with result code {rc}")
        
        # Subscribe to cattle data topics with QoS 1
        for topic_name, topic_pattern in MQTT_TOPICS.items():
            client.subscribe(topic_pattern, qos=1)
            print(f"Subscribed to {topic_name}: {topic_pattern}")
    else:
        mqtt_connected = False
        print(f"Failed to connect to MQTT broker, return code {rc}")

def on_disconnect(client, userdata, rc):
    """Callback for when the MQTT client disconnects from the broker"""
    global mqtt_connected
    mqtt_connected = False
    print(f"Disconnected from MQTT broker with result code {rc}")

def on_message(client, userdata, msg):
    """Callback for when a message is received from MQTT broker"""
    global latest_data
    
    try:
        # Parse the received message
        topic = msg.topic
        payload = msg.payload.decode('utf-8')
        
        print(f"Received message on topic {topic}: {payload}")
        
        # Try to parse JSON payload
        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            print(f"Failed to parse JSON payload: {payload}")
            return
        
        # Process different types of data based on topic
        if topic == "farm/environment":
            process_environmental_data(data, topic)
        elif topic == "farm/gate":
            process_gate_data(data, topic)
        elif topic == "farm/feed_monitor":
            process_feed_monitor_data(data, topic)
        elif "farm/" in topic or "sensors" in topic:
            process_sensor_data(data, topic)
        elif "health" in topic:
            process_health_data(data, topic)
            
    except Exception as e:
        print(f"Error processing MQTT message: {str(e)}")

# Assign event handlers
mqtt_client.on_connect = on_connect
mqtt_client.on_disconnect = on_disconnect
mqtt_client.on_message = on_message

def process_sensor_data(data, topic):
    """Process sensor data received from MQTT"""
    global latest_data
    
    try:
        # Extract sensor/cattle ID from topic
        topic_parts = topic.split('/')
        if "farm/" in topic:
            # For topics like "farm/sensor1" or "farm/cow001"
            cattle_id = topic_parts[1] if len(topic_parts) > 1 else "sensor1"
        elif "sensors" in topic:
            # For topics like "cattle/sensors/cow001/data"
            cattle_id = topic_parts[2] if len(topic_parts) > 2 else "unknown"
        else:
            cattle_id = "unknown"
        
        # If this sensor is mapped to an RFID tag, use the RFID instead
        if cattle_id in SENSOR_TO_RFID:
            cattle_id = SENSOR_TO_RFID[cattle_id]
        
        # Create standardized data structure
        timestamp = data.get('timestamp', datetime.now().isoformat())
        if isinstance(timestamp, str):
            # Try to parse timestamp if it's a string
            try:
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                formatted_time = dt.strftime("%Y-%m-%d %H:%M:%S")
            except:
                formatted_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        else:
            formatted_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Extract sensor values with defaults (support multiple formats)
        acc_x = float(data.get('acc_x', data.get('ax', data.get('accelerometer', {}).get('x', 0))))
        acc_y = float(data.get('acc_y', data.get('ay', data.get('accelerometer', {}).get('y', 0))))
        acc_z = float(data.get('acc_z', data.get('az', data.get('accelerometer', {}).get('z', 0))))
        gyro_x = float(data.get('gyro_x', data.get('gx', data.get('gyroscope', {}).get('x', 0))))
        gyro_y = float(data.get('gyro_y', data.get('gy', data.get('gyroscope', {}).get('y', 0))))
        gyro_z = float(data.get('gyro_z', data.get('gz', data.get('gyroscope', {}).get('z', 0))))
        
        sensor_data = {
            'timestamp': formatted_time,
            'cattle_id': cattle_id,
            'acc_x': acc_x,
            'acc_y': acc_y,
            'acc_z': acc_z,
            'gyro_x': gyro_x,
            'gyro_y': gyro_y,
            'gyro_z': gyro_z,
            'temperature': float(data.get('temperature', data.get('temp', data.get('t', 0)))),
        }
        
        # Store in buffer
        cattle_data_buffer.append(sensor_data)
        latest_data = sensor_data.copy()
        
        # Save to MongoDB
        if mongodb.connected:
            db_doc = SensorDataModel.create(
                cattle_id=cattle_id,
                acc_x=acc_x,
                acc_y=acc_y,
                acc_z=acc_z,
                gyro_x=gyro_x,
                gyro_y=gyro_y,
                gyro_z=gyro_z,
                topic=topic
            )
            doc_id = mongodb.insert_sensor_data(db_doc)
            if doc_id:
                sensor_data['_id'] = doc_id
        
        # Perform anomaly detection
        features = [acc_x, acc_y, acc_z, gyro_x, gyro_y, gyro_z]
        
        result = detect_anomaly(features)
        
        # Emit real-time update via WebSocket
        socketio.emit('sensor_update', {
            'data': sensor_data,
            'prediction': result["prediction"],
            'confidence': result["confidence"],
            'important_features': result["important_features"],
            'activity_level': result["activity_level"]
        })
        
        print(f"Processed sensor data for {cattle_id} at {formatted_time}")
        
    except Exception as e:
        print(f"Error processing sensor data: {str(e)}")

def process_health_data(data, topic):
    """Process health data received from MQTT"""
    try:
        # Extract cattle ID from topic
        cattle_id = topic.split('/')[2] if len(topic.split('/')) > 2 else "unknown"
        
        print(f"Received health data for {cattle_id}: {data}")
        
        # You can extend this to handle specific health metrics
        # For now, we'll just log it
        
    except Exception as e:
        print(f"Error processing health data: {str(e)}")

def process_environmental_data(data, topic):
    """Process environmental data received from MQTT"""
    global latest_environmental_data
    
    try:
        # Create standardized environmental data structure
        timestamp = data.get('timestamp', datetime.now().isoformat())
        
        # Handle timestamp formatting
        if timestamp:
            try:
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                formatted_time = dt.strftime("%Y-%m-%d %H:%M:%S")
            except:
                formatted_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        else:
            formatted_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Extract environmental values (matching incoming data format)
        ldr_raw = int(data.get('ldrValue', data.get('ldr_value', data.get('ldr', 0))))
        cattle_presence_str = data.get('cattlePresence', data.get('cattle_presence', 'false'))
        
        # Use day/night status directly from MQTT if available, otherwise calculate from LDR
        mqtt_is_day = data.get('isDay', data.get('dayNight', data.get('day_night', None)))
        if mqtt_is_day:
            # Convert MQTT format to our format
            if mqtt_is_day.lower() in ['day', 'true', '1']:
                day_night_status = 'day'
            else:
                day_night_status = 'night'
        else:
            day_night_status = 'day' if ldr_raw > 500 else 'night'
        
        environmental_data = {
            'timestamp': formatted_time,
            'ldr_value': ldr_raw,  # Light sensor (day/night)
            'env_temperature': float(data.get('temperature', data.get('dht11_temp', data.get('env_temp', 0)))),  # DHT11 temperature
            'humidity': float(data.get('humidity', data.get('dht11_humidity', 0))),  # DHT11 humidity
            'cattle_presence': cattle_presence_str == 'Cattle detected' or cattle_presence_str == True,  # Cattle detection
            'day_night': day_night_status  # Use MQTT day/night data directly
        }
        
        # Store in buffer
        environmental_data_buffer.append(environmental_data)
        latest_environmental_data = environmental_data.copy()
        
        # Save to MongoDB
        if mongodb.connected:
            zone = data.get('zone', 'unknown')
            db_doc = EnvironmentalDataModel.create(
                zone=zone,
                temperature=environmental_data['env_temperature'],
                humidity=environmental_data['humidity'],
                water_level=data.get('water_level', None),
                ph=data.get('ph', None),
                pump_status=data.get('pump_status', None),
                topic=topic
            )
            doc_id = mongodb.insert_environmental_data(db_doc)
            if doc_id:
                environmental_data['_id'] = doc_id
        
        # Emit real-time environmental update via WebSocket
        socketio.emit('environmental_update', {
            'data': environmental_data,
            'status': 'connected'
        })
        
        print(f"Processed environmental data at {formatted_time}: LDR={environmental_data['ldr_value']}, Temp={environmental_data['env_temperature']}°C, Humidity={environmental_data['humidity']}%, Presence={environmental_data['cattle_presence']}, Time={environmental_data['day_night']}")
        
    except Exception as e:
        print(f"Error processing environmental data: {str(e)}")

def process_feed_monitor_data(data, topic):
    """Process feed monitor data received from MQTT"""
    global latest_feed_data, processed_messages
    
    try:
        # DEBUG: Log the raw incoming data
        print(f"\n{'='*60}")
        print(f"🔍 RAW FEED DATA RECEIVED on topic '{topic}':")
        print(f"   Data: {json.dumps(data, indent=2)}")
        print(f"{'='*60}")
        
        # FILTER: Skip "no cattle detected" status messages
        if data.get('status') == 'no_cattle_detected':
            print(f"⏭️  FILTERED: No cattle detected message")
            return
        
        # Extract cattle ID and timestamp for deduplication
        cattle_id = data.get('cattleID', data.get('cattle_id', data.get('cattleName', 'unknown')))
        timestamp = data.get('timestamp', datetime.now().isoformat())
        
        # Get feed consumption to validate if this is real data
        feed_consumed = float(data.get('feedConsumed', data.get('feed_consumed', 0)))
        
        print(f"📋 Extracted Values:")
        print(f"   - cattle_id: '{cattle_id}'")
        print(f"   - feed_consumed: {feed_consumed}kg")
        print(f"   - timestamp: {timestamp}")
        
        # SKIP if no cattle detected AND no feed consumption (empty/idle message)
        # BUT allow "UNKNOWN" if there's actual feed consumption
        is_invalid_id = not cattle_id or cattle_id.lower() in ['no cattle', 'none', '']
        is_unknown_without_feed = cattle_id.lower() in ['unknown', 'no_cattle_detected'] and feed_consumed <= 0
        
        if is_invalid_id or is_unknown_without_feed:
            print(f"⏭️  FILTERED: Invalid cattle_id '{cattle_id}' with {feed_consumed}kg feed")
            print(f"   - is_invalid_id: {is_invalid_id}")
            print(f"   - is_unknown_without_feed: {is_unknown_without_feed}")
            return
        
        print(f"✅ PASSED initial filtering - proceeding to process...")
        
        # DEDUPLICATION: Check if we've already processed this exact message
        message_key = (topic, timestamp, cattle_id)
        if message_key in processed_messages:
            # Duplicate message - skip processing
            return
        
        # Add to processed messages set
        processed_messages.add(message_key)
        
        # Trim processed messages if too many stored
        if len(processed_messages) > MAX_MESSAGE_HISTORY:
            # Keep only recent messages
            processed_messages.clear()
            processed_messages.add(message_key)
        
        formatted_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Handle different MQTT payload formats
        # Format 1: Single cattle entry with cattleID and feedConsumed
        if 'cattleID' in data or 'cattle_id' in data or 'cattleName' in data:
            # feed_consumed already extracted above
            water_status = data.get('waterStatus', data.get('water_present', False))
            
            # Create activity entry with cattle identification
            activity = {
                'cattle_id': cattle_id,
                'rfid': cattle_id,
                'feed_consumed': feed_consumed,
                'water_present': bool(water_status),
                'timestamp': formatted_time
            }
            
            # Build standardized feed data
            feed_data = {
                'timestamp': formatted_time,
                'total_feed': feed_consumed,  # For single cattle entry
                'total_water': 0.0,
                'avg_feed_per_cattle': feed_consumed,
                'avg_water_per_cattle': 0.0,
                'recent_activity': [activity]
            }
        
        # Format 2: Aggregated format with total_feed, recent_activity array
        elif 'total_feed' in data or 'recent_activity' in data:
            recent_activities = data.get('recent_activity', [])
            
            # Normalize activity entries
            normalized_activities = []
            for act in recent_activities:
                normalized_activities.append({
                    'cattle_id': act.get('cattle_id', act.get('rfid', act.get('rfid_tag', 'unknown'))),
                    'rfid': act.get('rfid', act.get('rfid_tag', act.get('cattle_id', 'unknown'))),
                    'feed_consumed': float(act.get('feed_consumed', 0)),
                    'water_present': bool(act.get('water_present', False)),
                    'timestamp': formatted_time
                })
            
            feed_data = {
                'timestamp': formatted_time,
                'total_feed': float(data.get('total_feed', 0)),
                'total_water': float(data.get('total_water', 0)),
                'avg_feed_per_cattle': float(data.get('avg_feed_per_cattle', 0)),
                'avg_water_per_cattle': float(data.get('avg_water_per_cattle', 0)),
                'recent_activity': normalized_activities
            }
        else:
            # Unknown format, skip
            return
        
        # Add to buffer and update latest
        feed_monitor_buffer.append(feed_data)
        latest_feed_data = feed_data.copy()
        
        # Save individual cattle feed entries to MongoDB
        if mongodb.connected:
            for activity in feed_data.get('recent_activity', []):
                db_doc = FeedMonitorModel.create(
                    cattle_id=activity.get('cattle_id', 'unknown'),
                    rfid_tag=activity.get('rfid', None),
                    feed_consumed=float(activity.get('feed_consumed', 0)),
                    water_present=activity.get('water_present', False),
                    water_consumed=None,
                    feed_before=None,
                    feed_after=None,
                    topic=topic
                )
                mongodb.insert_feed_monitor_data(db_doc)
        
        # Emit real-time feed monitor update via WebSocket
        socketio.emit('feed_monitor_update', {
            'data': feed_data,
            'status': 'connected'
        })
        
        print(f"🍔 Feed Monitor: Cattle {cattle_id} consumed {feed_data['total_feed']}kg feed")
        
    except Exception as e:
        print(f"Error processing feed monitor data: {str(e)}")
        import traceback
        traceback.print_exc()

def process_gate_data(data, topic):
    """Process gate data (RFID + weight) received from MQTT"""
    global latest_gate_data, cattle_registry, unique_rfid_in, unique_rfid_out, last_date_in, last_date_out
    
    try:
        # Extract gate sensor values
        rfid_tag = data.get('rfidTag', data.get('rfid_tag', data.get('rfid', '')))
        
        # IGNORE messages with no RFID tag (e.g., "no_cattle_at_gate")
        # Only process messages that have an actual RFID tag
        if not rfid_tag or not rfid_tag.strip():
            return  # Skip this message - no RFID scanned
        
        # Create standardized gate data structure
        timestamp = data.get('timestamp', datetime.now().isoformat())
        
        # Handle timestamp formatting
        if timestamp:
            try:
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                formatted_time = dt.strftime("%Y-%m-%d %H:%M:%S")
            except:
                formatted_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        else:
            formatted_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        weight = float(data.get('weight', data.get('loadCell', data.get('load_cell', 0))))
        gate_status = data.get('gateStatus', data.get('gate_status', data.get('status', 'unknown')))
        
        # Get current IST time for date reset logic
        ist = timezone('Asia/Kolkata')
        current_time = datetime.now(ist)
        current_date = current_time.date()
        current_hour = current_time.hour
        
        # STRICT TIME-BASED LOGIC as requested by user
        # 5 AM to 4 PM (5:00 - 15:59) = IN (morning: cattle going to pasture)
        # 4 PM to 5 AM (16:00 - 4:59) = OUT (evening: cattle returning)
        
        if 5 <= current_hour < 16:
            direction = 'in'
            # Session date for IN is simply today
            session_date = current_date
            
            # Reset IN set if date changed
            if last_date_in != session_date:
                unique_rfid_in.clear()
                last_date_in = session_date
                
            # Add RFID to unique set for this period
            unique_rfid_in.add(rfid_tag)
            
        else:
            direction = 'out'
            # Session date for OUT needs to handle midnight crossover
            # If it's after 4 PM (>=16), session is today
            # If it's before 5 AM (<5), session belongs to yesterday's 4 PM start
            if current_hour >= 16:
                session_date = current_date
            else:
                session_date = current_date - timedelta(days=1)
                
            # Reset OUT set if session date changed
            if last_date_out != session_date:
                unique_rfid_out.clear()
                last_date_out = session_date
                
            # Add RFID to unique set for this period
            unique_rfid_out.add(rfid_tag)
        
        gate_data = {
            'timestamp': formatted_time,
            'rfid_tag': rfid_tag,
            'weight': weight,
            'gate_status': gate_status,
            'direction': direction,
            'cattle_id': rfid_tag  # Use RFID as cattle ID for now
        }
        
        # Update cattle registry with RFID -> weight mapping
        if rfid_tag and rfid_tag.strip() and weight > 0:
            if rfid_tag not in cattle_registry:
                cattle_registry[rfid_tag] = {
                    'rfid_tag': rfid_tag,
                    'latest_weight': weight,
                    'weight_history': [],
                    'first_seen': formatted_time,
                    'last_seen': formatted_time,
                    'total_entries': 0,
                    'total_exits': 0
                }
            else:
                cattle_registry[rfid_tag]['latest_weight'] = weight
                cattle_registry[rfid_tag]['last_seen'] = formatted_time
            
            # Add weight to history (keep last 10 readings)
            cattle_registry[rfid_tag]['weight_history'].append({
                'weight': weight,
                'timestamp': formatted_time
            })
            if len(cattle_registry[rfid_tag]['weight_history']) > 10:
                cattle_registry[rfid_tag]['weight_history'].pop(0)
        
        # Store in buffer
        gate_data_buffer.append(gate_data)
        latest_gate_data = gate_data.copy()
        
        # Save to MongoDB
        if mongodb.connected:
            db_doc = GateDataModel.create(
                cattle_id=rfid_tag or 'unknown',
                rfid_tag=rfid_tag,
                weight=weight,
                gate_status=gate_status,
                timestamp_readable=formatted_time,
                topic=topic
            )
            doc_id = mongodb.insert_gate_data(db_doc)
            if doc_id:
                gate_data['_id'] = doc_id
        
        # Emit real-time gate update via WebSocket
        socketio.emit('gate_update', {
            'data': gate_data,
            'registry': cattle_registry.get(rfid_tag, {}) if rfid_tag else {},
            'status': 'connected'
        })
        
        print(f"Processed gate data at {formatted_time}: RFID={rfid_tag}, Weight={weight}kg, Status={gate_status}, Direction={direction}")
        
    except Exception as e:
        print(f"Error processing gate data: {str(e)}")

def generate_simulated_data():
    """Generate simulated cattle data when MQTT is not available"""
    global latest_data
    
    while True:
        try:
            # Generate realistic sensor data
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            # Simulate different cattle with varying activity levels
            cattle_ids = ["cow001", "cow002", "cow003", "cow004", "cow005"]
            cattle_id = random.choice(cattle_ids)
            
            # Generate sensor values with some correlation
            base_activity = random.uniform(50, 800)  # Base activity level
            
            sensor_data = {
                'timestamp': timestamp,
                'cattle_id': cattle_id,
                'acc_x': random.uniform(-base_activity/10, base_activity/10),
                'acc_y': random.uniform(-base_activity/15, base_activity/15),
                'acc_z': random.uniform(-base_activity/20, base_activity/20),
                'gyro_x': random.uniform(-10, 10),
                'gyro_y': random.uniform(-8, 8),
                'gyro_z': random.uniform(-6, 6),
                'temperature': random.uniform(25.0, 30.0),  # Normal cattle temperature range
            }
            
            # Store in buffer
            cattle_data_buffer.append(sensor_data)
            latest_data = sensor_data.copy()
            
            # Perform anomaly detection
            features = [
                sensor_data['acc_x'], sensor_data['acc_y'], sensor_data['acc_z'],
                sensor_data['gyro_x'], sensor_data['gyro_y'], sensor_data['gyro_z']
            ]
            
            result = detect_anomaly(features)
            
            # Emit real-time update via WebSocket
            socketio.emit('sensor_update', {
                'data': sensor_data,
                'prediction': result["prediction"],
                'confidence': result["confidence"],
                'important_features': result["important_features"],
                'activity_level': result["activity_level"]
            })
            
            print(f"Emitted simulated data for {cattle_id} at {timestamp}")
            
            # Wait 2 seconds before next update
            time.sleep(2)
            
        except Exception as e:
            print(f"Error in simulated data generation: {str(e)}")
            time.sleep(5)

def start_mqtt_client():
    """Start the MQTT client in a separate thread"""
    # Check if simulation mode is enabled
    # Check if simulation mode is enabled
    if os.getenv('ENABLE_SIMULATION', 'False').lower() in ('true', '1', 'yes'):
        print("Simulation mode is DISABLED by user request. Proceeding with MQTT connection...")
        # generate_simulated_data()
        # return

    try:
        print(f"Attempting to connect to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}")
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        # Use loop_start() to run the network loop in a background thread
        mqtt_client.loop_start()
        # Keep the function running
        while True:
            time.sleep(1)
    except Exception as e:
        print(f"Error starting MQTT client: {str(e)}")
        # If MQTT connection fails, just log it and retry in a loop or exit
        print("MQTT connection failed. Retrying in 5 seconds...")
        time.sleep(5)
        start_mqtt_client()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for monitoring services"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'mqtt_connected': mqtt_connected,
        'version': '1.0.0',
        'service': 'CattleNet Smartfarm Backend'
    })

@app.route('/', methods=['GET'])
def home():
    """Root endpoint"""
    return jsonify({
        'message': 'CattleNet Smartfarm Backend API',
        'version': '1.0.0',
        'status': 'running',
        'endpoints': {
            'health': '/health',
            'data': '/api/data',
            'gate': '/api/gate',
            'environment': '/api/environment',
            'mqtt_status': '/api/mqtt-status'
        }
    })

# Flask API Routes
@app.route('/api/data', methods=['GET'])
def get_data():
    """Get recent cattle data from buffer"""
    try:
        # Convert deque to list and get last 10 entries
        data_list = list(cattle_data_buffer)
        recent_data = data_list[-10:] if len(data_list) >= 10 else data_list
        
        return jsonify({
            'status': 'success',
            'data': recent_data,
            'total_records': len(cattle_data_buffer),
            'mqtt_connected': mqtt_connected
        })
    
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f"An unexpected error occurred: {str(e)}"
        }), 500

@app.route('/api/latest', methods=['GET'])
def get_latest_data():
    """Get the latest cattle data point"""
    try:
        if not latest_data:
            return jsonify({
                'status': 'error',
                'message': 'No data available yet'
            }), 404
        
        # Perform anomaly detection on latest data
        features = [
            latest_data['acc_x'], latest_data['acc_y'], latest_data['acc_z'],
            latest_data['gyro_x'], latest_data['gyro_y'], latest_data['gyro_z']
        ]
        
        result = detect_anomaly(features)
        
        return jsonify({
            'status': 'success',
            'data': latest_data,
            'prediction': result["prediction"],
            'confidence': result["confidence"],
            'important_features': result["important_features"],
            'explanation': f"The model is {result['confidence']}% confident in its prediction. The most important factors were {', '.join(result['important_features'])}.",
            'mqtt_connected': mqtt_connected
        })
    
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f"An unexpected error occurred: {str(e)}"
        }), 500

@app.route('/api/predict', methods=['GET'])
def predict():
    """Make predictions based on the latest data"""
    try:
        if not latest_data:
            return jsonify({
                'status': 'success',
                'latest_data': {'acc_x': 0, 'acc_y': 0, 'acc_z': 0, 'gyro_x': 0, 'gyro_y': 0, 'gyro_z': 0},
                'prediction': 'Normal',
                'confidence': 0,
                'activity_level': 0,
                'important_features': [],
                'explanation': 'Waiting for sensor data...'
            }), 200
        
        # Extract features
        features = [
            latest_data['acc_x'], latest_data['acc_y'], latest_data['acc_z'],
            latest_data['gyro_x'], latest_data['gyro_y'], latest_data['gyro_z']
        ]
        
        # Use our rule-based anomaly detection
        result = detect_anomaly(features)
        
        return jsonify({
            'status': 'success',
            'latest_data': {
                'acc_x': features[0],
                'acc_y': features[1],
                'acc_z': features[2],
                'gyro_x': features[3],
                'gyro_y': features[4],
                'gyro_z': features[5],
            },
            'prediction': result["prediction"],
            'confidence': result["confidence"],
            'activity_level': result["activity_level"],
            'important_features': result["important_features"],
            'explanation': f"The model is {result['confidence']}% confident in its prediction. The most important factors were {', '.join(result['important_features'])}."
        })
    
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/health-stats', methods=['GET'])
def get_health_stats():
    """Get health statistics based on recent data"""
    try:
        if len(cattle_data_buffer) == 0:
            return jsonify({
                'status': 'success',
                'health_stats': {
                    'total_samples': 0,
                    'normal_count': 0,
                    'anomaly_count': 0,
                    'anomaly_percentage': 0,
                    'activity_levels': {'average': 0, 'maximum': 0, 'minimum': 0}
                }
            })
        
        # Aggregate data from buffer
        data_list = list(cattle_data_buffer)
        
        # 1. Total Cattle Count (Unique IDs from all sources: sensor, gate, feed)
        unique_cattle = set(d.get('cattle_id') for d in data_list if d.get('cattle_id'))
        
        # Also count unique RFID tags from gate data
        gate_list = list(gate_data_buffer)
        for d in gate_list:
            rfid = d.get('rfid_tag') or d.get('cattle_id')
            if rfid and rfid != 'unknown':
                unique_cattle.add(rfid)
        
        # Also count unique cattle from feed monitor data
        feed_list = list(feed_monitor_buffer)
        for d in feed_list:
            cattle_id = d.get('cattle_id') or d.get('rfid_tag')
            if cattle_id and cattle_id != 'unknown':
                unique_cattle.add(cattle_id)
        
        total_cattle = len(unique_cattle)
        
        # 2. Anomaly Detection & Healthy Percentage
        # We need to run anomaly detection on recent data for each cattle
        cattle_status = {}
        for d in data_list:
            cid = d.get('cattle_id')
            if not cid or cid in cattle_status:
                continue
                
            # Run detection on this reading
            features = [
                d.get('acc_x', 0), d.get('acc_y', 0), d.get('acc_z', 0),
                d.get('gyro_x', 0), d.get('gyro_y', 0), d.get('gyro_z', 0)
            ]
            result = detect_anomaly(features)
            cattle_status[cid] = result['prediction'] # "Normal" or "Anomaly"

        healthy_count = sum(1 for status in cattle_status.values() if status == 'Normal')
        anomaly_count = total_cattle - healthy_count
        healthy_percentage = round((healthy_count / total_cattle * 100), 1) if total_cattle > 0 else 0
        
        # 3. Average Temperature
        temps = [d.get('temperature') for d in data_list if d.get('temperature')]
        avg_temp = round(sum(temps) / len(temps), 1) if temps else 0
        
        # 4. Activity Score (Simple average of activity levels)
        # We'll re-calculate activity level for the sample
        activity_scores = []
        for d in data_list:
             features = [
                d.get('acc_x', 0), d.get('acc_y', 0), d.get('acc_z', 0),
                d.get('gyro_x', 0), d.get('gyro_y', 0), d.get('gyro_z', 0)
            ]
             # Re-use the logic from detect_anomaly but just get the score
             # Or just use a simplified magnitude check
             score = (abs(features[0]) + abs(features[1]) + abs(features[2])) * 10 # Rough scale
             activity_scores.append(score)
             
        avg_activity_score = int(sum(activity_scores) / len(activity_scores)) if activity_scores else 0
        
        # 5. Cattle Distribution for Pie Chart
        cattle_distribution = [
            {'name': 'Healthy', 'value': healthy_count, 'color': '#10B981'},
            {'name': 'Anomaly', 'value': anomaly_count, 'color': '#EF4444'}
        ]
        
        # 6. Activity Levels (Mocking time periods from recent buffer)
        # Since buffer is short, we'll just distribute current data into "Recent" buckets
        # In a real app, this would query historical DB
        activity_levels = [
            {'period': 'Recent', 'normal': healthy_count, 'anomaly': anomaly_count}
        ]

        return jsonify({
            'status': 'success',
            'health_stats': {
                'total_samples': len(data_list),
                'health_metrics': {
                    'total_cattle': total_cattle,
                    'healthy_percentage': healthy_percentage,
                    'average_temp': avg_temp,
                    'activity_score': min(100, avg_activity_score) # Cap at 100
                },
                'cattle_distribution': cattle_distribution,
                'activity_levels': activity_levels
            }
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500
 
@app.route('/api/test-data', methods=['POST'])
def test_data():
    """Analyze cattle data provided by user"""
    try:
        # Get the test data from request
        test_data_input = request.get_json()
        
        if not test_data_input:
            return jsonify({
                'status': 'error',
                'message': 'No test data provided'
            }), 400
            
        # Extract the features
        acc_x = float(test_data_input.get('acc_x', 0))
        acc_y = float(test_data_input.get('acc_y', 0))
        acc_z = float(test_data_input.get('acc_z', 0))
        gyro_x = float(test_data_input.get('gyro_x', 0))
        gyro_y = float(test_data_input.get('gyro_y', 0))
        gyro_z = float(test_data_input.get('gyro_z', 0))
        
        # Create features array
        features = [acc_x, acc_y, acc_z, gyro_x, gyro_y, gyro_z]
        
        # Use our detection function to analyze the data
        result = detect_anomaly(features)
        
        # Return the analysis results
        return jsonify({
            'status': 'success',
            'prediction': result['prediction'],
            'confidence': result['confidence'],
            'important_features': result['important_features'],
            'activity_level': result['activity_level'],
            'explanation': f"The model is {result['confidence']}% confident in its prediction. The most important factors were {', '.join(result['important_features'])}."
        })
    
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
 
@app.route('/api/mqtt-status', methods=['GET'])
def get_mqtt_status():
    """Get MQTT connection status"""
    return jsonify({
        'status': 'success',
        'mqtt_connected': mqtt_connected,
        'broker': MQTT_BROKER,
        'port': MQTT_PORT,
        'topics': MQTT_TOPICS,
        'data_count': len(cattle_data_buffer)
    })
@app.route('/api/temperature', methods=['GET'])
def get_temperature_stats():
    """Get temperature statistics from recent data"""
    try:
        if len(cattle_data_buffer) == 0:
            return jsonify({
                'status': 'error',
                'message': 'No data available for temperature statistics'
            }), 404
        
        # Extract temperature data from buffer
        data_list = list(cattle_data_buffer)
        temperatures = []
        cattle_temps = {}
        
        for data_point in data_list:
            temp = data_point.get('temperature', 0)
            if temp > 0:  # Only include valid temperature readings
                temperatures.append(temp)
                cattle_id = data_point.get('cattle_id', 'unknown')
                if cattle_id not in cattle_temps:
                    cattle_temps[cattle_id] = []
                cattle_temps[cattle_id].append(temp)
        
        if not temperatures:
            return jsonify({
                'status': 'error',
                'message': 'No valid temperature data available'
            }), 404
        
        # Calculate overall statistics
        avg_temp = round(sum(temperatures) / len(temperatures), 2)
        min_temp = round(min(temperatures), 2)
        max_temp = round(max(temperatures), 2)
        
        # Calculate per-cattle statistics
        cattle_stats = {}
        for cattle_id, temps in cattle_temps.items():
            if temps:
                cattle_stats[cattle_id] = {
                    'current': round(temps[-1], 2),  # Latest temperature
                    'average': round(sum(temps) / len(temps), 2),
                    'min': round(min(temps), 2),
                    'max': round(max(temps), 2),
                    'readings_count': len(temps)
                }
        
        # Temperature health assessment
        normal_range = {'min': 25.0, 'max': 30.0}
        alerts = []
        
        for cattle_id, stats in cattle_stats.items():
            current_temp = stats['current']
            if current_temp < normal_range['min']:
                alerts.append({
                    'cattle_id': cattle_id,
                    'type': 'low_temperature',
                    'message': f"Low temperature detected: {current_temp}°C"
                })
            elif current_temp > normal_range['max']:
                alerts.append({
                    'cattle_id': cattle_id,
                    'type': 'high_temperature',
                    'message': f"High temperature detected: {current_temp}°C"
                })
        
        return jsonify({
            'status': 'success',
            'overall_stats': {
                'average': avg_temp,
                'minimum': min_temp,
                'maximum': max_temp,
                'total_readings': len(temperatures)
            },
            'cattle_stats': cattle_stats,
            'normal_range': normal_range,
            'alerts': alerts,
            'mqtt_connected': mqtt_connected
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/environment', methods=['GET'])
def get_environmental_data():
    """Get environmental data (LDR, DHT11, cattle presence)"""
    try:
        if len(environmental_data_buffer) == 0:
            return jsonify({
                'status': 'error',
                'message': 'No environmental data available'
            }), 404
        
        # Extract environmental data from buffer
        data_list = list(environmental_data_buffer)
        
        # Get latest data
        latest = latest_environmental_data if latest_environmental_data else {}
        
        # Calculate statistics
        ldr_values = [d['ldr_value'] for d in data_list]
        temperatures = [d['env_temperature'] for d in data_list if d['env_temperature'] > 0]
        humidity_values = [d['humidity'] for d in data_list if d['humidity'] > 0]
        
        # Day/night detection based on recent LDR readings
        recent_ldr = ldr_values[-5:] if len(ldr_values) >= 5 else ldr_values
        avg_ldr = sum(recent_ldr) / len(recent_ldr) if recent_ldr else 0
        day_night_status = 'day' if avg_ldr > 500 else 'night'
        
        # Environmental statistics
        stats = {
            'current_ldr': latest.get('ldr_value', 0),
            'current_env_temp': latest.get('env_temperature', 0),
            'current_humidity': latest.get('humidity', 0),
            'current_presence': latest.get('cattle_presence', False),
            'day_night_status': day_night_status,
            'avg_ldr': round(avg_ldr, 2) if ldr_values else 0,
            'avg_env_temp': round(sum(temperatures) / len(temperatures), 2) if temperatures else 0,
            'avg_humidity': round(sum(humidity_values) / len(humidity_values), 2) if humidity_values else 0,
            'readings_count': len(data_list)
        }
        
        # Environmental alerts
        alerts = []
        if latest.get('env_temperature', 0) > 35:
            alerts.append({
                'type': 'high_env_temperature',
                'message': f"High environmental temperature: {latest.get('env_temperature')}°C"
            })
        elif latest.get('env_temperature', 0) < 10:
            alerts.append({
                'type': 'low_env_temperature', 
                'message': f"Low environmental temperature: {latest.get('env_temperature')}°C"
            })
            
        if latest.get('humidity', 0) > 80:
            alerts.append({
                'type': 'high_humidity',
                'message': f"High humidity detected: {latest.get('humidity')}%"
            })
        elif latest.get('humidity', 0) < 30:
            alerts.append({
                'type': 'low_humidity',
                'message': f"Low humidity detected: {latest.get('humidity')}%"
            })
        
        return jsonify({
            'status': 'success',
            'latest_data': latest,
            'statistics': stats,
            'alerts': alerts,
            'historical_data': data_list[-10:],  # Last 10 readings
            'mqtt_connected': mqtt_connected
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/integrated-data', methods=['GET'])
def get_integrated_data():
    """Get integrated cattle and environmental data"""
    try:
        # Get latest cattle sensor data
        cattle_data = latest_data if latest_data else {}
        
        # Get latest environmental data
        env_data = latest_environmental_data if latest_environmental_data else {}
        
        # Combine both datasets
        integrated_data = {
            'timestamp': cattle_data.get('timestamp') or env_data.get('timestamp') or datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            
            # Cattle sensor data
            'cattle_sensors': {
                'cattle_id': cattle_data.get('cattle_id', 'unknown'),
                'accelerometer': {
                    'x': cattle_data.get('acc_x', 0),
                    'y': cattle_data.get('acc_y', 0), 
                    'z': cattle_data.get('acc_z', 0)
                },
                'gyroscope': {
                    'x': cattle_data.get('gyro_x', 0),
                    'y': cattle_data.get('gyro_y', 0),
                    'z': cattle_data.get('gyro_z', 0)
                },
                'body_temperature': cattle_data.get('temperature', 0)
            },
            
            # Environmental data
            'environment': {
                'light_level': env_data.get('ldr_value', 0),
                'day_night': env_data.get('day_night', 'unknown'),
                'ambient_temperature': env_data.get('env_temperature', 0),
                'humidity': env_data.get('humidity', 0),
                'cattle_presence': env_data.get('cattle_presence', False)
            },
            
            # Data availability flags
            'data_availability': {
                'cattle_sensors_available': bool(cattle_data),
                'environmental_data_available': bool(env_data),
                'both_available': bool(cattle_data and env_data)
            },
            
            # Combined statistics
            'statistics': {
                'cattle_readings_count': len(cattle_data_buffer),
                'environmental_readings_count': len(environmental_data_buffer),
                'temperature_difference': abs(cattle_data.get('temperature', 0) - env_data.get('env_temperature', 0)) if cattle_data and env_data else 0
            }
        }
        
        # Add health prediction if cattle data is available
        if cattle_data:
            features = [
                cattle_data.get('acc_x', 0), cattle_data.get('acc_y', 0), cattle_data.get('acc_z', 0),
                cattle_data.get('gyro_x', 0), cattle_data.get('gyro_y', 0), cattle_data.get('gyro_z', 0)
            ]
            result = detect_anomaly(features)
            integrated_data['health_prediction'] = {
                'prediction': result["prediction"],
                'confidence': result["confidence"],
                'important_features': result["important_features"]
            }
        
        return jsonify({
            'status': 'success',
            'data': integrated_data,
            'mqtt_connected': mqtt_connected
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/gate', methods=['GET'])
def get_gate_data():
    """Get gate data (RFID + weight readings)"""
    try:
        if len(gate_data_buffer) == 0:
            return jsonify({
                'status': 'error',
                'message': 'No gate data available'
            }), 404
        
        # Extract gate data from buffer
        data_list = list(gate_data_buffer)
        
        # Get latest data
        latest = latest_gate_data if latest_gate_data else {}
        
        # Calculate statistics based on unique RFID counts
        total_entries = len(unique_rfid_in)  # Count of unique RFIDs in morning period
        total_exits = len(unique_rfid_out)   # Count of unique RFIDs in evening period
        
        # Get recent activity (last 10 readings)
        recent_activity = data_list[-10:] if len(data_list) >= 10 else data_list
        
        # Weight statistics
        weights = [d['weight'] for d in data_list if d.get('weight', 0) > 0]
        weight_stats = {}
        if weights:
            weight_stats = {
                'average': round(sum(weights) / len(weights), 2),
                'minimum': round(min(weights), 2),
                'maximum': round(max(weights), 2),
                'total_readings': len(weights)
            }
        
        # Gate alerts
        alerts = []
        if latest.get('weight', 0) > 800:  # Heavy cattle alert
            alerts.append({
                'type': 'heavy_cattle',
                'message': f"Heavy cattle detected: {latest.get('weight')}kg"
            })
        elif latest.get('weight', 0) > 0 and latest.get('weight', 0) < 200:  # Light cattle alert
            alerts.append({
                'type': 'light_cattle',
                'message': f"Unusually light reading: {latest.get('weight')}kg"
            })
        
        return jsonify({
            'status': 'success',
            'latest_data': latest,
            'statistics': {
                'total_entries': total_entries,
                'total_exits': total_exits,
                'total_readings': len(data_list),
                'weight_stats': weight_stats
            },
            'cattle_registry': cattle_registry,
            'recent_activity': recent_activity,
            'alerts': alerts,
            'mqtt_connected': mqtt_connected
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/feed-monitor', methods=['GET'])
def get_feed_monitor_data():
    """Get feed and water consumption data"""
    try:
        # Try to get data from MongoDB first
        if mongodb.connected:
            data_list = mongodb.get_feed_monitor_data(limit=20)
            # Convert ObjectId and datetime for JSON serialization
            for doc in data_list:
                if '_id' in doc:
                    doc['_id'] = str(doc['_id'])
                if 'timestamp' in doc and isinstance(doc['timestamp'], datetime):
                    doc['timestamp'] = doc['timestamp'].isoformat()
        else:
            # Fallback to in-memory buffer
            data_list = list(feed_monitor_buffer)[-20:]
        
        # Build response from buffer data
        latest = {}
        if data_list:
            # Calculate aggregates from recent data
            # Calculate aggregates from recent data
            total_feed = sum((d.get('feed_consumed') or 0) for d in data_list)
            total_water = sum((d.get('water_consumed') or 0) for d in data_list)
            count = len(data_list)
            
            latest = {
                'total_feed': round(total_feed, 2),
                'total_water': round(total_water, 2),
                'avg_feed_per_cattle': round(total_feed / count, 2) if count > 0 else 0,
                'avg_water_per_cattle': round(total_water / count, 2) if count > 0 else 0,
                'recent_activity': data_list
            }
        else:
            latest = {
                'total_feed': 0,
                'total_water': 0,
                'avg_feed_per_cattle': 0,
                'avg_water_per_cattle': 0,
                'recent_activity': []
            }
        
        return jsonify({
            'status': 'success',
            'latest_data': latest,
            'statistics': {
                'total_readings': len(data_list),
            },
            'mqtt_connected': mqtt_connected
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/gate/cattle/<rfid_tag>', methods=['GET'])
def get_cattle_details(rfid_tag):
    """Get detailed information for a specific cattle by RFID tag"""
    try:
        if rfid_tag not in cattle_registry:
            return jsonify({
                'status': 'error',
                'message': f'No data found for RFID tag: {rfid_tag}'
            }), 404
        
        cattle_info = cattle_registry[rfid_tag]
        
        # Get gate activities for this cattle
        cattle_activities = [d for d in list(gate_data_buffer) if d.get('rfid_tag') == rfid_tag]
        
        return jsonify({
            'status': 'success',
            'cattle_info': cattle_info,
            'activities': cattle_activities[-20:],  # Last 20 activities
            'activity_count': len(cattle_activities)
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# ==================== MongoDB Data Retrieval APIs ====================

@app.route('/api/db/status', methods=['GET'])
def get_db_status():
    """Get MongoDB connection status and database statistics"""
    try:
        stats = mongodb.get_statistics_summary() if mongodb.connected else {}
        return jsonify({
            'status': 'success',
            'mongodb_connected': mongodb.connected,
            'mongodb_uri': mongodb.mongo_uri if mongodb.connected else None,
            'database': mongodb.db_name if mongodb.connected else None,
            'collections': stats
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/db/cattle', methods=['GET'])
def get_all_cattle_db():
    """Get list of all cattle IDs from database"""
    try:
        cattle_ids = mongodb.get_all_cattle() if mongodb.connected else []
        return jsonify({
            'status': 'success',
            'cattle_ids': cattle_ids,
            'total_count': len(cattle_ids)
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/db/sensor-data/<cattle_id>', methods=['GET'])
def get_cattle_sensor_data(cattle_id):
    """Get sensor data for a specific cattle"""
    try:
        hours = request.args.get('hours', 24, type=int)
        limit = request.args.get('limit', 100, type=int)
        
        if not mongodb.connected:
            return jsonify({
                'status': 'error',
                'message': 'MongoDB not connected'
            }), 503
        
        data = mongodb.get_sensor_data(cattle_id, hours=hours, limit=limit)
        
        # Convert datetime to string for JSON serialization
        for doc in data:
            if 'timestamp' in doc:
                doc['timestamp'] = doc['timestamp'].isoformat()
            if '_id' in doc:
                doc['_id'] = str(doc['_id'])
        
        return jsonify({
            'status': 'success',
            'cattle_id': cattle_id,
            'period_hours': hours,
            'records_count': len(data),
            'data': data
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/db/feed-monitor', methods=['GET'])
def get_feed_monitor_data_db():
    """Get all recent feed monitor data from database"""
    try:
        hours = request.args.get('hours', 24, type=int)
        limit = request.args.get('limit', 100, type=int)
        
        if not mongodb.connected:
            return jsonify({
                'status': 'error',
                'message': 'MongoDB not connected'
            }), 503
        
        data = mongodb.get_feed_monitor_data(hours=hours, limit=limit)
        
        # Convert datetime to string for JSON serialization
        for doc in data:
            if 'timestamp' in doc:
                doc['timestamp'] = doc['timestamp'].isoformat()
            if '_id' in doc:
                doc['_id'] = str(doc['_id'])
        
        return jsonify({
            'status': 'success',
            'period_hours': hours,
            'records_count': len(data),
            'data': data
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/db/gate-data', methods=['GET'])
def get_gate_data_db():
    """Get gate/RFID data from database"""
    try:
        hours = request.args.get('hours', 24, type=int)
        limit = request.args.get('limit', 200, type=int)
        
        if not mongodb.connected:
            return jsonify({
                'status': 'error',
                'message': 'MongoDB not connected'
            }), 503
        
        data = mongodb.get_gate_data(hours=hours, limit=limit)
        
        # Convert datetime to string for JSON serialization
        for doc in data:
            if 'timestamp' in doc:
                doc['timestamp'] = doc['timestamp'].isoformat()
            if '_id' in doc:
                doc['_id'] = str(doc['_id'])
        
        return jsonify({
            'status': 'success',
            'period_hours': hours,
            'records_count': len(data),
            'data': data
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/db/environmental-data', methods=['GET'])
def get_environmental_data_db():
    """Get environmental data from database"""
    try:
        zone = request.args.get('zone', None)
        hours = request.args.get('hours', 24, type=int)
        limit = request.args.get('limit', 100, type=int)
        
        if not mongodb.connected:
            return jsonify({
                'status': 'error',
                'message': 'MongoDB not connected'
            }), 503
        
        data = mongodb.get_environmental_data(zone=zone, hours=hours, limit=limit)
        
        # Convert datetime to string for JSON serialization
        for doc in data:
            if 'timestamp' in doc:
                doc['timestamp'] = doc['timestamp'].isoformat()
            if '_id' in doc:
                doc['_id'] = str(doc['_id'])
        
        return jsonify({
            'status': 'success',
            'zone': zone or 'all',
            'period_hours': hours,
            'records_count': len(data),
            'data': data
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/db/cattle-stats/<cattle_id>', methods=['GET'])
def get_cattle_stats_db(cattle_id):
    """Get aggregated statistics for a specific cattle"""
    try:
        hours = request.args.get('hours', 24, type=int)
        
        if not mongodb.connected:
            return jsonify({
                'status': 'error',
                'message': 'MongoDB not connected'
            }), 503
        
        stats = mongodb.get_cattle_stats(cattle_id, hours=hours)
        
        # Convert datetime to string for JSON serialization
        if stats.get('feed_stats') and 'timestamp' in stats['feed_stats']:
            stats['feed_stats']['timestamp'] = stats['feed_stats']['timestamp'].isoformat()
        
        return jsonify({
            'status': 'success',
            'data': stats
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/db/export/<data_type>', methods=['GET'])
def export_data(data_type):
    """Export data in various formats (json, csv)"""
    try:
        format_type = request.args.get('format', 'json')
        hours = request.args.get('hours', 24, type=int)
        
        if not mongodb.connected:
            return jsonify({
                'status': 'error',
                'message': 'MongoDB not connected'
            }), 503
        
        # Fetch appropriate data based on type
        if data_type == 'feed_monitor':
            data = mongodb.get_feed_monitor_data(hours=hours, limit=10000)
        elif data_type == 'gate':
            data = mongodb.get_gate_data(hours=hours, limit=10000)
        elif data_type == 'environmental':
            data = mongodb.get_environmental_data(hours=hours, limit=10000)
        else:
            return jsonify({
                'status': 'error',
                'message': f'Unknown data type: {data_type}'
            }), 400
        
        # Convert datetime to string
        for doc in data:
            if 'timestamp' in doc:
                doc['timestamp'] = doc['timestamp'].isoformat()
            if '_id' in doc:
                doc['_id'] = str(doc['_id'])
        
        if format_type == 'json':
            return jsonify({
                'status': 'success',
                'data_type': data_type,
                'records_count': len(data),
                'data': data
            })
        elif format_type == 'csv':
            # Convert to CSV - basic implementation
            if not data:
                return jsonify({'status': 'error', 'message': 'No data to export'}), 404
            
            import csv
            from io import StringIO
            
            output = StringIO()
            fieldnames = list(data[0].keys())
            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(data)
            
            return output.getvalue(), 200, {
                'Content-Disposition': f'attachment; filename={data_type}_{hours}h.csv',
                'Content-Type': 'text/csv'
            }
        else:
            return jsonify({
                'status': 'error',
                'message': f'Unsupported format: {format_type}'
            }), 400
            

    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# WebSocket Event Handlers
@socketio.on('connect')
def handle_connect():
    """Handle client connection to WebSocket"""
    print('Client connected')
    emit('connection_response', {
        'status': 'connected',
        'mqtt_status': mqtt_connected
    })

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection from WebSocket"""
    print('Client disconnected')

# Initialize services immediately when app is imported (required for Gunicorn/Vercel)
print("Initializing services...")
try:
    if mongodb.connect():
        print("[OK] MongoDB database initialized")
    else:
        print("[WARN] MongoDB not available - running in memory-only mode")
except Exception as e:
    print(f"[ERROR] Failed to connect to MongoDB: {e}")

# Start the MQTT client in a separate thread
# Note: On Vercel, this background thread may be frozen between requests
try:
    mqtt_thread = threading.Thread(target=start_mqtt_client, daemon=True)
    mqtt_thread.start()
except Exception as e:
    print(f"[ERROR] Failed to start MQTT thread: {e}")

if __name__ == '__main__':
    try:
        # Get configuration from environment
        host = os.getenv('HOST', '127.0.0.1')
        port = int(os.getenv('PORT', 5001))
        debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
        
        print(f"Starting CattleNet Smartfarm Backend on {host}:{port}")
        print("MQTT Integration enabled")
        print("Press Ctrl+C to quit")
        
        # Run the SocketIO server
        print("About to start SocketIO server...")
        socketio.run(app, 
                    debug=debug, 
                    host='0.0.0.0', 
                    port=port, 
                    allow_unsafe_werkzeug=True)
    except Exception as e:
        print(f"Error starting server: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        # Cleanup on shutdown
        if mongodb.connected:
            mongodb.disconnect()
