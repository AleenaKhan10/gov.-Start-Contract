#!/bin/bash

# Deploy script for running directly on Linux server without Docker

echo "=========================================="
echo "Installing Node.js dependencies..."
echo "=========================================="

# Install required system dependencies for Puppeteer
sudo apt-get update
sudo apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    libu2f-udev \
    libvulkan1

echo "=========================================="
echo "Installing Node.js packages..."
echo "=========================================="

# Install npm packages
npm install

echo "=========================================="
echo "Starting the API server..."
echo "=========================================="

# Run the API
npm run start-api
