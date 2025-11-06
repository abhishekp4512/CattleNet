# CattleNet Smartfarm

🐄📡 **Advanced Real-Time Cattle Monitoring & Behavior Analytics**

Intelligent livestock management using ESP8266 IoT sensors with AI-powered anomaly detection, RFID gate monitoring, and environmental tracking for modern precision farming.

## 🌟 Features

### 📊 **Real-Time Monitoring Dashboard**
- Live cattle behavior analytics with accelerometer & gyroscope data
- AI-powered anomaly detection with confidence scoring
- Interactive time-series charts and radar pattern visualization
- Health statistics tracking (normal vs anomalous behavior)

### 🚪 **Gate Monitoring System**
- RFID-based cattle identification and tracking
- Load cell weight measurements for health monitoring
- Entry/exit activity logging with direction detection
- Cattle registry with weight history and movement patterns

### 🌡️ **Environmental Monitoring**
- Day/night detection using LDR sensors
- Temperature and humidity monitoring (DHT11)
- Cattle presence detection
- Environmental condition alerts and statistics

### 🎨 **Modern User Interface**
- Professional responsive design with Tailwind CSS
- Real-time WebSocket updates with live indicators
- Multi-tab dashboard (Dashboard, Data Table, Gate Monitor, Environment, Test Data)
- Mobile-friendly design for field use

## 🏗️ System Architecture

```
ESP8266 Sensors → MQTT Broker (broker.emqx.io:1883)
                       ↓
               Flask Backend (Python)
               ├── Real-time MQTT integration
               ├── Rule-based ML anomaly detection
               ├── WebSocket for live updates
               └── RESTful API endpoints
                       ↓
               React Frontend (Vercel)
               ├── Real-time dashboard
               ├── Interactive charts (Recharts)
               └── Professional UI (Tailwind CSS)
```

### 📡 **MQTT Topics**
- `farm/sensor1` - Cattle sensor data (accelerometer, gyroscope, temperature)
- `farm/environment` - Environmental data (LDR, DHT11, presence detection)
- `farm/gate` - Gate monitoring (RFID, load cell, entry/exit tracking)

## 🚀 Quick Start

### Prerequisites

- Node.js (v16+)
- Python (v3.11+)
- Git

### Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/abhishekp4512/CattleNet.git
   cd CattleNet
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   ```

3. **Setup Python virtual environment:**
   ```bash
   python -m venv .venv
   .venv\Scripts\activate  # Windows
   # source .venv/bin/activate  # Linux/Mac
   ```

4. **Install backend dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   cd ..
   ```

## 🖥️ Running Locally

### Option 1: Quick Start Scripts (Windows)

```bash
# PowerShell
.\start.ps1

# Command Prompt  
start.bat
```

### Option 2: Manual Start

1. **Start Backend Server:**
   ```bash
   cd backend
   python app.py
   # Backend runs on http://127.0.0.1:5000
   ```

2. **Start Frontend (New Terminal):**
   ```bash
   npm start
   # Frontend runs on http://localhost:3000
   ```

## 🌐 Access the Application

- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:5000](http://localhost:5000)
- **API Documentation**: [http://localhost:5000/api](http://localhost:5000/api)

## 📚 API Endpoints

### Cattle Monitoring
- `GET /api/data` - Latest sensor data from MQTT buffer
- `GET /api/latest` - Most recent cattle data point with prediction
- `GET /api/predict` - Health prediction based on latest sensor data
- `GET /api/health-stats` - Health statistics and analytics
- `POST /api/test-data` - Test cattle data analysis

### Environmental Monitoring
- `GET /api/environment` - Environmental sensor data and statistics
- `GET /api/temperature` - Temperature analytics and alerts

### Gate Monitoring
- `GET /api/gate` - Gate activity data and cattle registry
- `GET /api/gate/cattle/<rfid_tag>` - Specific cattle details and history

### System Status
- `GET /api/mqtt-status` - MQTT broker connection status
- `GET /api/integrated-data` - Combined cattle and environmental data

## 🚀 **Vercel Deployment**

### Deploy Frontend to Vercel (Recommended)

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy to Vercel:**
   ```bash
   vercel login
   vercel --prod
   ```

3. **Environment Variables:**
   Set these in your Vercel dashboard:
   ```
   REACT_APP_API_URL=https://your-backend-url.herokuapp.com
   REACT_APP_WEBSOCKET_URL=https://your-backend-url.herokuapp.com
   ```

### Backend Deployment Options

#### Option 1: Heroku (Always Running)
```bash
cd backend
heroku create cattlenet-smartfarm-backend
heroku config:set FLASK_ENV=production
git push heroku main
heroku ps:scale web=1  # Always running
```

#### Option 2: Railway.app
- Connect your GitHub repository
- Select backend folder for deployment
- Set environment variables in Railway dashboard

## 📋 Technology Stack

### Frontend
- **React 19.2.0** - UI Framework
- **Tailwind CSS 3.4.18** - Styling
- **Recharts 3.2.1** - Data Visualization
- **Socket.io Client 4.8.1** - Real-time Communication
- **Axios 1.12.2** - HTTP Client
- **Framer Motion 12.23.22** - Animations

### Backend
- **Flask** - Python Web Framework
- **Flask-SocketIO** - WebSocket Support
- **Paho MQTT** - MQTT Client
- **NumPy** - Data Processing
- **Gunicorn + Eventlet** - Production Server

### Infrastructure
- **MQTT Broker**: broker.emqx.io:1883
- **Frontend Hosting**: Vercel
- **Backend Hosting**: Heroku/Railway
- **Real-time**: WebSocket + MQTT Integration

## 🔧 Configuration

### Environment Variables

**Frontend (.env.production):**
```env
REACT_APP_API_URL=https://your-backend-url.herokuapp.com
REACT_APP_WEBSOCKET_URL=https://your-backend-url.herokuapp.com
```

**Backend (.env):**
```env
FLASK_ENV=production
FLASK_DEBUG=False
MQTT_BROKER=broker.emqx.io
MQTT_PORT=1883
CORS_ORIGINS=https://your-frontend.vercel.app
```

## 🧪 Testing MQTT Integration

Send test data to see the system in action:
```bash
cd backend
python test_gate_data.py  # Sends sample gate monitoring data
```

## 📊 Dashboard Features

### Main Dashboard
- Real-time cattle status with confidence indicators
- Latest sensor readings (accelerometer, gyroscope, temperature)
- Activity pattern visualization with radar charts
- Health statistics and trend analysis
- Time-series charts for movement patterns

### Gate Monitor
- Live RFID tag detection and cattle identification
- Weight measurements with load cell integration
- Entry/exit tracking with direction indicators
- Cattle registry with movement history
- System status monitoring (RFID reader, load cell, gate control)

### Environmental Monitor
- Day/night detection based on LDR sensors
- Temperature and humidity monitoring
- Cattle presence detection alerts
- Environmental condition statistics
- Historical data visualization

### Test Data Panel
- Simulate cattle sensor data for testing
- Preset configurations for normal and anomalous behavior
- Real-time analysis results with confidence scoring
- Feature importance analysis for predictions

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- ESP8266 community for IoT sensor integration
- EMQX for providing reliable MQTT broker services
- React and Flask communities for excellent frameworks
- Tailwind CSS for modern responsive design

## 📞 Support

- **GitHub Issues**: [https://github.com/abhishekp4512/CattleNet/issues](https://github.com/abhishekp4512/CattleNet/issues)
- **Documentation**: See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment guide

---

**Built with ❤️ for modern precision farming and livestock management**

🐄 **Happy Farming!** 📡
