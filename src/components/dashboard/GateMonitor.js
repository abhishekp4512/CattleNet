import React, { useEffect, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";
const WEBSOCKET_URL = process.env.REACT_APP_WEBSOCKET_URL || "http://127.0.0.1:5000";

const GateMonitor = () => {
  const [gateData, setGateData] = useState(null);
  const [cattleRegistry, setCattleRegistry] = useState({});
  const [recentActivity, setRecentActivity] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Fetch initial gate data
    const fetchGateData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_BASE_URL}/api/gate`);
        
        if (response.data.status === "success") {
          setGateData(response.data.latest_data);
          setCattleRegistry(response.data.cattle_registry);
          setRecentActivity(response.data.recent_activity);
          setStatistics(response.data.statistics);
        } else {
          setError("Failed to fetch gate data");
        }
      } catch (err) {
        setError("Error connecting to the server. Is the backend running?");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    // Initialize WebSocket connection for real-time updates
    const socket = io(WEBSOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      console.log('Connected to gate monitoring WebSocket');
      setConnected(true);
      setError(null);
    });

    socket.on('gate_update', (data) => {
      console.log('Received gate update:', data);
      
      if (data.data) {
        setGateData(data.data);
        
        // Update recent activity
        setRecentActivity(prev => {
          const newActivity = [data.data, ...prev.slice(0, 9)]; // Keep last 10
          return newActivity;
        });
        
        // Update cattle registry if available
        if (data.registry && data.data.rfid_tag) {
          setCattleRegistry(prev => ({
            ...prev,
            [data.data.rfid_tag]: data.registry
          }));
        }
        
        // Update statistics (simplified)
        setStatistics(prev => ({
          ...prev,
          total_readings: (prev.total_readings || 0) + 1
        }));
      }
    });

    socket.on('connect_error', (error) => {
      console.error('Gate WebSocket connection error:', error);
      setConnected(false);
      setError("Failed to connect to real-time gate monitoring");
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from gate monitoring WebSocket');
      setConnected(false);
    });

    // Initial data fetch
    fetchGateData();

    // Cleanup
    return () => {
      socket.disconnect();
    };
  }, []);

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getDirectionIcon = (direction) => {
    switch (direction?.toLowerCase()) {
      case 'in':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
        );
      case 'out':
        return (
          <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'reading':
        return 'text-green-600 bg-green-100';
      case 'error':
      case 'failed':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-100 border-t-primary rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl">🚪</span>
          </div>
        </div>
        <p className="text-gray-600 mt-6 animate-pulse">Loading gate monitoring data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto p-8 bg-white rounded-lg shadow-md text-center my-8">
        <h3 className="text-xl font-bold text-danger mb-4">Error</h3>
        <p className="text-gray-700 mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-hover transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <svg className="w-6 h-6 mr-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            Gate Activity Monitor
          </h2>
          
          {connected && (
            <div className="flex items-center bg-green-50 text-green-700 px-4 py-2 rounded-full">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              <span className="text-sm font-medium">Live Monitoring</span>
            </div>
          )}
        </div>

        <p className="text-gray-600">
          Real-time monitoring of cattle movement through RFID gates with weight measurement and activity tracking.
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Entries</p>
              <p className="text-2xl font-bold text-green-600">{statistics.total_entries || 0}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Exits</p>
              <p className="text-2xl font-bold text-orange-600">{statistics.total_exits || 0}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Unique Cattle</p>
              <p className="text-2xl font-bold text-blue-600">{statistics.unique_cattle || 0}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Avg Weight</p>
              <p className="text-2xl font-bold text-purple-600">
                {statistics.weight_stats?.average ? `${statistics.weight_stats.average}kg` : 'N/A'}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Latest Gate Reading */}
      {gateData && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Latest Gate Reading
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">RFID Tag</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(gateData.gate_status)}`}>
                  {gateData.gate_status || 'Unknown'}
                </span>
              </div>
              <p className="text-lg font-bold text-gray-800">{gateData.rfid_tag || 'No Tag'}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Weight</span>
                <span className="text-xs text-gray-500">kg</span>
              </div>
              <p className="text-lg font-bold text-gray-800">{gateData.weight || 0}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Direction</span>
                {getDirectionIcon(gateData.direction)}
              </div>
              <p className="text-lg font-bold text-gray-800 capitalize">{gateData.direction || 'Unknown'}</p>
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-500">
            Last updated: {gateData.timestamp ? formatTimestamp(gateData.timestamp) : 'N/A'}
          </div>
        </div>
      )}

      {/* Cattle Registry and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cattle Registry */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Registered Cattle
          </h3>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {Object.keys(cattleRegistry).length === 0 ? (
              <p className="text-gray-500 text-center py-8">No cattle registered yet</p>
            ) : (
              Object.entries(cattleRegistry).map(([rfidTag, cattleInfo]) => (
                <div key={rfidTag} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-800">RFID: {rfidTag}</p>
                      <p className="text-sm text-gray-600">Latest Weight: {cattleInfo.latest_weight}kg</p>
                      <p className="text-xs text-gray-500">Last Seen: {formatTimestamp(cattleInfo.last_seen)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-blue-600">{cattleInfo.total_entries} entries</p>
                      <button 
                        className="text-xs text-primary hover:underline"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Recent Activity
          </h3>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {recentActivity.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No recent activity</p>
            ) : (
              recentActivity.map((activity, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getDirectionIcon(activity.direction)}
                      <div>
                        <p className="font-medium text-gray-800">{activity.rfid_tag || 'Unknown RFID'}</p>
                        <p className="text-sm text-gray-600">{activity.weight}kg</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{formatTimestamp(activity.timestamp)}</p>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(activity.gate_status)}`}>
                        {activity.gate_status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* RFID Status Indicators */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
          System Status
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <span className="text-gray-700">RFID Reader</span>
            <div className={`flex items-center ${connected ? 'text-green-600' : 'text-red-600'}`}>
              <span className={`w-2 h-2 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className="text-sm font-medium">{connected ? 'Active' : 'Offline'}</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <span className="text-gray-700">Load Cell</span>
            <div className={`flex items-center ${gateData?.weight > 0 ? 'text-green-600' : 'text-gray-600'}`}>
              <span className={`w-2 h-2 rounded-full mr-2 ${gateData?.weight > 0 ? 'bg-green-500' : 'bg-gray-400'}`}></span>
              <span className="text-sm font-medium">{gateData?.weight > 0 ? 'Reading' : 'Standby'}</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <span className="text-gray-700">Gate Control</span>
            <div className={`flex items-center ${gateData?.gate_status === 'active' ? 'text-green-600' : 'text-gray-600'}`}>
              <span className={`w-2 h-2 rounded-full mr-2 ${gateData?.gate_status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
              <span className="text-sm font-medium capitalize">{gateData?.gate_status || 'Unknown'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GateMonitor;
