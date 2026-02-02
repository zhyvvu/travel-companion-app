const tg = window.Telegram.WebApp;
const API_BASE_URL = "https://travel-api-n6r2.onrender.com";

let currentUser = null;
let authInProgress = false;

// 1. ИНИЦИАЛИЗАЦИЯ
document.addEventListener('DOMContentLoaded', () => {
    tg.ready();
    tg.expand();
    authenticateUser();
    
    // Настройка навигации
    const navButtons = {
        'nav-welcome': 'welcome',
        'nav-find': 'find-trip',
        'nav-create': 'create-trip-map',
        'nav-profile': 'profile'
    };

    Object.entries(navButtons).forEach(([btnId, screenId]) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.onclick = () => showScreen(screenId);
        }
    });
});

// 2. АВТОРИЗАЦИЯ (ИСПРАВЛЕННЫЙ ПУТЬ /api/auth)
async function authenticateUser() {
    if (authInProgress) return;
    authInProgress = true;
    try {
        console.log("🔐 Авторизация по пути /api/auth...");
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
            console.log("✅ Пользователь загружен:", currentUser.first_name);
            updateUI();
            loadStats();
        } else {
            console.error("❌ Ошибка бэкенда:", result.message);
        }
    } catch (e) {
        console.error("❌ Ошибка сети при авторизации:", e);
    } finally {
        authInProgress = false;
    }
}

// 3. ПОИСК И БРОНИРОВАНИЕ (ВАША ЛОГИКА)
async function searchTrips() {
    const from = document.getElementById('find-from')?.value;
    const to = document.getElementById('find-to')?.value;
    const date = document.getElementById('find-date')?.value;

    const resultsContainer = document.getElementById('trips-results');
    if (!resultsContainer) return;
    
    resultsContainer.innerHTML = '<div class="loader">Ищем поездки...</div>';

    try {
        const url = `${API_BASE_URL}/api/trips/search?from_city=${encodeURIComponent(from)}&to_city=${encodeURIComponent(to)}&date=${date}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.trips && data.trips.length > 0) {
            resultsContainer.innerHTML = data.trips.map(trip => `
                <div class="trip-card" onclick="showTripDetails(${trip.id})">
                    <div class="trip-main">
                        <strong>${trip.from_city} → ${trip.to_city}</strong>
                        <span class="price-tag">${trip.price} ₽</span>
                    </div>
                    <div class="trip-footer">
                        <span>📅 ${trip.departure_date}</span>
                        <span>👤 ${trip.driver_name || 'Водитель'}</span>
                    </div>
                </div>
            `).join('');
        } else {
            resultsContainer.innerHTML = '<div class="no-results">Поездок не найдено</div>';
        }
    } catch (e) {
        resultsContainer.innerHTML = 'Ошибка загрузки данных';
    }
}

async function bookTrip(tripId) {
    tg.showConfirm("Вы хотите забронировать место в этой поездке?", async (ok) => {
        if (!ok) return;
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
                tg.showAlert("Ошибка: " + (data.detail || "Мест нет"));
            }
        } catch (e) { tg.showAlert("Ошибка сети"); }
    });
}

// 4. СОЗДАНИЕ ПОЕЗДКИ (С КАРТОЙ И ТИПАМИ ДАННЫХ)
async function createTripWithMap() {
    if (!window.YandexMapsModule?.isMapInitialized()) {
        tg.showAlert("Карта еще не загружена");
        return;
    }

    const route = window.YandexMapsModule.getRouteData();
    if (!route.start_point || !route.finish_point) {
        tg.showAlert("Пожалуйста, отметьте маршрут на карте");
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
            tg.showAlert("✅ Поездка успешно создана!");
            showScreen('welcome');
            loadStats();
        } else {
            tg.showAlert("Ошибка: " + JSON.stringify(result.detail));
        }
    } catch (e) { tg.showAlert("Ошибка связи с сервером"); }
}

// 5. МОДАЛЬНЫЕ ОКНА И ДЕТАЛИ
function showTripDetails(tripId) {
    openModal("Загрузка деталей...");
    fetch(`${API_BASE_URL}/api/trips/${tripId}`)
        .then(r => r.json())
        .then(trip => {
            document.getElementById('modal-body').innerHTML = `
                <div class="trip-details">
                    <h3>${trip.from_city} — ${trip.to_city}</h3>
                    <p><strong>Дата:</strong> ${trip.departure_date} ${trip.departure_time}</p>
                    <p><strong>Цена:</strong> ${trip.price} ₽</p>
                    <p><strong>Водитель:</strong> ${trip.driver_name || 'Неизвестно'}</p>
                    <button class="submit-btn" onclick="bookTrip(${trip.id})">Забронировать</button>
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

// 6. ВСПОМОГАТЕЛЬНЫЕ
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    const target = document.getElementById(screenId);
    if (target) {
        target.style.display = 'block';
        // Логика подсветки кнопок (универсальная)
        let cleanId = screenId.replace('-trip', '').replace('-map', '');
        document.getElementById(`nav-${cleanId}`)?.classList.add('active');
    }
    
    if (screenId === 'create-trip-map') window.YandexMapsModule?.initMap();
    if (screenId === 'profile') loadUserProfile();
}

async function loadStats() {
    if (!currentUser) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/users/${currentUser.id}/stats`);
        const data = await res.json();
        const t = document.getElementById('trips-count');
        const b = document.getElementById('bookings-count');
        if (t) t.textContent = data.trips_count || 0;
        if (b) b.textContent = data.bookings_count || 0;
    } catch (e) {}
}

async function loadUserProfile() {
    const container = document.getElementById('profile-data');
    if (!container || !currentUser) return;
    
    container.innerHTML = `<h3>${currentUser.first_name}</h3><div id="cars-list">Загрузка транспорта...</div>`;
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/users/${currentUser.id}/cars`);
        const data = await res.json();
        document.getElementById('cars-list').innerHTML = data.cars.length 
            ? data.cars.map(c => `<div class="car-item">🚗 ${c.model} (${c.plate})</div>`).join('')
            : 'Автомобили не добавлены';
    } catch (e) { console.error(e); }
}

function updateUI() {
    if (currentUser) {
        const nameEl = document.getElementById('user-name');
        if (nameEl) nameEl.textContent = currentUser.first_name;
        const welcome = document.getElementById('welcome-title');
        if (welcome) welcome.textContent = `👋 Привет, ${currentUser.first_name}!`;
    }
}

// Экспорт функций в глобальную область
window.showScreen = showScreen;
window.createTripWithMap = createTripWithMap;
window.searchTrips = searchTrips;
window.bookTrip = bookTrip;
window.closeModal = closeModal;