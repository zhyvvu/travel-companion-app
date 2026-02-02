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
}

// 2. АВТОРИЗАЦИЯ (Исправлено под ваш main.py)
async function authenticateUser() {
    if (authInProgress) return;
    authInProgress = true;
    
    const authData = {
        init_data: tg.initData,
        user_info: tg.initDataUnsafe?.user
    };

    // Пробуем два варианта, так как в Render/FastAPI пути могут капризничать
    const paths = ["/api/auth", "/auth"];
    
    for (let path of paths) {
        try {
            console.log(`📡 Пробую авторизацию: ${path}`);
            const response = await fetch(`${API_BASE_URL}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(authData)
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    currentUser = result.user;
                    console.log("✅ Успешный вход:", currentUser.first_name);
                    updateUI();
                    loadStats();
                    authInProgress = false;
                    return; 
                }
            }
        } catch (e) {
            console.error(`Ошибка на пути ${path}:`, e);
        }
    }
    
    console.error("🚫 Не удалось авторизоваться ни по одному пути");
    authInProgress = false;
}

// 3. ПОИСК И БРОНИРОВАНИЕ
async function searchTrips() {
    const from = document.getElementById('find-from')?.value;
    const to = document.getElementById('find-to')?.value;
    const date = document.getElementById('find-date')?.value;
    const container = document.getElementById('trips-results');

    container.innerHTML = '<div class="loader">Поиск поездок...</div>';

    try {
        // В вашем main.py префикс /api/trips
        const url = `${API_BASE_URL}/api/trips/search?from_city=${encodeURIComponent(from)}&to_city=${encodeURIComponent(to)}&date=${date}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.trips?.length > 0) {
            container.innerHTML = data.trips.map(trip => `
                <div class="trip-card" onclick="showTripDetails(${trip.id})">
                    <div class="trip-main">
                        <strong>${trip.from_city} → ${trip.to_city}</strong>
                        <span class="price">${trip.price_per_seat || trip.price} ₽</span>
                    </div>
                    <div class="trip-meta">📅 ${trip.departure_date} в ${trip.departure_time}</div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<div class="no-results">Поездок не найдено</div>';
        }
    } catch (e) {
        container.innerHTML = 'Ошибка загрузки данных';
    }
}

// ФУНКЦИЯ БРОНИРОВАНИЯ (Восстановлена полностью)
async function bookTrip(tripId) {
    if (!currentUser) return;
    tg.showConfirm("Забронировать место?", async (confirmed) => {
        if (!confirmed) return;
        try {
            // Эндпоинт из вашего main.py
            const res = await fetch(`${API_BASE_URL}/api/bookings/create?user_id=${currentUser.id}&trip_id=${tripId}`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
                tg.showAlert("✅ Место забронировано!");
                showScreen('welcome');
                loadStats();
                closeModal();
            } else {
                tg.showAlert("Ошибка: " + (data.detail || "Нет мест"));
            }
        } catch (e) { tg.showAlert("Ошибка сети"); }
    });
}

// 4. СОЗДАНИЕ ПОЕЗДКИ
async function createTripWithMap() {
    const route = window.YandexMapsModule?.getRouteData();
    if (!route?.start_point) {
        tg.showAlert("Сначала проложите маршрут на карте");
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
    } catch (e) { tg.showAlert("Ошибка сервера"); }
}

// 5. МОДАЛЬНЫЕ ОКНА И ПРОФИЛЬ
function showTripDetails(tripId) {
    openModal("Загрузка...");
    fetch(`${API_BASE_URL}/api/trips/${tripId}`)
        .then(r => r.json())
        .then(trip => {
            document.getElementById('modal-body').innerHTML = `
                <div class="trip-details">
                    <h3>${trip.from_city} — ${trip.to_city}</h3>
                    <p>Водитель: ${trip.driver_name || 'Попутчик'}</p>
                    <p>Мест: ${trip.available_seats || trip.seats_available}</p>
                    <button class="submit-btn" onclick="bookTrip(${trip.id})">Забронировать</button>
                </div>
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

async function loadUserProfile() {
    const container = document.getElementById('profile-data');
    if (!container || !currentUser) return;
    
    // Используем поля из вашей модели User в database.py
    container.innerHTML = `
        <div class="profile-info">
            <h3>${currentUser.first_name} ${currentUser.last_name || ''}</h3>
            <p>Рейтинг водителя: ⭐ ${currentUser.driver_rating || '5.0'}</p>
            <div class="car-card">
                <h4>🚗 Мой автомобиль</h4>
                ${currentUser.has_car ? `
                    <p>${currentUser.car_model || 'Не указано'}</p>
                    <p>Номер: ${currentUser.car_plate || '---'}</p>
                ` : '<p>Авто не добавлено</p>'}
            </div>
        </div>
    `;
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

function updateUI() {
    if (currentUser) {
        document.getElementById('user-name').textContent = currentUser.first_name;
        const welcome = document.getElementById('welcome-title');
        if (welcome) welcome.textContent = `👋 Привет, ${currentUser.first_name}!`;
    }
}

// Экспорт
window.showScreen = showScreen;
window.createTripWithMap = createTripWithMap;
window.searchTrips = searchTrips;
window.bookTrip = bookTrip;
window.closeModal = closeModal;