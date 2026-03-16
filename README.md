# YENES Inventory — Yancy Garcia

Personal vehicle inventory browsing site. Routes all interactions to SMS.

## Setup

1. Replace `<!-- REPLACE` placeholders in `index.html` and `vehicle.html` with your YENES Link landing page URL
2. Run the scraper to populate inventory data (see `scraper/README.md`)
3. Push to GitHub
4. Import into Vercel
5. Update "Browse Available Vehicles" link on YENES Link landing page to point to this site

## Updating Inventory

```
cd scraper
npm install
node scrape.js
cd ..
git add .
git commit -m "update inventory"
git push
```

Vercel auto-deploys.

## Deployment

1. Create a GitHub repository named `yancy-inventory`
2. Push this project to GitHub
3. Go to vercel.com
4. Click "Import Project"
5. Select the repository
6. Deploy

## File Structure

- `index.html` — Inventory grid page
- `vehicle.html` — Vehicle detail page
- `styles.css` — All styles
- `script.js` — Grid filtering, sorting, search
- `vehicle.js` — Vehicle detail rendering
- `data/inventory.json` — Vehicle data (edit or scrape to update)
- `scraper/` — Node.js scraper for dealer website
- `assets/` — Static assets

## Powered by YENES AI
