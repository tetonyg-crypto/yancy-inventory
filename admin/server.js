#!/usr/bin/env node
/**
 * Tool: admin/server.js
 * Purpose: Local admin dashboard for inventory management, publish toggle, and photo upload
 * Inputs: None (reads data/inventory.json)
 * Outputs: Serves web UI at http://localhost:3456
 * Dependencies: express, multer
 * Last Updated: 2026-03-22
 * Changelog:
 *   - 2026-03-22: Initial creation
 */

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const app = express();
const PORT = 3456;
const REPO_DIR = path.join(__dirname, '..');
const DATA_PATH = path.join(REPO_DIR, 'data', 'inventory.json');
const PHOTOS_DIR = path.join(REPO_DIR, 'photos');

// Middleware
app.use(express.json());
app.use('/photos', express.static(PHOTOS_DIR));

// Multer for photo uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(PHOTOS_DIR, req.params.stock);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        const existing = fs.readdirSync(path.join(PHOTOS_DIR, req.params.stock)).filter(f => !f.startsWith('.'));
        cb(null, `${existing.length + 1}${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Helpers ────────────────────────────────────────────────

function loadInventory() {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}

function saveInventory(data) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function getLocalIP() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) return net.address;
        }
    }
    return 'localhost';
}

// ─── API Routes ─────────────────────────────────────────────

// Get all vehicles
app.get('/api/inventory', (req, res) => {
    res.json(loadInventory());
});

// Toggle publish
app.post('/api/publish/:stock', (req, res) => {
    const inventory = loadInventory();
    const vehicle = inventory.find(v => v.stockNumber === req.params.stock);
    if (!vehicle) return res.status(404).json({ error: 'Not found' });
    vehicle.published = !vehicle.published;
    saveInventory(inventory);
    res.json({ stockNumber: vehicle.stockNumber, published: vehicle.published });
});

// Update price
app.post('/api/price/:stock', (req, res) => {
    const inventory = loadInventory();
    const vehicle = inventory.find(v => v.stockNumber === req.params.stock);
    if (!vehicle) return res.status(404).json({ error: 'Not found' });
    vehicle.price = parseInt(req.body.price) || 0;
    saveInventory(inventory);
    res.json({ stockNumber: vehicle.stockNumber, price: vehicle.price });
});

// Upload photos
app.post('/api/photos/:stock', upload.array('photos', 10), (req, res) => {
    const inventory = loadInventory();
    const vehicle = inventory.find(v => v.stockNumber === req.params.stock);
    if (!vehicle) return res.status(404).json({ error: 'Not found' });

    // Add local photo paths
    const newPhotos = req.files.map(f => `photos/${req.params.stock}/${f.filename}`);
    vehicle.photos = [...(vehicle.photos || []), ...newPhotos].filter(p => p);
    saveInventory(inventory);
    res.json({ stockNumber: vehicle.stockNumber, photos: vehicle.photos });
});

// Delete a photo
app.delete('/api/photos/:stock/:filename', (req, res) => {
    const filePath = path.join(PHOTOS_DIR, req.params.stock, req.params.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    const inventory = loadInventory();
    const vehicle = inventory.find(v => v.stockNumber === req.params.stock);
    if (vehicle) {
        vehicle.photos = (vehicle.photos || []).filter(p => !p.includes(req.params.filename));
        saveInventory(inventory);
    }
    res.json({ ok: true });
});

// Deploy (git commit + push)
app.post('/api/deploy', (req, res) => {
    try {
        execSync('git add data/inventory.json photos/', { cwd: REPO_DIR, stdio: 'pipe' });
        const msg = `Admin update: ${new Date().toLocaleString()}`;
        execSync(`git commit -m "${msg}"`, { cwd: REPO_DIR, stdio: 'pipe' });
        execSync('git push', { cwd: REPO_DIR, stdio: 'pipe' });
        res.json({ ok: true, message: 'Pushed to GitHub. Vercel will deploy.' });
    } catch (err) {
        const out = err.stdout ? err.stdout.toString() : err.message;
        if (out.includes('nothing to commit')) {
            res.json({ ok: true, message: 'No changes to deploy.' });
        } else {
            res.status(500).json({ error: out });
        }
    }
});

// ─── Dashboard Page ─────────────────────────────────────────

app.get('/', (req, res) => {
    res.send(DASHBOARD_HTML);
});

// ─── Upload Page (phone-friendly) ───────────────────────────

app.get('/upload/:stock', (req, res) => {
    res.send(UPLOAD_HTML.replace(/__STOCK__/g, req.params.stock));
});

// ─── Start Server ───────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIP();
    console.log('');
    console.log('══════════════════════════════════════════');
    console.log('  YENES Inventory Admin');
    console.log('══════════════════════════════════════════');
    console.log(`  Dashboard:  http://localhost:${PORT}`);
    console.log(`  From phone: http://${ip}:${PORT}`);
    console.log('');
    console.log('  Photo upload URLs per vehicle:');
    console.log(`  http://${ip}:${PORT}/upload/{STOCK_NUMBER}`);
    console.log('══════════════════════════════════════════');
    console.log('');
});

// ─── HTML Templates ─────────────────────────────────────────

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>YENES Inventory Admin</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0b; color: #f0f0f2; min-height: 100vh; }
.header { padding: 20px; border-bottom: 1px solid #2a2a2e; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.header h1 { font-size: 20px; }
.stats-bar { display: flex; gap: 16px; font-size: 13px; color: #8a8a95; }
.stats-bar span { font-weight: 700; color: #f0f0f2; }
.actions-bar { display: flex; gap: 8px; }
.btn { padding: 8px 16px; border: 1px solid #2a2a2e; border-radius: 8px; background: #141416; color: #f0f0f2; cursor: pointer; font-size: 13px; font-weight: 600; }
.btn:hover { border-color: #3b82f6; }
.btn-deploy { background: #2563eb; border-color: #2563eb; }
.btn-deploy:hover { background: #1d4ed8; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; padding: 20px; }
.card { background: #141416; border: 1px solid #2a2a2e; border-radius: 12px; overflow: hidden; }
.card.unpublished { opacity: 0.5; border-color: #991b1b; }
.card-img { height: 160px; background: #1c1c1f; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.card-img img { width: 100%; height: 100%; object-fit: cover; }
.card-img .placeholder { font-size: 48px; }
.card-body { padding: 14px; }
.card-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
.card-meta { font-size: 12px; color: #8a8a95; margin-bottom: 8px; }
.card-price { font-family: 'Courier New', monospace; font-size: 18px; font-weight: 700; color: #22c55e; margin-bottom: 10px; }
.card-price input { width: 120px; background: #1c1c1f; border: 1px solid #2a2a2e; border-radius: 6px; color: #22c55e; font-family: inherit; font-size: 16px; padding: 4px 8px; }
.card-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.card-actions .btn { padding: 6px 12px; font-size: 11px; }
.btn-pub { background: #166534; border-color: #166534; }
.btn-unpub { background: #991b1b; border-color: #991b1b; }
.btn-upload { background: #7c3aed; border-color: #7c3aed; }
.toast { position: fixed; bottom: 20px; right: 20px; padding: 12px 20px; background: #166534; border-radius: 8px; font-size: 13px; display: none; z-index: 100; }
.toast.error { background: #991b1b; }
.toast.show { display: block; animation: fadeIn 0.3s; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.search-bar { padding: 0 20px; }
.search-bar input { width: 100%; padding: 10px 14px; background: #141416; border: 1px solid #2a2a2e; border-radius: 8px; color: #f0f0f2; font-size: 14px; outline: none; }
.search-bar input:focus { border-color: #3b82f6; }
.filter-row { display: flex; gap: 8px; padding: 12px 20px; flex-wrap: wrap; }
.filter-btn { padding: 5px 12px; border: 1px solid #2a2a2e; border-radius: 6px; background: transparent; color: #8a8a95; cursor: pointer; font-size: 12px; }
.filter-btn.active { background: #3b82f6; border-color: #3b82f6; color: white; }
</style>
</head>
<body>
<div class="header">
    <h1>YENES Inventory Admin</h1>
    <div class="stats-bar">
        <div>Total: <span id="totalCount">0</span></div>
        <div>Published: <span id="pubCount">0</span></div>
        <div>Hidden: <span id="hidCount">0</span></div>
    </div>
    <div class="actions-bar">
        <button class="btn" onclick="publishAll()">Publish All</button>
        <button class="btn btn-deploy" onclick="deploy()">Deploy to Site</button>
    </div>
</div>
<div class="search-bar"><input type="text" id="search" placeholder="Search vehicles..." oninput="filterCards()"></div>
<div class="filter-row">
    <button class="filter-btn active" onclick="setFilter('all', this)">All</button>
    <button class="filter-btn" onclick="setFilter('published', this)">Published</button>
    <button class="filter-btn" onclick="setFilter('hidden', this)">Hidden</button>
    <button class="filter-btn" onclick="setFilter('New', this)">New</button>
    <button class="filter-btn" onclick="setFilter('Used', this)">Used</button>
</div>
<div class="grid" id="grid"></div>
<div class="toast" id="toast"></div>

<script>
let inventory = [];
let currentFilter = 'all';

async function load() {
    const res = await fetch('/api/inventory');
    inventory = await res.json();
    render();
}

function render() {
    const q = document.getElementById('search').value.toLowerCase();
    let filtered = inventory;

    if (currentFilter === 'published') filtered = filtered.filter(v => v.published !== false);
    else if (currentFilter === 'hidden') filtered = filtered.filter(v => v.published === false);
    else if (currentFilter === 'New' || currentFilter === 'Used') filtered = filtered.filter(v => v.condition === currentFilter);

    if (q) filtered = filtered.filter(v =>
        (v.year + ' ' + v.make + ' ' + v.model + ' ' + (v.trim||'') + ' ' + v.stockNumber).toLowerCase().includes(q)
    );

    document.getElementById('totalCount').textContent = inventory.length;
    document.getElementById('pubCount').textContent = inventory.filter(v => v.published !== false).length;
    document.getElementById('hidCount').textContent = inventory.filter(v => v.published === false).length;

    const grid = document.getElementById('grid');
    grid.innerHTML = filtered.map(v => {
        const hasPhoto = v.photos && v.photos.length > 0 && v.photos[0];
        const imgHtml = hasPhoto
            ? '<img src="' + v.photos[0] + '" onerror="this.outerHTML=\\'<div class=placeholder>&#128663;</div>\\'">'
            : '<div class="placeholder">&#128663;</div>';
        const pubClass = v.published === false ? ' unpublished' : '';
        const pubBtn = v.published === false
            ? '<button class="btn btn-pub" onclick="togglePub(\\'' + v.stockNumber + '\\')">Publish</button>'
            : '<button class="btn btn-unpub" onclick="togglePub(\\'' + v.stockNumber + '\\')">Hide</button>';

        return '<div class="card' + pubClass + '" data-stock="' + v.stockNumber + '">' +
            '<div class="card-img">' + imgHtml + '</div>' +
            '<div class="card-body">' +
                '<div class="card-title">' + v.year + ' ' + v.make + ' ' + v.model + ' ' + (v.trim||'') + '</div>' +
                '<div class="card-meta">STK ' + v.stockNumber + ' | ' + v.condition + ' | ' + (v.source||'') + '</div>' +
                '<div class="card-price">$<input type="number" value="' + (v.price||0) + '" onchange="updatePrice(\\'' + v.stockNumber + '\\', this.value)"></div>' +
                '<div class="card-actions">' +
                    pubBtn +
                    '<button class="btn btn-upload" onclick="window.open(\\'/upload/' + v.stockNumber + '\\')">Photos</button>' +
                '</div>' +
            '</div></div>';
    }).join('');
}

function filterCards() { render(); }
function setFilter(f, btn) {
    currentFilter = f;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render();
}

async function togglePub(stock) {
    const res = await fetch('/api/publish/' + stock, { method: 'POST' });
    const data = await res.json();
    const v = inventory.find(v => v.stockNumber === stock);
    if (v) v.published = data.published;
    render();
    toast(stock + ': ' + (data.published ? 'Published' : 'Hidden'));
}

async function updatePrice(stock, price) {
    await fetch('/api/price/' + stock, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: parseInt(price) })
    });
    const v = inventory.find(v => v.stockNumber === stock);
    if (v) v.price = parseInt(price);
    toast('Price updated: $' + parseInt(price).toLocaleString());
}

async function publishAll() {
    for (const v of inventory) {
        if (v.published === false) {
            await fetch('/api/publish/' + v.stockNumber, { method: 'POST' });
            v.published = true;
        }
    }
    render();
    toast('All vehicles published');
}

async function deploy() {
    toast('Deploying...');
    const res = await fetch('/api/deploy', { method: 'POST' });
    const data = await res.json();
    toast(data.message || data.error, data.error ? 'error' : '');
}

function toast(msg, type) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast show' + (type === 'error' ? ' error' : '');
    setTimeout(() => el.className = 'toast', 3000);
}

load();
</script>
</body>
</html>`;

const UPLOAD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Upload Photos — __STOCK__</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, sans-serif; background: #0a0a0b; color: #f0f0f2; min-height: 100vh; padding: 20px; }
h1 { font-size: 20px; margin-bottom: 4px; }
.subtitle { color: #8a8a95; font-size: 13px; margin-bottom: 20px; }
.upload-area { border: 2px dashed #2a2a2e; border-radius: 12px; padding: 40px; text-align: center; margin-bottom: 20px; cursor: pointer; }
.upload-area:hover { border-color: #3b82f6; }
.upload-area input { display: none; }
.upload-btn { display: block; width: 100%; padding: 16px; background: #7c3aed; border: none; border-radius: 10px; color: white; font-size: 16px; font-weight: 600; cursor: pointer; margin-bottom: 12px; }
.upload-btn:disabled { opacity: 0.5; }
.preview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; margin-bottom: 20px; }
.preview-item { position: relative; border-radius: 8px; overflow: hidden; aspect-ratio: 1; }
.preview-item img { width: 100%; height: 100%; object-fit: cover; }
.preview-item .remove { position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; background: #991b1b; border: none; border-radius: 50%; color: white; cursor: pointer; font-size: 14px; }
.existing { margin-bottom: 20px; }
.existing h3 { font-size: 14px; color: #8a8a95; margin-bottom: 8px; }
.status { text-align: center; padding: 12px; border-radius: 8px; margin-top: 12px; display: none; }
.status.success { display: block; background: #166534; }
.status.error { display: block; background: #991b1b; }
.back-link { display: block; text-align: center; color: #3b82f6; text-decoration: none; margin-top: 16px; font-size: 14px; }
</style>
</head>
<body>
<h1>Upload Photos</h1>
<p class="subtitle">Stock #__STOCK__</p>

<div class="existing" id="existingPhotos"></div>

<div class="upload-area" onclick="document.getElementById('fileInput').click()">
    <div style="font-size: 48px; margin-bottom: 8px;">&#128247;</div>
    <div>Tap to take photos or select from gallery</div>
    <input type="file" id="fileInput" accept="image/*" multiple capture="environment" onchange="handleFiles(this.files)">
</div>

<div class="preview-grid" id="previews"></div>
<button class="upload-btn" id="uploadBtn" onclick="uploadPhotos()" disabled>Upload Photos</button>
<div class="status" id="status"></div>
<a href="/" class="back-link">Back to Dashboard</a>

<script>
const STOCK = '__STOCK__';
let selectedFiles = [];

async function loadExisting() {
    const res = await fetch('/api/inventory');
    const inventory = await res.json();
    const vehicle = inventory.find(v => v.stockNumber === STOCK);
    if (!vehicle) return;

    document.querySelector('h1').textContent = vehicle.year + ' ' + vehicle.make + ' ' + vehicle.model;

    if (vehicle.photos && vehicle.photos.length > 0) {
        const container = document.getElementById('existingPhotos');
        container.innerHTML = '<h3>Current Photos</h3><div class="preview-grid">' +
            vehicle.photos.map(p => '<div class="preview-item"><img src="' + p + '" onerror="this.parentElement.remove()"></div>').join('') +
            '</div>';
    }
}

function handleFiles(files) {
    for (const file of files) {
        selectedFiles.push(file);
        const reader = new FileReader();
        reader.onload = e => {
            const idx = selectedFiles.length - 1;
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.innerHTML = '<img src="' + e.target.result + '"><button class="remove" onclick="removeFile(' + idx + ', this.parentElement)">X</button>';
            document.getElementById('previews').appendChild(div);
        };
        reader.readAsDataURL(file);
    }
    document.getElementById('uploadBtn').disabled = selectedFiles.length === 0;
}

function removeFile(idx, el) {
    selectedFiles[idx] = null;
    el.remove();
    if (selectedFiles.filter(f => f).length === 0) document.getElementById('uploadBtn').disabled = true;
}

async function uploadPhotos() {
    const btn = document.getElementById('uploadBtn');
    const status = document.getElementById('status');
    btn.disabled = true;
    btn.textContent = 'Uploading...';

    const formData = new FormData();
    selectedFiles.filter(f => f).forEach(f => formData.append('photos', f));

    try {
        const res = await fetch('/api/photos/' + STOCK, { method: 'POST', body: formData });
        const data = await res.json();
        status.className = 'status success';
        status.textContent = 'Uploaded ' + data.photos.length + ' photos!';
        status.style.display = 'block';
        selectedFiles = [];
        document.getElementById('previews').innerHTML = '';
        btn.textContent = 'Upload Photos';
        loadExisting();
    } catch (err) {
        status.className = 'status error';
        status.textContent = 'Upload failed: ' + err.message;
        status.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Upload Photos';
    }
}

loadExisting();
</script>
</body>
</html>`;
