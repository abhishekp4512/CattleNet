"""
Quick test script to publish gate data to MQTT
This sends RFID + weight data to test the Gate Monitor
"""
import paho.mqtt.client as mqtt
import json
import time
import random

# MQTT Configuration
MQTT_BROKER = "broker.emqx.io"
MQTT_PORT = 1883
GATE_TOPIC = "farm/gate"

# RFID tags for testing
rfid_tags = ["RFID_A001", "RFID_B002", "RFID_C003", "RFID_D004", "RFID_E005"]

def on_connect(client, userdata, flags, rc):
    print(f"✅ Connected to MQTT Broker (code {rc})")
    print(f"Publishing gate data to topic: {GATE_TOPIC}")
    print(f"Press Ctrl+C to stop\n")

client = mqtt.Client(client_id=f"gate_test_{random.randint(1000,9999)}")
client.on_connect = on_connect

print(f"Connecting to {MQTT_BROKER}...")
client.connect(MQTT_BROKER, MQTT_PORT, 60)
client.loop_start()

time.sleep(2)

try:
    iteration = 0
    while True:
        iteration += 1
        
        # Simulated time-based direction (morning = in, evening = out)
        current_hour = time.localtime().tm_hour
        if 5 <= current_hour < 16:
            direction = "in"
        else:
            direction = "out"
        
        # Random RFID tag
        rfid_tag = random.choice(rfid_tags)
        
        # Random weight (realistic cattle weight: 350-700kg)
        weight = round(random.uniform(350, 700), 1)
        
        # Gate status
        gate_status = random.choice(["active", "reading", "idle"])
        
        # Create gate data matching backend format
        gate_data = {
            "rfidTag": rfid_tag,          # or "rfid_tag" or "rfid"
            "weight": weight,             # Load cell reading
            "gateStatus": gate_status,    # Gate status
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
        }
        
        # Publish to MQTT
        result = client.publish(GATE_TOPIC, json.dumps(gate_data), qos=1)
        
        if result.rc == 0:
            print(f"🚪 [{iteration}] RFID: {rfid_tag} | Weight: {weight}kg | Direction: {direction} | Status: {gate_status}")
        else:
            print(f"❌ Failed to publish (error code: {result.rc})")
        
        # Wait 3 seconds before next reading
        time.sleep(3)
        
except KeyboardInterrupt:
    print("\n\n🛑 Stopping gate data publisher...")
    client.loop_stop()
    client.disconnect()
    print("✅ Disconnected from MQTT Broker")
