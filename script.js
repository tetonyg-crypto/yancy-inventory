const PHONE = '3076993743';
const INVENTORY_URL = 'data/inventory.json';

let allVehicles = [];
let filters = {
    search: '',
    body: 'all',
    price: 'all',
    make: 'all',
    condition: 'all',
    sort: 'year-desc'
};

function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

function formatPrice(num) {
    if (!num || num === 0) return 'Contact for Price';
    return '$' + num.toLocaleString('en-US');
}

function formatMiles(num) {
    if (!num || num === 0) return 'N/A';
    return num.toLocaleString('en-US');
}

async function loadInventory() {
    try {
        const res = await fetch(INVENTORY_URL);
        const data = await res.json();
        // Only show published vehicles on the public site
        allVehicles = data.filter(v => v.published !== false);
        buildMakeFilters();
        applyFilters();
        const countEl = document.getElementById('vehicleCount');
        if (countEl) countEl.textContent = allVehicles.length;
    } catch (err) {
        console.error('Failed to load inventory:', err);
        const grid = document.getElementById('vehicleGrid');
        if (grid) grid.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Unable to load inventory</div></div>';
    }
}

function buildMakeFilters() {
    const container = document.getElementById('makeFilters');
    if (!container) return;
    const makes = [...new Set(allVehicles.map(v => v.make))].sort();
    container.innerHTML = '';

    const allChip = document.createElement('button');
    allChip.className = 'filter-chip active';
    allChip.dataset.filter = 'make';
    allChip.dataset.value = 'all';
    allChip.textContent = 'All';
    container.appendChild(allChip);

    makes.forEach(make => {
        const chip = document.createElement('button');
        chip.className = 'filter-chip';
        chip.dataset.filter = 'make';
        chip.dataset.value = make;
        chip.textContent = make;
        container.appendChild(chip);
    });
}

function applyFilters() {
    let filtered = [...allVehicles];

    // Search
    if (filters.search) {
        const q = filters.search.toLowerCase();
        filtered = filtered.filter(v =>
            v.make.toLowerCase().includes(q) ||
            v.model.toLowerCase().includes(q) ||
            (v.trim && v.trim.toLowerCase().includes(q)) ||
            v.year.toString().includes(q) ||
            (v.description && v.description.toLowerCase().includes(q)) ||
            (v.features && v.features.join(' ').toLowerCase().includes(q))
        );
    }

    // Body
    if (filters.body !== 'all') {
        filtered = filtered.filter(v => v.body === filters.body);
    }

    // Price
    if (filters.price !== 'all') {
        switch (filters.price) {
            case 'under20k':
                filtered = filtered.filter(v => v.price > 0 && v.price < 20000);
                break;
            case '20to35':
                filtered = filtered.filter(v => v.price >= 20000 && v.price <= 35000);
                break;
            case '35to50':
                filtered = filtered.filter(v => v.price > 35000 && v.price <= 50000);
                break;
            case 'over50':
                filtered = filtered.filter(v => v.price > 50000);
                break;
        }
    }

    // Make
    if (filters.make !== 'all') {
        filtered = filtered.filter(v => v.make === filters.make);
    }

    // Condition
    if (filters.condition !== 'all') {
        filtered = filtered.filter(v => v.condition === filters.condition);
    }

    // Sort
    switch (filters.sort) {
        case 'price-asc':
            filtered.sort((a, b) => {
                if (!a.price || a.price === 0) return 1;
                if (!b.price || b.price === 0) return -1;
                return a.price - b.price;
            });
            break;
        case 'price-desc':
            filtered.sort((a, b) => {
                if (!a.price || a.price === 0) return 1;
                if (!b.price || b.price === 0) return -1;
                return b.price - a.price;
            });
            break;
        case 'year-desc':
            filtered.sort((a, b) => {
                if (b.year !== a.year) return b.year - a.year;
                const aPrice = a.price || 0;
                const bPrice = b.price || 0;
                return bPrice - aPrice;
            });
            break;
        case 'miles-asc':
            filtered.sort((a, b) => (a.mileage || 0) - (b.mileage || 0));
            break;
    }

    renderGrid(filtered);

    const countEl = document.getElementById('resultsCount');
    if (countEl) countEl.textContent = `${filtered.length} vehicle${filtered.length !== 1 ? 's' : ''}`;
}

function renderGrid(vehicles) {
    const grid = document.getElementById('vehicleGrid');
    const empty = document.getElementById('emptyState');
    if (!grid) return;

    grid.innerHTML = '';

    if (vehicles.length === 0) {
        grid.classList.add('hidden');
        if (empty) empty.classList.remove('hidden');
        return;
    }

    grid.classList.remove('hidden');
    if (empty) empty.classList.add('hidden');

    vehicles.forEach(v => {
        const card = document.createElement('a');
        card.className = 'vehicle-card';
        card.href = `vehicle.html?id=${v.stockNumber}`;

        const hasPhoto = v.photos && v.photos.length > 0 && v.photos[0] !== '';
        const imageHTML = hasPhoto
            ? `<img src="${v.photos[0]}" alt="${v.year} ${v.make} ${v.model}" onerror="this.parentElement.innerHTML='<div class=\\'card-placeholder\\'>🚗</div>'">`
            : '<div class="card-placeholder">🚗</div>';

        const conditionClass = v.condition === 'New' ? 'card-badge card-badge--new' : 'card-badge';
        const monthlyPayment = v.price && v.price > 0
            ? `<div class="card-monthly-est">Est. ~$${Math.round(v.price * 0.018).toLocaleString('en-US')}/mo</div>`
            : '';

        card.innerHTML = `
            <div class="card-image">${imageHTML}</div>
            <div class="card-body">
                <div class="card-title">${v.year} ${v.make} ${v.model} ${v.trim || ''}</div>
                <div class="card-price">${formatPrice(v.price)}</div>
                ${monthlyPayment}
                <div class="card-meta">
                    <span class="${conditionClass}">${v.condition}</span>
                    <span class="card-badge">${v.body}</span>
                    <span class="card-badge">${v.drivetrain}</span>
                </div>
                <div class="card-miles">${formatMiles(v.mileage)} mi</div>
            </div>
        `;

        grid.appendChild(card);
    });
}

function clearAllFilters() {
    filters = {
        search: '',
        body: 'all',
        price: 'all',
        make: 'all',
        condition: 'all',
        sort: filters.sort
    };

    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';

    document.querySelectorAll('.filter-chip').forEach(chip => {
        if (chip.dataset.value === 'all') {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });

    applyFilters();
}

document.addEventListener('DOMContentLoaded', () => {
    loadInventory();

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        const debouncedSearch = debounce(() => {
            filters.search = searchInput.value;
            applyFilters();
        }, 300);
        searchInput.addEventListener('input', debouncedSearch);
    }

    document.addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;

        const filterType = chip.dataset.filter;
        const value = chip.dataset.value;

        // Remove active from siblings in same filter group
        const group = chip.parentElement;
        group.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        filters[filterType] = value;
        applyFilters();
    });

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            filters.sort = sortSelect.value;
            applyFilters();
        });
    }

    const clearBtn = document.getElementById('clearFilters');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearAllFilters);
    }
});
