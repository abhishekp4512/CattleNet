"""
MongoDB API endpoints for CattleNet
"""
from flask import Blueprint, jsonify, request
from db_client import mongodb

# Initialize MongoDB connection
try:
    mongodb.connect()
    print("[INFO] MongoDB connected for API endpoints")
except Exception as e:
    print(f"[WARN] MongoDB connection failed: {str(e)}")

# Create a Blueprint for MongoDB routes
mongodb_api = Blueprint('mongodb_api', __name__)

@mongodb_api.route('/api/db/feed-monitor', methods=['GET'])
def get_feed_monitor_data_db():
    """Get all recent feed monitor data from database"""
    try:
        hours = request.args.get('hours', 24, type=int)
        limit = request.args.get('limit', 100, type=int)
        
        if not mongodb or not mongodb.connected:
            return jsonify({
                'status': 'error',
                'message': 'MongoDB not connected'
            }), 503
        
        data = mongodb.get_feed_monitor_data(hours=hours, limit=limit)
        
        # Convert datetime to string for JSON serialization
        for doc in data:
            if 'timestamp' in doc:
                doc['timestamp'] = doc['timestamp'].isoformat()
            if '_id' in doc:
                doc['_id'] = str(doc['_id'])
        
        return jsonify({
            'status': 'success',
            'period_hours': hours,
            'records_count': len(data),
            'data': data
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
