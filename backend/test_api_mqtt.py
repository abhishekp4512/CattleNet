
import requests
import sys

try:
    response = requests.get('http://localhost:5000/health')
    data = response.json()
    print(f"MQTT Connected: {data.get('mqtt_connected')}")
except Exception as e:
    print(f"Error: {e}")
