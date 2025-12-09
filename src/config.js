// Configuration for Backend API and WebSocket connection

const isProduction = process.env.NODE_ENV === 'production';

// In production, force connection to the Render backend
// In development, use the environment variable or fallback to localhost
export const API_BASE_URL = process.env.REACT_APP_API_URL || (isProduction ? 'https://cattlenet.onrender.com' : 'http://localhost:5001');

// WebSocket URL is usually same as API URL
export const WEBSOCKET_URL = process.env.REACT_APP_WEBSOCKET_URL || API_BASE_URL;

console.log(`[Config] Using API URL: ${API_BASE_URL}`);
