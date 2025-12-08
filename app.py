
import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

# Import the Flask app from backend package
from backend.app import app

if __name__ == '__main__':
    # Allow running this file directly for testing
    from backend.app import socketio
    socketio.run(app, debug=True, host='0.0.0.0', port=5001)
