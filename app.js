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
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => showScreen(btn.id.replace('nav-', ''));
    });
});

// 2. АВТОРИЗАЦИЯ (Исправлен путь на /api/users/auth)
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
    } catch (e) { console.error("Ошибка входа:", e); }
    finally { authInProgress = false; }
}

// 3. ПОИСК И БРОНИРОВАНИЕ (ВАША ЛОГИКА)
async function searchTrips() {
    const from = document.getElementById('find-from').value;
    const to = document.getElementById('find-to').value;
    const date = document.getElementById('find-date').value;

    const resultsContainer = document.getElementById('trips-results');
    resultsContainer.innerHTML = '<div class="loader">Ищем лучшие варианты...</div>';

    try {
        const url = `${API_BASE_URL}/api/trips/search?from_city=${encodeURIComponent(from)}&to_city=${encodeURIComponent(to)}&date=${date}`;
        const res = await fetch(url);
        const data = await res.json();

        resultsContainer.innerHTML = data.trips?.length 
            ? data.trips.map(trip => renderTripCard(trip)).join('')
            : '<div class="no-results">Поездок не найдено</div>';
    } catch (e) { resultsContainer.innerHTML = 'Ошибка загрузки'; }
}

function renderTripCard(trip) {
    return `
        <div class="trip-card" onclick="showTripDetails(${trip.id})">
            <div class="trip-main">
                <div class="route"><strong>${trip.from_city}</strong> → <strong>${trip.to_city}</strong></div>
                <div class="price">${trip.price} ₽</div>
            </div>
            <div class="trip-meta">
                <span>📅 ${trip.departure_date} в ${trip.departure_time}</span>
                <span>👤 ${trip.driver_name}</span>
            </div>
        </div>`;
}

// ВОССТАНОВЛЕННАЯ ФУНКЦИЯ БРОНИРОВАНИЯ
async function bookTrip(tripId) {
    tg.showConfirm("Забронировать место в этой поездке?", async (confirmed) => {
        if (!confirmed) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/bookings/create?user_id=${currentUser.id}&trip_id=${tripId}`, {
                method: 'POST'
            });
            const result = await response.json();
            if (result.success) {
                tg.showAlert("✅ Место забронировано! Водитель получит уведомление.");
                showScreen('welcome');
                loadStats();
            } else {
                tg.showAlert("Ошибка: " + result.detail);
            }
        } catch (e) {
            tg.showAlert("Не удалось связаться с сервером");
        }
    });
}

// 4. СОЗДАНИЕ ПОЕЗДКИ (Исправлено для Карт и Pydantic)
async function createTripWithMap() {
    const route = window.YandexMapsModule?.getRouteData();
    if (!route?.start_point || !route?.finish_point) {
        tg.showAlert("Сначала отметьте маршрут на карте");
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
        } else {
            const err = await res.json();
            tg.showAlert("Ошибка: " + JSON.stringify(err.detail));
        }
    } catch (e) { tg.showAlert("Сбой сети"); }
}

// 5. МОДАЛЬНЫЕ ОКНА И ДЕТАЛИ (ВОССТАНОВЛЕНО)
function showTripDetails(tripId) {
    // Ваша логика открытия деталей поездки
    openModal("Загрузка деталей...");
    fetch(`${API_BASE_URL}/api/trips/${tripId}`)
        .then(r => r.json())
        .then(trip => {
            const content = `
                <h3>Поездка ${trip.from_city} — ${trip.to_city}</h3>
                <p>Водитель: ${trip.driver_name}</p>
                <p>Цена: ${trip.price} ₽</p>
                <button class="submit-btn" onclick="bookTrip(${trip.id})">Забронировать</button>
            `;
            document.getElementById('modal-body').innerHTML = content;
        });
}

function openModal(html) {
    const modal = document.getElementById('modal');
    document.getElementById('modal-body').innerHTML = html;
    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

// 6. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
function showScreen(screenId) {
    // Если screenId пришел от кнопки навигации (например 'nav-create'), чистим его
    const id = screenId.replace('nav-', '');
    // Обработка случая, если экран создания теперь называется 'create-trip-map'
    const targetId = (id === 'create') ? 'create-trip-map' : id;

    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    const target = document.getElementById(targetId);
    if (target) {
        target.style.display = 'block';
        document.getElementById('nav-' + id)?.classList.add('active');
    }
}

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

// Экспорт в window
window.showScreen = showScreen;
window.searchTrips = searchTrips;
window.createTripWithMap = createTripWithMap;
window.bookTrip = bookTrip;
window.closeModal = closeModal;