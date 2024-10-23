#!/bin/bash

echo "Pull up the latest blinko mirror image..."

docker compose -f docker-compose.prod.yml pull blinko-website

DB_STATUS=$(docker compose -f docker-compose.prod.yml ps postgres | grep "Up")

if [ -z "$DB_STATUS" ]; then
  echo "The database container is not running or exists and is starting a new database container..."
  docker compose -f docker-compose.prod.yml up -d postgres
else
  echo "The database container is running, keeping the database container..."
fi

echo "Delete the existing website container..."
docker rm -f blinko-website

echo "Start the new website container..."
docker compose -f docker-compose.prod.yml up -d blinko-website