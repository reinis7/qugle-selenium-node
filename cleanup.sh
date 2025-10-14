#!/bin/bash

# Clear users.json
echo "{}" > logs/users.json
echo "Cleared logs/users.json"

# Define directories to DELETE (all except 9200)
DIRS_TO_DELETE=("9201" "9202" "9203" "9204" "9205" "9206" "9207" "9208" "9209" "9210")

# Delete specified directories
for dir in "${DIRS_TO_DELETE[@]}"; do
    if [ -d "./logs/users/user_log_$dir" ]; then
        rm -rf "./logs/users/user_log_$dir"
        echo "Deleted logs/users/user_log_$dir"
    else
        echo "Directory ./logs/users/user_log_$dir does not exist"
    fi
done

echo "Cleanup completed - 9200 was preserved"