#!/bin/bash

# Clear users.json
echo "{}" > logs/users.json
echo "Cleared logs/users.json"

# Define directories to DELETE (all except 9200)
DIRS_TO_DELETE=("9201" "9202" "9203" "9204" "9205" "9206" "9207" "9208" "9209" "9210"
 "9211" "9212" "9213" "9214" "9215" "9216" "9217" "9218" "9219" "9220"
 "9221" "9222" "9223" "9224" "9225" "9226" "9227" "9228" "9229" "9230"
 "9231" "9232" "9233" "9234" "9235" "9236" "9237" "9238" "9239" "9240"
 "9241" "9242" "9243" "9244" "9245" "9246" "9247" "9248" "9249" "9250")

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