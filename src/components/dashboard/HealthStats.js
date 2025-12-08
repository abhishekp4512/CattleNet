import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Heart, AlertTriangle, Activity } from 'lucide-react';

const HealthStats = () => {
  const [healthData, setHealthData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHealthStats = async () => {
    try {
      const isProduction = process.env.NODE_ENV === 'production';
      const API_BASE_URL = isProduction ? '' : (process.env.REACT_APP_API_URL || 'http://localhost:5001');
      const response = await fetch(`${API_BASE_URL}/api/health-stats`);
      if (response.ok) {
        const data = await response.json();
        setHealthData(data);
      }
    } catch (error) {
      console.error('Error fetching health stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthStats();
    const interval = setInterval(fetchHealthStats, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded mb-4"></div>
        <div className="h-40 bg-gray-200 rounded"></div>
      </div>
    );
  }

  // Mock data for demonstration when API doesn't return data
  const mockData = {
    cattle_distribution: [
      { name: 'Healthy', value: 12, color: '#10B981' },
      { name: 'Monitoring', value: 3, color: '#F59E0B' },
      { name: 'At Risk', value: 1, color: '#EF4444' }
    ],
    activity_levels: [
      { period: '6AM', normal: 8, anomaly: 2 },
      { period: '12PM', normal: 12, anomaly: 1 },
      { period: '6PM', normal: 10, anomaly: 3 },
      { period: '12AM', normal: 5, anomaly: 0 }
    ],
    health_metrics: {
      total_cattle: 16,
      healthy_percentage: 75,
      average_temp: 28.5,
      activity_score: 85
    }
  };

  const data = (healthData?.status === 'success' && healthData?.cattle_distribution) ? healthData : mockData;
  const COLORS = ['#10B981', '#F59E0B', '#EF4444'];

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center">
        <Heart className="mr-2 h-5 w-5 text-red-600" />
        Health Statistics
      </h3>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <Activity className="mx-auto h-6 w-6 text-green-600 mb-2" />
          <p className="text-2xl font-bold text-green-800">{data.health_metrics?.total_cattle || 16}</p>
          <p className="text-xs text-green-600">Total Cattle</p>
        </div>

        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <TrendingUp className="mx-auto h-6 w-6 text-blue-600 mb-2" />
          <p className="text-2xl font-bold text-blue-800">{data.health_metrics?.healthy_percentage || 75}%</p>
          <p className="text-xs text-blue-600">Healthy</p>
        </div>

        <div className="text-center p-3 bg-orange-50 rounded-lg">
          <span className="text-2xl">🌡️</span>
          <p className="text-2xl font-bold text-orange-800">{data.health_metrics?.average_temp || 28.5}°C</p>
          <p className="text-xs text-orange-600">Avg Temp</p>
        </div>

        <div className="text-center p-3 bg-purple-50 rounded-lg">
          <AlertTriangle className="mx-auto h-6 w-6 text-purple-600 mb-2" />
          <p className="text-2xl font-bold text-purple-800">{data.health_metrics?.activity_score || 85}</p>
          <p className="text-xs text-purple-600">Activity Score</p>
        </div>
      </div>

      {/* Health Distribution Chart */}
      <div className="mb-6">
        <h4 className="text-md font-medium text-gray-700 mb-3">Health Distribution</h4>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.cattle_distribution}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {data.cattle_distribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Activity Levels Chart */}
      <div>
        <h4 className="text-md font-medium text-gray-700 mb-3">Daily Activity Patterns</h4>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.activity_levels}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="normal" fill="#10B981" name="Normal" />
              <Bar dataKey="anomaly" fill="#EF4444" name="Anomaly" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Status Footer */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
          <span className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
            System Active
          </span>
        </div>
      </div>
    </div>
  );
};

export default HealthStats;
