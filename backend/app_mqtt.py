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
from db_client import MongoDBClient

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
socketio = SocketIO(app, cors_allowed_origins="*")  # Enable SocketIO with CORS

# Initialize MongoDB client
mongodb = MongoDBClient()
mongodb.connect()

# MQTT Configuration
MQTT_BROKER = "localhost"  # Change this to your MQTT broker address
MQTT_PORT = 1883
MQTT_TOPICS = {
    "sensor_data": "farm/sensor1",
    "feed_monitor": "farm/feed_monitor",
    "gate": "farm/gate",
    "environment": "farm/environment"
}

# Data storage (in-memory for now)
# Using deque for efficient FIFO operations
cattle_data_buffer = deque(maxlen=100)  # Store last 100 readings
latest_data = {}
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
        
        # Route based on topic
        if topic == "farm/sensor1":
            process_sensor_data(data, topic)
        elif topic == "farm/feed_monitor":
            process_feed_monitor_data(data, topic)
        elif topic == "farm/gate":
            process_gate_data(data, topic)
        elif topic == "farm/environment":
            process_environmental_data(data, topic)
        else:
            print(f"Unknown topic: {topic}")
            
    except Exception as e:
        print(f"Error processing MQTT message: {str(e)}")

def process_sensor_data(data, topic):
    """Process sensor data received from MQTT"""
    global latest_data
    
    try:
        # Extract cattle ID from topic (e.g., cattle/sensors/cow001/data -> cow001)
        cattle_id = topic.split('/')[2] if len(topic.split('/')) > 2 else "unknown"
        
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
        
        # Extract sensor values with defaults
        sensor_data = {
            'timestamp': formatted_time,
            'cattle_id': cattle_id,
            'acc_x': float(data.get('acc_x', data.get('accelerometer', {}).get('x', 0))),
            'acc_y': float(data.get('acc_y', data.get('accelerometer', {}).get('y', 0))),
            'acc_z': float(data.get('acc_z', data.get('accelerometer', {}).get('z', 0))),
            'gyro_x': float(data.get('gyro_x', data.get('gyroscope', {}).get('x', 0))),
            'gyro_y': float(data.get('gyro_y', data.get('gyroscope', {}).get('y', 0))),
            'gyro_z': float(data.get('gyro_z', data.get('gyroscope', {}).get('z', 0))),
        }
        
        # Store in buffer
        cattle_data_buffer.append(sensor_data)
        latest_data = sensor_data.copy()
        
        # Save to MongoDB
        if mongodb.connected:
            sensor_data['timestamp'] = datetime.now()  # Use datetime object for MongoDB
            mongodb.insert_sensor_data(sensor_data)
            print(f"✓ Saved sensor data to MongoDB for {cattle_id}")
        
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

def process_feed_monitor_data(data, topic):
    """Process feed monitor data received from MQTT"""
    try:
        timestamp = data.get('timestamp', datetime.now().isoformat())
        
        # Create feed monitor data structure
        feed_data = {
            'timestamp': datetime.now(),
            'cattle_id': data.get('cattle_id', 'unknown'),
            'rfid_tag': data.get('rfid_tag', ''),
            'feed_consumed': float(data.get('feed_consumed', 0)),
            'water_consumed': float(data.get('water_consumed', 0)),
            'duration': float(data.get('duration', 0)),
        }
        
        # Save to MongoDB
        if mongodb.connected:
            mongodb.insert_feed_monitor_data(feed_data)
            print(f"✓ Saved feed monitor data to MongoDB")
        
        # Emit real-time update via WebSocket
        socketio.emit('feed_monitor_update', feed_data)
        
    except Exception as e:
        print(f"Error processing feed monitor data: {str(e)}")

def process_gate_data(data, topic):
    """Process gate/RFID data received from MQTT"""
    try:
        gate_data = {
            'timestamp': datetime.now(),
            'cattle_id': data.get('cattle_id', 'unknown'),
            'rfid_tag': data.get('rfid_tag', ''),
            'gate_status': data.get('gate_status', 'unknown'),
            'weight': float(data.get('weight', 0)) if 'weight' in data else None,
            'direction': data.get('direction', 'unknown'),
        }
        
        # Save to MongoDB
        if mongodb.connected:
            mongodb.insert_gate_data(gate_data)
            print(f"✓ Saved gate data to MongoDB")
        
        # Emit real-time update via WebSocket
        socketio.emit('gate_update', gate_data)
        
    except Exception as e:
        print(f"Error processing gate data: {str(e)}")

def process_environmental_data(data, topic):
    """Process environmental data received from MQTT"""
    try:
        env_data = {
            'timestamp': datetime.now(),
            'zone': data.get('zone', 'main'),
            'temperature': float(data.get('temperature', 0)) if 'temperature' in data else None,
            'humidity': float(data.get('humidity', 0)) if 'humidity' in data else None,
            'light_level': float(data.get('light_level', 0)) if 'light_level' in data else None,
            'presence': data.get('presence', False),
        }
        
        # Save to MongoDB
        if mongodb.connected:
            mongodb.insert_environmental_data(env_data)
            print(f"✓ Saved environmental data to MongoDB")
        
        # Emit real-time update via WebSocket
        socketio.emit('environmental_update', env_data)
        
    except Exception as e:
        print(f"Error processing environmental data: {str(e)}")

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