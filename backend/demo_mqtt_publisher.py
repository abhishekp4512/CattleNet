import paho.mqtt.client as mqtt
import json
import time
import random

# MQTT Configuration
MQTT_BROKER = "broker.emqx.io"
MQTT_PORT = 1883

# Topics
SENSOR_TOPIC = "farm/sensor1"  # Changed to match backend subscription
FEED_TOPIC = "farm/feed_monitor"
GATE_TOPIC = "farm/gate"
ENV_TOPIC = "farm/environment"

def on_connect(client, userdata, flags, rc):
    print(f"✅ Connected to MQTT Broker (code {rc})")
    print(f"Publishing test data to demonstrate the dashboard...")
    print(f"Press Ctrl+C to stop\n")

client = mqtt.Client()
client.on_connect = on_connect
client.connect(MQTT_BROKER, MQTT_PORT, 60)
client.loop_start()

time.sleep(2)

# Cattle IDs for testing
cattle_ids = ["cow_001", "cow_002", "cow_003", "cow_004", "cow_005"]

try:
    iteration = 0
    while True:
        iteration += 1
        print(f"--- Iteration {iteration} ---")
        
        # 1. Publish Sensor Data (accelerometer/gyroscope + temperature)
        sensor_data = {
            "acc_x": random.uniform(80, 150),
            "acc_y": random.uniform(10, 30),
            "acc_z": random.uniform(15, 35),
            "gyro_x": random.uniform(0.5, 2.5),
            "gyro_y": random.uniform(0.8, 2.0),
            "gyro_z": random.uniform(0.3, 1.5),
            "temperature": round(random.uniform(36.5, 39.5), 1),  # Cattle body temperature
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        client.publish(SENSOR_TOPIC, json.dumps(sensor_data))
        print(f"📊 Sensor: acc_x={sensor_data['acc_x']:.1f}, temp={sensor_data['temperature']}°C, gyro_x={sensor_data['gyro_x']:.2f}")
        
        # 2. Publish Feed Monitor Data (random cattle)
        cattle_id = random.choice(cattle_ids)
        feed_data = {
            "cattle_id": cattle_id,
            "feed_consumed": round(random.uniform(2.0, 8.5), 2),
            "water_present": random.choice([True, False]),
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        client.publish(FEED_TOPIC, json.dumps(feed_data))
        print(f"🐄 Feed: {cattle_id} consumed {feed_data['feed_consumed']}kg")
        
        # 3. Publish Gate Data (entry/exit)
        gate_data = {
            "cattle_id": random.choice(cattle_ids),
            "event": random.choice(["entry", "exit"]),
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        client.publish(GATE_TOPIC, json.dumps(gate_data))
        print(f"🚪 Gate: {gate_data['cattle_id']} - {gate_data['event']}")
        
        # 4. Publish Environmental Data
        env_data = {
            "temperature": round(random.uniform(25, 32), 1),
            "humidity": round(random.uniform(60, 80), 1),
            "light": random.choice(["day", "night"]),
            "motion": random.choice([True, False]),
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        client.publish(ENV_TOPIC, json.dumps(env_data))
        print(f"🌡️  Environment: {env_data['temperature']}°C, {env_data['humidity']}% humidity")
        
        print(f"✓ Published all test data\n")
        time.sleep(5)  # Publish every 5 seconds
        
except KeyboardInterrupt:
    print("\n🛑 Stopping test data publisher...")
    client.loop_stop()
    client.disconnect()
    print("✅ Disconnected from MQTT Broker")
