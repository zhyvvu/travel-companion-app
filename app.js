// app.js - ПОЛНАЯ ВЕРСИЯ: ВСЕ ФУНКЦИИ В 10 РАЗ КОМПАКТНЕЕ
const tg = window.Telegram.WebApp;
const API_BASE_URL = "https://travel-api-n6r2.onrender.com";

let currentUser = null;
let authInProgress = false;

// 1. ИНИЦИАЛИЗАЦИЯ
document.addEventListener('DOMContentLoaded', () => {
    tg.ready();
    tg.expand();
    authenticateUser();
    
    // Привязываем поиск Яндекса к полям на экране поиска
    if (window.YandexMapsModule) {
        window.YandexMapsModule.initMap().then(() => {
            // Теперь и в поиске работает автодополнение Яндекса
            console.log("✅ Яндекс.Карты подключены к поиску и созданию");
        });
    }
});

// 2. АВТОРИЗАЦИЯ (Исправлено: /api/users/auth)
async function authenticateUser() {
    if (authInProgress) return;
    authInProgress = true;
    try {
        const response = await fetch(`${API_BASE_URL}/api/users/auth`, {
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
            updateUI();
            loadStats();
        }
    } catch (e) {
        console.error("Ошибка входа:", e);
    } finally {
        authInProgress = false;
    }
}

// 3. НАВИГАЦИЯ
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    const target = document.getElementById(screenId);
    if (target) {
        target.style.display = 'block';
        const navId = screenId.includes('create') ? 'nav-create' : `nav-${screenId}`;
        document.getElementById(navId)?.classList.add('active');
    }
}

// 4. ПОИСК ПОЕЗДОК (Используем новые поля)
async function searchTrips() {
    const from = document.getElementById('find-from').value;
    const to = document.getElementById('find-to').value;
    const date = document.getElementById('find-date').value;

    const resultsContainer = document.getElementById('trips-results');
    resultsContainer.innerHTML = '<div class="loader">Поиск...</div>';

    try {
        const url = `${API_BASE_URL}/api/trips/search?from_city=${encodeURIComponent(from)}&to_city=${encodeURIComponent(to)}&date=${date}`;
        const res = await fetch(url);
        const data = await res.json();

        resultsContainer.innerHTML = data.trips?.length 
            ? data.trips.map(trip => renderTripCard(trip)).join('')
            : '<div class="no-results">Поездок не найдено</div>';
    } catch (e) {
        resultsContainer.innerHTML = 'Ошибка загрузки';
    }
}

function renderTripCard(trip) {
    return `
        <div class="trip-card">
            <div class="trip-main">
                <span>${trip.from_city} → ${trip.to_city}</span>
                <strong>${trip.price} ₽</strong>
            </div>
            <div class="trip-details">
                <span>📅 ${trip.departure_date}</span>
                <span>👥 ${trip.seats_available} мест</span>
            </div>
            <button class="book-btn" onclick="bookTrip(${trip.id})">Забронировать</button>
        </div>`;
}

// 5. СОЗДАНИЕ ПОЕЗДКИ (С КАРТОЙ)
async function createTripWithMap() {
    const route = window.YandexMapsModule?.getRouteData();
    if (!route?.start_point || !route?.finish_point) {
        tg.showAlert("Отметьте точки на карте!");
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
        if (res.ok) {
            tg.showAlert("✅ Поездка создана!");
            showScreen('welcome');
            loadStats();
        }
    } catch (e) { tg.showAlert("Ошибка сети"); }
}

// 6. ПРОФИЛЬ И МАШИНЫ
async function loadUserProfile() {
    if (!currentUser) return;
    loadUserCars();
    document.getElementById('profile-data').innerHTML = `
        <div class="user-info">
            <h3>${currentUser.first_name}</h3>
            <p>Рейтинг: ⭐ 5.0</p>
        </div>
        <div id="cars-list"></div>
        <button class="add-car-btn" onclick="tg.showAlert('Функция в разработке')">Добавить авто</button>
    `;
}

async function loadUserCars() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/users/${currentUser.id}/cars`);
        const data = await res.json();
        const list = document.getElementById('cars-list');
        if (list) list.innerHTML = data.cars.map(c => `<div class="car-item">🚗 ${c.model} (${c.plate})</div>`).join('');
    } catch (e) { console.error(e); }
}

// 7. СТАТИСТИКА
async function loadStats() {
    if (!currentUser) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/users/${currentUser.id}/stats`);
        const data = await res.json();
        document.getElementById('trips-count').textContent = data.trips_count || 0;
        document.getElementById('bookings-count').textContent = data.bookings_count || 0;
    } catch (e) { console.error(e); }
}

function updateUI() {
    if (currentUser) {
        document.getElementById('user-name').textContent = currentUser.first_name;
        const title = document.getElementById('welcome-title');
        if (title) title.textContent = `👋 Привет, ${currentUser.first_name}!`;
    }
}

// Глобальный доступ
window.showScreen = showScreen;
window.searchTrips = searchTrips;
window.createTripWithMap = createTripWithMap;
window.bookTrip = (id) => tg.showAlert("Бронирование поездки #" + id);