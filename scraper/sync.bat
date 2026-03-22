@echo off
REM YENES Inventory Sync — Nightly scheduled task
REM Runs the Puppeteer scraper and pushes to GitHub for Vercel auto-deploy

cd /d "C:\Users\Yancy\New folder\yancy-inventory\scraper"
node sync.js --push >> "C:\Users\Yancy\New folder\yancy-inventory\scraper\sync.log" 2>&1
