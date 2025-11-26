
import requests
import time
import sys

print("Waiting for backend to generate data...")
time.sleep(5)

try:
    response = requests.get('http://localhost:5001/api/data')
    data = response.json()
    print(f"Status: {data.get('status')}")
    print(f"Data count: {len(data.get('data', []))}")
    if len(data.get('data', [])) > 0:
        print("First data point:", data.get('data')[0])
    else:
        print("No data received yet.")
except Exception as e:
    print(f"Error: {e}")
