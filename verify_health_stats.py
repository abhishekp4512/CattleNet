import requests
import json
import time

print("Waiting for data to accumulate...")
time.sleep(5)

try:
    resp = requests.get('http://localhost:5001/api/health-stats')
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        print(json.dumps(data, indent=2))
    else:
        print(resp.text)
except Exception as e:
    print(f"Error: {e}")
