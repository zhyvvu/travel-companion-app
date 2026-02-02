// app.js - ПОЛНАЯ ВЕРСИЯ: АВТОРИЗАЦИЯ, ПОИСК, СОЗДАНИЕ, ПРОФИЛЬ
const tg = window.Telegram.WebApp;
const API_BASE_URL = "https://travel-api-n6r2.onrender.com";

let currentUser = null;
let authInProgress = false;

// 1. ИНИЦИАЛИЗАЦИЯ И НАВИГАЦИЯ
document.addEventListener('DOMContentLoaded', () => {
    tg.ready();
    tg.expand();
    authenticateUser();
    
    // Привязка кнопок меню
    document.getElementById('nav-welcome')?.addEventListener('click', () => showScreen('welcome'));
    document.getElementById('nav-find')?.addEventListener('click', () => showScreen('find-trip'));
    document.getElementById('nav-create')?.addEventListener('click', () => showScreen('create-trip-map'));
    document.getElementById('nav-profile')?.addEventListener('click', () => {
        showScreen('profile');
        loadUserProfile();
    });
});

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    const target = document.getElementById(screenId);
    if (target) {
        target.style.display = 'block';
        const navId = screenId === 'create-trip-map' ? 'nav-create' : `nav-${screenId}`;
        document.getElementById(navId)?.classList.add('active');
    }

    if (screenId === 'create-trip-map' && window.YandexMapsModule) {
        window.YandexMapsModule.initMap();
    }
}

// 2. АВТОРИЗАЦИЯ
async function authenticateUser() {
    if (authInProgress) return;
    authInProgress = true;
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                init_data: tg.initData,
                user_info: tg.initDataUnsafe?.user
            })
        });
        const result = await response.json();
        if (result.success) {
            currentUser = result.user;
            updateHeader();
            loadStats();
        }
    } catch (e) { console.error("Ошибка входа:", e); }
    finally { authInProgress = false; }
}

function updateHeader() {
    if (!currentUser) return;
    document.getElementById('user-name').textContent = currentUser.first_name;
    const title = document.getElementById('welcome-title');
    if (title) title.textContent = `👋 Привет, ${currentUser.first_name}!`;
}

// 3. ПОИСК ПОЕЗДОК (FIND TRIP)
async function searchTrips() {
    const from = document.getElementById('find-from').value;
    const to = document.getElementById('find-to').value;
    const date = document.getElementById('find-date').value;

    if (!from || !to) {
        tg.showAlert("Введите пункты отправления и назначения");
        return;
    }

    const resultsContainer = document.getElementById('trips-results');
    resultsContainer.innerHTML = '<div class="loader">Ищем поездки...</div>';

    try {
        const url = `${API_BASE_URL}/api/trips/search?from_city=${encodeURIComponent(from)}&to_city=${encodeURIComponent(to)}&date=${date}`;
        const response = await fetch(url);
        const data = await response.json();

        resultsContainer.innerHTML = '';
        if (data.trips && data.trips.length > 0) {
            data.trips.forEach(trip => {
                resultsContainer.appendChild(renderTripCard(trip));
            });
        } else {
            resultsContainer.innerHTML = '<div class="no-results">Поездок не найдено</div>';
        }
    } catch (e) {
        resultsContainer.innerHTML = '<div class="error">Ошибка загрузки</div>';
    }
}

function renderTripCard(trip) {
    const div = document.createElement('div');
    div.className = 'trip-card';
    div.innerHTML = `
        <div class="trip-main">
            <div class="trip-route">
                <strong>${trip.from_city}</strong> → <strong>${trip.to_city}</strong>
            </div>
            <div class="trip-price">${trip.price} ₽</div>
        </div>
        <div class="trip-details">
            <span><i class="far fa-calendar"></i> ${trip.departure_date}</span>
            <span><i class="far fa-clock"></i> ${trip.departure_time}</span>
            <span><i class="fas fa-users"></i> мест: ${trip.seats_available}</span>
        </div>
        <button class="book-btn" onclick="bookTrip(${trip.id})">Забронировать</button>
    `;
    return div;
}

// 4. СОЗДАНИЕ ПОЕЗДКИ (С КАРТОЙ) - ИСПРАВЛЕННАЯ ВЕРСИЯ
async function createTripWithMap() {
    if (!window.YandexMapsModule?.isMapInitialized()) {
        tg.showAlert("Карта еще загружается...");
        return;
    }

    const route = window.YandexMapsModule.getRouteData();
    if (!route.start_point || !route.finish_point) {
        tg.showAlert("Выберите маршрут на карте");
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
        if (res.ok && result.success) {
            tg.showAlert("✅ Поездка создана!");
            showScreen('welcome');
            loadStats();
        } else {
            tg.showAlert("Ошибка сервера: " + (result.detail || "Проверьте данные"));
        }
    } catch (e) { tg.showAlert("Сбой сети"); }
}

// 5. ПРОФИЛЬ И МАШИНЫ
async function loadUserProfile() {
    if (!currentUser) return;
    const container = document.getElementById('profile-data');
    container.innerHTML = `
        <div class="user-card">
            <h3>${currentUser.first_name} ${currentUser.last_name || ''}</h3>
            <p>ID: ${currentUser.telegram_id}</p>
        </div>
        <div class="car-section">
            <h4>🚗 Мой транспорт</h4>
            <div id="cars-list">Загрузка...</div>
            <button class="add-car-btn" onclick="showAddCarModal()">+ Добавить авто</button>
        </div>
    `;
    loadUserCars();
}

async function loadUserCars() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/users/${currentUser.id}/cars`);
        const data = await res.json();
        const list = document.getElementById('cars-list');
        list.innerHTML = '';
        if (data.cars?.length > 0) {
            data.cars.forEach(car => {
                const carDiv = document.createElement('div');
                carDiv.className = 'car-item';
                carDiv.innerHTML = `<strong>${car.model}</strong> — ${car.plate} (${car.color})`;
                list.appendChild(carDiv);
            });
        } else {
            list.innerHTML = '<p>Автомобили не добавлены</p>';
        }
    } catch (e) { console.error(e); }
}

// 6. СТАТИСТИКА
async function loadStats() {
    if (!currentUser) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/users/${currentUser.id}/stats`);
        const data = await res.json();
        if (data.success) {
            document.getElementById('trips-count').textContent = data.trips_count || 0;
            document.getElementById('bookings-count').textContent = data.bookings_count || 0;
        }
    } catch (e) { console.error(e); }
}

// ГЛОБАЛЬНЫЙ ДОСТУП ДЛЯ HTML
window.showScreen = showScreen;
window.searchTrips = searchTrips;
window.createTripWithMap = createTripWithMap;