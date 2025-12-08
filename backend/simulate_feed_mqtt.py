import paho.mqtt.client as mqtt
import json
import time
import random
import os
from datetime import datetime

# MQTT Configuration
MQTT_BROKER = "broker.emqx.io"
MQTT_PORT = 1883
MQTT_TOPIC = "farm/feed_monitor"

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"Connected to MQTT Broker: {MQTT_BROKER}")
    else:
        print(f"Failed to connect, return code {rc}")

def generate_feed_data():
    cattle_ids = ["COW001", "COW002", "COW003", "COW004", "COW005"]
    selected_cow = random.choice(cattle_ids)
    
    # Simulate feed consumption between 0.5 and 5.0 kg
    feed_consumed = round(random.uniform(0.5, 5.0), 2)
    
    # Simulate water availability (mostly available)
    water_present = random.random() > 0.1
    
    data = {
        "cattle_id": selected_cow,
        "rfid_tag": f"RFID_{selected_cow}",
        "feed_consumed": feed_consumed,
        "water_present": water_present,
        "timestamp": datetime.now().isoformat()
    }
    return data

def main():
    client = mqtt.Client(client_id=f"feed-simulator-{random.randint(1000, 9999)}")
    client.on_connect = on_connect
    
    print(f"Connecting to {MQTT_BROKER}...")
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_start()
        
        print(f"Starting simulation on topic: {MQTT_TOPIC}")
        print("Press Ctrl+C to stop")
        
        while True:
            data = generate_feed_data()
            payload = json.dumps(data)
            
            client.publish(MQTT_TOPIC, payload)
            print(f"Published: {payload}")
            
            # Wait for random interval between 2-5 seconds
            time.sleep(random.uniform(2, 5))
            
    except KeyboardInterrupt:
        print("\nSimulation stopped")
    except Exception as e:
        print(f"\nError: {e}")
    finally:
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    main()
