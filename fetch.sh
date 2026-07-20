#!/bin/bash
# fetch.sh - Runs the python script to download HRRR data and generate maps

if [ ! -d "venv" ]; then
    echo "Virtual environment not found. Please run ./setup.sh first."
    exit 1
fi

echo "Activating virtual environment..."
source venv/bin/activate

echo "Fetching HRRR smoke data and generating map overlays..."
python3 fetch_data.py

echo ""
echo "Data fetch complete! You can now run ./run.sh to view the map."
