import React from 'react';
import { Wifi, WifiOff, AlertCircle, CheckCircle } from 'lucide-react';

const ConnectionStatus = ({ isConnected, status }) => {
  const getStatusColor = () => {
    if (isConnected) {
      return 'text-green-600 bg-green-100 border-green-200';
    } else {
      return 'text-red-600 bg-red-100 border-red-200';
    }
  };

  const getIcon = () => {
    if (isConnected) {
      return <CheckCircle className="h-4 w-4" />;
    } else {
      return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusText = () => {
    if (isConnected) {
      return 'MQTT Connected';
    } else {
      return status || 'Disconnected';
    }
  };

  return (
    <div className={`inline-flex items-center px-3 py-2 rounded-lg border text-sm font-medium ${getStatusColor()}`}>
      {getIcon()}
      <span className="ml-2">{getStatusText()}</span>
      <div className={`ml-2 w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
    </div>
  );
};

export default ConnectionStatus;