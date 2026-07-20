#!/bin/bash
# setup.sh - Creates the virtual environment and installs dependencies

echo "Setting up Python virtual environment..."
python3 -m venv venv

echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing dependencies..."
pip install -r requirements.txt

echo ""
echo "Setup complete! You can now run ./fetch.sh to download the data."
