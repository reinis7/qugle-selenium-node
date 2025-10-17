#!/bin/bash

# Function to display usage
usage() {
    echo "Usage: $0"
    echo "This script will prompt for:"
    echo "  1. Initial directory path"
    echo "  2. Start number"
    echo "  3. End number"
    echo ""
    echo "It will create numbered copies of the directory from start to end."
}

# Function to validate directory
validate_directory() {
    if [ ! -d "$1" ]; then
        echo "Error: Directory '$1' does not exist!"
        return 1
    fi
    return 0
}

# Function to validate numbers
validate_numbers() {
    if ! [[ "$1" =~ ^[0-9]+$ ]] || ! [[ "$2" =~ ^[0-9]+$ ]]; then
        echo "Error: Start and end must be numbers!"
        return 1
    fi
    
    if [ "$1" -gt "$2" ]; then
        echo "Error: Start number cannot be greater than end number!"
        return 1
    fi
    
    return 0
}

# Main script
main() {
    echo "=== Directory Numbered Copy Script ==="
    echo ""
    
    # Prompt for initial directory path
    while true; do
        read -p "Enter initial directory path: " init_dir
        init_dir=$(echo "$init_dir" | sed 's/^ *//;s/ *$//')  # Trim whitespace
        
        if validate_directory "$init_dir"; then
            break
        fi
    done
    
    # Prompt for start number
    while true; do
        read -p "Enter start number: " start_num
        start_num=$(echo "$start_num" | sed 's/^ *//;s/ *$//')  # Trim whitespace
        
        if [[ "$start_num" =~ ^[0-9]+$ ]]; then
            break
        else
            echo "Error: Please enter a valid number!"
        fi
    done
    
    # Prompt for end number
    while true; do
        read -p "Enter end number: " end_num
        end_num=$(echo "$end_num" | sed 's/^ *//;s/ *$//')  # Trim whitespace
        
        if validate_numbers "$start_num" "$end_num"; then
            break
        fi
    done
    
    # Get the base directory name
    base_dir=$(basename "$init_dir")
    parent_dir=$(dirname "$init_dir")
    
    echo ""
    echo "Summary:"
    echo "  Directory to copy: $init_dir"
    echo "  Base name: $base_dir"
    echo "  Parent directory: $parent_dir"
    echo "  Copy range: $start_num to $end_num"
    echo ""
    
    # Confirm action
    read -p "Proceed with copying? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Operation cancelled."
        exit 0
    fi
    
    echo ""
    echo "Starting copy operation..."
    
    # Copy directories
    for ((i=start_num; i<=end_num; i++)); do
        new_dir="${parent_dir}/${base_dir}_${i}"
        
        if [ -d "$new_dir" ]; then
            echo "Warning: Directory '$new_dir' already exists. Skipping..."
            continue
        fi
        
        echo "Copying to: $new_dir"
        cp -r "$init_dir" "$new_dir"
        
        if [ $? -eq 0 ]; then
            echo "  ✓ Successfully created: $new_dir"
        else
            echo "  ✗ Failed to create: $new_dir"
        fi
    done
    
    echo ""
    echo "Copy operation completed!"
    echo "Created directories from ${base_dir}_${start_num} to ${base_dir}_${end_num}"
}

# Run main function
main "$@"