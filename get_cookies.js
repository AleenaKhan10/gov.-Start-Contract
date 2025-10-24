const puppeteer = require('puppeteer');

async function getCookies() {
    const browser = await puppeteer.launch({
        headless: true, // Changed back to true for production
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ]
    });

    try {
        const page = await browser.newPage();

        // Set realistic viewport and user agent
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36');

        console.log('Navigating to California eProcure event search page...');

        // Go to event search page - this sets the InFlightSessionID cookie
        await page.goto('https://caleprocure.ca.gov/pages/Events-BS3/event-search.aspx', {
            waitUntil: 'domcontentloaded',
            timeout: 300000 // 5 minutes timeout
        });

        console.log('Event search page loaded successfully!');

        // Wait longer for JavaScript to execute and set cookies
        console.log('Waiting for cookies to be set...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Get all cookies
        const cookies = await page.cookies();

        // Convert cookies to string format for n8n
        const cookieString = cookies
            .map(cookie => `${cookie.name}=${cookie.value}`)
            .join(';');

        // Output in JSON format (easy for n8n to parse)
        const output = {
            success: true,
            timestamp: new Date().toISOString(),
            cookieString: cookieString,
            cookies: cookies.reduce((acc, cookie) => {
                acc[cookie.name] = cookie.value;
                return acc;
            }, {}),
            cookieCount: cookies.length
        };

        console.log(JSON.stringify(output, null, 2));

    } catch (error) {
        const errorOutput = {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
        console.error(JSON.stringify(errorOutput, null, 2));
        process.exit(1);
    } finally {
        await browser.close();
    }
}

// Run the function
getCookies();
