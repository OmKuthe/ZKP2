# backend/app/services/geofence.py
"""
Geofence verification service
"""
import math
import logging

logger = logging.getLogger(__name__)


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two points in kilometers using Haversine formula
    """
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c


def verify_geofence(lat: float, lon: float, center_lat: float, center_lon: float, radius_km: float) -> bool:
    """
    Check if a point is within a geofence
    """
    distance = calculate_distance(lat, lon, center_lat, center_lon)
    logger.info(f"📊 Distance: {distance:.4f} km, Radius: {radius_km} km")
    return distance <= radius_km