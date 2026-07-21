import os
import json
import numpy as np
import matplotlib.pyplot as plt
from herbie import Herbie
import cartopy.crs as ccrs

def main():
    # Setup directories
    os.makedirs('public/data', exist_ok=True)
    output_dir = 'public/data'
    
    # We will fetch the latest run
    # 'sfc' for surface fields, although smoke might be in different files depending on the version.
    # We'll grab the last available 12z run as an example, but Herbie can find the latest.
    print("Finding the most recent 18-hour HRRR run...")
    from herbie import HerbieLatest, Herbie
    from datetime import datetime, timedelta
    
    H_recent = None
    H_ext = None
    try:
        H_latest = HerbieLatest(model='hrrr', product='sfc', fxx=0)
        check_date = H_latest.date
        
        # 1. Find the latest run that has finished F18
        for i in range(12):
            test_date = check_date - timedelta(hours=i)
            print(f"Checking run {test_date} for F18 completeness...")
            try:
                H_test = Herbie(test_date, model='hrrr', product='sfc', fxx=18)
                if len(H_test.inventory()) > 0:
                    H_recent = Herbie(test_date, model='hrrr', product='sfc', fxx=0)
                    break
            except Exception:
                continue
                
        if not H_recent:
            print("Could not find a complete 18h run.")
            return

        # 2. Find the latest 48-hour extended run (must be <= H_recent.date)
        for i in range(24):
            test_date = H_recent.date - timedelta(hours=i)
            if test_date.hour not in [0, 6, 12, 18]:
                continue
            print(f"Checking extended run {test_date} for F48 completeness...")
            try:
                H_test = Herbie(test_date, model='hrrr', product='sfc', fxx=48)
                if len(H_test.inventory()) > 0:
                    H_ext = Herbie(test_date, model='hrrr', product='sfc', fxx=0)
                    break
            except Exception:
                continue
    except Exception as e:
        print(f"Error querying latest runs: {e}")

    if not H_recent or not H_ext:
        print("Could not find complete HRRR runs.")
        return

    print(f"Using recent run: {H_recent.date} (for hours 0-18)")
    print(f"Using extended run: {H_ext.date} (to fill the rest)")

    # Calculate seamless valid times
    start_time = H_recent.date
    end_time = H_ext.date + timedelta(hours=48)
    total_hours = int((end_time - start_time).total_seconds() / 3600) + 1

    metadata = {
        "run_time": H_recent.date.strftime('%Y-%m-%d %H:%M:%S UTC'),
        "forecasts": [],
        "bounds": [[20.0, -135.0], [55.0, -60.0]] 
    }

    # Fetch seamlessly
    for step in range(total_hours):
        valid_time = start_time + timedelta(hours=step)
        
        # Decide which model to use
        if valid_time <= start_time + timedelta(hours=18):
            model_to_use = H_recent
        else:
            model_to_use = H_ext
            
        # Calculate the fxx for the chosen model
        fxx = int((valid_time - model_to_use.date).total_seconds() / 3600)
        
        print(f"Processing valid time {valid_time} (using {model_to_use.date} F{fxx:02d})...")
        
        # Retry logic for network timeouts
        success = False
        for attempt in range(3):
            try:
                Hf = Herbie(model_to_use.date, model='hrrr', product='sfc', fxx=fxx)
                ds = Hf.xarray("MASSDEN:8 m above ground")
                success = True
                break
            except Exception as e:
                print(f"Attempt {attempt+1} failed: {e}")
                import time
                time.sleep(2)
                
        if not success:
            print(f"Failed to fetch data for {valid_time}, skipping...")
            continue
            
        try:
            if len(ds.data_vars) == 0:
                print(f"No MASSDEN data found for f{fxx:02d}")
                continue

            var_name = list(ds.data_vars)[0]
            data = ds[var_name]

            # Convert to numpy and plot
            lats = ds.latitude.values
            lons = ds.longitude.values
            val = data.values

            # Convert kg/m^3 to ug/m^3
            pm25 = val * 1e9

            # EPA AQI Colors and PM2.5 Breakpoints
            import matplotlib.colors as mcolors
            
            bounds = [0, 12.1, 35.5, 55.5, 150.5, 250.5, 500]
            colors = [
                '#00e40040', '#ffff0090', '#ff7e00d0', '#ff0000ff', '#8f3f97ff', '#7e0023ff'
            ]
            
            cmap = mcolors.ListedColormap(colors)
            norm = mcolors.BoundaryNorm(bounds, cmap.N)

            fig = plt.figure(figsize=(12, 7), frameon=False)
            # Use Mercator to match Leaflet's Web Mercator projection perfectly
            ax = plt.axes(projection=ccrs.Mercator())
            ax.set_extent([-135, -60, 20, 55], crs=ccrs.PlateCarree())
            
            pm25_masked = np.ma.masked_where(pm25 < 2.0, pm25)
            mesh = ax.pcolormesh(lons, lats, pm25_masked, 
                               transform=ccrs.PlateCarree(),
                               cmap=cmap, 
                               norm=norm)
                               
            ax.axis('off')
            
            # Save the figure
            img_filename = f"smoke_step{step:02d}.png"
            img_path = os.path.join(output_dir, img_filename)
            plt.savefig(img_path, transparent=True, bbox_inches='tight', pad_inches=0, dpi=150)
            plt.close(fig)

            # Append to metadata
            metadata["forecasts"].append({
                "step": step,
                "fxx": fxx,
                "valid_time": valid_time.strftime('%Y-%m-%d %H:%M:%S UTC'),
                "model_run": model_to_use.date.strftime('%Y-%m-%d %H:%M:%S UTC'),
                "image": f"data/{img_filename}"
            })
            
        except Exception as e:
            print(f"Error processing f{fxx:02d}: {e}")

    with open('public/data/metadata.json', 'w') as f:
        json.dump(metadata, f, indent=4)
        
    print("Done! Data saved to public/data/")

if __name__ == "__main__":
    main()
