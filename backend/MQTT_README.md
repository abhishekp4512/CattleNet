# MQTT Configuration for Cattle Dashboard

## Overview
The cattle dashboard has been completely migrated from ThingSpeak to MQTT for real-time data collection. This document explains the MQTT integration and configuration.

## MQTT Broker Configuration

### Default Settings
- **Broker**: localhost
- **Port**: 1883
- **Protocol**: MQTT v3.1.1

### Topics Structure
The application subscribes to the following MQTT topic patterns:

1. **Cattle Sensor Data**: `cattle/sensors/+/data`
   - Pattern allows data from any cattle ID
   - Example: `cattle/sensors/cow001/data`, `cattle/sensors/cow002/data`

2. **Cattle Health Data**: `cattle/health/+`
   - Pattern allows health data from any cattle ID
   - Example: `cattle/health/cow001`, `cattle/health/cow002`

## Message Format

### Sensor Data Message Format
Expected JSON payload for sensor data:
```json
{
  "timestamp": "2025-10-15T16:27:16Z",
  "acc_x": 45.2,
  "acc_y": -12.8,
  "acc_z": 98.6,
  "gyro_x": 2.3,
  "gyro_y": -1.1,
  "gyro_z": 0.8
}
```

### Alternative Nested Format
The application also supports nested accelerometer/gyroscope data:
```json
{
  "timestamp": "2025-10-15T16:27:16Z",
  "accelerometer": {
    "x": 45.2,
    "y": -12.8,
    "z": 98.6
  },
  "gyroscope": {
    "x": 2.3,
    "y": -1.1,
    "z": 0.8
  }
}
```

## Fallback Behavior
When MQTT broker is not available, the application automatically:
1. Logs connection failure
2. Switches to simulated data generation
3. Continues normal operation with synthetic cattle data
4. Emits data every 2 seconds for multiple cattle (cow001-cow005)

## MQTT Broker Setup

### Option 1: Local Mosquitto Broker
Install Mosquitto MQTT broker locally:

**Windows:**
```powershell
# Download and install from https://mosquitto.org/download/
# Or use Chocolatey
choco install mosquitto

# Start the broker
mosquitto -v
```

**Linux/Mac:**
```bash
# Install mosquitto
sudo apt-get install mosquitto mosquitto-clients  # Ubuntu/Debian
brew install mosquitto  # Mac

# Start the broker
mosquitto -v
```

### Option 2: Cloud MQTT Broker
Update the configuration in `backend/app.py`:
```python
# MQTT Configuration
MQTT_BROKER = "your-cloud-broker.com"  # Replace with your broker
MQTT_PORT = 1883  # or 8883 for SSL
```

### Option 3: Docker Mosquitto
```bash
docker run -it -p 1883:1883 eclipse-mosquitto:latest
```

## Testing MQTT Integration

### Publishing Test Data
Use mosquitto_pub to send test data:

```bash
# Send sensor data for cow001
mosquitto_pub -h localhost -t "cattle/sensors/cow001/data" -m '{
  "timestamp": "2025-10-15T16:27:16Z",
  "acc_x": 45.2,
  "acc_y": -12.8,
  "acc_z": 98.6,
  "gyro_x": 2.3,
  "gyro_y": -1.1,
  "gyro_z": 0.8
}'

# Send health data
mosquitto_pub -h localhost -t "cattle/health/cow001" -m '{
  "temperature": 38.5,
  "heart_rate": 65,
  "status": "healthy"
}'
```

### Monitoring MQTT Traffic
```bash
# Subscribe to all cattle topics
mosquitto_sub -h localhost -t "cattle/+/+"

# Subscribe to specific sensor data
mosquitto_sub -h localhost -t "cattle/sensors/+/data"
```

## API Endpoints

### New MQTT-specific Endpoints
- `GET /api/mqtt-status` - Check MQTT connection status and configuration

### Updated Endpoints
All existing endpoints now work with MQTT data:
- `GET /api/data` - Returns recent cattle data from MQTT
- `GET /api/latest` - Returns latest cattle reading
- `GET /api/predict` - Makes predictions on latest MQTT data
- `GET /api/health-stats` - Statistics based on MQTT data history

## Configuration Changes Required

### In your MQTT publisher (IoT device/sensor):
1. Configure to publish to the correct topics
2. Use the expected JSON message format
3. Set appropriate QoS levels (recommend QoS 1)

### In the application:
1. Update `MQTT_BROKER` and `MQTT_PORT` in `backend/app.py`
2. Modify topic patterns if needed
3. Adjust message parsing logic for your specific payload format

## Migration Benefits

1. **Real-time Data**: Direct MQTT subscription vs. polling ThingSpeak API
2. **No Rate Limits**: Unlike ThingSpeak API limitations
3. **Better Scalability**: Handle multiple cattle with different topic patterns
4. **Offline Resilience**: Graceful fallback to simulated data
5. **Flexible Message Format**: Support for various JSON payload structures
6. **Lower Latency**: Direct broker connection vs. HTTP API calls

## Troubleshooting

### Common Issues:
1. **Connection Refused**: Ensure MQTT broker is running on correct host/port
2. **No Data**: Check topic patterns match your publisher topics
3. **Parse Errors**: Verify JSON payload format matches expected structure

### Debug Mode:
The application logs all MQTT events including:
- Connection status
- Received messages
- Parsing errors
- Fallback activation