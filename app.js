const tg = window.Telegram.WebApp;
const API_BASE_URL = "https://travel-api-n6r2.onrender.com";

let currentUser = null;
let authInProgress = false;

// 1. ИНИЦИАЛИЗАЦИЯ
document.addEventListener('DOMContentLoaded', () => {
    tg.ready();
    tg.expand();
    authenticateUser();
    
    // Навигация
    setupNavigation();
});

function setupNavigation() {
    const navMapping = {
        'nav-welcome': 'welcome',
        'nav-find': 'find-trip',
        'nav-create': 'create-trip-map',
        'nav-profile': 'profile'
    };

    Object.entries(navMapping).forEach(([btnId, screenId]) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.onclick = () => showScreen(screenId);
        }
    });
}

// 2. АВТОРИЗАЦИЯ (Проверка разных эндпоинтов)
async function authenticateUser() {
    if (authInProgress) return;
    authInProgress = true;
    
    const authData = {
        init_data: tg.initData,
        user_info: tg.initDataUnsafe?.user
    };

    // Пробуем основной путь, который должен быть в main.py
    try {
        let response = await fetch(`${API_BASE_URL}/api/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(authData)
        });

        // Если 404, пробуем альтернативный путь (иногда в FastAPI это /auth/)
        if (response.status === 404) {
            response = await fetch(`${API_BASE_URL}/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(authData)
            });
        }

        const result = await response.json();
        if (result.success) {
            currentUser = result.user;
            updateUI();
            loadStats();
        } else {
            console.error("Ошибка авторизации:", result.message);
        }
    } catch (e) {
        console.error("Критическая ошибка сети:", e);
    } finally {
        authInProgress = false;
    }
}

// 3. ПОИСК И БРОНИРОВАНИЕ (ВАША ПОЛНАЯ ЛОГИКА)
async function searchTrips() {
    const from = document.getElementById('find-from')?.value;
    const to = document.getElementById('find-to')?.value;
    const date = document.getElementById('find-date')?.value;

    const container = document.getElementById('trips-results');
    if (!container) return;
    
    container.innerHTML = '<div class="loader">Загрузка поездок...</div>';

    try {
        const url = `${API_BASE_URL}/api/trips/search?from_city=${encodeURIComponent(from)}&to_city=${encodeURIComponent(to)}&date=${date}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.trips && data.trips.length > 0) {
            container.innerHTML = data.trips.map(trip => `
                <div class="trip-card" onclick="showTripDetails(${trip.id})">
                    <div class="trip-main">
                        <strong>${trip.from_city} → ${trip.to_city}</strong>
                        <span class="price">${trip.price} ₽</span>
                    </div>
                    <div class="trip-details">
                        <span>📅 ${trip.departure_date}</span>
                        <span>👤 ${trip.driver_name || 'Водитель'}</span>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<div class="no-results">Поездок не найдено</div>';
        }
    } catch (e) {
        container.innerHTML = 'Ошибка при поиске';
    }
}

async function bookTrip(tripId) {
    tg.showConfirm("Забронировать место?", async (confirmed) => {
        if (!confirmed) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/bookings/create?user_id=${currentUser.id}&trip_id=${tripId}`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
                tg.showAlert("✅ Успешно забронировано!");
                showScreen('welcome');
                loadStats();
                closeModal();
            } else {
                tg.showAlert("Ошибка: " + data.detail);
            }
        } catch (e) { tg.showAlert("Ошибка соединения"); }
    });
}

// 4. СОЗДАНИЕ ПОЕЗДКИ (С КАРТОЙ)
async function createTripWithMap() {
    if (!window.YandexMapsModule?.isMapInitialized()) {
        tg.showAlert("Карта не готова");
        return;
    }

    const route = window.YandexMapsModule.getRouteData();
    if (!route.start_point || !route.finish_point) {
        tg.showAlert("Выберите маршрут");
        return;
    }

    const payload = {
        from_city: route.start_point.address,
        to_city: route.finish_point.address,
        start_lat: parseFloat(route.start_point.lat),
        start_lng: parseFloat(route.start_point.lng),
        finish_lat: parseFloat(route.finish_point.lat),
        finish_lng: parseFloat(route.finish_point.lng),
        departure_date: document.getElementById('trip-date-map').value,
        departure_time: document.getElementById('trip-time-map').value,
        seats_available: parseInt(document.getElementById('seats-count-map').value),
        price: parseFloat(document.getElementById('trip-price-map').value),
        comment: document.getElementById('trip-comment-map').value || "",
        distance_km: parseFloat(route.distance || 0),
        duration_min: parseInt(route.duration || 0)
    };

    try {
        const res = await fetch(`${API_BASE_URL}/api/trips/create?user_id=${currentUser.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (res.ok) {
            tg.showAlert("✅ Поездка создана!");
            showScreen('welcome');
            loadStats();
        } else {
            tg.showAlert("Ошибка: " + JSON.stringify(result.detail));
        }
    } catch (e) { tg.showAlert("Ошибка сети"); }
}

// 5. МОДАЛЬНЫЕ ОКНА
function showTripDetails(tripId) {
    openModal("Загрузка данных...");
    fetch(`${API_BASE_URL}/api/trips/${tripId}`)
        .then(r => r.json())
        .then(trip => {
            document.getElementById('modal-body').innerHTML = `
                <div class="modal-trip-info">
                    <h3>${trip.from_city} — ${trip.to_city}</h3>
                    <p>Водитель: ${trip.driver_name || 'Аноним'}</p>
                    <p>Цена: ${trip.price} ₽</p>
                    <button class="book-btn" onclick="bookTrip(${trip.id})">Забронировать</button>
                </div>
            `;
        });
}

function openModal(html) {
    const m = document.getElementById('modal');
    if (m) {
        document.getElementById('modal-body').innerHTML = html;
        m.style.display = 'flex';
    }
}

function closeModal() {
    const m = document.getElementById('modal');
    if (m) m.style.display = 'none';
}

// 6. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    const target = document.getElementById(screenId);
    if (target) {
        target.style.display = 'block';
        let navId = 'nav-' + screenId.replace('-trip', '').replace('-map', '');
        document.getElementById(navId)?.classList.add('active');
    }

    if (screenId === 'create-trip-map') window.YandexMapsModule?.initMap();
    if (screenId === 'profile') loadUserProfile();
}

async function loadStats() {
    if (!currentUser) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/users/${currentUser.id}/stats`);
        const data = await res.json();
        if (document.getElementById('trips-count')) 
            document.getElementById('trips-count').textContent = data.trips_count || 0;
        if (document.getElementById('bookings-count')) 
            document.getElementById('bookings-count').textContent = data.bookings_count || 0;
    } catch (e) {}
}

async function loadUserProfile() {
    const container = document.getElementById('profile-data');
    if (!container || !currentUser) return;
    
    container.innerHTML = `<h3>${currentUser.first_name}</h3><div id="cars-list">Загрузка авто...</div>`;
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/users/${currentUser.id}/cars`);
        const data = await res.json();
        document.getElementById('cars-list').innerHTML = data.cars.map(c => 
            `<div class="car-item">🚗 ${c.model} (${c.plate})</div>`
        ).join('') || 'Нет добавленных машин';
    } catch (e) {}
}

function updateUI() {
    if (currentUser) {
        if (document.getElementById('user-name'))
            document.getElementById('user-name').textContent = currentUser.first_name;
        if (document.getElementById('welcome-title'))
            document.getElementById('welcome-title').textContent = `👋 Привет, ${currentUser.first_name}!`;
    }
}

// Глобальный доступ
window.showScreen = showScreen;
window.createTripWithMap = createTripWithMap;
window.searchTrips = searchTrips;
window.bookTrip = bookTrip;
window.closeModal = closeModal;