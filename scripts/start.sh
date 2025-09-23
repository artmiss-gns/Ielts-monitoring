#!/bin/bash

# Start the health check server in the background
echo "Starting health check server on port 8000..."
PORT=8000 node dist/healthcheck.js \
  &> >(sed 's/^/HEALTH CHECK: /') \
  &
HEALTH_CHECK_PID=$!

# Start the main application
echo "Starting main application..."
node dist/index.js start --daemon

# Capture the exit status of the main application
APP_EXIT_STATUS=$?

# Clean up - kill the health check server when the main app exits
kill $HEALTH_CHECK_PID 2>/dev/null

exit $APP_EXIT_STATUS
