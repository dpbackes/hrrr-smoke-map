import os
import json
import numpy as np
import matplotlib.pyplot as plt
from herbie import Herbie
import cartopy.crs as ccrs

def main():
    # Setup directories
    os.makedirs('public/data', exist_ok=True)
    
    # We will fetch the latest run
    # 'sfc' for surface fields, although smoke might be in different files depending on the version.
    # We'll grab the last available 12z run as an example, but Herbie can find the latest.
    print("Finding the most recent 48-hour extended HRRR run (00z, 06z, 12z, 18z)...")
    from herbie import HerbieLatest, Herbie
    from datetime import datetime, timedelta
    
    H = None
    try:
        H_latest = HerbieLatest(model='hrrr', product='sfc', fxx=0)
        check_date = H_latest.date
        
        # Look back up to 24 hours to find an extended run that has finished F48
        for i in range(24):
            test_date = check_date - timedelta(hours=i)
            # Only these hours produce a 48-hour forecast
            if test_date.hour not in [0, 6, 12, 18]:
                continue
                
            print(f"Checking extended run {test_date} for completeness (F48)...")
            try:
                H_test = Herbie(test_date, model='hrrr', product='sfc', fxx=48)
                if len(H_test.inventory()) > 0:
                    H = Herbie(test_date, model='hrrr', product='sfc', fxx=0)
                    break
            except Exception:
                continue
    except Exception as e:
        print(f"Error querying latest run: {e}")

    if not H:
        print("Could not find a recent complete HRRR run.")
        return

    print(f"Using complete run: {H.date}")

    metadata = {
        "run_time": H.date.strftime('%Y-%m-%d %H:%M:%S UTC'),
        "forecasts": [],
        # Exact bounds matching the Cartopy plot extent for Leaflet
        "bounds": [[24.0, -125.0], [50.0, -65.0]] 
    }

    # Fetch forecast hours 0 to 48
    for fxx in range(49):
        print(f"Processing forecast hour f{fxx:02d}...")
        
        # Retry logic for network timeouts
        success = False
        for attempt in range(3):
            try:
                # Re-initialize for specific forecast hour
                Hf = Herbie(H.date, model='hrrr', product='sfc', fxx=fxx)
                
                # The variable for smoke at surface is typically 'MASSDEN'
                ds = Hf.xarray("MASSDEN:8 m above ground")
                success = True
                break
            except Exception as e:
                print(f"Attempt {attempt+1} failed for f{fxx:02d}: {e}")
                import time
                time.sleep(2)
                
        if not success:
            print(f"Failed to fetch f{fxx:02d} after 3 attempts, skipping...")
            continue
            
        try:
            if len(ds.data_vars) == 0:
                print(f"No MASSDEN data found for f{fxx:02d}")
                continue

            var_name = list(ds.data_vars)[0]
            data = ds[var_name]

            # Convert to numpy and plot
            # Extract lats/lons
            lats = ds.latitude.values
            lons = ds.longitude.values
            val = data.values

            # Convert kg/m^3 to ug/m^3
            pm25 = val * 1e9

            # EPA AQI Colors and PM2.5 Breakpoints
            import matplotlib.colors as mcolors
            
            # PM2.5 Breakpoints (ug/m3) corresponding to AQI categories
            # Good, Moderate, USG, Unhealthy, Very Unhealthy, Hazardous
            bounds = [0, 12.1, 35.5, 55.5, 150.5, 250.5, 500]
            
            # EPA standard colors for AQI
            # We add an alpha channel to the hex colors to make lower values more transparent
            colors = [
                '#00e40040',  # Green (Good) - highly transparent
                '#ffff0090',  # Yellow (Moderate)
                '#ff7e00d0',  # Orange (USG)
                '#ff0000ff',  # Red (Unhealthy)
                '#8f3f97ff',  # Purple (Very Unhealthy)
                '#7e0023ff'   # Maroon (Hazardous)
            ]
            
            cmap = mcolors.ListedColormap(colors)
            norm = mcolors.BoundaryNorm(bounds, cmap.N)

            # Plot using Cartopy for proper projection
            fig = plt.figure(figsize=(10, 6), frameon=False)
            
            # Use PlateCarree which Leaflet expects for ImageOverlay
            ax = plt.axes(projection=ccrs.PlateCarree())
            ax.set_extent([-125, -65, 24, 50], crs=ccrs.PlateCarree())
            
            # Mask out values below 2 ug/m3 so the map isn't completely covered in green for background negligible smoke
            pm25_masked = np.ma.masked_where(pm25 < 2.0, pm25)
            
            # Plot the data using the AQI colormap and norm
            mesh = ax.pcolormesh(lons, lats, pm25_masked, 
                               transform=ccrs.PlateCarree(),
                               cmap=cmap, 
                               norm=norm)
                               
            ax.axis('off')
            
            filename = f"smoke_f{fxx:02d}.png"
            filepath = os.path.join('public', 'data', filename)
            
            plt.savefig(filepath, transparent=True, bbox_inches='tight', pad_inches=0, dpi=150)
            plt.close(fig)

            metadata["forecasts"].append({
                "fxx": fxx,
                "image": f"data/{filename}",
                "valid_time": (H.date + timedelta(hours=fxx)).strftime('%Y-%m-%d %H:%M:%S UTC')
            })
            
        except Exception as e:
            print(f"Error processing f{fxx:02d}: {e}")

    with open('public/data/metadata.json', 'w') as f:
        json.dump(metadata, f, indent=4)
        
    print("Done! Data saved to public/data/")

if __name__ == "__main__":
    main()
