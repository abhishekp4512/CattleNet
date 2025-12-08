#!/usr/bin/env python3
"""
Test Feed Monitor MQTT Publisher
Publishes valid feed data to test the dashboard
"""

import paho.mqtt.client as mqtt
import json
import time
from datetime import datetime

# MQTT Configuration
BROKER = "broker.emqx.io"
PORT = 1883
TOPIC = "farm/feed_monitor"

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"✅ Connected to MQTT Broker: {BROKER}")
    else:
        print(f"❌ Failed to connect. Return code: {rc}")

def publish_feed_data():
    """Publish test feed monitor data"""
    client = mqtt.Client("FeedTestPublisher")
    client.on_connect = on_connect
    
    try:
        print(f"🔌 Connecting to {BROKER}:{PORT}...")
        client.connect(BROKER, PORT, 60)
        client.loop_start()
        time.sleep(2)  # Wait for connection
        
        # Test Data - matching your MQTT format
        test_data = {
            "cattleName": "Cattle_006",
            "feedConsumed": 15.30,
            "waterStatus": 1
        }
        
        # Publish
        payload = json.dumps(test_data)
        result = client.publish(TOPIC, payload)
        
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            print(f"✅ Published to {TOPIC}:")
            print(f"   {payload}")
        else:
            print(f"❌ Failed to publish. Error code: {result.rc}")
        
        time.sleep(1)
        
        # Publish a few more test entries
        print("\n📊 Publishing more test data...")
        cattle_names = ["Cattle_007", "Cattle_008", "Cattle_009"]
        for i, name in enumerate(cattle_names, 1):
            data = {
                "cattleName": name,
                "feedConsumed": round(10.0 + i * 3.5, 2),
                "waterStatus": 1 if i % 2 == 0 else 0
            }
            payload = json.dumps(data)
            client.publish(TOPIC, payload)
            print(f"   Published: {name} - {data['feedConsumed']}kg")
            time.sleep(0.5)
        
        print("\n✅ All test data published!")
        print(f"💡 Check your dashboard at: http://127.0.0.1:3000")
        print(f"💡 Check backend logs for processing messages")
        
        time.sleep(2)
        client.loop_stop()
        client.disconnect()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("="*50)
    print("  Feed Monitor MQTT Test Publisher")
    print("="*50)
    publish_feed_data()
