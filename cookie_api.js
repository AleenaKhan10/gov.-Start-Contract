const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = 3456;

app.use(express.json());

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'running',
        message: 'Scraper API',
        endpoints: {
            '/get-cookies': 'GET - Fetch fresh cookies from California eProcure',
            '/scrape-nyscr': 'GET - Scrape NY State Contract Reporter ads (query param: startnum)'
        }
    });
});

// Get cookies endpoint
app.get('/get-cookies', async (req, res) => {
    console.log(`[${new Date().toISOString()}] Cookie request received`);

    const browser = await puppeteer.launch({
        headless: true,
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

        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36');

        console.log('Navigating to California eProcure event search page...');

        await page.goto('https://caleprocure.ca.gov/pages/Events-BS3/event-search.aspx', {
            waitUntil: 'domcontentloaded',
            timeout: 300000
        });

        console.log('Event search page loaded successfully!');
        await new Promise(resolve => setTimeout(resolve, 5000));

        const cookies = await page.cookies();

        const cookieString = cookies
            .map(cookie => `${cookie.name}=${cookie.value}`)
            .join(';');

        const cookieObject = cookies.reduce((acc, cookie) => {
            acc[cookie.name] = cookie.value;
            return acc;
        }, {});

        const response = {
            success: true,
            timestamp: new Date().toISOString(),
            cookieString: cookieString,
            cookies: cookieObject,
            cookieCount: cookies.length
        };

        console.log(`[${new Date().toISOString()}] Success! ${cookies.length} cookies fetched`);

        res.json(response);

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error:`, error.message);

        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    } finally {
        await browser.close();
    }
});

// NY State Contract Reporter scraper endpoint
app.get('/scrape-nyscr', async (req, res) => {
    const startnum = req.query.startnum || '121';
    const url = `https://www.nyscr.ny.gov/adsOpen.cfm?startnum=${startnum}`;

    console.log(`[${new Date().toISOString()}] NYSCR scrape request received for startnum: ${startnum}`);

    const browser = await puppeteer.launch({
        headless: true,
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
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36');

        console.log(`Navigating to ${url}...`);

        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 300000
        });

        console.log('Page loaded, waiting for content...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Extract ALL ad data from the page
        const adData = await page.evaluate(() => {
            const allText = document.body.innerText;
            const ads = [];

            // Use global regex to find all occurrences
            const titleMatches = [...allText.matchAll(/Title:\s*([^\n]+)/g)];
            const agencyMatches = [...allText.matchAll(/Agency:\s*([^\n]+)/g)];
            const issueDateMatches = [...allText.matchAll(/Issue Date:\s*([^\n]+)/g)];
            const dueDateMatches = [...allText.matchAll(/Due Date:\s*([^\n]+)/g)];
            const locationMatches = [...allText.matchAll(/Location:\s*([^\n]+)/g)];
            const categoryMatches = [...allText.matchAll(/Category:\s*([^\n]+)/g)];
            const adTypeMatches = [...allText.matchAll(/Ad Type:\s*([^\n]+)/g)];

            // Get the count of ads (use the field that appears most consistently)
            const adCount = Math.max(
                titleMatches.length,
                agencyMatches.length,
                issueDateMatches.length
            );

            // Extract each ad's data
            for (let i = 0; i < adCount; i++) {
                ads.push({
                    title: titleMatches[i] ? titleMatches[i][1].trim() : '',
                    agency: agencyMatches[i] ? agencyMatches[i][1].trim() : '',
                    issueDate: issueDateMatches[i] ? issueDateMatches[i][1].trim() : '',
                    dueDate: dueDateMatches[i] ? dueDateMatches[i][1].trim() : '',
                    location: locationMatches[i] ? locationMatches[i][1].trim() : '',
                    category: categoryMatches[i] ? categoryMatches[i][1].trim() : '',
                    adType: adTypeMatches[i] ? adTypeMatches[i][1].trim() : ''
                });
            }

            return ads;
        });

        const cookies = await page.cookies();
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join(';');

        const response = {
            success: true,
            timestamp: new Date().toISOString(),
            url: url,
            totalAds: adData.length,
            ads: adData,
            cookies: cookieString
        };

        console.log(`[${new Date().toISOString()}] Success! ${adData.length} ad(s) scraped from NYSCR`);
        res.json(response);

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error:`, error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    } finally {
        await browser.close();
    }
});

app.listen(PORT, () => {
    console.log('='.repeat(80));
    console.log('Scraper API');
    console.log('='.repeat(80));
    console.log(`Server running on: http://localhost:${PORT}`);
    console.log(`Get cookies: http://localhost:${PORT}/get-cookies`);
    console.log(`Scrape NYSCR: http://localhost:${PORT}/scrape-nyscr?startnum=121`);
    console.log('='.repeat(80));
});
