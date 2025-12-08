import requests
import sys

try:
    resp = requests.get('http://localhost:5001/api/feed-monitor')
    print(f"Status: {resp.status_code}")
    print("Body:")
    print(resp.text)
except Exception as e:
    print(f"Error: {e}")
