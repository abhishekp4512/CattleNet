import paho.mqtt.client as mqtt
import json
import time
import random

# MQTT Configuration
MQTT_BROKER = "broker.emqx.io"
MQTT_PORT = 1883

# Connect to MQTT
client = mqtt.Client()

def publish_test_data():
    try:
        print("Connecting to MQTT broker...")
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        
        # Generate test cattle sensor data
        for i in range(5):
            cattle_data = {
                "timestamp": "2025-10-17T13:30:00Z",
                "cattle_id": f"cow00{i+1}",
                "ax": random.uniform(-50, 50),    # Accelerometer X
                "ay": random.uniform(-30, 30),    # Accelerometer Y  
                "az": random.uniform(-20, 20),    # Accelerometer Z
                "gx": random.uniform(-10, 10),    # Gyroscope X
                "gy": random.uniform(-8, 8),      # Gyroscope Y
                "gz": random.uniform(-6, 6),      # Gyroscope Z
                "temperature": random.uniform(25.0, 30.0)  # Temperature
            }
            
            # Publish to farm/sensor1
            payload = json.dumps(cattle_data)
            result = client.publish("farm/sensor1", payload)
            
            if result.rc == 0:
                print(f"Published test data for {cattle_data['cattle_id']}: {payload}")
            else:
                print(f"Failed to publish data for {cattle_data['cattle_id']}")
            
            time.sleep(2)  # Wait 2 seconds between publications
            
        client.disconnect()
        print("Test data publishing completed!")
        
    except Exception as e:
        print(f"Error publishing test data: {str(e)}")

if __name__ == "__main__":
    publish_test_data()