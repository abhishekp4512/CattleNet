import React from 'react';
import useFeedMonitor from '../../hooks/useFeedMonitor';
import { formatNumber } from '../../utils/formatters';
import Card from '../ui/card';

const FeedMonitor = () => {
  const { avgFeedPerCattle, recentActivity } = useFeedMonitor();

  return (
    <Card className="p-6 space-y-6 animate-slideUp">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-blue-600">
            Feed & Water Monitoring
          </h2>
          <p className="text-sm text-gray-500 mt-1">Real-time consumption tracking by Cattle ID (RFID)</p>
        </div>
        <div className="flex items-center space-x-2 text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Live Feed
        </div>
      </div>

      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-1 gap-4">
        <div className="hover-lift bg-gradient-warning rounded-xl p-4 border-0 shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Avg Feed/Head</p>
              <p className="text-2xl font-bold text-white mt-2">{formatNumber(avgFeedPerCattle)}</p>
              <p className="text-xs text-gray-200 mt-1">kg per cattle</p>
            </div>
            <div className="text-4xl opacity-20">🐄</div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Cattle Consumption Log</h3>
          <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
            {recentActivity?.length || 0} entries
          </span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-300">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-green-600 via-blue-600 to-indigo-600 text-white sticky top-0">
              <tr>
                <th className="px-6 py-4 text-left font-bold uppercase tracking-widest text-xs">Cattle ID</th>
                <th className="px-6 py-4 text-left font-bold uppercase tracking-widest text-xs">Feed (kg)</th>
                <th className="px-6 py-4 text-left font-bold uppercase tracking-widest text-xs">Water Status</th>
                <th className="px-6 py-4 text-left font-bold uppercase tracking-widest text-xs">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentActivity && recentActivity.length > 0 ? (
                recentActivity.map((activity, index) => (
                  <tr key={index} className={`transition-all duration-200 hover:shadow-md ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    } hover:bg-blue-50 hover:scale-x-102`}>
                    <td className="px-6 py-4">
                      <span className="font-bold bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-full text-xs shadow-md">
                        {activity.cattle_id || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="font-bold text-green-700">{formatNumber(activity.feed_consumed || 0, 2)} kg</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 ${activity.water_present
                        ? 'bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-800 shadow-sm'
                        : 'bg-gradient-to-r from-red-100 to-orange-100 text-red-800 shadow-sm'
                        }`}>
                        {activity.water_present ? (
                          <>
                            <svg className="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Available
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5 mr-2 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                            Unavailable
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-xs font-mono">{activity.timestamp || 'N/A'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-gray-600 font-medium">No feeding activity yet</p>
                      <p className="text-gray-400 text-xs mt-1">Waiting for real-time data from MQTT broker</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
};

export default FeedMonitor;
