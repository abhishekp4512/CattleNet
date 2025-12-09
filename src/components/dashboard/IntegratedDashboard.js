import React, { useState, useEffect } from 'react';
import { Activity, Thermometer, Droplets, Sun, Moon } from 'lucide-react';
import Card from '../ui/card';
import { API_BASE_URL } from '../../config';

const IntegratedDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/integrated-data`);
        if (response.ok) {
          const result = await response.json();
          if (result.status === 'success') {
            setData(result.data);
          }
        }
      } catch (error) {
        console.error('Error fetching integrated data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card className="p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cattle Status Card */}
        <Card className="p-6 border-l-4 border-blue-500">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                <Activity className="w-5 h-5 mr-2 text-blue-500" />
                Cattle Status
              </h3>
              <p className="text-sm text-gray-500">ID: {data.cattle_sensors?.cattle_id}</p>
            </div>
            {data.health_prediction && (
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${data.health_prediction.prediction === 'Normal'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
                }`}>
                {data.health_prediction.prediction}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-xs text-blue-600 uppercase">Body Temp</p>
              <p className="text-xl font-bold text-blue-900">
                {data.cattle_sensors?.body_temperature?.toFixed(1)}°C
              </p>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <p className="text-xs text-purple-600 uppercase">Movement</p>
              <div className="flex space-x-2 text-xs text-purple-900 mt-1">
                <span>X: {data.cattle_sensors?.accelerometer?.x?.toFixed(2)}</span>
                <span>Y: {data.cattle_sensors?.accelerometer?.y?.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Environment Status Card */}
        <Card className="p-6 border-l-4 border-green-500">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                <Sun className="w-5 h-5 mr-2 text-orange-500" />
                Environment
              </h3>
              <p className="text-sm text-gray-500">
                {data.environment?.day_night === 'day' ? 'Daytime' : 'Nighttime'}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${data.environment?.cattle_presence
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-600'
              }`}>
              {data.environment?.cattle_presence ? 'Cattle Present' : 'No Presence'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-orange-50 p-3 rounded-lg">
              <div className="flex items-center mb-1">
                <Thermometer className="w-4 h-4 text-orange-500 mr-1" />
                <p className="text-xs text-orange-600 uppercase">Ambient Temp</p>
              </div>
              <p className="text-xl font-bold text-orange-900">
                {data.environment?.ambient_temperature?.toFixed(1)}°C
              </p>
            </div>
            <div className="bg-cyan-50 p-3 rounded-lg">
              <div className="flex items-center mb-1">
                <Droplets className="w-4 h-4 text-cyan-500 mr-1" />
                <p className="text-xs text-cyan-600 uppercase">Humidity</p>
              </div>
              <p className="text-xl font-bold text-cyan-900">
                {data.environment?.humidity?.toFixed(1)}%
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default IntegratedDashboard;
