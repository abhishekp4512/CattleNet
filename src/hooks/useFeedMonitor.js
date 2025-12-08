import { useState, useEffect } from 'react';
import useWebSocket from './useWebSocket';

const useFeedMonitor = () => {
  const [feedData, setFeedData] = useState({

    avgFeedPerCattle: 0,
    avgWaterPerCattle: 0,
    recentActivity: []
  });

  const { lastMessage } = useWebSocket();

  // API Configuration - use environment variable
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5001';

  // Fetch from API as fallback/initial load
  useEffect(() => {
    const fetchFeedData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/feed-monitor`);
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success') {
            const latest = data.latest_data || {};
            setFeedData(prevData => ({

              avgFeedPerCattle: latest.avg_feed_per_cattle || prevData.avgFeedPerCattle,
              avgWaterPerCattle: latest.avg_water_per_cattle || prevData.avgWaterPerCattle,
              recentActivity: [...(latest.recent_activity || []), ...prevData.recentActivity].slice(0, 20)
            }));
          }
        }
      } catch (err) {
        console.error('Feed monitor API fetch failed:', err);
      }
    };

    // Poll API every 3 seconds for data updates
    const interval = setInterval(fetchFeedData, 3000);
    fetchFeedData(); // Initial fetch

    return () => clearInterval(interval);
  }, [API_BASE_URL]);

  // Handle real-time WebSocket updates
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'feed_monitor') {
      console.log('🍔 Feed Monitor WebSocket Update:', lastMessage.data);
      const payload = lastMessage.data || {};

      // Normalize recent activity entries
      const incomingActivities = Array.isArray(payload.recent_activity) ? payload.recent_activity : [];
      const normalized = incomingActivities.map((act) => {
        return {
          cattle_id: act.cattle_id || act.rfid || act.rfid_tag || act.id || 'unknown',
          rfid: act.rfid || act.rfid_tag || null,
          partition: act.partition || act.zone || act.station || null,
          timestamp: act.timestamp || new Date().toISOString(),
          feed_before: parseFloat(act.feed_before || act.before_feed || act.feed_before_kg || 0),
          feed_after: parseFloat(act.feed_after || act.after_feed || act.feed_after_kg || 0),
          feed_consumed: parseFloat(act.feed_consumed || act.consumed || Math.max(0, (act.feed_before || 0) - (act.feed_after || 0)) || 0),
          water_before: parseFloat(act.water_before || act.before_water || 0),
          water_after: parseFloat(act.water_after || act.after_water || 0),
          water_consumed: parseFloat(act.water_consumed || act.water_drunk || Math.max(0, (act.water_before || 0) - (act.water_after || 0)) || 0),
          water_present: (act.water_present === true) || (String(act.water_present).toLowerCase() === 'true') || Boolean(act.water_after || act.water_before || act.water_consumed)
        };
      });

      // Filter out invalid entries
      const validActivities = normalized.filter(act => {
        const isValidId = act.cattle_id &&
          !['unknown', 'no cattle', 'none', '', 'no_cattle_detected'].includes(act.cattle_id.toLowerCase());
        const hasConsumption = act.feed_consumed > 0 || act.water_consumed > 0;
        return isValidId && hasConsumption;
      });

      // Compute totals if not present in payload
      const totalFeed = typeof payload.total_feed !== 'undefined'
        ? parseFloat(payload.total_feed)
        : validActivities.reduce((s, a) => s + (a.feed_consumed || 0), 0);

      const totalWater = typeof payload.total_water !== 'undefined'
        ? parseFloat(payload.total_water)
        : validActivities.reduce((s, a) => s + (a.water_consumed || 0), 0);

      const avgFeed = typeof payload.avg_feed_per_cattle !== 'undefined'
        ? parseFloat(payload.avg_feed_per_cattle)
        : (validActivities.length ? totalFeed / validActivities.length : 0);

      const avgWater = typeof payload.avg_water_per_cattle !== 'undefined'
        ? parseFloat(payload.avg_water_per_cattle)
        : (validActivities.length ? totalWater / validActivities.length : 0);

      setFeedData(prevData => ({

        avgFeedPerCattle: isNaN(avgFeed) ? prevData.avgFeedPerCattle : avgFeed,
        avgWaterPerCattle: isNaN(avgWater) ? prevData.avgWaterPerCattle : avgWater,
        recentActivity: [
          ...validActivities,
          ...prevData.recentActivity
        ].slice(0, 20) // Keep recent 20 activities
      }));
    }
  }, [lastMessage]);

  return feedData;
};

export default useFeedMonitor;
