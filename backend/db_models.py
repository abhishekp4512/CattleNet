"""
MongoDB Data Models and Schemas for CattleNet Smartfarm

This module defines the schema and structure for all MQTT data stored in MongoDB
"""

from datetime import datetime
from typing import Dict, List, Any, Optional

class SensorDataModel:
    """Model for cattle sensor data (accelerometer, gyroscope)"""
    
    @staticmethod
    def create(
        cattle_id: str,
        acc_x: float,
        acc_y: float,
        acc_z: float,
        gyro_x: float,
        gyro_y: float,
        gyro_z: float,
        topic: str = "farm/sensor1"
    ) -> Dict[str, Any]:
        """Create a sensor data document"""
        return {
            "cattle_id": cattle_id,
            "timestamp": datetime.utcnow(),
            "acceleration": {
                "x": acc_x,
                "y": acc_y,
                "z": acc_z
            },
            "gyroscope": {
                "x": gyro_x,
                "y": gyro_y,
                "z": gyro_z
            },
            "topic": topic,
            "data_type": "sensor"
        }


class EnvironmentalDataModel:
    """Model for environmental data (temperature, humidity, water level, pH)"""
    
    @staticmethod
    def create(
        zone: str,
        temperature: Optional[float] = None,
        humidity: Optional[float] = None,
        water_level: Optional[float] = None,
        ph: Optional[float] = None,
        pump_status: Optional[str] = None,
        topic: str = "farm/environment"
    ) -> Dict[str, Any]:
        """Create an environmental data document"""
        doc = {
            "zone": zone,
            "timestamp": datetime.utcnow(),
            "topic": topic,
            "data_type": "environmental"
        }
        
        if temperature is not None:
            doc["temperature"] = temperature
        if humidity is not None:
            doc["humidity"] = humidity
        if water_level is not None:
            doc["water_level"] = water_level
        if ph is not None:
            doc["ph"] = ph
        if pump_status is not None:
            doc["pump_status"] = pump_status
            
        return doc


class GateDataModel:
    """Model for gate/RFID monitoring data"""
    
    @staticmethod
    def create(
        cattle_id: str,
        rfid_tag: Optional[str] = None,
        weight: Optional[float] = None,
        gate_status: Optional[str] = None,
        timestamp_readable: Optional[str] = None,
        topic: str = "farm/gate"
    ) -> Dict[str, Any]:
        """Create a gate data document"""
        return {
            "cattle_id": cattle_id,
            "rfid_tag": rfid_tag or cattle_id,
            "timestamp": datetime.utcnow(),
            "weight": weight,
            "gate_status": gate_status,
            "timestamp_readable": timestamp_readable,
            "topic": topic,
            "data_type": "gate"
        }


class FeedMonitorModel:
    """Model for feed and water consumption data"""
    
    @staticmethod
    def create(
        cattle_id: str,
        rfid_tag: Optional[str] = None,
        feed_consumed: float = 0.0,
        water_present: bool = False,
        water_consumed: Optional[float] = None,
        feed_before: Optional[float] = None,
        feed_after: Optional[float] = None,
        topic: str = "farm/feed_monitor"
    ) -> Dict[str, Any]:
        """Create a feed monitor data document"""
        return {
            "cattle_id": cattle_id,
            "rfid_tag": rfid_tag or cattle_id,
            "timestamp": datetime.utcnow(),
            "feed_consumed": feed_consumed,
            "feed_before": feed_before,
            "feed_after": feed_after,
            "water_present": water_present,
            "water_consumed": water_consumed,
            "topic": topic,
            "data_type": "feed_monitor"
        }


class HealthDataModel:
    """Model for health prediction data"""
    
    @staticmethod
    def create(
        cattle_id: str,
        prediction: Optional[str] = None,
        confidence: Optional[float] = None,
        features: Optional[Dict] = None,
        topic: str = "cattle/health"
    ) -> Dict[str, Any]:
        """Create a health data document"""
        return {
            "cattle_id": cattle_id,
            "timestamp": datetime.utcnow(),
            "prediction": prediction,
            "confidence": confidence,
            "features": features or {},
            "topic": topic,
            "data_type": "health"
        }


# Index definitions for optimal query performance
INDEXES = {
    "sensor_data": [
        ("cattle_id", 1),
        ("timestamp", -1),
        [("cattle_id", 1), ("timestamp", -1)],
    ],
    "environmental_data": [
        ("zone", 1),
        ("timestamp", -1),
        [("zone", 1), ("timestamp", -1)],
    ],
    "gate_data": [
        ("cattle_id", 1),
        ("timestamp", -1),
        ("rfid_tag", 1),
        [("cattle_id", 1), ("timestamp", -1)],
    ],
    "feed_monitor_data": [
        ("cattle_id", 1),
        ("timestamp", -1),
        ("rfid_tag", 1),
        [("cattle_id", 1), ("timestamp", -1)],
    ],
    "health_data": [
        ("cattle_id", 1),
        ("timestamp", -1),
        [("cattle_id", 1), ("timestamp", -1)],
    ]
}
