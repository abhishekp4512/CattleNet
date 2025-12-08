import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import GateMonitor from './components/dashboard/GateMonitor';
import EnvironmentalMonitor from './EnvironmentalMonitor';
import FeedMonitorComponent from './components/dashboard/FeedMonitor';

import IntegratedDashboard from './components/dashboard/IntegratedDashboard';
import HealthStats from './components/dashboard/HealthStats';
import EnvironmentalDataTable from './components/dashboard/EnvironmentalDataTable';
import DashboardLayout from './components/dashboard/DashboardLayout';


function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sensorData, setSensorData] = useState([]);
  const [latestData, setLatestData] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [importantFeatures, setImportantFeatures] = useState([]);
  const [healthStats, setHealthStats] = useState(null);
  const [connected, setConnected] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testData, setTestData] = useState({
    acc_x: 120, acc_y: 15, acc_z: 20,
    gyro_x: 1.5, gyro_y: 1.2, gyro_z: 0.8
  });

  // Use environment variable for backend API URL
  // In production on Vercel, point to Render backend
  // In development, use localhost
  const isProduction = process.env.NODE_ENV === 'production';
  const API_BASE_URL = process.env.REACT_APP_API_URL || (isProduction ? 'https://cattlenet-backend.onrender.com' : 'http://localhost:5001');
  const WEBSOCKET_URL = process.env.REACT_APP_WEBSOCKET_URL || API_BASE_URL;
  const maxDataPoints = 20;
  const socketRef = useRef(null);

  useEffect(() => {
    // Initial data fetch to populate historical data
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        // Fetch sensor data
        const dataResponse = await axios.get(`${API_BASE_URL}/api/data`);

        if (dataResponse.data.status === "success") {
          setSensorData(dataResponse.data.data.reverse()); // Most recent data first

          // Extract the latest data point
          if (dataResponse.data.data.length > 0) {
            setLatestData(dataResponse.data.data[0]);
          }
        } else {
          setError("Failed to fetch sensor data");
        }

        // Fetch prediction
        const predictionResponse = await axios.get(`${API_BASE_URL}/api/predict`);
        if (predictionResponse.data.status === "success") {
          setPrediction(predictionResponse.data.prediction);
          setConfidence(predictionResponse.data.confidence);
          setImportantFeatures(predictionResponse.data.important_features || []);
        } else {
          setError("Failed to fetch prediction");
        }

        // Fetch health statistics
        const statsResponse = await axios.get(`${API_BASE_URL}/api/health-stats`);
        if (statsResponse.data.status === "success") {
          setHealthStats(statsResponse.data.health_stats);
        }
      } catch (err) {
        setError(`Error connecting to ${API_BASE_URL}. Is the backend running?`);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    // Initialize WebSocket connection
    socketRef.current = io(WEBSOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5
    });

    // Handle successful connection
    socketRef.current.on('connect', () => {
      console.log('Connected to WebSocket server');
      setConnected(true);
      setError(null);
    });

    // Handle connection response
    socketRef.current.on('connection_response', (data) => {
      console.log('Connection response:', data);
    });

    // Handle real-time sensor updates
    socketRef.current.on('sensor_update', (data) => {
      console.log('Received real-time update:', data);

      // Update latest data point
      setLatestData(data.data);

      // Update prediction, confidence, and important features
      setPrediction(data.prediction);
      setConfidence(data.confidence);
      if (data.important_features) {
        setImportantFeatures(data.important_features);
      }

      // Add new data point to the history, keeping only the most recent ones
      setSensorData(prevData => {
        const newData = [data.data, ...prevData.slice(0, maxDataPoints - 1)];
        return newData;
      });
    });

    // Handle connection errors
    socketRef.current.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnected(false);
      setError("Failed to connect to real-time server. Falling back to polling.");

      // If WebSocket fails, fall back to regular HTTP polling
      fetchInitialData();
    });

    // Handle disconnection
    socketRef.current.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      setConnected(false);
    });

    // Initial data fetch
    fetchInitialData();

    // Cleanup on unmount
    return () => {
      // Disconnect socket if it exists
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);



  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const testCattleData = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/test-data`, testData);
      if (response.data.status === 'success') {
        setTestResult(response.data);
      } else {
        setTestResult({ error: 'Failed to analyze test data' });
      }
    } catch (err) {
      console.error('Error testing cattle data:', err);
      setTestResult({
        error: 'Error connecting to the server',
        message: err.message
      });
    }
  };

  const handleTestDataChange = (e) => {
    const { name, value } = e.target;
    setTestData(prev => ({ ...prev, [name]: parseFloat(value) }));
  };

  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center h-[60vh]">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-blue-100 border-t-primary rounded-full animate-spin"></div>
        <div className="w-16 h-16 border-4 border-transparent border-r-secondary absolute top-0 rounded-full animate-pulse"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl text-primary">🐄</span>
        </div>
      </div>
      <p className="text-gray-600 mt-6 animate-pulse">Loading cattle monitoring data...</p>
    </div>
  );

  const renderError = () => (
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

  const renderDataTable = () => (
    <div className="space-y-6 animate-fadeIn">
      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Sensor Data History
          </h3>
          <button className="text-sm text-primary hover:text-primary-dark font-medium flex items-center transition-colors">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acc X</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acc Y</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acc Z</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gyro X</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gyro Y</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gyro Z</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sensorData.length > 0 ? (
                sensorData.map((data, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{formatTimestamp(data.timestamp)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{data.acc_x.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{data.acc_y.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{data.acc_z.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{data.gyro_x.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{data.gyro_y.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{data.gyro_z.toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-10 text-center text-gray-500 italic">
                    No data available. Waiting for sensor readings...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Environmental Data Table */}
      <EnvironmentalDataTable />
    </div>
  );

  const renderDashboard = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
      {/* Status Card */}
      <div className={`bg-white rounded-xl shadow-lg p-6 relative overflow-hidden backdrop-blur-sm ${prediction === "Normal"
        ? "border-l-4 border-success"
        : "border-l-4 border-danger"
        }`}>
        {/* Background decorative elements */}
        <div className={`absolute -right-8 -bottom-8 w-32 h-32 rounded-full opacity-10 ${prediction === "Normal" ? "bg-success" : "bg-danger"
          }`}></div>
        <div className={`absolute -left-4 -top-4 w-16 h-16 rounded-full opacity-10 ${prediction === "Normal" ? "bg-success" : "bg-danger"
          }`}></div>

        <h3 className="text-lg font-semibold text-gray-800 pb-3 mb-4 border-b border-gray-200 flex items-center justify-between">
          <span className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Cattle Status
          </span>
          {connected && (
            <span className="bg-danger text-white text-xs font-bold px-3 py-1 rounded-full flex items-center animate-pulse shadow-md">
              <span className="w-1.5 h-1.5 bg-white rounded-full mr-1.5"></span>
              LIVE
            </span>
          )}
        </h3>

        {/* Status indicator with cool effects */}
        <div className="relative w-36 h-36 mx-auto my-2">
          <div className={`absolute inset-0 rounded-full opacity-30 ${prediction === "Normal" ? "bg-success" : "bg-danger"
            } blur-md transform scale-110 animate-pulse-slow`}></div>

          <div className={`absolute inset-0 rounded-full ${prediction === "Normal"
            ? "border-2 border-success animate-spin-slow"
            : "border-2 border-danger animate-spin-slow"
            }`}></div>

          <div className="absolute inset-0 rounded-full border-2 border-gray-100 border-dashed animate-spin-reverse-slow"></div>

          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <span className={`text-3xl font-bold ${prediction === "Normal" ? "text-success" : "text-danger"}`}>
              {prediction || "--"}
            </span>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-1">Status</span>
          </div>
        </div>

        {/* Confidence Bar */}
        {confidence && (
          <div className="mt-4 mb-2">
            <div className="flex justify-between items-end mb-1">
              <span className="text-sm text-gray-600 flex items-center">
                <svg className="w-4 h-4 mr-1 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                Confidence Level
              </span>
              <span className={`text-sm font-medium px-2 py-0.5 rounded ${confidence > 75
                ? "bg-success-light text-success"
                : confidence > 50
                  ? "bg-warning-light text-warning"
                  : "bg-danger-light text-danger"
                }`}>
                {confidence}%
              </span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out ${confidence > 75
                  ? "bg-gradient-to-r from-green-400 to-success"
                  : confidence > 50
                    ? "bg-gradient-to-r from-yellow-400 to-warning"
                    : "bg-gradient-to-r from-red-400 to-danger"
                  }`}
                style={{ width: `${confidence}%` }}
              >
                <div className="w-full h-full opacity-50 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(255,255,255,0.2)_5px,rgba(255,255,255,0.2)_10px)]"></div>
              </div>
            </div>
          </div>
        )}

        <p className="text-gray-600 text-sm my-4">
          {prediction === "Normal"
            ? "The cattle appears to be behaving normally with all vital signs within expected ranges."
            : "Potential anomaly detected in cattle behavior. Review readings for more details."}
        </p>

        {/* Important Features */}
        {importantFeatures && importantFeatures.length > 0 && (
          <div className="mt-4 p-3 bg-gray-50 rounded-md border-l-4 border-primary">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Contributing Factors:</h4>
            <ul className="pl-5 list-disc text-sm text-gray-600">
              {importantFeatures.map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Real-time indicator */}
        {connected && (
          <div className="mt-4 mx-auto w-fit flex items-center justify-center bg-danger-light px-4 py-2 rounded-full text-sm text-gray-600">
            <span className="w-2 h-2 rounded-full bg-danger mr-2 animate-pulse"></span>
            <span>Real-time monitoring active</span>
          </div>
        )}
      </div>

      {/* Health Stats */}
      <HealthStats stats={healthStats} />

      {/* Charts */}
      <div className="md:col-span-2 lg:col-span-3">
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              Live Movement Analysis
            </h3>
            <div className="flex space-x-2">
              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">Accelerometer</span>
              <span className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded">Gyroscope</span>
            </div>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sensorData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTimestamp}
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                  domain={['auto', 'auto']}
                  label={{ value: 'Accelerometer', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af' } }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  stroke="#8b5cf6"
                  domain={['auto', 'auto']}
                  label={{ value: 'Gyroscope', angle: 90, position: 'insideRight', style: { fill: '#8b5cf6' } }}
                />
                <Tooltip
                  labelFormatter={formatTimestamp}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="acc_x"
                  name="Acc X"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="acc_y"
                  name="Acc Y"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="acc_z"
                  name="Acc Z"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="gyro_x"
                  name="Gyro X"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="gyro_y"
                  name="Gyro Y"
                  stroke="#ec4899"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="gyro_z"
                  name="Gyro Z"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Sensor Data History
            </h3>
            <button className="text-sm text-primary hover:text-primary-dark font-medium flex items-center transition-colors">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acc X</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acc Y</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acc Z</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gyro X</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gyro Y</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gyro Z</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sensorData.length > 0 ? (
                  sensorData.map((data, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{formatTimestamp(data.timestamp)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{data.acc_x.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{data.acc_y.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{data.acc_z.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{data.gyro_x.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{data.gyro_y.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{data.gyro_z.toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-10 text-center text-gray-500 italic">
                      No data available. Waiting for sensor readings...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTestCattleData = () => (
    <div className="max-w-4xl mx-auto animate-fadeIn">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
        <div className="p-6 border-b border-gray-100 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            Test Cattle Data Analysis
          </h3>
          <p className="text-sm text-gray-500 mt-1">Simulate sensor readings to test the AI model's prediction capabilities.</p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-medium text-gray-700 mb-4 flex items-center">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs mr-2">1</span>
                Input Sensor Values
              </h4>
              <div className="grid grid-cols-2 gap-4">
                {Object.keys(testData).map((key) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{key.replace('_', ' ')}</label>
                    <input
                      type="number"
                      step="0.1"
                      name={key}
                      value={testData[key]}
                      onChange={handleTestDataChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <button
                  onClick={testCattleData}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium py-2 px-4 rounded-md shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  Analyze Data
                </button>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h4 className="font-medium text-gray-700 mb-4 flex items-center">
                <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs mr-2">2</span>
                Analysis Results
              </h4>

              {testResult ? (
                <div className="animate-fadeIn">
                  {testResult.error ? (
                    <div className="bg-red-50 text-red-700 p-4 rounded-md border border-red-200 flex items-start">
                      <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="font-bold">Analysis Failed</p>
                        <p className="text-sm">{testResult.message || testResult.error}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className={`p-4 rounded-md border flex items-center justify-between ${testResult.prediction === "Normal"
                        ? "bg-green-50 border-green-200 text-green-800"
                        : "bg-red-50 border-red-200 text-red-800"
                        }`}>
                        <div>
                          <p className="text-xs uppercase font-bold opacity-70">Prediction</p>
                          <p className="text-2xl font-bold">{testResult.prediction}</p>
                        </div>
                        <div className={`p-2 rounded-full ${testResult.prediction === "Normal" ? "bg-green-100" : "bg-red-100"
                          }`}>
                          {testResult.prediction === "Normal" ? (
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ) : (
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-gray-700">Confidence Score</span>
                          <span className="text-sm font-bold text-gray-900">{testResult.confidence}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full ${testResult.confidence > 80 ? 'bg-green-600' :
                              testResult.confidence > 60 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                            style={{ width: `${testResult.confidence}%` }}
                          ></div>
                        </div>
                      </div>

                      {testResult.important_features && testResult.important_features.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase mb-2">Key Factors</p>
                          <div className="flex flex-wrap gap-2">
                            {testResult.important_features.map((feature, idx) => (
                              <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded border border-gray-200">
                                {feature}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10">
                  <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p className="text-center">Enter sensor values and click "Analyze Data" to see AI predictions.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      connected={connected}
    >
      <div className="animate-fadeIn">
        <div className="transition-all duration-500 ease-in-out">
          {loading ? renderLoading() :
            error ? renderError() :
              activeTab === "dashboard" ? renderDashboard() :
                activeTab === "data" ? renderDataTable() :
                  activeTab === "gate" ? <GateMonitor /> :
                    activeTab === "environment" ? <EnvironmentalMonitor /> :
                      activeTab === "feed" ? <FeedMonitorComponent /> :
                        activeTab === "test" ? renderTestCattleData() :
                          null
          }
        </div>
      </div>
    </DashboardLayout>
  );
}

export default App;
