import paho.mqtt.client as mqtt
import json
import time
import random
from datetime import datetime

# MQTT Configuration
MQTT_BROKER = "broker.emqx.io"
MQTT_PORT = 1883
MQTT_TOPIC_PREFIX = "farm/"

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"Connected to MQTT Broker: {MQTT_BROKER}")
    else:
        print(f"Failed to connect, return code {rc}")

def generate_sensor_data(cattle_id):
    # Simulate normal behavior vs anomaly
    is_anomaly = random.random() < 0.2 # 20% chance of anomaly
    
    if is_anomaly:
        # High activity (running/distress)
        acc_base = random.uniform(2.0, 4.0)
        gyro_base = random.uniform(1.0, 3.0)
    else:
        # Normal activity (grazing/resting)
        acc_base = random.uniform(0.1, 1.0)
        gyro_base = random.uniform(0.1, 0.5)
        
    data = {
        "cattle_id": cattle_id,
        "timestamp": datetime.now().isoformat(),
        "acc_x": random.uniform(-acc_base, acc_base),
        "acc_y": random.uniform(-acc_base, acc_base),
        "acc_z": random.uniform(-acc_base, acc_base),
        "gyro_x": random.uniform(-gyro_base, gyro_base),
        "gyro_y": random.uniform(-gyro_base, gyro_base),
        "gyro_z": random.uniform(-gyro_base, gyro_base),
        "temperature": random.uniform(37.5, 39.5) # Normal cow body temp in Celsius
    }
    return data

def main():
    client = mqtt.Client(client_id=f"sensor-simulator-{random.randint(1000, 9999)}")
    client.on_connect = on_connect
    
    print(f"Connecting to {MQTT_BROKER}...")
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_start()
        
        cattle_list = ["COW001", "COW002", "COW003", "COW004", "COW005"]
        print(f"Starting simulation for: {cattle_list}")
        print("Press Ctrl+C to stop")
        
        while True:
            for cow in cattle_list:
                data = generate_sensor_data(cow)
                payload = json.dumps(data)
                topic = f"{MQTT_TOPIC_PREFIX}{cow}"
                
                client.publish(topic, payload)
                print(f"Published to {topic}: Activity={'High' if abs(data['acc_x']) > 1.5 else 'Normal'}")
                
                time.sleep(0.5) # Fast updates to fill buffer quickly
            
            time.sleep(2) # Pause between batches
            
    except KeyboardInterrupt:
        print("\nSimulation stopped")
    except Exception as e:
        print(f"\nError: {e}")
    finally:
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    main()
