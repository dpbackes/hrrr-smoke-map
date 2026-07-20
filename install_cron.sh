#!/bin/bash
# install_cron.sh - Installs the background cron job to fetch HRRR data automatically

# Get the absolute path to the directory where this script is located
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
CRON_CMD="30 3,9,15,21 * * * cd $PROJECT_DIR && ./fetch.sh >> $PROJECT_DIR/cron.log 2>&1"

echo "Checking for existing cron jobs..."

# Check if the cron job already exists to prevent duplicates
if crontab -l 2>/dev/null | grep -Fq "$PROJECT_DIR/fetch.sh"; then
    echo "Cron job already exists for this project!"
else
    echo "Installing new cron job..."
    # Append the new cron job to the user's crontab
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
    echo "✅ Cron job installed successfully!"
    echo "The fetch script will automatically run in the background at 3:30, 9:30, 15:30, and 21:30 every day."
    echo "Output and errors will be logged to: $PROJECT_DIR/cron.log"
fi
