from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import paho.mqtt.client as mqtt
import numpy as np
from datetime import datetime
import os
import time
import threading
import random
import json
from collections import deque

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
socketio = SocketIO(app, cors_allowed_origins="*")  # Enable SocketIO with CORS

# MQTT Configuration
MQTT_BROKER = "broker.emqx.io"  # Public EMQX broker
MQTT_PORT = 1883
MQTT_TOPICS = {
    "cattle_data": "farm/sensor1",           # Specific topic for farm sensor data
    "cattle_sensors": "farm/+",             # Topic pattern for multiple farm sensors
    "cattle_health": "cattle/health/+",     # Topic pattern for health data
    "environment": "farm/environment",       # Environmental data (LDR, DHT11, presence)
    "gate": "farm/gate",                    # Gate data (RFID + load cell)
}

# Data storage (in-memory for now)
# Using deque for efficient FIFO operations
cattle_data_buffer = deque(maxlen=100)  # Store last 100 readings
environmental_data_buffer = deque(maxlen=50)  # Store last 50 environmental readings
gate_data_buffer = deque(maxlen=200)  # Store last 200 gate readings
latest_data = {}
latest_environmental_data = {}
latest_gate_data = {}
cattle_registry = {}  # Maps RFID tags to cattle information
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
        
        # Subscribe to cattle data topics
        for topic_name, topic_pattern in MQTT_TOPICS.items():
            client.subscribe(topic_pattern)
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
        elif "farm/" in topic or "sensors" in topic:
            process_sensor_data(data, topic)
        elif "health" in topic:
            process_health_data(data, topic)
            
    except Exception as e:
        print(f"Error processing MQTT message: {str(e)}")

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
        sensor_data = {
            'timestamp': formatted_time,
            'cattle_id': cattle_id,
            'acc_x': float(data.get('acc_x', data.get('ax', data.get('accelerometer', {}).get('x', 0)))),
            'acc_y': float(data.get('acc_y', data.get('ay', data.get('accelerometer', {}).get('y', 0)))),
            'acc_z': float(data.get('acc_z', data.get('az', data.get('accelerometer', {}).get('z', 0)))),
            'gyro_x': float(data.get('gyro_x', data.get('gx', data.get('gyroscope', {}).get('x', 0)))),
            'gyro_y': float(data.get('gyro_y', data.get('gy', data.get('gyroscope', {}).get('y', 0)))),
            'gyro_z': float(data.get('gyro_z', data.get('gz', data.get('gyroscope', {}).get('z', 0)))),
            'temperature': float(data.get('temperature', data.get('temp', data.get('t', 0)))),
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
        
        # Emit real-time environmental update via WebSocket
        socketio.emit('environmental_update', {
            'data': environmental_data,
            'status': 'connected'
        })
        
        print(f"Processed environmental data at {formatted_time}: LDR={environmental_data['ldr_value']}, Temp={environmental_data['env_temperature']}°C, Humidity={environmental_data['humidity']}%, Presence={environmental_data['cattle_presence']}, Time={environmental_data['day_night']}")
        
    except Exception as e:
        print(f"Error processing environmental data: {str(e)}")

def process_gate_data(data, topic):
    """Process gate data (RFID + weight) received from MQTT"""
    global latest_gate_data, cattle_registry
    
    try:
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
        
        # Extract gate sensor values
        rfid_tag = data.get('rfidTag', data.get('rfid_tag', data.get('rfid', '')))
        weight = float(data.get('weight', data.get('loadCell', data.get('load_cell', 0))))
        gate_status = data.get('gateStatus', data.get('gate_status', data.get('status', 'unknown')))
        direction = data.get('direction', data.get('entry_exit', 'unknown'))  # in/out/unknown
        
        gate_data = {
            'timestamp': formatted_time,
            'rfid_tag': rfid_tag,
            'weight': weight,
            'gate_status': gate_status,
            'direction': direction,
            'cattle_id': rfid_tag  # Use RFID as cattle ID for now
        }
        
        # Update cattle registry with RFID -> weight mapping
        if rfid_tag and weight > 0:
            if rfid_tag not in cattle_registry:
                cattle_registry[rfid_tag] = {
                    'rfid_tag': rfid_tag,
                    'latest_weight': weight,
                    'weight_history': [],
                    'first_seen': formatted_time,
                    'last_seen': formatted_time,
                    'total_entries': 0
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
            
            # Count entries
            if direction.lower() == 'in':
                cattle_registry[rfid_tag]['total_entries'] += 1
        
        # Store in buffer
        gate_data_buffer.append(gate_data)
        latest_gate_data = gate_data.copy()
        
        # Emit real-time gate update via WebSocket
        socketio.emit('gate_update', {
            'data': gate_data,
            'registry': cattle_registry.get(rfid_tag, {}) if rfid_tag else {},
            'status': 'connected'
        })
        
        print(f"Processed gate data at {formatted_time}: RFID={rfid_tag}, Weight={weight}kg, Status={gate_status}, Direction={direction}")
        
    except Exception as e:
        print(f"Error processing gate data: {str(e)}")

# Initialize MQTT Client
mqtt_client = mqtt.Client()
mqtt_client.on_connect = on_connect
mqtt_client.on_disconnect = on_disconnect
mqtt_client.on_message = on_message

def start_mqtt_client():
    """Start the MQTT client in a separate thread"""
    try:
        print(f"Attempting to connect to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}")
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.loop_forever()
    except Exception as e:
        print(f"Error starting MQTT client: {str(e)}")
        # If MQTT connection fails, start simulated data generation
        print("Starting simulated data generation instead...")
        generate_simulated_data()

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
                'status': 'error',
                'message': 'No data available for prediction'
            }), 404
        
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
                'status': 'error',
                'message': 'No data available for health statistics'
            }), 404
        
        # Process recent data for statistics
        normal_count = 0
        anomaly_count = 0
        activity_levels = []
        
        data_list = list(cattle_data_buffer)
        
        for data_point in data_list:
            # Extract features
            features = [
                data_point['acc_x'], data_point['acc_y'], data_point['acc_z'],
                data_point['gyro_x'], data_point['gyro_y'], data_point['gyro_z']
            ]
            
            # Use our rule-based detection
            result = detect_anomaly(features)
            
            # Update counters
            if result["prediction"] == "Anomaly":
                anomaly_count += 1
            else:
                normal_count += 1
                
            # Add activity level to our list
            activity_levels.append(result["activity_level"])
        
        # Calculate statistics
        total_samples = len(data_list)
        anomaly_percentage = round((anomaly_count / total_samples) * 100, 2) if total_samples > 0 else 0
        avg_activity = round(sum(activity_levels) / len(activity_levels), 2) if activity_levels else 0
        max_activity = round(max(activity_levels), 2) if activity_levels else 0
        min_activity = round(min(activity_levels), 2) if activity_levels else 0
        
        # Use the pre-defined feature importance
        importances = [(name, importance) for name, importance in FEATURE_IMPORTANCE.items()]
        importances.sort(key=lambda x: x[1], reverse=True)
        
        return jsonify({
            'status': 'success',
            'health_stats': {
                'total_samples': total_samples,
                'normal_count': normal_count,
                'anomaly_count': anomaly_count,
                'anomaly_percentage': anomaly_percentage,
                'activity_levels': {
                    'average': avg_activity,
                    'maximum': max_activity,
                    'minimum': min_activity
                }
            },
            'model_info': {
                'feature_importance': [{
                    'feature': feature,
                    'importance': round(importance * 100, 2)
                } for feature, importance in importances],
                'n_estimators': 100,
                'model_type': 'Rule-based Anomaly Detection with MQTT Data'
            },
            'mqtt_status': {
                'connected': mqtt_connected,
                'broker': MQTT_BROKER,
                'port': MQTT_PORT
            }
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/test-data', methods=['POST'])
def test_data():
    """Analyze cattle data provided by user"""
    try:
        # Get the test data from request
        test_data = request.get_json()
        
        if not test_data:
            return jsonify({
                'status': 'error',
                'message': 'No test data provided'
            }), 400
            
        # Extract the features
        acc_x = float(test_data.get('acc_x', 0))
        acc_y = float(test_data.get('acc_y', 0))
        acc_z = float(test_data.get('acc_z', 0))
        gyro_x = float(test_data.get('gyro_x', 0))
        gyro_y = float(test_data.get('gyro_y', 0))
        gyro_z = float(test_data.get('gyro_z', 0))
        
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
        
        # Calculate statistics
        total_entries = len([d for d in data_list if d.get('direction') == 'in'])
        total_exits = len([d for d in data_list if d.get('direction') == 'out'])
        unique_cattle = len(set([d['rfid_tag'] for d in data_list if d.get('rfid_tag')]))
        
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
                'unique_cattle': unique_cattle,
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

if __name__ == '__main__':
    try:
        # Start the MQTT client in a separate thread
        mqtt_thread = threading.Thread(target=start_mqtt_client, daemon=True)
        mqtt_thread.start()
        
        print("Starting Flask server on http://127.0.0.1:5000")
        print("MQTT Integration enabled")
        print("Press Ctrl+C to quit")
        
        # Run the SocketIO server
        socketio.run(app, debug=True, host='127.0.0.1', port=5000, allow_unsafe_werkzeug=True)
    except Exception as e:
        print(f"Error starting server: {str(e)}")
        import traceback
        traceback.print_exc()