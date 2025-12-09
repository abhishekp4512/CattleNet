
import sys
import os

# Add backend to path
sys.path.append(os.path.dirname(__file__))

from db_client import mongodb

def check_connection():
    print("Testing MongoDB Connection...")
    print(f"URI from env: {os.getenv('MONGODB_URI')}")
    
    if mongodb.connect():
        print("[SUCCESS] Successfully connected to MongoDB Atlas!")
        # Try a simple operation
        try:
            stats = mongodb.get_statistics_summary()
            print("Database Stats accessible.")
        except Exception as e:
            print(f"Connected but failed to get stats: {e}")
    else:
        print("[FAILURE] Could not connect to MongoDB.")

if __name__ == "__main__":
    check_connection()
