#!/bin/bash

# Base directory for Chrome user data
BASE_DIR="/chromeTEMP"

# Create directories and launch Chrome instances
for ((port=9201; port<=9210; port++))
do
    user_dir="$BASE_DIR/$port"
    
    # Create directory if it doesn't exist
    # mkdir -p "$user_dir"
    
    # Launch Chrome with specified flags
    google-chrome-stable \
        --remote-debugging-port=$port \
        --user-data-dir="$user_dir" \
        --no-first-run \
        --no-default-browser-check \
        --headless=new \
        --disable-features=TranslateUI &
    
    echo "Launched Chrome on port $port with user-data-dir: $user_dir"
done

echo "All Chrome instances launched in background."
wait