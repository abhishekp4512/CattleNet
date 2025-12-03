import paho.mqtt.client as mqtt
import json
import time
import random

# MQTT Configuration
BROKER = "broker.emqx.io"
PORT = 1883
TOPIC = "farm/feed_monitor"

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Connected to MQTT Broker!")
    else:
        print(f"Failed to connect, return code {rc}")

client = mqtt.Client()
client.on_connect = on_connect

try:
    client.connect(BROKER, PORT, 60)
    client.loop_start()
    
    # User's specific data format
    data = {
        "cattleID": "a1b2c3d4",
        "feedConsumed": 1.32,
        "waterStatus": 1
    }
    
    print(f"Publishing to {TOPIC}: {json.dumps(data)}")
    client.publish(TOPIC, json.dumps(data))
    
    time.sleep(2)
    client.loop_stop()
    client.disconnect()
    print("Done!")
    
except Exception as e:
    print(f"Error: {e}")
