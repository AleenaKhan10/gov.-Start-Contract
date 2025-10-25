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
            '/scrape-nyscr': 'GET - Scrape NY State Contract Reporter ads (query param: startnum)',
            '/scrape-txsmartbuy-list': 'GET - Scrape Texas SmartBuy solicitations list (query param: page)',
            '/scrape-txsmartbuy-detail': 'GET - Scrape Texas SmartBuy solicitation details (query param: id)'
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

            // Extract IDs from login.cfm URLs
            const htmlContent = document.body.innerHTML;
            const idMatches = [...htmlContent.matchAll(/login\.cfm\?ID=([A-F0-9\-]+)/gi)];

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
                issueDateMatches.length,
                idMatches.length
            );

            // Extract each ad's data
            for (let i = 0; i < adCount; i++) {
                ads.push({
                    id: idMatches[i] ? idMatches[i][1] : '',
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

// Texas SmartBuy list scraper endpoint
app.get('/scrape-txsmartbuy-list', async (req, res) => {
    const page = req.query.page || '1';
    const url = `https://www.txsmartbuy.gov/esbd?page=${page}`;

    console.log(`[${new Date().toISOString()}] Texas SmartBuy list scrape request for page: ${page}`);

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
        const pageObj = await browser.newPage();
        await pageObj.setViewport({ width: 1920, height: 1080 });
        await pageObj.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36');

        console.log(`Navigating to ${url}...`);

        await pageObj.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 300000
        });

        console.log('Page loaded, waiting for dynamic content...');
        await new Promise(resolve => setTimeout(resolve, 8000));

        // Extract all solicitation data from the page
        const solicitations = await pageObj.evaluate(() => {
            const results = [];
            const allText = document.body.innerText;

            // Split by "Solicitation ID:" to find individual records
            const blocks = allText.split(/Solicitation ID:/);

            // Skip the first block (before the first solicitation)
            for (let i = 1; i < blocks.length; i++) {
                const block = blocks[i];
                const lines = block.split('\n').map(l => l.trim()).filter(l => l);

                if (lines.length === 0) continue;

                // First line should be the ID
                const solicitationId = lines[0].trim();

                // Extract other fields
                const extractFromBlock = (fieldName) => {
                    for (const line of lines) {
                        if (line.startsWith(fieldName + ':')) {
                            return line.substring(fieldName.length + 1).trim();
                        }
                    }
                    return '';
                };

                // Title is usually right before "Solicitation ID" in previous block
                let title = '';
                if (i > 0) {
                    const prevBlock = blocks[i - 1];
                    const prevLines = prevBlock.split('\n').map(l => l.trim()).filter(l => l);
                    // Get the last non-empty line from previous block that's not a field
                    for (let j = prevLines.length - 1; j >= 0; j--) {
                        const line = prevLines[j];
                        if (line && !line.includes(':') && !line.includes('|')) {
                            title = line;
                            break;
                        }
                    }
                }

                results.push({
                    solicitationId: solicitationId,
                    title: title,
                    dueDate: extractFromBlock('Due Date'),
                    dueTime: extractFromBlock('Due Time'),
                    agency: extractFromBlock('Agency/Texas SmartBuy Member Number'),
                    status: extractFromBlock('Status'),
                    postingDate: extractFromBlock('Posting Date'),
                    createdDate: extractFromBlock('Created Date'),
                    lastUpdated: extractFromBlock('Last Updated')
                });
            }

            return results;
        });

        const cookies = await pageObj.cookies();
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join(';');

        const response = {
            success: true,
            timestamp: new Date().toISOString(),
            url: url,
            page: page,
            totalSolicitations: solicitations.length,
            solicitations: solicitations,
            cookies: cookieString
        };

        console.log(`[${new Date().toISOString()}] Success! ${solicitations.length} solicitation(s) scraped from Texas SmartBuy`);
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

// Texas SmartBuy detail scraper endpoint
app.get('/scrape-txsmartbuy-detail', async (req, res) => {
    const solicitationId = req.query.id;

    if (!solicitationId) {
        return res.status(400).json({
            success: false,
            error: 'Missing required parameter: id',
            timestamp: new Date().toISOString()
        });
    }

    const url = `https://www.txsmartbuy.gov/esbd/${solicitationId}`;

    console.log(`[${new Date().toISOString()}] Texas SmartBuy detail scrape request for ID: ${solicitationId}`);

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
        const pageObj = await browser.newPage();
        await pageObj.setViewport({ width: 1920, height: 1080 });
        await pageObj.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36');

        console.log(`Navigating to ${url}...`);

        await pageObj.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 300000
        });

        console.log('Page loaded, waiting for content...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Extract detailed solicitation data
        const detailData = await pageObj.evaluate(() => {
            const allText = document.body.innerText;
            const data = {};

            // Extract title (first line usually)
            const titleMatch = allText.match(/Electronic State Business Daily[^\n]*\n[^\n]*\n([^\n]+)/);
            data.title = titleMatch ? titleMatch[1].trim() : '';

            // Extract all fields using regex
            const extractField = (fieldName) => {
                const regex = new RegExp(fieldName + ':\\s*([^\\n]+)', 'i');
                const match = allText.match(regex);
                return match ? match[1].trim() : '';
            };

            data.solicitationId = extractField('Solicitation ID');
            data.status = extractField('Status');
            data.contactName = extractField('Contact Name');
            data.contactNumber = extractField('Contact Number');
            data.contactEmail = extractField('Contact Email');
            data.responseDueDate = extractField('Response Due Date');
            data.responseDueTime = extractField('Response Due Time');
            data.agency = extractField('Agency/Texas SmartBuy Member Number');
            data.postingRequirement = extractField('Posting Requirement');
            data.solicitationPostingDate = extractField('Solicitation Posting Date');
            data.lastModified = extractField('Last Modified');
            data.classItemCode = extractField('Class/Item Code');
            data.description = extractField('Solicitation Description');

            // Clean up empty contact fields
            if (!data.contactName || data.contactName.includes(':')) data.contactName = '';
            if (!data.contactNumber || data.contactNumber.includes(':')) data.contactNumber = '';
            if (!data.contactEmail || data.contactEmail.includes(':')) data.contactEmail = '';

            // Extract attachments
            data.attachments = [];

            // Look for all links with downloadURL action or file extensions
            const allLinks = document.querySelectorAll('a');

            allLinks.forEach(link => {
                const dataAction = link.getAttribute('data-action') || '';
                const dataHref = link.getAttribute('data-href') || '';
                const href = link.href || link.getAttribute('href') || '';
                const name = link.textContent.trim();

                // Check if this is a download link with data-href
                if (dataAction === 'downloadURL' && dataHref) {
                    // Build full URL from data-href
                    const fullUrl = dataHref.startsWith('http')
                        ? dataHref
                        : `https://www.txsmartbuy.gov${dataHref}`;

                    data.attachments.push({
                        name: name || 'Attachment',
                        url: fullUrl
                    });
                }
                // Also check regular hrefs for file extensions
                else if (href && (
                    href.includes('ESBD_') ||
                    href.includes('.pdf') ||
                    href.includes('.docx') ||
                    href.includes('.doc') ||
                    href.includes('.xlsx') ||
                    href.includes('.xls')
                )) {
                    data.attachments.push({
                        name: name || 'Attachment',
                        url: href
                    });
                }
            });

            return data;
        });

        const cookies = await pageObj.cookies();
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join(';');

        const response = {
            success: true,
            timestamp: new Date().toISOString(),
            url: url,
            data: detailData,
            cookies: cookieString
        };

        console.log(`[${new Date().toISOString()}] Success! Detail data scraped for solicitation: ${solicitationId}`);
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
    console.log(`Scrape TX SmartBuy List: http://localhost:${PORT}/scrape-txsmartbuy-list?page=2191`);
    console.log(`Scrape TX SmartBuy Detail: http://localhost:${PORT}/scrape-txsmartbuy-detail?id=RFP-19-DT-003`);
    console.log('='.repeat(80));
});
