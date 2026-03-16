# Inventory Scraper

Pulls vehicle inventory from the dealership website and outputs data/inventory.json.

## Setup

```
npm install
```

## Usage

```
node scrape.js
```

## Output

Writes to ../data/inventory.json

## Notes

- CSS selectors may need updating if the dealer website changes
- Run whenever inventory changes significantly (weekly recommended)
- After running: `cd .. && git add . && git commit -m "update inventory" && git push`
