# Deployment Instructions

## Option 1: Run Directly on Linux Server (Recommended to try first)

### Prerequisites
- Node.js 18+ installed
- Ubuntu/Debian Linux server

### Steps

1. **Upload files to your server:**
   ```bash
   scp cookie_api.js package.json package-lock.json deploy-without-docker.sh root@your-server:/root/scraper-api/
   ```

2. **SSH into your server:**
   ```bash
   ssh root@your-server
   cd /root/scraper-api
   ```

3. **Make the deploy script executable:**
   ```bash
   chmod +x deploy-without-docker.sh
   ```

4. **Run the deployment script:**
   ```bash
   ./deploy-without-docker.sh
   ```

5. **Or run manually:**
   ```bash
   # Install system dependencies
   sudo apt-get update
   sudo apt-get install -y wget gnupg ca-certificates fonts-liberation libasound2 \
       libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 libcups2 libdbus-1-3 libdrm2 \
       libgbm1 libgtk-3-0 libnspr4 libnss3 libwayland-client0 libxcomposite1 \
       libxdamage1 libxfixes3 libxkbcommon0 libxrandr2 xdg-utils libu2f-udev libvulkan1

   # Install npm packages
   npm install

   # Start the API
   npm run start-api
   ```

6. **Run in background with PM2 (recommended for production):**
   ```bash
   # Install PM2
   npm install -g pm2

   # Start the API with PM2
   pm2 start npm --name "scraper-api" -- run start-api

   # Save PM2 configuration
   pm2 save

   # Enable PM2 to start on boot
   pm2 startup
   ```

7. **Access the API:**
   ```
   http://your-server-ip:3456
   ```

## Option 2: Run with Docker

If running directly doesn't work or you prefer Docker:

```bash
docker-compose up --build
```

## Troubleshooting

### If you still get timeouts:

1. **Check proxy connection from server:**
   ```bash
   curl -x pr.oxylabs.io:7777 --proxy-user "customer-govscout_S8lKq-cc-US-sessid-12345:caz3vak3WXG+rjh8yqr" https://www.txsmartbuy.gov/
   ```

2. **Check if port 3456 is accessible:**
   ```bash
   netstat -tulpn | grep 3456
   ```

3. **View logs with PM2:**
   ```bash
   pm2 logs scraper-api
   ```

4. **Test without proxy first:**
   Edit `cookie_api.js` and temporarily comment out the proxy lines to see if basic connectivity works.

## API Endpoints

- `GET /` - Health check
- `GET /get-cookies` - Fetch cookies from California eProcure
- `GET /scrape-nyscr?startnum=121` - Scrape NY State Contract Reporter
- `GET /scrape-txsmartbuy-list?page=1` - Scrape Texas SmartBuy list
- `GET /scrape-txsmartbuy-detail?id=RFP-ID` - Scrape Texas SmartBuy details
- `GET /scrape-txsmartbuy-complete?page=1&limit=10` - Complete scrape with proxy and date filtering

## Features

- ✅ Proxy support for all Texas SmartBuy requests
- ✅ Automatic proxy rotation on timeout
- ✅ Retry logic (up to 3 attempts for listing, 2 for details)
- ✅ Filters out records older than 6 months
- ✅ Returns clean response with only fresh records
