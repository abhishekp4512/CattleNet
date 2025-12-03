import React, { useState, useEffect } from 'react';
import EnvironmentalCard from './components/dashboard/EnvironmentalCard';
import EnvironmentalDataTable from './components/dashboard/EnvironmentalDataTable';
import IntegratedDashboard from './components/dashboard/IntegratedDashboard';

const EnvironmentalMonitor = () => {
  const [environmentalData, setEnvironmentalData] = useState(null);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/environment');
      const data = await response.json();
      setEnvironmentalData(data);
      console.log('Environmental data:', data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching environmental data:', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Environmental Monitoring Dashboard
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            Error: {error}
          </div>
        )}

        {/* Debug Info */}
        <div className="bg-blue-50 border border-blue-200 p-4 rounded mb-6">
          <h3 className="font-semibold text-blue-800">Debug Information:</h3>
          <p className="text-blue-600">
            API Status: {environmentalData ? 'Connected ✅' : 'Loading...'}
          </p>
          {environmentalData?.latest_data && (
            <div className="mt-2 text-sm text-blue-700">
              <p>Latest: {environmentalData.latest_data.timestamp}</p>
              <p>Temperature: {environmentalData.latest_data.env_temperature}°C</p>
              <p>Humidity: {environmentalData.latest_data.humidity}%</p>
              <p>Light Level: {environmentalData.latest_data.ldr_value}</p>
            </div>
          )}
        </div>

        {/* Integrated Dashboard */}
        <div className="mb-8">
          <IntegratedDashboard />
        </div>

        {/* Environmental Card */}
        <div className="mb-8">
          <EnvironmentalCard />
        </div>

        {/* Environmental Data Table */}
        <div className="mb-8">
          <EnvironmentalDataTable />
        </div>
      </div>
    </div>
  );
};

export default EnvironmentalMonitor;
