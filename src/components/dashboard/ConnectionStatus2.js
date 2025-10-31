import React from 'react';
import { Wifi, WifiOff, AlertCircle, CheckCircle } from 'lucide-react';

const ConnectionStatus = ({ isConnected, status }) => {
  const getStatusIcon = () => {
    if (isConnected) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    } else {
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    if (isConnected) {
      return 'text-green-600 bg-green-100 border-green-200';
    } else {
      return 'text-red-600 bg-red-100 border-red-200';
    }
  };

  return (
    <div className={`inline-flex items-center px-3 py-2 rounded-lg border text-sm font-medium ${getStatusColor()}`}>
      {getStatusIcon()}
      <span className="ml-2">
        MQTT: {status || (isConnected ? 'Connected' : 'Disconnected')}
      </span>
      {isConnected ? (
        <Wifi className="h-4 w-4 ml-2 text-green-500" />
      ) : (
        <WifiOff className="h-4 w-4 ml-2 text-red-500" />
      )}
    </div>
  );
};

export default ConnectionStatus;