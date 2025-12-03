import paho.mqtt.client as mqtt
import json
import time
import os
import random

# MQTT Configuration
MQTT_BROKER = "broker.emqx.io"
MQTT_PORT = 1883
TOPIC = "farm/feed_monitor"

def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")

client = mqtt.Client()
client.on_connect = on_connect
client.connect(MQTT_BROKER, MQTT_PORT, 60)
client.loop_start()

time.sleep(2) # Wait for connection

def publish_test_message(cattle_id, feed_consumed, description):
    data = {
        "cattle_id": cattle_id,
        "feed_consumed": feed_consumed,
        "water_present": True,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    payload = json.dumps(data)
    print(f"\nTest: {description}")
    print(f"Publishing: {payload}")
    client.publish(TOPIC, payload)
    time.sleep(1)

# Test Case 1: Valid Message
publish_test_message("cow_test_001", 5.5, "Valid Message - Should Appear")

# Test Case 2: "no_cattle_detected"
publish_test_message("no_cattle_detected", 0, "Invalid ID 'no_cattle_detected' - Should NOT Appear")

# Test Case 3: Zero Feed
publish_test_message("cow_test_002", 0, "Zero Feed - Should NOT Appear")

# Test Case 4: Negative Feed
publish_test_message("cow_test_003", -2.5, "Negative Feed - Should NOT Appear")

# Test Case 5: Empty ID
publish_test_message("", 5.0, "Empty ID - Should NOT Appear")

print("\nTests completed. Check backend logs and dashboard.")
client.loop_stop()
client.disconnect()
