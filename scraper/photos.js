#!/usr/bin/env node
/**
 * Tool: photos.js
 * Purpose: Scrape photo URLs from vehicle detail pages for all vehicles missing photos
 * Dependencies: puppeteer-extra, puppeteer-extra-plugin-stealth
 * Last Updated: 2026-03-22
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'inventory.json');

async function scrapePhotos(page, url) {
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await new Promise(r => setTimeout(r, 2000));

        const photos = await page.evaluate(() => {
            const urls = new Set();

            // DealerEprocess: gallery images
            document.querySelectorAll('.vdp-gallery img, .media-viewer img, .gallery img, .photo-gallery img, .vehicle-photo img, .slick-slide img, .swiper-slide img, [class*="gallery"] img, [class*="photo"] img, [class*="slider"] img, [class*="carousel"] img').forEach(img => {
                const src = img.src || img.dataset.src || img.dataset.lazy || img.dataset.original || '';
                if (src && !src.includes('placeholder') && !src.includes('noimage') && !src.includes('logo') && !src.includes('icon') && !src.includes('svg')) {
                    urls.add(src.split('?')[0]);
                }
            });

            // DealerOn: check for vehicle images
            document.querySelectorAll('.media-gallery img, .vehicle-image img, .photo-viewer img, [data-image-url]').forEach(el => {
                const src = el.src || el.dataset.imageUrl || el.dataset.src || '';
                if (src && !src.includes('placeholder') && !src.includes('noimage') && !src.includes('logo')) {
                    urls.add(src.split('?')[0]);
                }
            });

            // Fallback: any large image on the page
            if (urls.size === 0) {
                document.querySelectorAll('img').forEach(img => {
                    const src = img.src || '';
                    if (src && img.naturalWidth > 200 && !src.includes('logo') && !src.includes('icon') && !src.includes('avatar') && !src.includes('svg') && !src.includes('placeholder')) {
                        urls.add(src.split('?')[0]);
                    }
                });
            }

            return [...urls].slice(0, 20); // Max 20 photos per vehicle
        });

        return photos.filter(p => p.startsWith('http'));
    } catch (err) {
        return [];
    }
}

async function main() {
    const inventory = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    const needPhotos = inventory.filter(v => (!v.photos || v.photos.length === 0 || !v.photos[0]) && v.url);

    console.log(`\nPhoto Scraper`);
    console.log(`Total vehicles: ${inventory.length}`);
    console.log(`Need photos: ${needPhotos.length}`);
    console.log(`Already have photos: ${inventory.length - needPhotos.length}\n`);

    if (needPhotos.length === 0) {
        console.log('All vehicles have photos!');
        return;
    }

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Visit homepages first to set cookies
    console.log('Setting up sessions...');
    for (const homepage of ['https://www.stonessubaru.com', 'https://www.stonescars.com']) {
        try {
            await page.goto(homepage, { waitUntil: 'networkidle2', timeout: 20000 });
            await new Promise(r => setTimeout(r, 2000));
        } catch(e) {}
    }

    let updated = 0;
    let failed = 0;

    for (let i = 0; i < needPhotos.length; i++) {
        const vehicle = needPhotos[i];
        process.stdout.write(`  [${i + 1}/${needPhotos.length}] ${vehicle.year} ${vehicle.make} ${vehicle.model}...`);

        const photos = await scrapePhotos(page, vehicle.url);

        if (photos.length > 0) {
            // Update in the full inventory array
            const idx = inventory.findIndex(v => v.stockNumber === vehicle.stockNumber);
            if (idx >= 0) {
                inventory[idx].photos = photos;
                updated++;
                console.log(` ${photos.length} photos`);
            }
        } else {
            failed++;
            console.log(` no photos found`);
        }

        // Small delay between requests
        await new Promise(r => setTimeout(r, 500));
    }

    await browser.close();

    // Save
    fs.writeFileSync(DATA_PATH, JSON.stringify(inventory, null, 2));

    console.log(`\n══════════════════════════════════════════`);
    console.log(`  Photos scraped: ${updated}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Total with photos: ${inventory.filter(v => v.photos && v.photos.length > 0 && v.photos[0]).length}/${inventory.length}`);
    console.log(`══════════════════════════════════════════\n`);
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
