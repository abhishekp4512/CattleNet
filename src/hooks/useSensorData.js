import { useState, useEffect } from 'react';

export const useSensorData = () => {
  const [sensorData, setSensorData] = useState([]);
  const [latestReading, setLatestReading] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSensorData = async () => {
    try {
      setIsLoading(true);

      // Fetch latest sensor reading
      const isProduction = process.env.NODE_ENV === 'production';
      const API_BASE_URL = isProduction ? '' : (process.env.REACT_APP_API_URL || 'http://localhost:5001');
      const latestResponse = await fetch(`${API_BASE_URL}/api/latest`);
      if (latestResponse.ok) {
        const latestData = await latestResponse.json();
        setLatestReading(latestData);
      }

      // Fetch all sensor data
      const dataResponse = await fetch(`${API_BASE_URL}/api/data`);
      if (dataResponse.ok) {
        const allData = await dataResponse.json();
        if (allData.status === 'success' && allData.data) {
          setSensorData(allData.data);
        } else {
          setSensorData([]);
        }
      }

      setError(null);
    } catch (err) {
      console.error('Error fetching sensor data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSensorData();

    // Set up polling for real-time updates
    const interval = setInterval(fetchSensorData, 3000); // Update every 3 seconds

    return () => clearInterval(interval);
  }, []);

  return {
    sensorData,
    latestReading,
    isLoading,
    error,
    refetch: fetchSensorData
  };
};
