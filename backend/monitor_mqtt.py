import paho.mqtt.client as mqtt
import json
import time

MQTT_BROKER = "broker.emqx.io"
MQTT_PORT = 1883
TOPICS = ["farm/sensor1", "farm/sensor_data", "farm/feed_monitor", "farm/gate", "farm/environment"]

def on_connect(client, userdata, flags, rc):
    print(f"✅ Connected to MQTT Broker (code {rc})")
    for topic in TOPICS:
        client.subscribe(topic)
        print(f"📡 Subscribed to: {topic}")
    print("\n🔍 Monitoring MQTT messages (Press Ctrl+C to stop)...\n")

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        timestamp = time.strftime("%H:%M:%S")
        
        # Pretty print the message with topic name
        print(f"[{timestamp}] 📨 Topic: {msg.topic}")
        print(f"  Data: {json.dumps(payload, indent=2)}")
        print()
        
    except Exception as e:
        print(f"Error decoding message: {e}")

client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message

print("🚀 Starting MQTT Monitor...")
client.connect(MQTT_BROKER, MQTT_PORT, 60)

try:
    client.loop_forever()
except KeyboardInterrupt:
    print("\n\n🛑 Stopping MQTT Monitor...")
    client.disconnect()
    print("✅ Disconnected from MQTT Broker")
