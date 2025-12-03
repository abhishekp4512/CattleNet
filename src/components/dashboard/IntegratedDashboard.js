import React, { useState, useEffect } from 'react';
import { Activity, Thermometer, Eye, Sun, Moon, Droplets, Compass, Heart, Clock, Wifi } from 'lucide-react';

const IntegratedDashboard = () => {
  const [integratedData, setIntegratedData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchIntegratedData = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/integrated-data');
      if (response.ok) {
        const data = await response.json();
        setIntegratedData(data);
        setError(null);
      } else {
        throw new Error('Failed to fetch integrated data');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegratedData();
    const interval = setInterval(fetchIntegratedData, 2000); // Update every 2 seconds
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded mb-4"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !integratedData) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
        <h3 className="text-lg font-semibold text-red-800 mb-2">Integration Error</h3>
        <p className="text-red-600">{error || 'No integrated data available'}</p>
        <button
          onClick={fetchIntegratedData}
          className="mt-2 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const { data } = integratedData;
  const cattleSensors = data.cattle_sensors;
  const environment = data.environment;
  const healthPrediction = data.health_prediction;
  const availability = data.data_availability;

  // Helper functions for styling
  const getHealthColor = (prediction) => {
    return prediction === 'Normal' ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100';
  };

  const getTempColor = (temp) => {
    if (temp > 30) return 'text-red-600';
    if (temp < 25) return 'text-blue-600';
    return 'text-green-600';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center">
          <Activity className="mr-2 h-6 w-6 text-blue-600" />
          Integrated Cattle & Environment Monitor
        </h2>
        <div className="flex items-center space-x-2 text-sm">
          <Wifi className={`h-4 w-4 ${integratedData.mqtt_connected ? 'text-green-500' : 'text-red-500'}`} />
          <span className={`${integratedData.mqtt_connected ? 'text-green-600' : 'text-red-600'}`}>
            {integratedData.mqtt_connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Data Availability Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className={`p-3 rounded-lg border-2 ${availability.cattle_sensors_available ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center">
            <Activity className={`h-5 w-5 mr-2 ${availability.cattle_sensors_available ? 'text-green-600' : 'text-gray-400'}`} />
            <span className="text-sm font-medium">
              Cattle Sensors: {availability.cattle_sensors_available ? 'Active' : 'No Data'}
            </span>
          </div>
        </div>

        <div className={`p-3 rounded-lg border-2 ${availability.environmental_data_available ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center">
            <Sun className={`h-5 w-5 mr-2 ${availability.environmental_data_available ? 'text-blue-600' : 'text-gray-400'}`} />
            <span className="text-sm font-medium">
              Environment: {availability.environmental_data_available ? 'Active' : 'No Data'}
            </span>
          </div>
        </div>

        <div className={`p-3 rounded-lg border-2 ${availability.both_available ? 'border-purple-200 bg-purple-50' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center">
            <Heart className={`h-5 w-5 mr-2 ${availability.both_available ? 'text-purple-600' : 'text-gray-400'}`} />
            <span className="text-sm font-medium">
              Full Integration: {availability.both_available ? 'Complete' : 'Partial'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Data Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Cattle Sensor Data */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 flex items-center">
            <Activity className="mr-2 h-5 w-5 text-blue-600" />
            Cattle Sensor Data
          </h3>

          {availability.cattle_sensors_available ? (
            <>
              {/* Health Status */}
              {healthPrediction && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Health Status</p>
                      <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getHealthColor(healthPrediction.prediction)}`}>
                        {healthPrediction.prediction}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Confidence</p>
                      <p className="text-lg font-bold text-gray-800">{healthPrediction.confidence}%</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Cattle ID and Temperature */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <p className="text-sm text-blue-600 mb-1">Cattle ID</p>
                  <p className="text-lg font-bold text-blue-800">{cattleSensors.cattle_id}</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg text-center">
                  <Thermometer className="mx-auto h-6 w-6 text-orange-600 mb-1" />
                  <p className={`text-lg font-bold ${getTempColor(cattleSensors.body_temperature)}`}>
                    {cattleSensors.body_temperature?.toFixed(1) || 0}°C
                  </p>
                  <p className="text-xs text-orange-600">Body Temp</p>
                </div>
              </div>

              {/* Accelerometer Data */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Accelerometer (m/s²)</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 bg-red-50 rounded text-center">
                    <p className="text-sm font-bold text-red-800">{cattleSensors.accelerometer.x?.toFixed(1)}</p>
                    <p className="text-xs text-red-600">X</p>
                  </div>
                  <div className="p-2 bg-green-50 rounded text-center">
                    <p className="text-sm font-bold text-green-800">{cattleSensors.accelerometer.y?.toFixed(1)}</p>
                    <p className="text-xs text-green-600">Y</p>
                  </div>
                  <div className="p-2 bg-blue-50 rounded text-center">
                    <p className="text-sm font-bold text-blue-800">{cattleSensors.accelerometer.z?.toFixed(1)}</p>
                    <p className="text-xs text-blue-600">Z</p>
                  </div>
                </div>
              </div>

              {/* Gyroscope Data */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Gyroscope (°/s)</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 bg-purple-50 rounded text-center">
                    <Compass className="mx-auto h-4 w-4 text-purple-600 mb-1" />
                    <p className="text-sm font-bold text-purple-800">{cattleSensors.gyroscope.x?.toFixed(1)}</p>
                    <p className="text-xs text-purple-600">Pitch</p>
                  </div>
                  <div className="p-2 bg-indigo-50 rounded text-center">
                    <Compass className="mx-auto h-4 w-4 text-indigo-600 mb-1" />
                    <p className="text-sm font-bold text-indigo-800">{cattleSensors.gyroscope.y?.toFixed(1)}</p>
                    <p className="text-xs text-indigo-600">Roll</p>
                  </div>
                  <div className="p-2 bg-pink-50 rounded text-center">
                    <Compass className="mx-auto h-4 w-4 text-pink-600 mb-1" />
                    <p className="text-sm font-bold text-pink-800">{cattleSensors.gyroscope.z?.toFixed(1)}</p>
                    <p className="text-xs text-pink-600">Yaw</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Activity className="mx-auto h-12 w-12 text-gray-400 mb-2" />
              <p>No cattle sensor data available</p>
            </div>
          )}
        </div>

        {/* Environmental Data */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 flex items-center">
            <Sun className="mr-2 h-5 w-5 text-yellow-600" />
            Environmental Data
          </h3>

          {availability.environmental_data_available ? (
            <>
              {/* Light and Time Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-yellow-50 rounded-lg text-center">
                  {environment.day_night === 'day' ? (
                    <Sun className="mx-auto h-6 w-6 text-yellow-600 mb-1" />
                  ) : (
                    <Moon className="mx-auto h-6 w-6 text-blue-600 mb-1" />
                  )}
                  <p className="text-lg font-bold text-gray-800">{environment.light_level}</p>
                  <p className="text-xs text-gray-600">Light Level</p>
                  <p className={`text-sm font-medium ${environment.day_night === 'day' ? 'text-yellow-600' : 'text-blue-600'}`}>
                    {environment.day_night === 'day' ? 'Daytime' : 'Nighttime'}
                  </p>
                </div>

                <div className="p-3 bg-green-50 rounded-lg text-center">
                  {environment.cattle_presence ? (
                    <Eye className="mx-auto h-6 w-6 text-green-600 mb-1" />
                  ) : (
                    <Eye className="mx-auto h-6 w-6 text-gray-400 mb-1" />
                  )}
                  <p className={`text-lg font-bold ${environment.cattle_presence ? 'text-green-800' : 'text-gray-500'}`}>
                    {environment.cattle_presence ? 'Detected' : 'None'}
                  </p>
                  <p className="text-xs text-gray-600">Cattle Presence</p>
                </div>
              </div>

              {/* Temperature and Humidity */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-orange-50 rounded-lg text-center">
                  <Thermometer className="mx-auto h-6 w-6 text-orange-600 mb-1" />
                  <p className={`text-lg font-bold ${getTempColor(environment.ambient_temperature)}`}>
                    {environment.ambient_temperature?.toFixed(1) || 0}°C
                  </p>
                  <p className="text-xs text-orange-600">Ambient Temp</p>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <Droplets className="mx-auto h-6 w-6 text-blue-600 mb-1" />
                  <p className="text-lg font-bold text-blue-800">
                    {environment.humidity?.toFixed(1) || 0}%
                  </p>
                  <p className="text-xs text-blue-600">Humidity</p>
                </div>
              </div>

              {/* Temperature Comparison */}
              {availability.both_available && (
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="text-sm font-medium text-purple-800 mb-2">Temperature Analysis</h4>
                  <div className="flex justify-between items-center">
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Body Temp</p>
                      <p className="text-sm font-bold text-purple-800">{cattleSensors.body_temperature?.toFixed(1)}°C</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Difference</p>
                      <p className="text-sm font-bold text-purple-800">
                        ±{data.statistics.temperature_difference?.toFixed(1)}°C
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Ambient Temp</p>
                      <p className="text-sm font-bold text-purple-800">{environment.ambient_temperature?.toFixed(1)}°C</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Sun className="mx-auto h-12 w-12 text-gray-400 mb-2" />
              <p>No environmental data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer Status */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center space-x-4">
            <span className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              Last update: {data.timestamp}
            </span>
            <span>
              Readings: C:{data.statistics.cattle_readings_count} | E:{data.statistics.environmental_readings_count}
            </span>
          </div>
          <div className={`flex items-center ${availability.both_available ? 'text-green-600' : 'text-orange-600'}`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${availability.both_available ? 'bg-green-500' : 'bg-orange-500'} animate-pulse`}></div>
            {availability.both_available ? 'Full Integration Active' : 'Partial Data Available'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegratedDashboard;
