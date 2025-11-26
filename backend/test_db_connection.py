
import sys
import os
from dotenv import load_dotenv

# Add current directory to path
sys.path.append(os.getcwd())

from db_client import mongodb

print("Testing MongoDB connection...")
load_dotenv()

try:
    success = mongodb.connect()
    if success:
        print("SUCCESS: Connected to MongoDB")
        print(f"DB Name: {mongodb.db_name}")
        # Try a simple operation
        print("Listing collections:")
        print(mongodb.db.list_collection_names())
    else:
        print("FAILURE: Could not connect to MongoDB")
except Exception as e:
    print(f"EXCEPTION: {e}")
