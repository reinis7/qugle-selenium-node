#!/bin/bash

set_window_top_advanced() {
    local PID=$1
    local WINDOW_ID=""
    
    # Check if PID exists
    if ! ps -p "$PID" > /dev/null 2>&1; then
        echo "Error: Process with PID $PID does not exist"
        return 1
    fi
    
    # Get process name for better logging
    local PROCESS_NAME=$(ps -p "$PID" -o comm= 2>/dev/null)
    echo "Processing PID: $PID ($PROCESS_NAME)"
    
    # Try multiple methods to find window
    echo "Searching for window..."
    
    # Method 1: wmctrl
    if command -v wmctrl >/dev/null 2>&1; then
        WINDOW_ID=$(wmctrl -lp 2>/dev/null | awk -v pid="$PID" '$3 == pid {print $1; exit}')
        [ -n "$WINDOW_ID" ] && echo "Found via wmctrl: $WINDOW_ID"
    fi
    
    # Method 2: xdotool
    if [ -z "$WINDOW_ID" ] && command -v xdotool >/dev/null 2>&1; then
        WINDOW_ID=$(xdotool search --pid "$PID" --onlyvisible 2>/dev/null | head -1)
        [ -n "$WINDOW_ID" ] && echo "Found via xdotool: $WINDOW_ID" && WINDOW_ID="0x$(printf '%x' "$WINDOW_ID")"
    fi
    
    if [ -n "$WINDOW_ID" ]; then
        echo "Setting window to top..."
        
        # Use wmctrl for window management (most reliable)
        if command -v wmctrl >/dev/null 2>&1; then
            # Remove minimization if any
            wmctrl -i -r "$WINDOW_ID" -b remove,hidden 2>/dev/null
            wmctrl -i -r "$WINDOW_ID" -b remove,below 2>/dev/null
            
            # Activate and set to top
            wmctrl -i -a "$WINDOW_ID" 2>/dev/null
            wmctrl -i -r "$WINDOW_ID" -b add,above 2>/dev/null
            
            echo "✓ Window brought to top and set always-on-top"
        else
            echo "✗ wmctrl not available for window management"
        fi
        
        return 0
    else
        echo "✗ No visible window found for PID: $PID"
        echo "The process might be:"
        echo "  - A background process without GUI"
        echo "  - Running in terminal only"
        echo "  - Minimized or hidden"
        return 1
    fi
}

# Main execution
if [ $# -ne 1 ]; then
    echo "Usage: $0 <PID>"
    echo "Example: $0 220821"
    exit 1
fi

set_window_top_advanced "$1"