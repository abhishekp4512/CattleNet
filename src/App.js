import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import TemperatureCard from "./components/dashboard/TemperatureCard";
import EnvironmentalMonitor from "./EnvironmentalMonitor";
import GateMonitor from "./components/dashboard/GateMonitor";

function App() {
  const [sensorData, setSensorData] = useState([]);
  const [latestData, setLatestData] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [healthStats, setHealthStats] = useState(null);
  const [importantFeatures, setImportantFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [connected, setConnected] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  
  // Test cattle data states
  const [testData, setTestData] = useState({
    acc_x: 120,
    acc_y: 15,
    acc_z: 20,
    gyro_x: 1.5,
    gyro_y: 1.2,
    gyro_z: 0.8
  });
  const [testResult, setTestResult] = useState(null);
  const socketRef = useRef(null);
  const maxDataPoints = 20; // Maximum number of data points to keep in state

  // Connect to WebSocket and set up real-time updates
  useEffect(() => {
    // Initial data fetch to populate historical data
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        // Fetch sensor data
        const dataResponse = await axios.get("http://127.0.0.1:5000/api/data");
        
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
        const predictionResponse = await axios.get("http://127.0.0.1:5000/api/predict");
        if (predictionResponse.data.status === "success") {
          setPrediction(predictionResponse.data.prediction);
          setConfidence(predictionResponse.data.confidence);
          setImportantFeatures(predictionResponse.data.important_features || []);
        } else {
          setError("Failed to fetch prediction");
        }
        
        // Fetch health statistics
        const statsResponse = await axios.get("http://127.0.0.1:5000/api/health-stats");
        if (statsResponse.data.status === "success") {
          setHealthStats(statsResponse.data.health_stats);
        }
      } catch (err) {
        setError("Error connecting to the server. Is the backend running?");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    // Initialize WebSocket connection
    socketRef.current = io("http://127.0.0.1:5000", {
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
      
      // Update last update time
      setLastUpdateTime(new Date());
      
      // Refresh health stats periodically
      const fetchHealthStats = async () => {
        try {
          const statsResponse = await axios.get("http://127.0.0.1:5000/api/health-stats");
          if (statsResponse.data.status === "success") {
            setHealthStats(statsResponse.data.health_stats);
          }
        } catch (err) {
          console.error("Failed to fetch health stats:", err);
        }
      };
      
      // Update health stats every 10 updates (to avoid too many requests)
      if (Math.random() < 0.1) {
        fetchHealthStats();
      }
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

  // Prepare data for the radar chart
  const prepareRadarData = () => {
    if (!latestData) return [];
    
    // Scale the values appropriately for better visualization
    const scaleAccelerometer = (val) => Math.min(10, Math.abs(val) / 40);
    const scaleGyroscope = (val) => Math.min(10, Math.abs(val));
    
    return [
      { subject: 'Acc X', value: scaleAccelerometer(latestData.acc_x), fullMark: 10 },
      { subject: 'Acc Y', value: scaleAccelerometer(latestData.acc_y), fullMark: 10 },
      { subject: 'Acc Z', value: scaleAccelerometer(latestData.acc_z), fullMark: 10 },
      { subject: 'Gyro X', value: scaleGyroscope(latestData.gyro_x), fullMark: 10 },
      { subject: 'Gyro Y', value: scaleGyroscope(latestData.gyro_y), fullMark: 10 },
      { subject: 'Gyro Z', value: scaleGyroscope(latestData.gyro_z), fullMark: 10 },
    ];
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };
  
  // Function to test normal cattle data against our detection system
  const testCattleData = async () => {
    try {
      // Make a POST request to test the data
      const response = await axios.post('http://127.0.0.1:5000/api/test-data', testData);
      
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
  
  // Function to handle input changes for test data
  const handleTestDataChange = (e) => {
    const { name, value } = e.target;
    setTestData(prev => ({
      ...prev,
      [name]: parseFloat(value)
    }));
  };

  // Render loading spinner
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

  // Render error message
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

  // Render dashboard
  const renderDashboard = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
      {/* Status Card */}
      <div className={`bg-white rounded-xl shadow-lg p-6 relative overflow-hidden backdrop-blur-sm ${
        prediction === "Normal" 
          ? "border-l-4 border-success" 
          : "border-l-4 border-danger"
      }`}>
        {/* Background decorative elements */}
        <div className={`absolute -right-8 -bottom-8 w-32 h-32 rounded-full opacity-10 ${
          prediction === "Normal" ? "bg-success" : "bg-danger"
        }`}></div>
        <div className={`absolute -left-4 -top-4 w-16 h-16 rounded-full opacity-10 ${
          prediction === "Normal" ? "bg-success" : "bg-danger"
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
          <div className={`absolute inset-0 rounded-full opacity-30 ${
            prediction === "Normal" ? "bg-success" : "bg-danger"
          } blur-md transform scale-110 animate-pulse-slow`}></div>
          
          <div className={`absolute inset-0 rounded-full ${
            prediction === "Normal"
              ? "border-2 border-success animate-spin-slow"
              : "border-2 border-danger animate-spin-slow"
          }`}></div>
          
          <div className="absolute inset-0 rounded-full border-2 border-gray-100 border-dashed animate-spin-reverse-slow"></div>
          
          <div className={`flex items-center justify-center w-full h-full rounded-full text-xl font-bold ${
            prediction === "Normal"
              ? "bg-gradient-to-br from-success/90 to-success-light/90 text-white border-2 border-success"
              : "bg-gradient-to-br from-danger/90 to-danger-light/90 text-white border-2 border-danger"
          } shadow-lg backdrop-blur-sm`}>
            {prediction || "Unknown"}
          </div>
        </div>
        
        {/* Confidence Meter */}
        {confidence !== null && (
          <div className="mt-6 relative">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600 flex items-center">
                <svg className="w-4 h-4 mr-1 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                Confidence Level
              </span>
              <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                confidence > 75 
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
                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                  confidence > 75 
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
            
            {/* Confidence markers */}
            <div className="flex justify-between mt-1 px-1">
              <span className="text-[10px] text-gray-400">0%</span>
              <span className="text-[10px] text-gray-400">25%</span>
              <span className="text-[10px] text-gray-400">50%</span>
              <span className="text-[10px] text-gray-400">75%</span>
              <span className="text-[10px] text-gray-400">100%</span>
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

      {/* Latest Readings Card */}
      <div className="bg-white rounded-xl shadow-lg p-6 relative overflow-hidden border border-gray-100 hover:shadow-xl transition-shadow duration-300">
        {/* Decorative elements */}
        <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-gradient-to-br from-blue-50 to-purple-50 rounded-full opacity-60"></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xl font-bold text-gray-800 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
              Latest Sensor Readings
            </h3>
            {connected && (
              <div className="animate-pulse flex items-center bg-primary-light text-primary text-xs font-medium px-3 py-1.5 rounded-full shadow-sm">
                <span className="w-1.5 h-1.5 bg-primary rounded-full mr-1.5"></span>
                LIVE DATA
              </div>
            )}
          </div>
          
          {latestData ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                {/* Accelerometer Readings Group */}
                <div className="col-span-2 bg-gradient-to-r from-blue-50 to-blue-100/60 rounded-xl p-3 mb-2">
                  <h4 className="text-xs uppercase tracking-wide text-blue-600 font-semibold mb-2 flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Accelerometer
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 shadow-sm flex flex-col items-center hover:bg-white transition-all duration-200 hover:-translate-y-0.5 border border-blue-100/50">
                      <span className="text-xs text-gray-500 mb-1">X-axis</span>
                      <span className="text-lg font-bold text-blue-700">
                        {latestData.acc_x.toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 shadow-sm flex flex-col items-center hover:bg-white transition-all duration-200 hover:-translate-y-0.5 border border-blue-100/50">
                      <span className="text-xs text-gray-500 mb-1">Y-axis</span>
                      <span className="text-lg font-bold text-blue-700">
                        {latestData.acc_y.toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 shadow-sm flex flex-col items-center hover:bg-white transition-all duration-200 hover:-translate-y-0.5 border border-blue-100/50">
                      <span className="text-xs text-gray-500 mb-1">Z-axis</span>
                      <span className="text-lg font-bold text-blue-700">
                        {latestData.acc_z.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Gyroscope Readings Group */}
                <div className="col-span-2 bg-gradient-to-r from-purple-50 to-purple-100/60 rounded-xl p-3">
                  <h4 className="text-xs uppercase tracking-wide text-purple-600 font-semibold mb-2 flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Gyroscope
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 shadow-sm flex flex-col items-center hover:bg-white transition-all duration-200 hover:-translate-y-0.5 border border-purple-100/50">
                      <span className="text-xs text-gray-500 mb-1">X-axis</span>
                      <span className="text-lg font-bold text-purple-700">
                        {latestData.gyro_x.toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 shadow-sm flex flex-col items-center hover:bg-white transition-all duration-200 hover:-translate-y-0.5 border border-purple-100/50">
                      <span className="text-xs text-gray-500 mb-1">Y-axis</span>
                      <span className="text-lg font-bold text-purple-700">
                        {latestData.gyro_y.toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 shadow-sm flex flex-col items-center hover:bg-white transition-all duration-200 hover:-translate-y-0.5 border border-purple-100/50">
                      <span className="text-xs text-gray-500 mb-1">Z-axis</span>
                      <span className="text-lg font-bold text-purple-700">
                        {latestData.gyro_z.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Temperature Reading */}
                {latestData.temperature !== undefined && latestData.temperature > 0 && (
                  <div className="col-span-2 bg-gradient-to-r from-orange-50 to-orange-100/60 rounded-xl p-3 mt-2">
                    <h4 className="text-xs uppercase tracking-wide text-orange-600 font-semibold mb-2 flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Temperature
                    </h4>
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 shadow-sm flex items-center justify-center hover:bg-white transition-all duration-200 hover:-translate-y-0.5 border border-orange-100/50">
                      <div className="text-center">
                        <span className="text-2xl font-bold text-orange-700">
                          {latestData.temperature.toFixed(1)}°C
                        </span>
                        <div className="text-xs text-gray-500 mt-1">
                          {latestData.temperature < 25 ? 'Low' : 
                           latestData.temperature > 30 ? 'High' : 'Normal'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-between items-center mt-5 pt-3 border-t border-gray-100">
                <div className="flex items-center text-xs text-gray-500">
                  <svg className="w-3.5 h-3.5 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Last updated: {lastUpdateTime ? lastUpdateTime.toLocaleString() : (latestData ? new Date(latestData.timestamp).toLocaleString() : 'N/A')}
                </div>
                {connected && (
                  <div className="flex items-center text-xs text-white bg-gradient-to-r from-danger to-danger-light px-2 py-1 rounded-full shadow-sm">
                    <span className="w-1.5 h-1.5 bg-white rounded-full mr-1 animate-ping"></span>
                    <span className="w-1.5 h-1.5 bg-white rounded-full mr-1 absolute"></span>
                    <span className="ml-1">LIVE</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-gray-500 mt-3">Loading sensor readings...</p>
            </div>
          )}
        </div>
      </div>

      {/* Radar Chart Card */}
      <div className="bg-white rounded-xl shadow-lg p-6 overflow-hidden relative border border-gray-100 hover:shadow-xl transition-shadow duration-300">
        {/* Decorative elements */}
        <div className="absolute -left-10 -top-10 w-32 h-32 bg-indigo-50 rounded-full opacity-60"></div>
        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-purple-50 rounded-full opacity-60"></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xl font-bold text-gray-800 flex items-center">
              <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
              Sensor Pattern
            </h3>
            
            {connected && (
              <div className="animate-pulse flex items-center bg-indigo-50 text-indigo-600 text-xs font-medium px-3 py-1.5 rounded-full shadow-sm">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-1.5"></span>
                LIVE DATA
              </div>
            )}
          </div>
          
          <div className="bg-gradient-to-br from-gray-50 to-indigo-50/20 rounded-lg p-4">
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart outerRadius={90} width={730} height={250} data={prepareRadarData()}>
                  <defs>
                    <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8884d8" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#8884d8" stopOpacity={0.3} />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <PolarGrid 
                    stroke="#e0e0e0" 
                    strokeDasharray="3 3"
                  />
                  <PolarAngleAxis 
                    dataKey="subject" 
                    tick={{ fill: '#555', fontSize: 12 }}
                    tickLine={{ stroke: '#888', strokeWidth: 0.5 }}
                    stroke="#e0e0e0"
                  />
                  <PolarRadiusAxis 
                    angle={30} 
                    domain={[0, 10]} 
                    stroke="#bbb"
                    tickCount={5}
                    tick={{ fontSize: 10 }}
                  />
                  <Radar 
                    name="Sensor Values" 
                    dataKey="value" 
                    stroke="#8884d8" 
                    fill="url(#radarGradient)" 
                    fillOpacity={0.7}
                    isAnimationActive={true}
                    animationBegin={300}
                    animationDuration={1500}
                    filter="url(#glow)"
                  />
                  <Legend 
                    wrapperStyle={{ 
                      fontFamily: 'Segoe UI', 
                      fontSize: '12px',
                      bottom: 0
                    }}
                    formatter={(value) => (
                      <span className="text-xs font-medium text-gray-700">{value}</span>
                    )}
                  />
                  <Tooltip 
                    formatter={(value) => [`${parseFloat(value).toFixed(2)}`, 'Value']}
                    contentStyle={{ 
                      backgroundColor: 'rgba(17, 24, 39, 0.95)',
                      borderRadius: '0.5rem',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                      border: 'none',
                      padding: '10px',
                      color: 'white'
                    }}
                    itemStyle={{ color: 'white' }}
                    labelStyle={{ fontWeight: 'bold', color: 'white' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="flex justify-center items-center mt-3 space-x-6">
            <div className="text-xs text-center">
              <div className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-md font-medium mb-1">Accelerometer</div>
              <span className="text-gray-500 text-xs">X, Y, Z axes</span>
            </div>
            <div className="text-xs text-center">
              <div className="bg-purple-100 text-purple-800 px-2.5 py-1 rounded-md font-medium mb-1">Gyroscope</div>
              <span className="text-gray-500 text-xs">X, Y, Z axes</span>
            </div>
          </div>
          
          {connected && (
            <div className="flex items-center justify-center text-gray-500 text-xs mt-4 bg-gray-50 rounded-full py-1.5">
              <svg className="w-3 h-3 mr-1 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Real-time pattern visualization
            </div>
          )}
        </div>
      </div>
      
      {/* Health Statistics Card */}
      <div className="bg-white rounded-xl shadow-lg p-6 relative overflow-hidden border border-gray-100 hover:shadow-xl transition-shadow duration-300">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 opacity-70"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-green-50 rounded-full -ml-16 -mb-16 opacity-70"></div>
        
        <div className="relative">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xl font-bold text-gray-800 flex items-center">
              <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Health Statistics
            </h3>
            <span className="bg-green-50 text-green-600 text-xs font-semibold px-3 py-1.5 rounded-full">
              Latest Data
            </span>
          </div>
          
          {healthStats ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 text-center shadow-sm">
                <div className="text-sm text-gray-600 mb-1">Normal Readings</div>
                <div className="text-2xl font-bold text-blue-700 flex items-center justify-center">
                  <svg className="w-4 h-4 mr-1 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {healthStats.normal_count}
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-xl p-4 text-center shadow-sm">
                <div className="text-sm text-gray-600 mb-1">Anomalies Detected</div>
                <div className="text-2xl font-bold text-danger flex items-center justify-center">
                  <svg className="w-4 h-4 mr-1 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {healthStats.anomaly_count}
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-4 text-center shadow-sm">
                <div className="text-sm text-gray-600 mb-1">Anomaly Rate</div>
                <div className="text-2xl font-bold text-purple-700 flex items-center justify-center">
                  <svg className="w-4 h-4 mr-1 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                  {healthStats.anomaly_percentage}%
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-4 text-center shadow-sm">
                <div className="text-sm text-gray-600 mb-1">Avg. Activity Level</div>
                <div className="text-2xl font-bold text-green-700 flex items-center justify-center">
                  <svg className="w-4 h-4 mr-1 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {healthStats.activity_levels?.average || 'N/A'}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-gray-500 mt-3">Loading health statistics...</p>
            </div>
          )}
          
          {importantFeatures && importantFeatures.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-100">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <svg className="w-4 h-4 mr-1 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Key Factors in Prediction:
              </h4>
              <ul className="space-y-2">
                {importantFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center bg-gray-50 rounded-md px-3 py-2 text-sm text-gray-700">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Time Series Chart Card */}
      <div className="bg-white rounded-xl shadow-lg p-6 overflow-hidden col-span-full border border-gray-100 hover:shadow-xl transition-shadow duration-300">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xl font-bold text-gray-800 flex items-center">
            <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Accelerometer Readings
          </h3>
          
          {connected && (
            <div className="flex items-center bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse mr-1.5"></span>
              LIVE DATA
            </div>
          )}
        </div>
        
        {/* Chart container with decorative background */}
        <div className="relative">
          {/* Decorative gradient background */}
          <div className="absolute inset-0 bg-gradient-to-b from-gray-50/50 to-blue-50/20 rounded-lg"></div>
          
          {/* Grid lines decoration */}
          <div className="absolute inset-0">
            {[...Array(10)].map((_, i) => (
              <div 
                key={i} 
                className="absolute w-full h-[1px] bg-gray-100" 
                style={{ top: `${i * 10}%` }}
              ></div>
            ))}
            {[...Array(10)].map((_, i) => (
              <div 
                key={i} 
                className="absolute h-full w-[1px] bg-gray-100" 
                style={{ left: `${i * 10}%` }}
              ></div>
            ))}
          </div>
          
          <div className="h-[280px] w-full px-2 py-4 relative">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={sensorData}
                margin={{ top: 15, right: 30, left: 20, bottom: 15 }}
              >
                <defs>
                  <linearGradient id="accXGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="accYGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#82ca9d" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="accZGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffc658" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ffc658" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={formatTimestamp}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#666', fontSize: 11 }}
                  minTickGap={30}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#666', fontSize: 11 }}
                  width={40}
                />
                <Tooltip 
                  labelFormatter={(value) => `Time: ${new Date(value).toLocaleString()}`}
                  contentStyle={{
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    padding: '12px',
                    color: 'white'
                  }}
                  itemStyle={{ color: 'white', padding: '2px 0' }}
                  labelStyle={{ fontWeight: 'bold', color: 'white', marginBottom: '5px' }}
                />
                <Legend 
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ paddingTop: 15 }}
                  formatter={(value) => (
                    <span className="text-xs font-medium text-gray-700">{value}</span>
                  )}
                />
                
                <Line 
                  type="monotone" 
                  dataKey="acc_x" 
                  name="Acc X" 
                  stroke="#8884d8" 
                  strokeWidth={2.5}
                  dot={{ r: 0 }}
                  activeDot={{ r: 6, fill: '#8884d8', stroke: 'white', strokeWidth: 2 }}
                  isAnimationActive={true}
                />
                <Line 
                  type="monotone" 
                  dataKey="acc_y" 
                  name="Acc Y" 
                  stroke="#82ca9d" 
                  strokeWidth={2.5}
                  dot={{ r: 0 }}
                  activeDot={{ r: 6, fill: '#82ca9d', stroke: 'white', strokeWidth: 2 }}
                  isAnimationActive={true}
                />
                <Line 
                  type="monotone" 
                  dataKey="acc_z" 
                  name="Acc Z" 
                  stroke="#ffc658" 
                  strokeWidth={2.5}
                  dot={{ r: 0 }}
                  activeDot={{ r: 6, fill: '#ffc658', stroke: 'white', strokeWidth: 2 }}
                  isAnimationActive={true}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100 text-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <span className="h-2 w-2 rounded-full bg-[#8884d8] mr-1.5"></span>
              <span className="text-xs text-gray-600">X-axis</span>
            </div>
            <div className="flex items-center">
              <span className="h-2 w-2 rounded-full bg-[#82ca9d] mr-1.5"></span>
              <span className="text-xs text-gray-600">Y-axis</span>
            </div>
            <div className="flex items-center">
              <span className="h-2 w-2 rounded-full bg-[#ffc658] mr-1.5"></span>
              <span className="text-xs text-gray-600">Z-axis</span>
            </div>
          </div>
          <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            Showing {sensorData.length} data points
          </div>
        </div>
      </div>

      {/* Gyroscope Time Series Chart Card */}
      <div className="bg-white rounded-xl shadow-lg p-6 overflow-hidden col-span-full border border-gray-100 hover:shadow-xl transition-shadow duration-300">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xl font-bold text-gray-800 flex items-center">
            <svg className="w-5 h-5 mr-2 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Gyroscope Readings
          </h3>
          
          {connected && (
            <div className="flex items-center bg-secondary/10 text-secondary text-xs font-medium px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse mr-1.5"></span>
              LIVE DATA
            </div>
          )}
        </div>
        
        {/* Chart container with decorative background */}
        <div className="relative">
          {/* Decorative gradient background */}
          <div className="absolute inset-0 bg-gradient-to-b from-gray-50/50 to-purple-50/20 rounded-lg"></div>
          
          {/* Grid lines decoration */}
          <div className="absolute inset-0">
            {[...Array(10)].map((_, i) => (
              <div 
                key={i} 
                className="absolute w-full h-[1px] bg-gray-100" 
                style={{ top: `${i * 10}%` }}
              ></div>
            ))}
            {[...Array(10)].map((_, i) => (
              <div 
                key={i} 
                className="absolute h-full w-[1px] bg-gray-100" 
                style={{ left: `${i * 10}%` }}
              ></div>
            ))}
          </div>
          
          <div className="h-[280px] w-full px-2 py-4 relative">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={sensorData}
                margin={{ top: 15, right: 30, left: 20, bottom: 15 }}
              >
                <defs>
                  <linearGradient id="gyroXGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff7300" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ff7300" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="gyroYGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0088fe" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#0088fe" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="gyroZGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00C49F" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#00C49F" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={formatTimestamp}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#666', fontSize: 11 }}
                  minTickGap={30}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#666', fontSize: 11 }}
                  width={40}
                />
                <Tooltip 
                  labelFormatter={(value) => `Time: ${new Date(value).toLocaleString()}`}
                  contentStyle={{
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    padding: '12px',
                    color: 'white'
                  }}
                  itemStyle={{ color: 'white', padding: '2px 0' }}
                  labelStyle={{ fontWeight: 'bold', color: 'white', marginBottom: '5px' }}
                />
                <Legend 
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ paddingTop: 15 }}
                  formatter={(value) => (
                    <span className="text-xs font-medium text-gray-700">{value}</span>
                  )}
                />
                
                <Line 
                  type="monotone" 
                  dataKey="gyro_x" 
                  name="Gyro X" 
                  stroke="#ff7300" 
                  strokeWidth={2.5}
                  dot={{ r: 0 }}
                  activeDot={{ r: 6, fill: '#ff7300', stroke: 'white', strokeWidth: 2 }}
                  isAnimationActive={true}
                />
                <Line 
                  type="monotone" 
                  dataKey="gyro_y" 
                  name="Gyro Y" 
                  stroke="#0088fe" 
                  strokeWidth={2.5}
                  dot={{ r: 0 }}
                  activeDot={{ r: 6, fill: '#0088fe', stroke: 'white', strokeWidth: 2 }}
                  isAnimationActive={true}
                />
                <Line 
                  type="monotone" 
                  dataKey="gyro_z" 
                  name="Gyro Z" 
                  stroke="#00C49F" 
                  strokeWidth={2.5}
                  dot={{ r: 0 }}
                  activeDot={{ r: 6, fill: '#00C49F', stroke: 'white', strokeWidth: 2 }}
                  isAnimationActive={true}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100 text-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <span className="h-2 w-2 rounded-full bg-[#ff7300] mr-1.5"></span>
              <span className="text-xs text-gray-600">X-axis</span>
            </div>
            <div className="flex items-center">
              <span className="h-2 w-2 rounded-full bg-[#0088fe] mr-1.5"></span>
              <span className="text-xs text-gray-600">Y-axis</span>
            </div>
            <div className="flex items-center">
              <span className="h-2 w-2 rounded-full bg-[#00C49F] mr-1.5"></span>
              <span className="text-xs text-gray-600">Z-axis</span>
            </div>
          </div>
          <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            Real-time gyroscope data
          </div>
        </div>
      </div>

      {/* Temperature Card */}
      <TemperatureCard />
    </div>
  );

  // Render data table
  const renderDataTable = () => (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-8 relative overflow-hidden border border-gray-100">
      {/* Decorative elements */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-50 rounded-full opacity-30"></div>
      <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-50 rounded-full opacity-30"></div>
      
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
            Sensor Data History
          </h3>
          
          <div className="flex items-center space-x-3">
            <div className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full flex items-center">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5"></span>
              {sensorData.length} Records
            </div>
            
            {connected && (
              <div className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-full flex items-center animate-pulse">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
                Live Updates
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 rounded-xl p-1 shadow-inner mb-4">
          <div className="overflow-x-auto rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                  <th className="px-4 py-3 text-left font-medium rounded-tl-lg">Time</th>
                  <th className="px-4 py-3 text-left font-medium">Acc X</th>
                  <th className="px-4 py-3 text-left font-medium">Acc Y</th>
                  <th className="px-4 py-3 text-left font-medium">Acc Z</th>
                  <th className="px-4 py-3 text-left font-medium">Gyro X</th>
                  <th className="px-4 py-3 text-left font-medium">Gyro Y</th>
                  <th className="px-4 py-3 text-left font-medium rounded-tr-lg">Gyro Z</th>
                </tr>
              </thead>
              <tbody>
                {sensorData.map((item, index) => (
                  <tr 
                    key={index} 
                    className={`border-b border-gray-100 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    } hover:bg-blue-50`}
                  >
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(item.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium bg-blue-50/70 text-blue-800 px-2 py-0.5 rounded">
                        {item.acc_x.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium bg-blue-50/70 text-blue-800 px-2 py-0.5 rounded">
                        {item.acc_y.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium bg-blue-50/70 text-blue-800 px-2 py-0.5 rounded">
                        {item.acc_z.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium bg-purple-50/70 text-purple-800 px-2 py-0.5 rounded">
                        {item.gyro_x.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium bg-purple-50/70 text-purple-800 px-2 py-0.5 rounded">
                        {item.gyro_y.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium bg-purple-50/70 text-purple-800 px-2 py-0.5 rounded">
                        {item.gyro_z.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="flex justify-between items-center text-xs text-gray-500">
          <div>Showing {sensorData.length} of {sensorData.length} records</div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
            <span>Accelerometer</span>
            <div className="w-2 h-2 rounded-full bg-purple-400 ml-3"></div>
            <span>Gyroscope</span>
          </div>
        </div>
      </div>
    </div>
  );
  
  // Render test cattle data interface
  const renderTestCattleData = () => (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-6 relative overflow-hidden border border-gray-100">
        {/* Decorative elements */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-50 rounded-full opacity-30"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-50 rounded-full opacity-30"></div>
        
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-xl font-bold text-gray-800 flex items-center">
              <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              Test Cattle Data
            </h3>
            
            <div className="bg-yellow-50 text-yellow-700 text-xs font-medium px-3 py-1.5 rounded-full flex items-center">
              <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Simulation Mode
            </div>
          </div>
          
          <p className="text-gray-600 mb-6 bg-blue-50 p-4 rounded-lg border-l-4 border-blue-300">
            Input typical sensor values for normal, healthy cattle and test if they are correctly identified by the anomaly detection system.
          </p>
          
          <div className="bg-gradient-to-r from-gray-50 to-blue-50/10 p-6 rounded-xl shadow-sm mb-6 border border-gray-100">
            {/* Accelerometer Values */}
            <div className="mb-7 relative">
              <h4 className="text-base font-semibold text-primary flex items-center mb-4">
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Accelerometer Values
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="relative group">
                  <label className="block">
                    <span className="block text-sm font-medium text-gray-700 mb-1.5">X-axis:</span>
                    <div className="relative">
                      <input 
                        type="number" 
                        name="acc_x" 
                        value={testData.acc_x} 
                        onChange={handleTestDataChange}
                        className="w-full p-2.5 pr-10 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 shadow-sm"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <span className="text-xs font-medium text-gray-400">m/s²</span>
                      </div>
                    </div>
                  </label>
                  <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-blue-500 to-primary scale-0 group-hover:scale-100 transition-transform duration-200 origin-left"></div>
                </div>
                
                <div className="relative group">
                  <label className="block">
                    <span className="block text-sm font-medium text-gray-700 mb-1.5">Y-axis:</span>
                    <div className="relative">
                      <input 
                        type="number" 
                        name="acc_y" 
                        value={testData.acc_y} 
                        onChange={handleTestDataChange}
                        className="w-full p-2.5 pr-10 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 shadow-sm"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <span className="text-xs font-medium text-gray-400">m/s²</span>
                      </div>
                    </div>
                  </label>
                  <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-blue-500 to-primary scale-0 group-hover:scale-100 transition-transform duration-200 origin-left"></div>
                </div>
                
                <div className="relative group">
                  <label className="block">
                    <span className="block text-sm font-medium text-gray-700 mb-1.5">Z-axis:</span>
                    <div className="relative">
                      <input 
                        type="number" 
                        name="acc_z" 
                        value={testData.acc_z} 
                        onChange={handleTestDataChange}
                        className="w-full p-2.5 pr-10 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 shadow-sm"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <span className="text-xs font-medium text-gray-400">m/s²</span>
                      </div>
                    </div>
                  </label>
                  <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-blue-500 to-primary scale-0 group-hover:scale-100 transition-transform duration-200 origin-left"></div>
                </div>
              </div>
              
              <div className="absolute -right-2 -top-2">
                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1 rounded-full">X, Y, Z</span>
              </div>
            </div>
          
            {/* Gyroscope Values */}
            <div className="mb-7 relative">
              <h4 className="text-base font-semibold text-secondary flex items-center mb-4">
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Gyroscope Values
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="relative group">
                  <label className="block">
                    <span className="block text-sm font-medium text-gray-700 mb-1.5">X-axis:</span>
                    <div className="relative">
                      <input 
                        type="number" 
                        name="gyro_x" 
                        value={testData.gyro_x} 
                        onChange={handleTestDataChange}
                        step="0.1"
                        className="w-full p-2.5 pr-10 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all duration-200 shadow-sm"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <span className="text-xs font-medium text-gray-400">rad/s</span>
                      </div>
                    </div>
                  </label>
                  <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-secondary to-purple-500 scale-0 group-hover:scale-100 transition-transform duration-200 origin-left"></div>
                </div>
                
                <div className="relative group">
                  <label className="block">
                    <span className="block text-sm font-medium text-gray-700 mb-1.5">Y-axis:</span>
                    <div className="relative">
                      <input 
                        type="number" 
                        name="gyro_y" 
                        value={testData.gyro_y} 
                        onChange={handleTestDataChange}
                        step="0.1"
                        className="w-full p-2.5 pr-10 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all duration-200 shadow-sm"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <span className="text-xs font-medium text-gray-400">rad/s</span>
                      </div>
                    </div>
                  </label>
                  <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-secondary to-purple-500 scale-0 group-hover:scale-100 transition-transform duration-200 origin-left"></div>
                </div>
                
                <div className="relative group">
                  <label className="block">
                    <span className="block text-sm font-medium text-gray-700 mb-1.5">Z-axis:</span>
                    <div className="relative">
                      <input 
                        type="number" 
                        name="gyro_z" 
                        value={testData.gyro_z} 
                        onChange={handleTestDataChange}
                        step="0.1"
                        className="w-full p-2.5 pr-10 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all duration-200 shadow-sm"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <span className="text-xs font-medium text-gray-400">rad/s</span>
                      </div>
                    </div>
                  </label>
                  <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-secondary to-purple-500 scale-0 group-hover:scale-100 transition-transform duration-200 origin-left"></div>
                </div>
              </div>
              
              <div className="absolute -right-2 -top-2">
                <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-1 rounded-full">X, Y, Z</span>
              </div>
            </div>
            
            {/* Quick Presets */}
            <div className="mt-8 mb-8">
              <h4 className="text-base font-semibold text-gray-700 flex items-center mb-4">
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Quick Presets
              </h4>
              
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => setTestData({
                    acc_x: 120, acc_y: 15, acc_z: 20,
                    gyro_x: 1.5, gyro_y: 1.2, gyro_z: 0.8
                  })}
                  className="px-5 py-3 bg-gradient-to-br from-success to-green-500 text-white rounded-lg hover:shadow-lg hover:from-success-hover hover:to-green-600 transition-all duration-300 flex items-center gap-2 shadow-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Normal Healthy Cattle
                </button>
                
                <button
                  onClick={() => setTestData({
                    acc_x: 350, acc_y: 80, acc_z: 70,
                    gyro_x: 7.2, gyro_y: 6.8, gyro_z: 5.5
                  })}
                  className="px-5 py-3 bg-gradient-to-br from-danger to-red-500 text-white rounded-lg hover:shadow-lg hover:from-danger-hover hover:to-red-600 transition-all duration-300 flex items-center gap-2 shadow-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Anomalous Behavior
                </button>
              </div>
            </div>
            
            {/* Test Data Button */}
            <div className="flex justify-center">
              <button 
                onClick={testCattleData} 
                className="px-6 py-3 bg-gradient-to-r from-primary to-blue-600 text-white text-lg font-medium rounded-lg hover:shadow-lg hover:from-primary-hover hover:to-blue-700 transform hover:-translate-y-0.5 transition-all duration-300 shadow-md flex items-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Run Analysis
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Test Results */}
      {testResult && (
        <div className={`mt-8 bg-white rounded-xl shadow-lg p-6 relative overflow-hidden border ${
          testResult.error ? 'border-danger' : 'border-primary'
        }`}>
          {/* Decorative elements */}
          {!testResult.error && (
            <>
              <div className={`absolute -top-16 -right-16 w-40 h-40 rounded-full opacity-10 ${
                testResult.prediction === 'Normal' ? 'bg-success' : 'bg-danger'
              }`}></div>
              <div className={`absolute -bottom-10 -left-10 w-32 h-32 rounded-full opacity-10 ${
                testResult.prediction === 'Normal' ? 'bg-success' : 'bg-danger'
              }`}></div>
            </>
          )}
          
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-gray-800 flex items-center">
                <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Analysis Results
              </h3>
              
              {!testResult.error && (
                <div className={`text-xs font-medium px-3 py-1.5 rounded-full ${
                  testResult.prediction === 'Normal' 
                    ? 'bg-success-light text-success' 
                    : 'bg-danger-light text-danger'
                }`}>
                  {testResult.prediction === 'Normal' ? 'NORMAL' : 'ANOMALY'}
                </div>
              )}
            </div>
            
            {testResult.error ? (
              <div className="p-5 bg-danger-light/40 rounded-xl border border-danger text-danger">
                <div className="flex items-start">
                  <svg className="w-6 h-6 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-bold text-lg">{testResult.error}</p>
                    {testResult.message && <p className="mt-2 text-danger-hover">{testResult.message}</p>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Prediction Results */}
                <div className={`p-6 rounded-xl ${
                  testResult.prediction === 'Normal' 
                    ? 'bg-gradient-to-br from-success-light/50 to-success-light/20 border border-success/30'
                    : 'bg-gradient-to-br from-danger-light/50 to-danger-light/20 border border-danger/30'
                }`}>
                  <div className="flex items-start">
                    <div className={`p-3 rounded-lg ${
                      testResult.prediction === 'Normal' 
                        ? 'bg-success-light text-success' 
                        : 'bg-danger-light text-danger'
                    } mr-4`}>
                      {testResult.prediction === 'Normal' ? (
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <h4 className={`text-lg font-bold mb-2 ${
                        testResult.prediction === 'Normal' ? 'text-success' : 'text-danger'
                      }`}>
                        Prediction: {testResult.prediction}
                      </h4>
                      
                      <p className="text-gray-600 mb-5">
                        {testResult.prediction === 'Normal' 
                          ? "The movement pattern indicates normal cattle behavior. All parameters are within expected ranges."
                          : "Anomalous movement pattern detected. The parameters deviate significantly from normal cattle behavior."}
                      </p>
                      
                      <div className="mt-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-700 flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                            Confidence Level
                          </span>
                          <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                            testResult.confidence > 75 
                              ? "bg-success-light text-success" 
                              : testResult.confidence > 50 
                                ? "bg-warning-light text-warning" 
                                : "bg-danger-light text-danger"
                          }`}>
                            {testResult.confidence}%
                          </span>
                        </div>
                        
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner p-0.5">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${
                              testResult.confidence > 75 
                                ? "bg-gradient-to-r from-green-400 to-success" 
                                : testResult.confidence > 50 
                                  ? "bg-gradient-to-r from-yellow-400 to-warning" 
                                  : "bg-gradient-to-r from-red-400 to-danger"
                            }`}
                            style={{ width: `${testResult.confidence}%` }}
                          >
                            <div className="w-full h-full opacity-50 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(255,255,255,0.2)_5px,rgba(255,255,255,0.2)_10px)]"></div>
                          </div>
                        </div>
                        
                        <div className="flex justify-between mt-1 px-1">
                          <span className="text-[10px] text-gray-400">0%</span>
                          <span className="text-[10px] text-gray-400">25%</span>
                          <span className="text-[10px] text-gray-400">50%</span>
                          <span className="text-[10px] text-gray-400">75%</span>
                          <span className="text-[10px] text-gray-400">100%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Key Factors */}
                {testResult.important_features && (
                  <div className="p-5 bg-blue-50/50 rounded-xl border border-blue-200">
                    <h4 className="text-md font-semibold text-blue-800 mb-3 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Key Factors in Analysis:
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {testResult.important_features.map((feature, index) => (
                        <div 
                          key={index} 
                          className="flex items-center bg-white p-3 rounded-lg shadow-sm border border-blue-100"
                        >
                          <span className="w-2 h-2 bg-primary rounded-full mr-2"></span>
                          <span className="text-gray-800">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Explanation */}
                {testResult.explanation && (
                  <div className="p-5 bg-gray-50/70 rounded-xl border border-gray-200">
                    <h4 className="text-md font-semibold text-gray-700 mb-3 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Detailed Explanation:
                    </h4>
                    <p className="text-gray-700 italic bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                      {testResult.explanation}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="relative bg-gradient-to-r from-primary via-blue-600 to-secondary px-8 py-8 text-white shadow-lg overflow-hidden">
        {/* Abstract background patterns */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-1/4 w-64 h-32 bg-white rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-white rounded-full blur-2xl transform -translate-x-1/2 -translate-y-1/2"></div>
        </div>
        
        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <div className="flex items-center justify-center mb-4">
            <span className="text-5xl mr-4 animate-bounce">🐄</span>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-purple-100">
              CattleNet Smartfarm
            </h1>
            <span className="text-5xl ml-4 animate-bounce" style={{animationDelay: '0.5s'}}>📡</span>
          </div>
          
          <div className="space-y-2">
            <p className="text-lg md:text-xl font-medium opacity-95 tracking-wide">
              Advanced Real-Time Cattle Monitoring & Behavior Analytics
            </p>
            <p className="text-sm md:text-base opacity-80 max-w-3xl mx-auto leading-relaxed">
              Intelligent livestock management using ESP8266 IoT sensors with AI-powered anomaly detection, RFID gate monitoring, and environmental tracking for modern precision farming
            </p>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
            {connected && (
              <div className="flex items-center text-sm bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 border border-white/30 shadow-inner">
                <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse mr-2 shadow-glow-green"></span> 
                <span className="font-medium">Live Monitoring Active</span>
              </div>
            )}
            
            <div className="flex items-center text-sm bg-white/15 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span>ESP8266 Powered</span>
            </div>
            
            <div className="flex items-center text-sm bg-white/15 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>AI Analytics</span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm sticky top-0 z-20 px-8 py-1 flex border-b shadow-sm">
        <div className="flex space-x-1">
          <button 
            className={`px-5 py-3.5 font-medium transition-all duration-200 relative rounded-t-md ${
              activeTab === "dashboard" 
                ? "text-primary bg-blue-50" 
                : "text-gray-600 hover:text-primary hover:bg-gray-50"
            }`}
            onClick={() => setActiveTab("dashboard")}
          >
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Dashboard
            </div>
            {activeTab === "dashboard" && (
              <>
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></span>
                <span className="absolute -bottom-[1px] left-1/2 w-2 h-2 bg-primary transform -translate-x-1/2 rotate-45"></span>
              </>
            )}
          </button>
          <button 
            className={`px-5 py-3.5 font-medium transition-all duration-200 relative rounded-t-md ${
              activeTab === "data" 
                ? "text-primary bg-blue-50" 
                : "text-gray-600 hover:text-primary hover:bg-gray-50"
            }`}
            onClick={() => setActiveTab("data")}
          >
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
              Data Table
            </div>
            {activeTab === "data" && (
              <>
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></span>
                <span className="absolute -bottom-[1px] left-1/2 w-2 h-2 bg-primary transform -translate-x-1/2 rotate-45"></span>
              </>
            )}
          </button>
          <button 
            className={`px-5 py-3.5 font-medium transition-all duration-200 relative rounded-t-md ${
              activeTab === "test" 
                ? "text-primary bg-blue-50" 
                : "text-gray-600 hover:text-primary hover:bg-gray-50"
            }`}
            onClick={() => setActiveTab("test")}
          >
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              Test Cattle Data
            </div>
            {activeTab === "test" && (
              <>
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></span>
                <span className="absolute -bottom-[1px] left-1/2 w-2 h-2 bg-primary transform -translate-x-1/2 rotate-45"></span>
              </>
            )}
          </button>
          <button 
            className={`px-5 py-3.5 font-medium transition-all duration-200 relative rounded-t-md ${
              activeTab === "gate" 
                ? "text-primary bg-blue-50" 
                : "text-gray-600 hover:text-primary hover:bg-gray-50"
            }`}
            onClick={() => setActiveTab("gate")}
          >
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
              Gate Monitor
            </div>
            {activeTab === "gate" && (
              <>
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></span>
                <span className="absolute -bottom-[1px] left-1/2 w-2 h-2 bg-primary transform -translate-x-1/2 rotate-45"></span>
              </>
            )}
          </button>
          <button 
            className={`px-5 py-3.5 font-medium transition-all duration-200 relative rounded-t-md ${
              activeTab === "environment" 
                ? "text-primary bg-blue-50" 
                : "text-gray-600 hover:text-primary hover:bg-gray-50"
            }`}
            onClick={() => setActiveTab("environment")}
          >
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              Environment
            </div>
            {activeTab === "environment" && (
              <>
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></span>
                <span className="absolute -bottom-[1px] left-1/2 w-2 h-2 bg-primary transform -translate-x-1/2 rotate-45"></span>
              </>
            )}
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow px-8 py-6 bg-gradient-to-b from-gray-50 to-blue-50/30">
        <div className="max-w-7xl mx-auto">
          {/* Page transitions */}
          <div className="transition-all duration-500 ease-in-out">
            {loading ? renderLoading() :
             error ? renderError() :
             activeTab === "dashboard" ? renderDashboard() : 
             activeTab === "data" ? renderDataTable() : 
             activeTab === "gate" ? <GateMonitor /> :
             activeTab === "environment" ? <EnvironmentalMonitor /> :
             renderTestCattleData()
            }
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-gray-900 to-gray-800 text-white text-center py-6 px-8 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <div className="absolute bottom-0 left-1/4 w-full h-32 bg-blue-400 rounded-full filter blur-3xl transform -translate-y-1/2"></div>
          <div className="absolute top-0 right-1/4 w-full h-32 bg-purple-400 rounded-full filter blur-3xl transform translate-y-1/2"></div>
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-center mb-2">
            <span className="text-2xl mr-2">🐄</span>
            <p className="font-bold text-lg">CattleNet Smartfarm</p>
            <span className="text-2xl ml-2">📡</span>
          </div>
          <p className="text-sm opacity-90 mb-3">Intelligent Livestock Management System • {new Date().getFullYear()}</p>
          <div className="flex flex-wrap items-center justify-center text-xs text-gray-300 space-x-4 gap-y-1">
            <div className="flex items-center">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5"></span>
              <span>ESP8266 IoT Sensors</span>
            </div>
            <div className="flex items-center">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-1.5"></span>
              <span>MQTT Live Data (farm/sensor1, farm/environment, farm/gate)</span>
            </div>
            <div className="flex items-center">
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full mr-1.5"></span>
              <span>AI-Powered Analytics</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;