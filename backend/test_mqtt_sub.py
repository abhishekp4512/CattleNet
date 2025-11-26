
import paho.mqtt.client as mqtt
import time
import os
from dotenv import load_dotenv

load_dotenv()

BROKER = os.getenv('MQTT_BROKER', "broker.emqx.io")
PORT = int(os.getenv('MQTT_PORT', 1883))

def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")
    client.subscribe("farm/#")
    client.subscribe("cattle/#")

def on_message(client, userdata, msg):
    print(f"Topic: {msg.topic} Payload: {msg.payload.decode()}")

client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message

print(f"Connecting to {BROKER}:{PORT}...")
client.connect(BROKER, PORT, 60)

client.loop_start()
time.sleep(10)
client.loop_stop()
print("Finished listening.")
