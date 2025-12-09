"""
MongoDB Database Connection and Operations
"""

from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import ServerSelectionTimeoutError, ConnectionFailure
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import os
from dotenv import load_dotenv
import json

load_dotenv()

class MongoDBClient:
    """MongoDB client wrapper for CattleNet Smartfarm"""
    
    def __init__(self):
        """Initialize MongoDB connection"""
        self.mongo_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
        self.db_name = os.getenv('MONGODB_DB', 'cattlenet_smartfarm')
        self.client = None
        self.db = None
        self.connected = False
        
    def connect(self):
        """Establish connection to MongoDB (optional - silently fails if unavailable)"""
        try:
            self.client = MongoClient(
                self.mongo_uri,
                serverSelectionTimeoutMS=2000,
                connectTimeoutMS=3000
            )
            # Verify connection
            self.client.admin.command('ping')
            self.db = self.client[self.db_name]
            self.connected = True
            print(f"[OK] Connected to MongoDB at {self.mongo_uri}")
            print(f"[OK] Using database: {self.db_name}")
            self._ensure_indexes()
            return True
        except Exception:
            # Silently fail - database is optional
            self.connected = False
            return False
    
    def _ensure_indexes(self):
        """Create necessary indexes for optimal query performance"""
        collections_config = {
            "sensor_data": [
                ([("cattle_id", ASCENDING)], {}),
                ([("timestamp", DESCENDING)], {}),
                ([("cattle_id", ASCENDING), ("timestamp", DESCENDING)], {}),
            ],
            "environmental_data": [
                ([("zone", ASCENDING)], {}),
                ([("timestamp", DESCENDING)], {}),
                ([("zone", ASCENDING), ("timestamp", DESCENDING)], {}),
            ],
            "gate_data": [
                ([("cattle_id", ASCENDING)], {}),
                ([("rfid_tag", ASCENDING)], {}),
                ([("timestamp", DESCENDING)], {}),
                ([("cattle_id", ASCENDING), ("timestamp", DESCENDING)], {}),
            ],
            "feed_monitor_data": [
                ([("cattle_id", ASCENDING)], {}),
                ([("rfid_tag", ASCENDING)], {}),
                ([("timestamp", DESCENDING)], {}),
                ([("cattle_id", ASCENDING), ("timestamp", DESCENDING)], {}),
            ],
            "health_data": [
                ([("cattle_id", ASCENDING)], {}),
                ([("timestamp", DESCENDING)], {}),
            ]
        }
        
        for collection_name, indexes in collections_config.items():
            collection = self.db[collection_name]
            for index_fields, options in indexes:
                try:
                    collection.create_index(index_fields, **options)
                except Exception as e:
                    print(f"Warning: Could not create index on {collection_name}: {e}")
    
    def insert_sensor_data(self, data: Dict[str, Any]) -> Optional[str]:
        """Insert sensor data document"""
        if not self.connected:
            return None
        try:
            result = self.db.sensor_data.insert_one(data)
            return str(result.inserted_id)
        except Exception:
            return None
    
    def insert_environmental_data(self, data: Dict[str, Any]) -> Optional[str]:
        """Insert environmental data document"""
        if not self.connected:
            return None
        try:
            result = self.db.environmental_data.insert_one(data)
            return str(result.inserted_id)
        except Exception:
            return None
    
    def insert_gate_data(self, data: Dict[str, Any]) -> Optional[str]:
        """Insert gate data document"""
        if not self.connected:
            return None
        try:
            result = self.db.gate_data.insert_one(data)
            return str(result.inserted_id)
        except Exception:
            return None
    
    def insert_feed_monitor_data(self, data: Dict[str, Any]) -> Optional[str]:
        """Insert feed monitor data document"""
        if not self.connected:
            return None
        try:
            result = self.db.feed_monitor_data.insert_one(data)
            return str(result.inserted_id)
        except Exception:
            return None
    
    def insert_health_data(self, data: Dict[str, Any]) -> Optional[str]:
        """Insert health prediction data document"""
        if not self.connected:
            return None
        try:
            result = self.db.health_data.insert_one(data)
            return str(result.inserted_id)
        except Exception:
            return None
    
    def get_sensor_data(self, cattle_id: str, hours: int = 24, limit: int = 100) -> List[Dict]:
        """Retrieve sensor data for a cattle in the last N hours"""
        try:
            time_threshold = datetime.utcnow() - timedelta(hours=hours)
            cursor = self.db.sensor_data.find(
                {
                    "cattle_id": cattle_id,
                    "timestamp": {"$gte": time_threshold}
                }
            ).sort("timestamp", DESCENDING).limit(limit)
            return list(cursor)
        except Exception as e:
            print(f"Error retrieving sensor data: {e}")
            return []
    
    def get_feed_monitor_data(self, hours: int = 24, limit: int = 100) -> List[Dict]:
        """Retrieve recent feed monitor data"""
        try:
            time_threshold = datetime.utcnow() - timedelta(hours=hours)
            cursor = self.db.feed_monitor_data.find(
                {"timestamp": {"$gte": time_threshold}}
            ).sort("timestamp", DESCENDING).limit(limit)
            return list(cursor)
        except Exception as e:
            print(f"Error retrieving feed monitor data: {e}")
            return []
    
    def get_gate_data(self, hours: int = 24, limit: int = 200) -> List[Dict]:
        """Retrieve gate data from the last N hours"""
        try:
            time_threshold = datetime.utcnow() - timedelta(hours=hours)
            cursor = self.db.gate_data.find(
                {"timestamp": {"$gte": time_threshold}}
            ).sort("timestamp", DESCENDING).limit(limit)
            return list(cursor)
        except Exception as e:
            print(f"Error retrieving gate data: {e}")
            return []
    
    def get_environmental_data(self, zone: Optional[str] = None, hours: int = 24, limit: int = 100) -> List[Dict]:
        """Retrieve environmental data"""
        try:
            time_threshold = datetime.utcnow() - timedelta(hours=hours)
            query = {"timestamp": {"$gte": time_threshold}}
            
            if zone:
                query["zone"] = zone
            
            cursor = self.db.environmental_data.find(query).sort("timestamp", DESCENDING).limit(limit)
            return list(cursor)
        except Exception as e:
            print(f"Error retrieving environmental data: {e}")
            return []
    
    def get_cattle_health_history(self, cattle_id: str, limit: int = 50) -> List[Dict]:
        """Retrieve health prediction history for a cattle"""
        try:
            cursor = self.db.health_data.find(
                {"cattle_id": cattle_id}
            ).sort("timestamp", DESCENDING).limit(limit)
            return list(cursor)
        except Exception as e:
            print(f"Error retrieving health data: {e}")
            return []
    
    def get_cattle_stats(self, cattle_id: str, hours: int = 24) -> Dict[str, Any]:
        """Get aggregated statistics for a cattle"""
        try:
            time_threshold = datetime.utcnow() - timedelta(hours=hours)
            
            # Feed consumption stats
            feed_stats = self.db.feed_monitor_data.find_one(
                {
                    "cattle_id": cattle_id,
                    "timestamp": {"$gte": time_threshold}
                },
                sort=[("timestamp", DESCENDING)]
            )
            
            # Recent sensor activity
            sensor_count = self.db.sensor_data.count_documents({
                "cattle_id": cattle_id,
                "timestamp": {"$gte": time_threshold}
            })
            
            # Gate activity
            gate_count = self.db.gate_data.count_documents({
                "cattle_id": cattle_id,
                "timestamp": {"$gte": time_threshold}
            })
            
            return {
                "cattle_id": cattle_id,
                "feed_stats": feed_stats,
                "sensor_readings_count": sensor_count,
                "gate_activities_count": gate_count,
                "period_hours": hours
            }
        except Exception as e:
            print(f"Error getting cattle stats: {e}")
            return {}
    
    def get_all_cattle(self) -> List[str]:
        """Get list of all unique cattle IDs in database"""
        try:
            cattle_ids = self.db.sensor_data.distinct("cattle_id")
            return cattle_ids
        except Exception as e:
            print(f"Error retrieving cattle list: {e}")
            return []
    
    def cleanup_old_data(self, days: int = 30):
        """Remove data older than N days (data retention policy)"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            collections = [
                "sensor_data",
                "environmental_data",
                "gate_data",
                "feed_monitor_data",
                "health_data"
            ]
            
            for collection_name in collections:
                result = self.db[collection_name].delete_many(
                    {"timestamp": {"$lt": cutoff_date}}
                )
                print(f"Deleted {result.deleted_count} documents from {collection_name}")
        except Exception as e:
            print(f"Error cleaning up old data: {e}")
    
    def get_statistics_summary(self) -> Dict[str, Any]:
        """Get overall database statistics"""
        try:
            collections = [
                "sensor_data",
                "environmental_data",
                "gate_data",
                "feed_monitor_data",
                "health_data"
            ]
            
            stats = {}
            for collection_name in collections:
                count = self.db[collection_name].count_documents({})
                stats[collection_name] = count
            
            return stats
        except Exception as e:
            print(f"Error getting statistics: {e}")
            return {}
    
    def disconnect(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()
            self.connected = False
            print("[OK] Disconnected from MongoDB")


# Global MongoDB instance
mongodb = MongoDBClient()
