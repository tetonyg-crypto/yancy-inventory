const PHONE = '3076993743';
const INVENTORY_URL = 'data/inventory.json';

function formatPrice(num) {
    if (!num || num === 0) return 'Contact for Price';
    return '$' + num.toLocaleString('en-US');
}

function formatMiles(num) {
    if (!num || num === 0) return 'N/A';
    return num.toLocaleString('en-US');
}

function renderVehicle(v) {
    const container = document.getElementById('vehicleContent');
    if (!container) return;

    // Update page title
    document.title = `${v.year} ${v.make} ${v.model} ${v.trim || ''} | Yancy Garcia`;

    // Photo Gallery
    const hasPhotos = v.photos && v.photos.length > 0 && v.photos[0] !== '';
    let galleryHTML = '<div class="gallery">';
    if (hasPhotos) {
        galleryHTML += `
            <div class="main-photo">
                <img id="mainPhoto" src="${v.photos[0]}" alt="${v.year} ${v.make} ${v.model}" onerror="this.parentElement.innerHTML='<div class=\\'main-photo-placeholder\\'>🚗</div>'">
            </div>
        `;
        if (v.photos.length > 1) {
            galleryHTML += '<div class="thumbnail-strip">';
            v.photos.forEach((photo, i) => {
                if (photo) {
                    galleryHTML += `<div class="thumbnail ${i === 0 ? 'active' : ''}" data-index="${i}"><img src="${photo}" alt="Photo ${i + 1}" onerror="this.parentElement.style.display='none'"></div>`;
                }
            });
            galleryHTML += '</div>';
        }
    } else {
        galleryHTML += '<div class="main-photo-placeholder">🚗</div>';
    }
    galleryHTML += '</div>';

    // Condition badge class
    const conditionClass = v.condition === 'New' ? 'card-badge card-badge--new' : 'card-badge';

    // Title + Badges
    const headerHTML = `
        <div class="vehicle-header">
            <h1 class="vehicle-title">${v.year} ${v.make} ${v.model} ${v.trim || ''}</h1>
            <div class="vehicle-stock">Stock #${v.stockNumber}</div>
            <div class="vehicle-badges">
                <span class="${conditionClass}">${v.condition}</span>
                <span class="card-badge">${v.body}</span>
                <span class="card-badge">${v.drivetrain}</span>
            </div>
        </div>
    `;

    // Price
    const priceHTML = `
        <div class="price-section">
            <div class="vehicle-price">${formatPrice(v.price)}</div>
        </div>
    `;

    // Primary CTA
    const ctaHTML = `
        <a href="sms:${PHONE}?body=${encodeURIComponent(v.smsBody)}" class="cta-primary action-btn">
            <div class="action-icon icon-white">💬</div>
            <div class="action-text">
                <div class="action-title">Text Me About This Vehicle</div>
                <div class="action-subtitle">I'll respond within minutes</div>
            </div>
            <div class="action-arrow">→</div>
        </a>
    `;

    // Specs Grid
    const specs = [
        { icon: '📏', label: 'Mileage', value: v.mileage ? formatMiles(v.mileage) + ' mi' : null },
        { icon: '⚙️', label: 'Drivetrain', value: v.drivetrain },
        { icon: '🔧', label: 'Transmission', value: v.transmission },
        { icon: '⛽', label: 'Fuel Type', value: v.fuelType },
        { icon: '🏎️', label: 'Engine', value: v.engine },
        { icon: '🎨', label: 'Exterior Color', value: v.extColor }
    ].filter(s => s.value);

    let specsHTML = '';
    if (specs.length > 0) {
        specsHTML = '<div class="section-label">Specifications</div><div class="specs-grid">';
        specs.forEach(s => {
            specsHTML += `
                <div class="spec-card">
                    <div class="spec-icon">${s.icon}</div>
                    <div class="spec-label">${s.label}</div>
                    <div class="spec-value">${s.value}</div>
                </div>
            `;
        });
        specsHTML += '</div>';
    }

    // Features
    let featuresHTML = '';
    if (v.features && v.features.length > 0) {
        featuresHTML = '<div class="features-section"><div class="section-label">Features</div><div class="features-wrap">';
        v.features.forEach(f => {
            featuresHTML += `<span class="feature-chip">${f}</span>`;
        });
        featuresHTML += '</div></div>';
    }

    // Description
    let descHTML = '';
    if (v.description) {
        descHTML = `
            <div class="description-section">
                <div class="section-label">About This Vehicle</div>
                <p>${v.description}</p>
            </div>
        `;
    }

    // Secondary Actions
    const actionsHTML = `
        <div class="section-label">Interested?</div>
        <div class="actions">
            <a class="action-btn" href="sms:${PHONE}?body=${encodeURIComponent(`Hey Yancy, what would payments be on the ${v.year} ${v.model}?`)}">
                <div class="action-icon icon-green">💰</div>
                <div class="action-text">
                    <div class="action-title">Check My Payment</div>
                    <div class="action-subtitle">Free estimate · All credit types welcome</div>
                </div>
                <div class="action-arrow">→</div>
            </a>
            <a class="action-btn" href="sms:${PHONE}?body=${encodeURIComponent(`Hey Yancy, what's my trade worth toward the ${v.year} ${v.model}?`)}">
                <div class="action-icon icon-orange">🔄</div>
                <div class="action-text">
                    <div class="action-title">What's My Trade Worth?</div>
                    <div class="action-subtitle">Text me your vehicle details</div>
                </div>
                <div class="action-arrow">→</div>
            </a>
            <a class="action-btn" href="sms:${PHONE}?body=${encodeURIComponent(`Hola Yancy, me interesa el ${v.year} ${v.model}`)}">
                <div class="action-icon icon-purple">🇲🇽</div>
                <div class="action-text">
                    <div class="action-title">Hablo Español</div>
                    <div class="action-subtitle">Financiamiento disponible</div>
                </div>
                <div class="action-arrow">→</div>
            </a>
            <a class="action-btn" href="sms:${PHONE}?body=${encodeURIComponent(`Hey Yancy, can I test drive the ${v.year} ${v.model}?`)}">
                <div class="action-icon icon-primary">📅</div>
                <div class="action-text">
                    <div class="action-title">Schedule a Test Drive</div>
                    <div class="action-subtitle">Come see it in person</div>
                </div>
                <div class="action-arrow">→</div>
            </a>
        </div>
    `;

    // Dealer Link
    let dealerHTML = '';
    if (v.url) {
        dealerHTML = `<a class="dealer-link" href="${v.url}" target="_blank" rel="noopener">View on dealer site →</a>`;
    }

    container.innerHTML = galleryHTML + headerHTML + priceHTML + ctaHTML + specsHTML + featuresHTML + descHTML + actionsHTML + dealerHTML;

    // Thumbnail click handlers
    if (hasPhotos && v.photos.length > 1) {
        container.querySelectorAll('.thumbnail').forEach(thumb => {
            thumb.addEventListener('click', () => {
                const idx = parseInt(thumb.dataset.index);
                const mainImg = document.getElementById('mainPhoto');
                if (mainImg) mainImg.src = v.photos[idx];
                container.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id) {
        document.getElementById('vehicleContent').classList.add('hidden');
        document.getElementById('notFound').classList.remove('hidden');
        return;
    }

    try {
        const res = await fetch(INVENTORY_URL);
        const data = await res.json();
        const vehicle = data.find(v => v.stockNumber === id);

        if (!vehicle) {
            document.getElementById('vehicleContent').classList.add('hidden');
            document.getElementById('notFound').classList.remove('hidden');
            return;
        }

        renderVehicle(vehicle);
    } catch (err) {
        console.error('Failed to load vehicle:', err);
        document.getElementById('vehicleContent').classList.add('hidden');
        document.getElementById('notFound').classList.remove('hidden');
    }
});
