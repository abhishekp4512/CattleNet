import React from 'react';
import { Activity, Thermometer, Compass, Clock } from 'lucide-react';

const LatestReadings = ({ data }) => {
  if (!data || !data.data) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <Activity className="mr-2 h-5 w-5 text-blue-600" />
          Latest Sensor Readings
        </h3>
        <div className="text-center py-8">
          <Activity className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500">No sensor data available</p>
          <p className="text-sm text-gray-400 mt-2">Waiting for cattle sensor readings...</p>
        </div>
      </div>
    );
  }

  const sensorData = data.data;
  const prediction = data.prediction;
  const confidence = data.confidence;

  const getPredictionColor = (prediction) => {
    switch (prediction?.toLowerCase()) {
      case 'normal':
        return 'text-green-600 bg-green-100';
      case 'anomaly':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <Activity className="mr-2 h-5 w-5 text-blue-600" />
          Latest Sensor Readings
        </h3>
        <div className="text-sm text-gray-500 flex items-center">
          <Clock className="mr-1 h-4 w-4" />
          {sensorData.timestamp}
        </div>
      </div>

      {/* Cattle Info */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Cattle ID</p>
            <p className="text-lg font-medium text-gray-800">{sensorData.cattle_id}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Health Status</p>
            <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getPredictionColor(prediction)}`}>
              {prediction}
            </span>
          </div>
        </div>
        {confidence && (
          <div className="mt-2">
            <p className="text-sm text-gray-600">
              Confidence: <span className="font-medium">{confidence}%</span>
            </p>
          </div>
        )}
      </div>

      {/* Sensor Data Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {/* Temperature */}
        <div className="text-center p-3 bg-orange-50 rounded-lg">
          <Thermometer className="mx-auto h-6 w-6 text-orange-600 mb-1" />
          <p className="text-2xl font-bold text-orange-800">
            {sensorData.temperature?.toFixed(1) || 0}°C
          </p>
          <p className="text-xs text-orange-600">Temperature</p>
        </div>

        {/* Accelerometer X */}
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <Compass className="mx-auto h-6 w-6 text-blue-600 mb-1" />
          <p className="text-xl font-bold text-blue-800">
            {sensorData.acc_x?.toFixed(1) || 0}
          </p>
          <p className="text-xs text-blue-600">Accel X</p>
        </div>

        {/* Accelerometer Y */}
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <Compass className="mx-auto h-6 w-6 text-green-600 mb-1" />
          <p className="text-xl font-bold text-green-800">
            {sensorData.acc_y?.toFixed(1) || 0}
          </p>
          <p className="text-xs text-green-600">Accel Y</p>
        </div>

        {/* Accelerometer Z */}
        <div className="text-center p-3 bg-purple-50 rounded-lg">
          <Compass className="mx-auto h-6 w-6 text-purple-600 mb-1" />
          <p className="text-xl font-bold text-purple-800">
            {sensorData.acc_z?.toFixed(1) || 0}
          </p>
          <p className="text-xs text-purple-600">Accel Z</p>
        </div>
      </div>

      {/* Gyroscope Data */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-3 bg-indigo-50 rounded-lg">
          <p className="text-lg font-bold text-indigo-800">
            {sensorData.gyro_x?.toFixed(1) || 0}
          </p>
          <p className="text-xs text-indigo-600">Gyro X</p>
        </div>

        <div className="text-center p-3 bg-pink-50 rounded-lg">
          <p className="text-lg font-bold text-pink-800">
            {sensorData.gyro_y?.toFixed(1) || 0}
          </p>
          <p className="text-xs text-pink-600">Gyro Y</p>
        </div>

        <div className="text-center p-3 bg-yellow-50 rounded-lg">
          <p className="text-lg font-bold text-yellow-800">
            {sensorData.gyro_z?.toFixed(1) || 0}
          </p>
          <p className="text-xs text-yellow-600">Gyro Z</p>
        </div>
      </div>

      {/* Important Features */}
      {data.important_features && data.important_features.length > 0 && (
        <div className="mt-4 p-3 bg-amber-50 rounded-lg">
          <p className="text-sm text-amber-800 font-medium mb-2">Key Indicators:</p>
          <div className="flex flex-wrap gap-2">
            {data.important_features.map((feature, index) => (
              <span key={index} className="inline-flex px-2 py-1 bg-amber-200 text-amber-800 text-xs rounded-full">
                {feature}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LatestReadings;