const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const DEALER_URL = 'https://tetonmotorsgm.com';
// TODO: Update this URL to the actual inventory listing page
const INVENTORY_PAGE = `${DEALER_URL}/searchnew.aspx`;
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'inventory.json');

// Body type detection from model name
function detectBodyType(model) {
    const trucks = ['sierra', 'silverado', 'colorado', 'f-150', 'f-250', 'f-350', 'tacoma', 'tundra', 'ranger', 'canyon'];
    const suvs = ['forester', 'crosstrek', 'highlander', 'ascent', 'tahoe', 'suburban', 'traverse', 'equinox', 'blazer', 'trailblazer', 'outback', 'rav4', '4runner', 'acadia', 'terrain', 'yukon'];
    const sedans = ['malibu', 'camry', 'corolla', 'civic', 'accord', 'impreza', 'legacy'];
    const vans = ['express', 'savana', 'transit', 'sienna'];

    const m = model.toLowerCase();
    if (trucks.some(t => m.includes(t))) return 'Truck';
    if (suvs.some(s => m.includes(s))) return 'SUV';
    if (sedans.some(s => m.includes(s))) return 'Sedan';
    if (vans.some(v => m.includes(v))) return 'Van';
    return 'SUV'; // Default fallback
}

// Determine condition from mileage
function detectCondition(mileage) {
    return (!mileage || mileage < 500) ? 'New' : 'Used';
}

// Detect drivetrain from text
function detectDrivetrain(text) {
    const t = (text || '').toLowerCase();
    if (t.includes('4wd') || t.includes('4x4')) return '4WD';
    if (t.includes('awd')) return 'AWD';
    if (t.includes('rwd') || t.includes('rear-wheel')) return 'RWD';
    return 'FWD';
}

async function scrape() {
    console.log(`Fetching inventory from ${INVENTORY_PAGE}...`);

    try {
        const res = await fetch(INVENTORY_PAGE, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const html = await res.text();
        const $ = cheerio.load(html);

        const vehicles = [];

        // TODO: Update selector to match actual dealer site structure
        // Common patterns:
        //   .vehicle-card, .inventory-listing, .srpVehicle, .vehicle-item
        $('.vehicle-card').each((i, el) => {
            try {
                // TODO: Update selectors below to match actual dealer site

                const title = $(el).find('.vehicle-title, .title, h2').first().text().trim();
                // Parse "2025 Chevrolet Silverado 2500HD LTZ" format
                const titleParts = title.match(/^(\d{4})\s+(\w+)\s+(.+?)(?:\s+([\w]+))?$/);

                const year = titleParts ? parseInt(titleParts[1]) : 0;
                const make = titleParts ? titleParts[2] : '';
                const modelTrim = titleParts ? titleParts[3] : title;
                const model = modelTrim.split(' ').slice(0, -1).join(' ') || modelTrim;
                const trim = modelTrim.split(' ').slice(-1)[0] || '';

                // TODO: Update price selector
                const priceText = $(el).find('.price, .vehicle-price, .final-price').first().text().trim();
                const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;

                // TODO: Update mileage selector
                const milesText = $(el).find('.mileage, .miles, .odometer').first().text().trim();
                const mileage = parseInt(milesText.replace(/[^0-9]/g, '')) || 0;

                // TODO: Update VIN/stock selectors
                const vin = $(el).find('.vin, [data-vin]').first().text().trim() || $(el).attr('data-vin') || '';
                const stockNumber = $(el).find('.stock, .stock-number').first().text().replace(/[^a-zA-Z0-9]/g, '') || `STK${i}`;

                // TODO: Update photo selector
                const photos = [];
                $(el).find('img').each((j, img) => {
                    const src = $(img).attr('src') || $(img).attr('data-src');
                    if (src && !src.includes('placeholder') && !src.includes('noimage')) {
                        photos.push(src.startsWith('http') ? src : `${DEALER_URL}${src}`);
                    }
                });

                // TODO: Update detail URL selector
                const detailHref = $(el).find('a').first().attr('href') || '';
                const url = detailHref.startsWith('http') ? detailHref : `${DEALER_URL}${detailHref}`;

                const body = detectBodyType(model);
                const condition = detectCondition(mileage);
                const drivetrain = detectDrivetrain(title + ' ' + $(el).text());

                const vehicle = {
                    id: `STK-${stockNumber}`,
                    vin: vin,
                    year: year,
                    make: make,
                    model: model,
                    trim: trim,
                    price: price,
                    mileage: mileage,
                    body: body,
                    drivetrain: drivetrain,
                    transmission: 'Automatic',
                    fuelType: 'Gasoline',
                    extColor: '',
                    intColor: '',
                    engine: '',
                    stockNumber: stockNumber,
                    condition: condition,
                    description: '',
                    features: [],
                    photos: photos,
                    url: url,
                    smsBody: `Hey Yancy, I'm interested in the ${year} ${model} ${trim} (STK ${stockNumber})`,
                    dateAdded: new Date().toISOString().split('T')[0]
                };

                vehicles.push(vehicle);
            } catch (parseErr) {
                console.error(`Error parsing vehicle ${i}:`, parseErr.message);
            }
        });

        // Write output
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(vehicles, null, 4));
        console.log(`Scraped ${vehicles.length} vehicles. Written to data/inventory.json.`);

        if (vehicles.length === 0) {
            console.log('\nNo vehicles found. The CSS selectors likely need updating.');
            console.log('Open the dealer website and inspect the HTML structure,');
            console.log('then update the selectors marked with TODO in this file.');
        }

    } catch (err) {
        console.error('Scrape failed:', err.message);
        process.exit(1);
    }
}

scrape();
