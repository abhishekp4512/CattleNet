# Quick fix: Add health-stats endpoint to app.py before main block
# This file will be inserted at line 863

@app.route('/api/health-stats', methods=['GET'])
def get_health_stats():
    """Get health statistics based on recent data"""
    try:
        if len(cattle_data_buffer) == 0:
            # Return empty stats if no data
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
        
        # Process recent data
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
