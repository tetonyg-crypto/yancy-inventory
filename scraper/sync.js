#!/usr/bin/env node
/**
 * Tool: sync.js
 * Purpose: Scrape vehicle inventory from 3 dealer websites and merge into inventory.json
 * Inputs: None (dealer URLs configured below)
 * Outputs: data/inventory.json
 * Dependencies: puppeteer
 * Last Updated: 2026-03-22
 * Changelog:
 *   - 2026-03-22: Initial creation — Puppeteer-based multi-dealer scraper
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(REPO_DIR, 'data');
const OUTPUT_PATH = path.join(DATA_DIR, 'inventory.json');
const PHONE = '3076993743';

// ─── Dealer Configurations ─────────────────────────────────
const DEALERS = [
    {
        name: "Stone's Subaru",
        baseUrl: 'https://www.stonessubaru.com',
        searchUrl: 'https://www.stonessubaru.com/search/used-jackson-wy/?cy=83001&tp=used',
        platform: 'dealereprocess',
        defaultCondition: 'Used',
        maxPages: 10,
        needsHomepage: true
    },
    {
        name: "Stone's Cars",
        baseUrl: 'https://www.stonescars.com',
        searchUrl: 'https://www.stonescars.com/search/used-rexburg-id/?s:pr=0&ct=all&cy=83440&tp=used&v=2',
        platform: 'dealereprocess',
        defaultCondition: 'Used',
        maxPages: 15,
        needsHomepage: true
    },
    {
        name: "Stone's Auto Group GM",
        baseUrl: 'https://www.tetonmotorsgm.com',
        searchUrl: 'https://www.tetonmotorsgm.com/searchnew.aspx',
        platform: 'dealeron',
        defaultCondition: 'New',
        maxPages: 1,
        needsHomepage: false
    }
];

// ─── Helpers ────────────────────────────────────────────────

function detectBodyType(text) {
    const m = (text || '').toLowerCase();
    const trucks = ['sierra','silverado','colorado','canyon','ram','1500','2500','3500','f-150','f-250','tacoma','tundra','ranger','gladiator'];
    const suvs = ['forester','crosstrek','outback','ascent','solterra','tahoe','suburban','traverse','equinox','blazer','trailblazer','trax','yukon','acadia','terrain','4runner','highlander','rav4','explorer','expedition','escape','bronco','edge','wrangler','cherokee','grand cherokee','durango','enclave','encore','envision','pilot','cr-v','hr-v','pathfinder','rogue','murano','tucson','santa fe','kona','sportage','sorento','telluride','cx-5','cx-50','rx','nx','r1s','corolla cross','kicks','impreza sport','impreza'];
    const sedans = ['malibu','camry','corolla','civic','accord','legacy','altima','sentra','elantra','sonata','charger','lacrosse','regal','model 3','jetta','optima','forte','mazda3'];
    const vans = ['express','savana','transit','sienna','pacifica','odyssey','carnival'];

    if (trucks.some(t => m.includes(t))) return 'Truck';
    if (suvs.some(s => m.includes(s))) return 'SUV';
    if (sedans.some(s => m.includes(s))) return 'Sedan';
    if (vans.some(v => m.includes(v))) return 'Van';
    return 'SUV';
}

function detectDrivetrain(text) {
    const t = (text || '').toLowerCase();
    if (t.includes('4wd') || t.includes('4x4') || t.includes('four wheel')) return '4WD';
    if (t.includes('awd') || t.includes('all wheel') || t.includes('all-wheel')) return 'AWD';
    if (t.includes('rwd') || t.includes('rear wheel')) return 'RWD';
    return 'FWD';
}

function parsePrice(text) {
    const cleaned = (text || '').replace(/,/g, '');
    const match = cleaned.match(/\d{4,}/);
    return match ? parseInt(match[0]) : 0;
}

function parseMileage(text) {
    const cleaned = (text || '').replace(/,/g, '');
    const match = cleaned.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

function parseTitle(title) {
    const t = (title || '').trim();
    const match = t.match(/^(\d{4})\s+(\S+)\s+(.+)$/);
    if (!match) return { year: 0, make: '', model: t, trim: '' };

    const year = parseInt(match[1]);
    const make = match[2];
    const rest = match[3].trim();
    const parts = rest.split(/\s+/);

    // Try to separate model from trim
    const trimWords = ['LT','LS','LTZ','Premier','Limited','Sport','Premium','Base','SE','SEL','XLE','XSE','SR','SV','SL','Touring','Wilderness','Onyx','RS','ZR2','Z71','Denali','AT4','SLE','SLT','Police','R/T','ACTIV','Big Horn','Lone Star','Laramie','Overland','Altitude','Trailhawk'];
    let splitIdx = parts.length;
    for (let i = 0; i < parts.length; i++) {
        const remaining = parts.slice(i).join(' ');
        if (trimWords.some(tw => remaining.toLowerCase().startsWith(tw.toLowerCase()))) {
            splitIdx = i;
            break;
        }
    }

    return {
        year,
        make,
        model: parts.slice(0, splitIdx || 1).join(' '),
        trim: parts.slice(splitIdx).join(' ')
    };
}

function log(msg) {
    console.log(`  ${msg}`);
}

// ─── DealerEprocess Scraper ─────────────────────────────────

async function scrapeDealerEprocess(browser, config) {
    const vehicles = [];
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        // Visit homepage first if needed (stonessubaru 403 fix)
        if (config.needsHomepage) {
            log(`Visiting homepage: ${config.baseUrl}`);
            await page.goto(config.baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise(r => setTimeout(r, 4000));
            // Click through any cookie/popup banners
            try { await page.click('[class*="close"], [class*="accept"], [class*="dismiss"]'); } catch(e) {}
            await new Promise(r => setTimeout(r, 1000));
        }

        for (let pg = 1; pg <= config.maxPages; pg++) {
            const sep = config.searchUrl.includes('?') ? '&' : '?';
            const pageUrl = pg === 1 ? config.searchUrl : `${config.searchUrl}${sep}pg=${pg}`;
            log(`Page ${pg}: ${pageUrl}`);

            try {
                const response = await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                if (!response || response.status() === 403) {
                    log(`Got 403 on page ${pg}, stopping.`);
                    break;
                }
                await new Promise(r => setTimeout(r, 2000));

                const pageVehicles = await page.evaluate((baseUrl) => {
                    const items = document.querySelectorAll('.vehicle_item');
                    if (items.length === 0) return [];

                    const results = [];
                    items.forEach(item => {
                        try {
                            const titleEl = item.querySelector('.vehicle_title a');
                            const title = titleEl ? titleEl.textContent.trim() : '';
                            const detailUrl = titleEl ? titleEl.href : '';

                            const priceEl = item.querySelector('.vehicle_price');
                            const priceText = priceEl ? priceEl.textContent.trim() : '';

                            // Stock number — look for text containing "Stock"
                            let stockNumber = '';
                            const allText = item.textContent;
                            const stockMatch = allText.match(/Stock\s*#?\s*:?\s*([A-Z0-9]+)/i);
                            if (stockMatch) stockNumber = stockMatch[1];

                            // VIN
                            let vin = '';
                            const vinMatch = allText.match(/VIN\s*:?\s*([A-Z0-9]{17})/i);
                            if (vinMatch) vin = vinMatch[1];

                            // Mileage
                            let mileageText = '';
                            const mileageMatch = allText.match(/([\d,]+)\s*mi/i);
                            if (mileageMatch) mileageText = mileageMatch[1];

                            // Photo
                            const imgEl = item.querySelector('img');
                            let photo = '';
                            if (imgEl) {
                                photo = imgEl.src || imgEl.dataset.src || '';
                                if (photo.includes('placeholder') || photo.includes('noimage')) photo = '';
                            }

                            // Details table
                            const details = {};
                            item.querySelectorAll('.details-overview_title').forEach(label => {
                                const val = label.nextElementSibling;
                                if (val) {
                                    details[label.textContent.trim().toLowerCase().replace(':', '')] = val.textContent.trim();
                                }
                            });

                            if (title) {
                                results.push({ title, priceText, stockNumber, vin, mileageText, photo, detailUrl, details });
                            }
                        } catch (e) {}
                    });
                    return results;
                }, config.baseUrl);

                if (pageVehicles.length === 0) {
                    log(`No vehicles on page ${pg}, done with ${config.name}.`);
                    break;
                }

                vehicles.push(...pageVehicles);
                log(`Found ${pageVehicles.length} vehicles (total: ${vehicles.length})`);

            } catch (err) {
                log(`Error on page ${pg}: ${err.message}`);
                if (pg === 1) break; // If first page fails, skip this dealer
            }
        }
    } finally {
        await page.close();
    }

    return vehicles;
}

// ─── DealerOn Scraper ───────────────────────────────────────

async function scrapeDealerOn(browser, config) {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        log(`Navigating: ${config.searchUrl}`);
        await page.goto(config.searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 5000));

        // Scroll to trigger lazy loading
        let lastCount = 0;
        let staleRounds = 0;
        for (let i = 0; i < 40 && staleRounds < 6; i++) {
            await page.evaluate(() => window.scrollBy(0, 600));
            await new Promise(r => setTimeout(r, 1500));
            const count = await page.evaluate(() =>
                document.querySelectorAll('.vehicle-card, .hproduct, [data-vehicle-id], .vehicle-card-details-container').length
            );
            if (count > lastCount) {
                lastCount = count;
                staleRounds = 0;
                log(`Loaded ${count} vehicle cards...`);
            } else {
                staleRounds++;
            }
        }

        const vehicles = await page.evaluate((baseUrl) => {
            const cards = document.querySelectorAll('.vehicle-card, .hproduct, [data-vehicle-id]');
            const results = [];

            cards.forEach(card => {
                try {
                    const titleEl = card.querySelector('.vehicle-card-details-container h2, .vehicle-title, .fn, h2');
                    const title = titleEl ? titleEl.textContent.trim().replace(/\s+/g, ' ') : '';

                    const priceEl = card.querySelector('.vehicle-card-price, .price, .final-price, .primaryPrice');
                    const priceText = priceEl ? priceEl.textContent.trim() : '';

                    const stockNumber = card.dataset.stockNumber || card.dataset.stock || '';
                    const vin = card.dataset.vin || '';

                    const imgEl = card.querySelector('img');
                    let photo = '';
                    if (imgEl) photo = imgEl.src || imgEl.dataset.src || imgEl.dataset.original || '';

                    const linkEl = card.querySelector('a[href]');
                    const detailUrl = linkEl ? linkEl.href : '';

                    if (title) results.push({ title, priceText, stockNumber, vin, mileageText: '', photo, detailUrl, details: {} });
                } catch (e) {}
            });
            return results;
        }, config.baseUrl);

        return vehicles;
    } finally {
        await page.close();
    }
}

// ─── Transform Raw → Structured Vehicle ─────────────────────

function transformVehicle(raw, dealer) {
    const parsed = parseTitle(raw.title);
    const stockNumber = raw.stockNumber || raw.vin || `${dealer.name.replace(/[^a-zA-Z]/g, '')}-${Date.now()}`;
    const mileage = parseMileage(raw.mileageText || raw.details.mileage || '');
    const price = parsePrice(raw.priceText);
    const allText = raw.title + ' ' + JSON.stringify(raw.details);
    const drivetrain = detectDrivetrain(allText + ' ' + (raw.details.drivetrain || '') + ' ' + (raw.details.drive || ''));

    return {
        id: stockNumber,
        vin: raw.vin || '',
        year: parsed.year,
        make: parsed.make,
        model: parsed.model,
        trim: parsed.trim,
        price: price,
        mileage: mileage,
        body: detectBodyType(parsed.model + ' ' + (parsed.trim || '')),
        drivetrain: drivetrain,
        transmission: raw.details.transmission || 'Automatic',
        fuelType: raw.details['fuel type'] || raw.details.fuel || 'Gasoline',
        extColor: raw.details['exterior color'] || raw.details.exterior || raw.details['ext. color'] || '',
        intColor: raw.details['interior color'] || raw.details.interior || raw.details['int. color'] || '',
        engine: raw.details.engine || raw.details.motor || '',
        stockNumber: stockNumber,
        condition: dealer.defaultCondition || (mileage < 500 ? 'New' : 'Used'),
        description: `${parsed.year} ${parsed.make} ${parsed.model} ${parsed.trim}`.trim(),
        features: [],
        photos: raw.photo ? [raw.photo] : [],
        url: raw.detailUrl || '',
        smsBody: `Hey Yancy, I'm interested in the ${parsed.year} ${parsed.make} ${parsed.model} ${parsed.trim} (STK ${stockNumber})`.replace(/\s+/g, ' ').trim(),
        dateAdded: new Date().toISOString().split('T')[0],
        source: dealer.name,
        published: true
    };
}

// ─── Merge Logic ─────────────────────────────────────────────

function mergeInventory(scraped, existing) {
    const merged = [];
    const seen = new Set();

    // First, add all scraped vehicles (update existing if found)
    const existingMap = {};
    existing.forEach(v => { existingMap[v.stockNumber || v.id] = v; });

    scraped.forEach(vehicle => {
        const key = vehicle.stockNumber;
        if (seen.has(key)) return;
        seen.add(key);

        const prev = existingMap[key];
        if (prev) {
            merged.push({
                ...vehicle,
                published: prev.published !== undefined ? prev.published : true,
                photos: (vehicle.photos.length > 0 && vehicle.photos[0]) ? vehicle.photos : (prev.photos || []),
                description: prev.description || vehicle.description,
                features: (prev.features && prev.features.length > 0) ? prev.features : vehicle.features,
                dateAdded: prev.dateAdded || vehicle.dateAdded
            });
        } else {
            merged.push(vehicle);
        }
    });

    // Then, preserve ALL existing vehicles that weren't re-scraped
    existing.forEach(v => {
        const key = v.stockNumber || v.id;
        if (!seen.has(key)) {
            seen.add(key);
            merged.push(v);
        }
    });

    // Sort by price
    merged.sort((a, b) => {
        if (!a.price) return 1;
        if (!b.price) return -1;
        return a.price - b.price;
    });

    return merged;
}

// ─── Git Push ────────────────────────────────────────────────

function gitPush(count) {
    log('Pushing to GitHub...');
    try {
        execSync('git add data/inventory.json', { cwd: REPO_DIR, stdio: 'pipe' });
        const msg = `Inventory sync: ${count} vehicles (${new Date().toLocaleDateString()})`;
        execSync(`git commit -m "${msg}"`, { cwd: REPO_DIR, stdio: 'pipe' });
        execSync('git push', { cwd: REPO_DIR, stdio: 'pipe' });
        log('Pushed to GitHub. Vercel will auto-deploy.');
    } catch (err) {
        const output = err.stdout ? err.stdout.toString() : err.message;
        if (output.includes('nothing to commit')) {
            log('No changes to commit — inventory unchanged.');
        } else {
            log(`Push failed: ${err.message}`);
        }
    }
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
    const startTime = Date.now();
    console.log('');
    console.log('══════════════════════════════════════════');
    console.log('  YENES Inventory Sync');
    console.log(`  ${new Date().toLocaleString()}`);
    console.log('══════════════════════════════════════════');

    // Load existing inventory
    let existing = [];
    if (fs.existsSync(OUTPUT_PATH)) {
        try {
            existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
            console.log(`\nLoaded ${existing.length} existing vehicles.\n`);
        } catch (e) {
            console.log('\nCould not parse existing inventory, starting fresh.\n');
        }
    }

    // Launch browser
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const allScraped = [];

    for (const dealer of DEALERS) {
        console.log(`\n► ${dealer.name} (${dealer.platform})`);

        try {
            let rawVehicles;
            if (dealer.platform === 'dealeron') {
                rawVehicles = await scrapeDealerOn(browser, dealer);
            } else {
                rawVehicles = await scrapeDealerEprocess(browser, dealer);
            }

            const structured = rawVehicles.map(raw => transformVehicle(raw, dealer));
            allScraped.push(...structured);
            log(`Total: ${rawVehicles.length} vehicles from ${dealer.name}`);

        } catch (err) {
            log(`FAILED: ${err.message}`);
        }
    }

    await browser.close();

    // Merge
    console.log('\n► Merging...');
    const merged = mergeInventory(allScraped, existing);

    // Write
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(merged, null, 2));

    const newCount = merged.filter(v => !existing.find(e => e.stockNumber === v.stockNumber)).length;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('');
    console.log('══════════════════════════════════════════');
    console.log(`  Sync complete in ${elapsed}s`);
    console.log(`  Total: ${merged.length} vehicles`);
    console.log(`  New:   ${newCount}`);
    console.log(`  File:  data/inventory.json`);
    console.log('══════════════════════════════════════════');

    // Push if --push flag
    if (process.argv.includes('--push')) {
        console.log('');
        gitPush(merged.length);
    }

    console.log('');
}

main().catch(err => {
    console.error('\nFatal error:', err);
    process.exit(1);
});
