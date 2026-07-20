#!/bin/bash
# run.sh - Starts the local web server to serve the frontend

echo "Starting web server for the HRRR Smoke Map..."
echo "The map will be available at: http://localhost:8000"
echo "Press Ctrl+C to stop the server."
echo ""

python3 -m http.server 8000 -d public
