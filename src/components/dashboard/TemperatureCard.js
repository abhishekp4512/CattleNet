import React, { useState, useEffect } from 'react';

const TemperatureCard = () => {
  const [temperatureData, setTemperatureData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTemperatureData = async () => {
      try {
        const response = await fetch('http://127.0.0.1:5000/api/temperature');
        if (!response.ok) {
          throw new Error('Failed to fetch temperature data');
        }
        const data = await response.json();
        setTemperatureData(data);
        setError(null);
      } catch (err) {
        setError(err.message);
        console.error('Error fetching temperature data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTemperatureData();
    // Refresh every 5 seconds
    const interval = setInterval(fetchTemperatureData, 5000);

    return () => clearInterval(interval);
  }, []);

  const getTemperatureColor = (temp) => {
    if (temp < 25) return '#3b82f6'; // Blue for cold
    if (temp > 30) return '#ef4444'; // Red for hot
    return '#10b981'; // Green for normal
  };

  const getAlertColor = (type) => {
    return type === 'high_temperature' ? '#ef4444' : '#3b82f6';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Temperature Monitoring</h3>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Temperature Monitoring</h3>
        <div className="text-red-600 text-center py-4">
          Error loading temperature data: {error}
        </div>
      </div>
    );
  }

  if (!temperatureData || temperatureData.status !== 'success') {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Temperature Monitoring</h3>
        <div className="text-gray-600 text-center py-4">
          No temperature data available
        </div>
      </div>
    );
  }

  const { overall_stats, cattle_stats, normal_range, alerts } = temperatureData;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Temperature Monitoring</h3>
      </div>

      {/* Alerts */}
      {alerts && alerts.length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-700 mb-2">Alerts</div>
          <div className="space-y-2">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className="p-2 rounded-lg text-sm"
                style={{
                  backgroundColor: `${getAlertColor(alert.type)}20`,
                  borderLeft: `4px solid ${getAlertColor(alert.type)}`
                }}
              >
                <strong>{alert.cattle_id}:</strong> {alert.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Individual Cattle Temperature */}
      <div>
        <div className="text-sm font-medium text-gray-700 mb-3">Individual Cattle</div>
        <div className="space-y-2">
          {Object.entries(cattle_stats).map(([cattleId, stats]) => (
            <div key={cattleId} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="font-medium text-gray-800">{cattleId}</div>
                <div className="text-sm text-gray-600">
                  ({stats.readings_count} readings)
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div
                    className="text-lg font-bold"
                    style={{ color: getTemperatureColor(stats.current) }}
                  >
                    {stats.current}°C
                  </div>
                  <div className="text-xs text-gray-500">
                    Avg: {stats.average}°C
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500 text-center">
        Total readings: {overall_stats.total_readings} | Updates every 5 seconds
      </div>
    </div>
  );
};

export default TemperatureCard;