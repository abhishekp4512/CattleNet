# Cattle Health Monitoring Dashboard

A real-time dashboard for monitoring cattle health data collected from ESP32 sensors via MQTT broker.

## System Architecture

```
ESP32 → MQTT Broker (broker.emqx.io)
          ↓
   Flask (Python backend)
   ↳ Loads trained Random Forest model
   ↳ Subscribes to real-time MQTT data (farm/sensor1, farm/environment)
          ↓
   React frontend (displays live integrated data + predictions)
```

## Features

- Real-time data visualization from MQTT broker
- Interactive charts for accelerometer and gyroscope data
- Cattle activity status prediction
- Responsive design for desktop and mobile devices
- Data table view for historical analysis

## Installation

### Prerequisites

- Node.js (v14+)
- Python (v3.7+)
- Git

### Setup

1. Clone the repository:
   ```
   git clone <repository-url>
   cd cattle-dashboard
   ```

2. Install frontend dependencies:
   ```
   npm install
   ```

3. Install backend dependencies:
   ```
   cd backend
   pip install -r requirements.txt
   cd ..
   ```

## Running the Application

### Option 1: Using the start script (Recommended)

On Windows, simply run:
```
.\start.ps1  # For PowerShell
```
or
```
start.bat    # For Command Prompt
```

This will start both the backend Flask server and the React frontend development server.

### Option 2: Starting manually

1. Start the backend server:
   ```
   cd backend
   python app.py
   ```

2. In a new terminal, start the frontend development server:
   ```
   npm start
   ```

## Access the Application

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API: [http://localhost:5000](http://localhost:5000)

## API Endpoints

- `GET /api/data`: Fetches the latest sensor data from MQTT buffer
- `GET /api/environment`: Fetches environmental data from farm/environment topic
- `GET /api/integrated-data`: Gets combined cattle sensor and environmental data
- `GET /api/predict`: Makes a prediction based on the latest sensor data

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
