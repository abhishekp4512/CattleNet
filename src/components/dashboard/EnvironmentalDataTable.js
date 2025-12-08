import React, { useState, useEffect } from 'react';
import { Thermometer, Droplets, Sun, Moon, Eye, EyeOff, Download, Calendar, RotateCcw, Clock } from 'lucide-react';

const EnvironmentalDataTable = () => {
  const [environmentalData, setEnvironmentalData] = useState([]);
  const [latestData, setLatestData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterByDayNight, setFilterByDayNight] = useState('all');
  const [filterByPresence, setFilterByPresence] = useState('all');

  const fetchEnvironmentalData = async () => {
    try {
      const isProduction = process.env.NODE_ENV === 'production';
      const API_BASE_URL = isProduction ? '' : (process.env.REACT_APP_API_URL || 'http://localhost:5001');
      const response = await fetch(`${API_BASE_URL}/api/environment`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          setEnvironmentalData(data.historical_data || []);
          setLatestData(data.latest_data);
          setError(null);
        }
      } else {
        throw new Error('Failed to fetch environmental data');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEnvironmentalData();
    const interval = setInterval(fetchEnvironmentalData, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const filteredAndSortedData = () => {
    let filtered = [...environmentalData];

    // Filter by day/night
    if (filterByDayNight !== 'all') {
      filtered = filtered.filter(item => item.day_night === filterByDayNight);
    }

    // Filter by cattle presence
    if (filterByPresence !== 'all') {
      const presenceFilter = filterByPresence === 'detected';
      filtered = filtered.filter(item => item.cattle_presence === presenceFilter);
    }

    // Sort data
    filtered.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (sortBy === 'timestamp') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  };

  const exportToCSV = () => {
    const headers = ['Timestamp', 'Light Level', 'Day/Night', 'Temperature (°C)', 'Humidity (%)', 'Cattle Presence'];
    const csvData = [
      headers.join(','),
      ...filteredAndSortedData().map(row => [
        row.timestamp,
        row.ldr_value,
        row.day_night,
        row.env_temperature,
        row.humidity,
        row.cattle_presence ? 'Detected' : 'None'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `environmental_data_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getSortIcon = (field) => {
    if (sortBy !== field) return '⇅';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const getTemperatureColor = (temp) => {
    if (temp > 35) return 'text-red-600 bg-red-50';
    if (temp < 10) return 'text-blue-600 bg-blue-50';
    return 'text-green-600 bg-green-50';
  };

  const getHumidityColor = (humidity) => {
    if (humidity > 80) return 'text-red-600 bg-red-50';
    if (humidity < 30) return 'text-orange-600 bg-orange-50';
    return 'text-blue-600 bg-blue-50';
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded mb-4"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
        <h3 className="text-lg font-semibold text-red-800 mb-2">Environmental Data Error</h3>
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchEnvironmentalData}
          className="mt-2 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const data = filteredAndSortedData();

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <Thermometer className="mr-2 h-6 w-6 text-green-600" />
            Environmental Data Table
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchEnvironmentalData}
              className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Refresh
            </button>
            <button
              onClick={exportToCSV}
              className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors flex items-center"
            >
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Latest Reading Summary */}
        {latestData && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Latest Reading</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div className="flex items-center">
                {latestData.day_night === 'day' ? (
                  <Sun className="h-4 w-4 text-yellow-500 mr-1" />
                ) : (
                  <Moon className="h-4 w-4 text-blue-500 mr-1" />
                )}
                <span className="font-medium">{latestData.ldr_value}</span>
                <span className="text-gray-500 ml-1">lux</span>
              </div>
              <div className="flex items-center">
                <Thermometer className="h-4 w-4 text-orange-500 mr-1" />
                <span className="font-medium">{latestData.env_temperature}°C</span>
              </div>
              <div className="flex items-center">
                <Droplets className="h-4 w-4 text-blue-500 mr-1" />
                <span className="font-medium">{latestData.humidity}%</span>
              </div>
              <div className="flex items-center">
                {latestData.cattle_presence ? (
                  <Eye className="h-4 w-4 text-green-500 mr-1" />
                ) : (
                  <EyeOff className="h-4 w-4 text-gray-400 mr-1" />
                )}
                <span className="font-medium">
                  {latestData.cattle_presence ? 'Detected' : 'None'}
                </span>
              </div>
              <div className="flex items-center">
                <Clock className="h-4 w-4 text-purple-500 mr-1" />
                <span className="font-medium">{new Date(latestData.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Time:</label>
            <select
              value={filterByDayNight}
              onChange={(e) => setFilterByDayNight(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="day">Day</option>
              <option value="night">Night</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Presence:</label>
            <select
              value={filterByPresence}
              onChange={(e) => setFilterByPresence(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="detected">Detected</option>
              <option value="none">None</option>
            </select>
          </div>

          <div className="text-sm text-gray-600">
            Showing {data.length} of {environmentalData.length} records
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('timestamp')}
              >
                <div className="flex items-center">
                  Timestamp
                  <span className="ml-1">{getSortIcon('timestamp')}</span>
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('ldr_value')}
              >
                <div className="flex items-center">
                  Light Level
                  <span className="ml-1">{getSortIcon('ldr_value')}</span>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Day/Night
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('env_temperature')}
              >
                <div className="flex items-center">
                  Temperature (°C)
                  <span className="ml-1">{getSortIcon('env_temperature')}</span>
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('humidity')}
              >
                <div className="flex items-center">
                  Humidity (%)
                  <span className="ml-1">{getSortIcon('humidity')}</span>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cattle Presence
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.length > 0 ? (
              data.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex flex-col">
                      <span className="font-medium">{new Date(row.timestamp).toLocaleDateString()}</span>
                      <span className="text-gray-500">{new Date(row.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <div className="flex items-center">
                      <span className="font-medium text-gray-900">{row.ldr_value}</span>
                      <span className="text-gray-500 ml-1 text-xs">lux</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <div className="flex items-center">
                      {row.day_night === 'day' ? (
                        <Sun className="h-4 w-4 text-yellow-500 mr-1" />
                      ) : (
                        <Moon className="h-4 w-4 text-blue-500 mr-1" />
                      )}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${row.day_night === 'day'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                        }`}>
                        {row.day_night === 'day' ? 'Day' : 'Night'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded font-medium ${getTemperatureColor(row.env_temperature)}`}>
                      {row.env_temperature}°C
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded font-medium ${getHumidityColor(row.humidity)}`}>
                      {row.humidity}%
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <div className="flex items-center">
                      {row.cattle_presence ? (
                        <Eye className="h-4 w-4 text-green-500 mr-1" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-gray-400 mr-1" />
                      )}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${row.cattle_presence
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                        }`}>
                        {row.cattle_presence ? 'Detected' : 'None'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center">
                    <Calendar className="h-12 w-12 text-gray-400 mb-2" />
                    <p>No environmental data available</p>
                    <p className="text-sm">Data will appear when received from farm/environment topic</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <span>MQTT Topic: farm/environment</span>
            <span>•</span>
            <span>Updates every 5 seconds</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
            Real-time monitoring active
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnvironmentalDataTable;
