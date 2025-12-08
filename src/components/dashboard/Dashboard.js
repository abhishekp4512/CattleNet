import React, { useState, useEffect } from 'react';
import StatusCard from './StatusCard';
import TemperatureCard from './TemperatureCard';
import EnvironmentalCard from './EnvironmentalCard';
import EnvironmentalDataTable from './EnvironmentalDataTable';
import IntegratedDashboard from './IntegratedDashboard';
import LatestReadings from './LatestReadings';
import HealthStats from './HealthStats';
import TimeSeriesChart from './TimeSeriesChart';
import ConnectionStatus from './ConnectionStatus2';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useSensorData } from '../../hooks/useSensorData';

const Dashboard = () => {
  const { isConnected, connectionStatus } = useWebSocket();
  const { sensorData, latestReading } = useSensorData();
  const [cattleStats, setCattleStats] = useState({
    total: 0,
    healthy: 0,
    monitoring: 0,
    alerts: 0
  });

  // Calculate cattle statistics from sensor data
  useEffect(() => {
    if (sensorData && sensorData.length > 0) {
      const total = sensorData.length;
      const healthy = sensorData.filter(cattle =>
        cattle.temperature >= 38.0 && cattle.temperature <= 39.5 &&
        cattle.activity_level > 0.3
      ).length;
      const monitoring = sensorData.filter(cattle =>
        cattle.temperature > 39.5 && cattle.temperature < 40.5
      ).length;
      const alerts = sensorData.filter(cattle =>
        cattle.temperature >= 40.5 || cattle.temperature < 37.0
      ).length;

      setCattleStats({ total, healthy, monitoring, alerts });
    }
  }, [sensorData]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Cattle Health Dashboard
          </h1>
          <p className="text-gray-600">
            Real-time monitoring of cattle health and activity
          </p>
          <ConnectionStatus isConnected={isConnected} status={connectionStatus} />
        </div>

        {/* Status Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatusCard
            title="Total Cattle"
            value={cattleStats.total}
            status="active"
            icon="🐄"
          />
          <StatusCard
            title="Healthy"
            value={cattleStats.healthy}
            status="healthy"
            icon="✅"
          />
          <StatusCard
            title="Monitoring"
            value={cattleStats.monitoring}
            status="warning"
            icon="⚠️"
          />
          <StatusCard
            title="Alerts"
            value={cattleStats.alerts}
            status={cattleStats.alerts > 0 ? "danger" : "healthy"}
            icon="🚨"
          />
        </div>

        {/* Integrated Dashboard - Combined Cattle & Environmental Data */}
        <div className="mb-8">
          <IntegratedDashboard />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Temperature Monitoring */}
          <div className="lg:col-span-1">
            <TemperatureCard />
          </div>

          {/* Latest Readings */}
          <div className="lg:col-span-2">
            <LatestReadings data={latestReading} />
          </div>
        </div>

        {/* Environmental Monitoring */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="lg:col-span-2">
            <EnvironmentalCard />
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <HealthStats />
          <TimeSeriesChart data={sensorData} />
        </div>

        {/* Environmental Data Table */}
        <div className="mb-8">
          <EnvironmentalDataTable />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
