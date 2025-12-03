import paho.mqtt.client as mqtt
import json
import time
import random
from datetime import datetime

BROKER = "broker.emqx.io"
PORT = 1883
TOPIC = "farm/gate"

client = mqtt.Client()
client.connect(BROKER, PORT, 60)

# Simulate cattle entry (IN) - Morning
print("Simulating cattle entry (IN)...")
data_in = {
    "rfidTag": "COW_TEST_001",
    "weight": 450.5,
    "gateStatus": "open",
    "timestamp": datetime.now().isoformat(),
    # We don't send direction, let backend logic decide based on time
    # But if we want to force test, we can send direction
    # "direction": "in" 
}
client.publish(TOPIC, json.dumps(data_in))
print(f"Published: {data_in}")

time.sleep(2)

# Simulate another cattle entry (IN)
data_in_2 = {
    "rfidTag": "COW_TEST_002",
    "weight": 480.2,
    "gateStatus": "open",
    "timestamp": datetime.now().isoformat()
}
client.publish(TOPIC, json.dumps(data_in_2))
print(f"Published: {data_in_2}")

time.sleep(2)

# Simulate same cattle again (should not increment unique count)
print("Simulating duplicate cattle entry...")
client.publish(TOPIC, json.dumps(data_in))
print(f"Published duplicate: {data_in}")

client.disconnect()
print("Done.")
