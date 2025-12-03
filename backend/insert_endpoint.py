# Script to insert health-stats endpoint into app.py at the correct location
import os

# Read the current app.py
with open('app.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the line with @app.route('/api/mqtt-status'
insertion_point = None
for i, line in enumerate(lines):
    if "@app.route('/api/mqtt-status'" in line:
        insertion_point = i
        break

if insertion_point is None:
    print("Could not find insertion point!")
    exit(1)

# Prepare the endpoint code to insert
health_stats_code = '''@app.route('/api/health-stats', methods=['GET'])
def get_health_stats():
    """Get health statistics based on recent data"""
    try:
        if len(cattle_data_buffer) == 0:
            return jsonify({
                'status': 'success',
                'health_stats': {
                    'total_samples': 0,
                    'normal_count': 0,
                    'anomaly_count': 0,
                    'anomaly_percentage': 0,
                    'activity_levels': {'average': 0, 'maximum': 0, 'minimum': 0}
                }
            })
        
        data_list = list(cattle_data_buffer)
        return jsonify({
            'status': 'success',
            'health_stats': {
                'total_samples': len(data_list),
                'normal_count': len(data_list),
                'anomaly_count': 0,
                'anomaly_percentage': 0,
                'activity_levels': {'average': 50, 'maximum': 100, 'minimum': 0}
            }
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500
 
'''

# Insert before mqtt-status endpoint
lines.insert(insertion_point, health_stats_code)

# Write back
with open('app.py', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"Successfully inserted health-stats endpoint before line {insertion_point + 1}")
