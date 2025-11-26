/**
 * Format timestamp for display
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Formatted time string
 */
export const formatTimestamp = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString();
};

/**
 * Format number with specified decimals and unit
 * @param {number} value - Number to format
 * @param {number} decimals - Number of decimal places
 * @param {string} unit - Unit to append
 * @returns {string} Formatted number with unit
 */
export const formatNumber = (value, decimals = 1, unit = '') => {
  return `${Number(value).toFixed(decimals)}${unit ? ` ${unit}` : ''}`;
};

/**
 * Scale accelerometer values for radar chart visualization
 * @param {number} val - Accelerometer value
 * @returns {number} Scaled value
 */
export const scaleAccelerometer = (val) => Math.min(10, Math.abs(val) / 40);

/**
 * Scale gyroscope values for radar chart visualization
 * @param {number} val - Gyroscope value
 * @returns {number} Scaled value
 */
export const scaleGyroscope = (val) => Math.min(10, Math.abs(val));

/**
 * Prepare sensor data for radar chart
 * @param {object} latestData - Latest sensor data
 * @returns {array} Formatted data for radar chart
 */
export const prepareRadarData = (latestData) => {
  if (!latestData) return [];
  
  return [
    { subject: 'Acc X', value: scaleAccelerometer(latestData.acc_x), fullMark: 10 },
    { subject: 'Acc Y', value: scaleAccelerometer(latestData.acc_y), fullMark: 10 },
    { subject: 'Acc Z', value: scaleAccelerometer(latestData.acc_z), fullMark: 10 },
    { subject: 'Gyro X', value: scaleGyroscope(latestData.gyro_x), fullMark: 10 },
    { subject: 'Gyro Y', value: scaleGyroscope(latestData.gyro_y), fullMark: 10 },
    { subject: 'Gyro Z', value: scaleGyroscope(latestData.gyro_z), fullMark: 10 },
  ];
};