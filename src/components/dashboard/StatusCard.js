import React from 'react';

const StatusCard = ({ title, value, status, icon, trend }) => {
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'normal':
      case 'good':
        return 'text-green-600 bg-green-100';
      case 'warning':
      case 'moderate':
        return 'text-yellow-600 bg-yellow-100';
      case 'danger':
      case 'critical':
      case 'high':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getTrendIcon = (trend) => {
    if (trend > 0) return '↗️';
    if (trend < 0) return '↘️';
    return '→';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow duration-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-700">{title}</h3>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
      
      <div className="space-y-3">
        <div className="text-3xl font-bold text-gray-900">{value}</div>
        
        {status && (
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status)}`}>
            {status}
          </div>
        )}
        
        {trend !== undefined && (
          <div className="flex items-center text-sm text-gray-600">
            <span className="mr-1">{getTrendIcon(trend)}</span>
            <span>
              {Math.abs(trend).toFixed(1)}% from last reading
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusCard;
