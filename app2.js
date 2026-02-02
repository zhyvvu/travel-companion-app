const tg = window.Telegram.WebApp;
const API_BASE_URL = "https://travel-api-n6r2.onrender.com";

let currentUser = null;
let authInProgress = false;

// 1. ИНИЦИАЛИЗАЦИЯ
document.addEventListener('DOMContentLoaded', () => {
    tg.ready();
    tg.expand();
    authenticateUser();
    
    // Привязка навигации
    const screens = {
        'nav-welcome': 'welcome',
        'nav-find': 'find-trip',
        'nav-create': 'create-trip-map',
        'nav-profile': 'profile'
    };

    Object.entries(screens).forEach(([btnId, screenId]) => {
        const btn = document.getElementById(btnId);
        if (btn) btn.onclick = () => showScreen(screenId);
    });
});

// 2. АВТОРИЗАЦИЯ (ИСПРАВЛЕНО: /api/auth/telegram)
async function authenticateUser() {
    if (authInProgress) return;
    authInProgress = true;
    
    // ВАЖНО: Используем путь /api/auth/telegram, как в вашем main.py
    const url = `${API_BASE_URL}/api/auth/telegram?v=${Date.now()}`;
    
    try {
        console.log("📡 Отправка запроса на:", url);
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                init_data: tg.initData,
                user_info: tg.initDataUnsafe?.user
            })
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                currentUser = result.user;
                console.log("✅ Успешный вход!");
                updateUI();
                loadStats();
            }
        } else {
            console.error(`❌ Ошибка ${response.status}. Проверьте эндпоинт в main.py`);
            const text = await response.text();
            console.log("Ответ сервера:", text);
        }
    } catch (e) {
        console.error("❌ Сетевой сбой:", e);
    } finally {
        authInProgress = false;
    }
}

// 3. ПОИСК ПОЕЗДОК (Префикс /api/trips)
async function searchTrips() {
    const from = document.getElementById('find-from')?.value;
    const to = document.getElementById('find-to')?.value;
    const date = document.getElementById('find-date')?.value;
    const container = document.getElementById('trips-results');

    container.innerHTML = 'Ищем...';

    try {
        const url = `${API_BASE_URL}/api/trips/search?from_city=${encodeURIComponent(from)}&to_city=${encodeURIComponent(to)}&date=${date}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.trips?.length > 0) {
            container.innerHTML = data.trips.map(trip => `
                <div class="trip-card" onclick="showTripDetails(${trip.id})">
                    <strong>${trip.from_city} → ${trip.to_city}</strong><br>
                    <span>${trip.price || trip.price_per_seat} ₽</span>
                </div>
            `).join('');
        } else {
            container.innerHTML = 'Поездок не найдено';
        }
    } catch (e) { container.innerHTML = 'Ошибка загрузки'; }
}

// 4. БРОНИРОВАНИЕ (Префикс /api/bookings)
async function bookTrip(tripId) {
    if (!currentUser) return;
    tg.showConfirm("Забронировать?", async (ok) => {
        if (!ok) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/bookings/create?user_id=${currentUser.id}&trip_id=${tripId}`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
                tg.showAlert("✅ Забронировано!");
                showScreen('welcome');
                loadStats();
                closeModal();
            }
        } catch (e) { tg.showAlert("Ошибка сети"); }
    });
}

// 5. СОЗДАНИЕ ПОЕЗДКИ
async function createTripWithMap() {
    const route = window.YandexMapsModule?.getRouteData();
    if (!route?.start_point) { tg.showAlert("Выберите маршрут"); return; }

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
    } catch (e) { tg.showAlert("Ошибка сервера"); }
}

// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    const target = document.getElementById(screenId);
    if (target) target.style.display = 'block';
    
    if (screenId === 'create-trip-map') window.YandexMapsModule?.initMap();
    if (screenId === 'profile') loadUserProfile();
}

function showTripDetails(tripId) {
    openModal("Загрузка...");
    fetch(`${API_BASE_URL}/api/trips/${tripId}`)
        .then(r => r.json())
        .then(trip => {
            document.getElementById('modal-body').innerHTML = `
                <h3>Поездка #${trip.id}</h3>
                <p>${trip.from_city} → ${trip.to_city}</p>
                <button onclick="bookTrip(${trip.id})">Забронировать</button>
            `;
        });
}

function openModal(html) {
    const m = document.getElementById('modal');
    document.getElementById('modal-body').innerHTML = html;
    if (m) m.style.display = 'flex';
}

function closeModal() {
    const m = document.getElementById('modal');
    if (m) m.style.display = 'none';
}

async function loadUserProfile() {
    const container = document.getElementById('profile-data');
    if (!container || !currentUser) return;
    container.innerHTML = `<h3>${currentUser.first_name}</h3><p>Авто: ${currentUser.car_model || 'Нет'}</p>`;
}

async function loadStats() {
    if (!currentUser) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/users/${currentUser.id}/stats`);
        const data = await res.json();
        if (document.getElementById('trips-count')) document.getElementById('trips-count').textContent = data.trips_count || 0;
        if (document.getElementById('bookings-count')) document.getElementById('bookings-count').textContent = data.bookings_count || 0;
    } catch (e) {}
}

function updateUI() {
    if (currentUser) {
        document.getElementById('user-name').textContent = currentUser.first_name;
    }
}

// Глобальный доступ
window.showScreen = showScreen;
window.createTripWithMap = createTripWithMap;
window.searchTrips = searchTrips;
window.bookTrip = bookTrip;
window.closeModal = closeModal;