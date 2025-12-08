from backend.db_client import mongodb
import json
from datetime import datetime

def json_serial(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    return str(obj)

def check_data():
    if not mongodb.connect():
        print("Failed to connect to MongoDB")
        return

    print("Connected to MongoDB")
    
    data = mongodb.get_feed_monitor_data(limit=10)
    print(f"Found {len(data)} records")
    
    for i, doc in enumerate(data):
        feed = doc.get('feed_consumed')
        water = doc.get('water_consumed')
        print(f"Record {i}: feed={feed} ({type(feed)}), water={water} ({type(water)})")

if __name__ == "__main__":
    check_data()
