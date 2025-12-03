import React, { useState, useEffect } from 'react';
import { Cloud, Sun, Moon, Eye, EyeOff, Thermometer, Droplets } from 'lucide-react';

const EnvironmentalCard = () => {
  const [environmentalData, setEnvironmentalData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEnvironmentalData = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/environment');
      if (response.ok) {
        const data = await response.json();
        setEnvironmentalData(data);
        setError(null);
      } else {
        throw new Error('Failed to fetch environmental data');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEnvironmentalData();
    const interval = setInterval(fetchEnvironmentalData, 3000); // Update every 3 seconds
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
        <h3 className="text-lg font-semibold text-red-800 mb-2">Environmental Monitor Error</h3>
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchEnvironmentalData}
          className="mt-2 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const { latest_data, statistics, alerts } = environmentalData || {};

  // Helper function to get LDR status color
  const getLdrStatusColor = (dayNight) => {
    return dayNight === 'day' ? 'text-yellow-600' : 'text-blue-600';
  };

  // Helper function to get temperature color
  const getTempColor = (temp) => {
    if (temp > 35) return 'text-red-600';
    if (temp < 10) return 'text-blue-600';
    return 'text-green-600';
  };

  // Helper function to get humidity color
  const getHumidityColor = (humidity) => {
    if (humidity > 80) return 'text-red-600';
    if (humidity < 30) return 'text-orange-600';
    return 'text-blue-600';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <Cloud className="mr-2 h-5 w-5 text-green-600" />
          Environmental Monitor
        </h3>
        <div className={`flex items-center ${getLdrStatusColor(statistics?.day_night_status)}`}>
          {statistics?.day_night_status === 'day' ? (
            <Sun className="h-5 w-5 mr-1" />
          ) : (
            <Moon className="h-5 w-5 mr-1" />
          )}
          <span className="text-sm font-medium capitalize">
            {statistics?.day_night_status || 'Unknown'}
          </span>
        </div>
      </div>

      {/* Current Readings */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Light Level */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center justify-between">
            {statistics?.day_night_status === 'day' ? (
              <Sun className="h-6 w-6 text-yellow-500" />
            ) : (
              <Moon className="h-6 w-6 text-blue-500" />
            )}
          </div>
          <p className="text-2xl font-bold text-gray-800 mt-2">
            {latest_data?.ldr_value || 0}
          </p>
          <p className="text-xs text-gray-600">Light Level</p>
        </div>

        {/* Environmental Temperature */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center justify-between">
            <Thermometer className={`h-6 w-6 ${getTempColor(latest_data?.env_temperature || 0)}`} />
          </div>
          <p className={`text-2xl font-bold mt-2 ${getTempColor(latest_data?.env_temperature || 0)}`}>
            {latest_data?.env_temperature || 0}°C
          </p>
          <p className="text-xs text-gray-600">Environment Temp</p>
        </div>

        {/* Humidity */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center justify-between">
            <Droplets className={`h-6 w-6 ${getHumidityColor(latest_data?.humidity || 0)}`} />
          </div>
          <p className={`text-2xl font-bold mt-2 ${getHumidityColor(latest_data?.humidity || 0)}`}>
            {latest_data?.humidity || 0}%
          </p>
          <p className="text-xs text-gray-600">Humidity</p>
        </div>

        {/* Cattle Presence */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center justify-between">
            {latest_data?.cattle_presence ? (
              <Eye className="h-6 w-6 text-green-500" />
            ) : (
              <EyeOff className="h-6 w-6 text-gray-400" />
            )}
          </div>
          <p className={`text-lg font-bold mt-2 ${latest_data?.cattle_presence ? 'text-green-600' : 'text-gray-500'}`}>
            {latest_data?.cattle_presence ? 'Detected' : 'None'}
          </p>
          <p className="text-xs text-gray-600">Cattle Presence</p>
        </div>
      </div>

      {/* Statistics Summary */}
      <div className="bg-gray-50 p-4 rounded-lg mb-4">
        <h4 className="font-medium text-gray-800 mb-2">Recent Averages</h4>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Light:</span>
            <span className="ml-1 font-medium">{statistics?.avg_ldr || 0}</span>
          </div>
          <div>
            <span className="text-gray-600">Temp:</span>
            <span className="ml-1 font-medium">{statistics?.avg_env_temp || 0}°C</span>
          </div>
          <div>
            <span className="text-gray-600">Humidity:</span>
            <span className="ml-1 font-medium">{statistics?.avg_humidity || 0}%</span>
          </div>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          Based on {statistics?.readings_count || 0} readings
        </div>
      </div>

      {/* Alerts */}
      {alerts && alerts.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-800">Environmental Alerts</h4>
          {alerts.map((alert, index) => (
            <div key={index} className="bg-red-50 border border-red-200 p-3 rounded-lg">
              <p className="text-red-800 text-sm font-medium">
                {alert.message}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Status Indicator */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t">
        <div className="flex items-center text-sm text-gray-600">
          <div className={`w-2 h-2 rounded-full mr-2 ${environmentalData?.mqtt_connected ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
          MQTT {environmentalData?.mqtt_connected ? 'Connected' : 'Disconnected'}
        </div>
        <div className="text-xs text-gray-500">
          Last updated: {latest_data?.timestamp || 'Never'}
        </div>
      </div>
    </div>
  );
};

export default EnvironmentalCard;
