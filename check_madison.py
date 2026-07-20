import numpy as np
from herbie import HerbieLatest
import warnings
warnings.filterwarnings('ignore')

def get_aqi_category(pm25):
    if pm25 <= 12.0: return "Good (0-50)"
    elif pm25 <= 35.4: return "Moderate (51-100)"
    elif pm25 <= 55.4: return "Unhealthy for Sensitive Groups (101-150)"
    elif pm25 <= 150.4: return "Unhealthy (151-200)"
    elif pm25 <= 250.4: return "Very Unhealthy (201-300)"
    else: return "Hazardous (301+)"

def main():
    print("Fetching the latest HRRR data...")
    try:
        H = HerbieLatest(model='hrrr', product='sfc', fxx=0)
        print(f"Found latest run: {H.date}")
        
        ds = H.xarray("MASSDEN:8 m above ground")
        data = ds[list(ds.data_vars)[0]]
        
        lats = ds.latitude.values
        lons = ds.longitude.values
        
        # Madison, WI coordinates
        lat_target = 43.0731
        lon_target = -89.4012
        
        # Herbie longitude can be -180 to 180 OR 0 to 360, so we check both to find the closest point
        dist1 = np.sqrt((lats - lat_target)**2 + (lons - lon_target)**2)
        idx1 = np.unravel_index(np.argmin(dist1), dist1.shape)
        
        dist2 = np.sqrt((lats - lat_target)**2 + (lons - (360 + lon_target))**2)
        idx2 = np.unravel_index(np.argmin(dist2), dist2.shape)
        
        idx = idx1 if dist1[idx1] < dist2[idx2] else idx2
        
        pm25 = data.values[idx] * 1e9
        aqi = get_aqi_category(pm25)
        
        print("\n--- Madison, WI Smoke Forecast ---")
        print(f"Time: {H.date} UTC")
        print(f"PM2.5 Concentration: {pm25:.2f} µg/m³")
        print(f"Estimated AQI Category: {aqi}")
        print("----------------------------------\n")
        
    except Exception as e:
        print(f"Error fetching data: {e}")

if __name__ == "__main__":
    main()
