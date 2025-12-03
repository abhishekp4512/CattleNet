import requests
import json

try:
    response = requests.get('http://localhost:5001/api/gate')
    if response.status_code == 200:
        data = response.json()
        print("Statistics:")
        print(json.dumps(data.get('statistics', {}), indent=2))
        print("\nUnique Cattle Registry Keys:")
        print(list(data.get('cattle_registry', {}).keys()))
    else:
        print(f"Error: {response.status_code}")
        print(response.text)
except Exception as e:
    print(f"Exception: {e}")
