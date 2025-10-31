import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Clock } from 'lucide-react';

const TimeSeriesChart = ({ data }) => {
  const [chartData, setChartData] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('temperature');
  
  useEffect(() => {
    if (data && data.length > 0) {
      // Process the data for the chart
      const processedData = data.slice(-20).map((item, index) => ({
        time: new Date(item.timestamp).toLocaleTimeString(),
        timestamp: item.timestamp,
        temperature: item.temperature || 0,
        acc_x: Math.abs(item.acc_x) || 0,
        acc_y: Math.abs(item.acc_y) || 0,
        acc_z: Math.abs(item.acc_z) || 0,
        activity: Math.sqrt((item.acc_x || 0)**2 + (item.acc_y || 0)**2 + (item.acc_z || 0)**2)
      }));
      setChartData(processedData);
    } else {
      // Generate sample data when no real data is available
      const sampleData = Array.from({ length: 10 }, (_, i) => {
        const now = new Date();
        const time = new Date(now.getTime() - (9 - i) * 60000); // Every minute for last 10 minutes
        return {
          time: time.toLocaleTimeString(),
          timestamp: time.toISOString(),
          temperature: 25 + Math.random() * 8, // 25-33°C
          acc_x: Math.random() * 100,
          acc_y: Math.random() * 100,
          acc_z: Math.random() * 100,
          activity: Math.random() * 150
        };
      });
      setChartData(sampleData);
    }
  }, [data]);

  const metrics = [
    { key: 'temperature', label: 'Temperature (°C)', color: '#EF4444' },
    { key: 'activity', label: 'Activity Level', color: '#3B82F6' },
    { key: 'acc_x', label: 'Acceleration X', color: '#10B981' },
    { key: 'acc_y', label: 'Acceleration Y', color: '#F59E0B' },
    { key: 'acc_z', label: 'Acceleration Z', color: '#8B5CF6' }
  ];

  const currentMetric = metrics.find(m => m.key === selectedMetric);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <TrendingUp className="mr-2 h-5 w-5 text-blue-600" />
          Real-time Trends
        </h3>
        <div className="flex items-center text-sm text-gray-500">
          <Clock className="mr-1 h-4 w-4" />
          Last 10 readings
        </div>
      </div>

      {/* Metric Selector */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          {metrics.map(metric => (
            <button
              key={metric.key}
              onClick={() => setSelectedMetric(metric.key)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedMetric === metric.key
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {metric.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="time" 
              stroke="#6B7280"
              fontSize={12}
              tickFormatter={(value) => value.slice(0, 5)} // Show only HH:MM
            />
            <YAxis 
              stroke="#6B7280"
              fontSize={12}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e5e7eb', 
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              labelFormatter={(value) => `Time: ${value}`}
              formatter={(value) => [
                typeof value === 'number' ? value.toFixed(2) : value, 
                currentMetric?.label
              ]}
            />
            <Line 
              type="monotone" 
              dataKey={selectedMetric} 
              stroke={currentMetric?.color || '#3B82F6'}
              strokeWidth={2}
              dot={{ fill: currentMetric?.color || '#3B82F6', strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5, fill: currentMetric?.color || '#3B82F6' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Current Value Display */}
      {chartData.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Current {currentMetric?.label}</p>
              <p className="text-2xl font-bold" style={{ color: currentMetric?.color }}>
                {chartData[chartData.length - 1]?.[selectedMetric]?.toFixed(2) || 'N/A'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Data Points</p>
              <p className="text-lg font-medium text-gray-800">{chartData.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Status */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Real-time monitoring active</span>
          <span className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
            Live Data
          </span>
        </div>
      </div>
    </div>
  );
};

export default TimeSeriesChart;