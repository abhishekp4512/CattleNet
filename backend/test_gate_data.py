import paho.mqtt.client as mqtt
import json
import time
import random
from datetime import datetime

# MQTT Configuration
MQTT_BROKER = "broker.emqx.io"
MQTT_PORT = 1883
GATE_TOPIC = "farm/gate"

def send_gate_data():
    """Send test gate data to MQTT broker"""
    
    # Sample RFID tags
    rfid_tags = ["RFID001", "RFID002", "RFID003", "RFID004", "RFID005"]
    
    # Sample gate statuses
    gate_statuses = ["active", "reading", "completed"]
    
    # Sample directions
    directions = ["in", "out"]
    
    client = mqtt.Client()
    
    try:
        print(f"Connecting to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}")
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_start()
        
        for i in range(10):  # Send 10 test messages
            # Generate realistic gate data
            gate_data = {
                "timestamp": datetime.now().isoformat(),
                "rfidTag": random.choice(rfid_tags),
                "weight": round(random.uniform(350, 750), 2),  # Cattle weight range
                "gateStatus": random.choice(gate_statuses),
                "direction": random.choice(directions)
            }
            
            # Send the data
            message = json.dumps(gate_data)
            client.publish(GATE_TOPIC, message)
            
            print(f"Sent gate data {i+1}: {message}")
            
            # Wait 3 seconds between messages
            time.sleep(3)
        
        client.loop_stop()
        client.disconnect()
        print("Test gate data sending completed!")
        
    except Exception as e:
        print(f"Error sending gate data: {str(e)}")

if __name__ == "__main__":
    send_gate_data()
