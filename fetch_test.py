import s3fs
import xarray as xr
import datetime
import numpy as np

def get_latest_hrrr_smoke():
    # HRRR runs every hour. Try to find the most recent available run.
    now = datetime.datetime.utcnow()
    fs = s3fs.S3FileSystem(anon=True)
    
    for i in range(24):
        # Check the last 24 hours
        check_time = now - datetime.timedelta(hours=i)
        date_str = check_time.strftime("%Y%m%d")
        hour_str = check_time.strftime("%H")
        
        # Path for surface smoke (MASSDEN)
        # s3://hrrrzarr/sfc/YYYYMMDD/YYYYMMDD_HHz_anl.zarr/surface/MASSDEN
        path = f"hrrrzarr/sfc/{date_str}/{date_str}_{hour_str}z_anl.zarr/surface/MASSDEN"
        
        if fs.exists(path):
            print(f"Found latest run at: {path}")
            try:
                ds = xr.open_dataset(fs.get_mapper(f"s3://{path}"), engine="zarr", consolidated=True)
                print(ds)
                
                # Check data bounds
                lats = ds.latitude.values
                lons = ds.longitude.values
                smoke_data = ds.MASSDEN.values
                print(f"Lats: min={np.min(lats)}, max={np.max(lats)}")
                print(f"Lons: min={np.min(lons)}, max={np.max(lons)}")
                print(f"Smoke: min={np.nanmin(smoke_data)}, max={np.nanmax(smoke_data)}, shape={smoke_data.shape}")
                
                return ds
            except Exception as e:
                print(f"Could not open {path}: {e}")
                
    print("Could not find any recent HRRR data")
    return None

if __name__ == "__main__":
    get_latest_hrrr_smoke()
