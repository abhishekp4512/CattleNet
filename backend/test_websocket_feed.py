import socketio
import time

sio = socketio.Client()

@sio.event
def connect():
    print("Connected to backend WebSocket")

@sio.event
def disconnect():
    print("Disconnected from backend WebSocket")

@sio.on('feed_monitor_update')
def on_feed_update(data):
    print(f"RECEIVED_FEED_UPDATE: {data}")

try:
    sio.connect('http://127.0.0.1:5002')
    print("Listening for feed updates...")
    sio.wait()
except Exception as e:
    print(f"Connection failed: {e}")
