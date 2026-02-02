/**
 * ПОЛНЫЙ И ИСПРАВЛЕННЫЙ APP.JS (ВСЕ 9 ЧАСТЕЙ)
 */

// =============== 1. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===============
const tg = window.Telegram.WebApp;
const API_BASE_URL = "https://travel-api-n6r2.onrender.com"; // СЮДА НУЖНО ВСТАВИТЬ ВАШ РЕАЛЬНЫЙ URL
let currentUser = null;
let currentTrips = [];
window.currentScreen = 'welcome';

// =============== ИНИЦИАЛИЗАЦИЯ ===============
function initApp() {
    tg.expand();
    tg.ready();

    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
        currentUser = {
            id: tg.initDataUnsafe.user.id,
            telegram_id: tg.initDataUnsafe.user.id,
            first_name: tg.initDataUnsafe.user.first_name,
            last_name: tg.initDataUnsafe.user.last_name,
            username: tg.initDataUnsafe.user.username,
            name: `${tg.initDataUnsafe.user.first_name} ${tg.initDataUnsafe.user.last_name || ''}`.trim()
        };
        updateUserUI();
    }
    
    setupEventListeners();
    loadStats();
    showScreen('welcome');
}

// =============== НАВИГАЦИЯ (ИСПРАВЛЕННАЯ ПОД КАРТЫ) ===============
function showScreen(screenId) {
    window.currentScreen = screenId;
    
    // Скрываем все экраны
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });
    
    const activeScreen = document.getElementById(screenId);
    if (activeScreen) {
        activeScreen.style.display = 'block';
        // Даем браузеру время отрисовать блок перед активацией
        setTimeout(() => activeScreen.classList.add('active'), 10);
    }

    // Инициализация карты только когда экран показан
    if (screenId === 'create-trip-map') {
        initMapScreen();
    }

    if (screenId === 'profile') loadFullProfile();
    
    setupCityAutocomplete();

    if (screenId === 'welcome') tg.BackButton.hide();
    else tg.BackButton.show();
}

async function initMapScreen() {
    const mapContainer = document.getElementById('yandex-map');
    if (mapContainer && typeof TripRouteMap !== 'undefined') {
        try {
            // Ждем, пока блок станет видимым, чтобы не было ошибки offsetWidth
            await TripRouteMap.init();
            console.log("✅ Карта успешно инициализирована");
        } catch (e) {
            console.error("❌ Ошибка инициализации карты:", e);
        }
    }
}

// =============== ПРОФИЛЬ (ВОССТАНОВЛЕНО ПО ЧАСТИ 4 и 7) ===============
async function loadFullProfile() {
    if (!currentUser) return;
    const container = document.getElementById('profile-data');
    container.innerHTML = '<div class="loader"></div>';

    try {
        const response = await fetch(`${API_BASE_URL}/api/users/${currentUser.telegram_id}/full`);
        const data = await response.json();
        
        if (data.success) {
            renderFullProfile(data);
        }
    } catch (e) {
        container.innerHTML = '<p>Ошибка загрузки профиля</p>';
    }
}

function renderFullProfile(data) {
    const container = document.getElementById('profile-data');
    container.innerHTML = `
        <div class="profile-header">
            <h3>${data.user.name}</h3>
            <p>Рейтинг: ⭐ ${data.user.rating || '5.0'}</p>
        </div>
        <div class="profile-section">
            <h4>🚗 Мои автомобили</h4>
            <div id="cars-list">${renderCars(data.cars)}</div>
            <button class="add-btn" onclick="showAddCarModal()">Добавить авто</button>
        </div>
        <div class="profile-section">
            <h4>📅 Активные поездки</h4>
            <div id="user-trips">${renderUserTrips(data.trips)}</div>
        </div>
    `;
}

// Функция из части 7 для отрисовки машин
function renderCars(cars) {
    if (!cars || cars.length === 0) return '<p>Автомобили не добавлены</p>';
    return cars.map(car => `
        <div class="car-item">
            <span>${car.brand} ${car.model} (${car.plate_number})</span>
            <button onclick="deleteCar(${car.id})"><i class="fas fa-trash"></i></button>
        </div>
    `).join('');
}

// =============== ПОИСК (ВОССТАНОВЛЕНО ПО ЧАСТИ 6) ===============
async function searchTrips() {
    const from = document.getElementById('find-from').value;
    const to = document.getElementById('find-to').value;
    const date = document.getElementById('find-date').value;
    const pass = document.getElementById('find-passengers').value;

    if (!from || !to || !date) {
        showNotification('Заполните все поля поиска', 'warning');
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/trips/search`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ from_city: from, to_city: to, date: date, passengers: pass })
        });
        const result = await res.json();
        
        const container = document.getElementById('search-results');
        if (result.success && result.trips.length > 0) {
            currentTrips = result.trips;
            container.innerHTML = result.trips.map(trip => `
                <div class="trip-card">
                    <div class="trip-info">
                        <strong>${trip.from_city} → ${trip.to_city}</strong>
                        <span>Водитель: ${trip.driver.name}</span>
                        <span>Мест: ${trip.seats_available}</span>
                    </div>
                    <div class="trip-action">
                        <span class="price">${trip.price} ₽</span>
                        <button onclick="bookTrip(${trip.id})">Забронировать</button>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<div class="empty-state">Поездок не найдено</div>';
        }
    } catch (e) {
        showNotification('Ошибка поиска', 'error');
    }
}

// =============== СОЗДАНИЕ ПОЕЗДКИ (ВОССТАНОВЛЕНО ПО ЧАСТИ 9) ===============
async function createTripWithMap() {
    const routeData = TripRouteMap.getRouteData();
    if (!routeData.start_point || !routeData.finish_point) {
        showNotification('Укажите маршрут на карте', 'warning');
        return;
    }

    const payload = {
        driver_id: currentUser.telegram_id,
        from_city: routeData.start_address,
        to_city: routeData.finish_address,
        departure_time: `${document.getElementById('trip-date-map').value}T${document.getElementById('trip-time-map').value}`,
        price: document.getElementById('trip-price-map').value,
        seats_available: document.getElementById('seats-count-map').value,
        comment: document.getElementById('trip-comment-map').value,
        route_geometry: routeData.geometry // Это важно для бэкенда из части 9
    };

    try {
        const res = await fetch(`${API_BASE_URL}/api/trips`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            showNotification('Поездка создана!', 'success');
            showScreen('welcome');
        }
    } catch (e) {
        showNotification('Ошибка создания', 'error');
    }
}

// =============== АВТОДОПОЛНЕНИЕ (ИСПРАВЛЕННЫЕ ID) ===============
function setupCityAutocomplete() {
    const mapping = {
        'find-trip': ['find-from', 'find-to'],
        'create-trip-map': ['map-search-input']
    };
    const ids = mapping[window.currentScreen] || [];
    ids.forEach(id => {
        const input = document.getElementById(id);
        if (input && !input._bound) {
            input.addEventListener('input', (e) => showSuggestions(id, e.target.value));
            input._bound = true;
        }
    });
}

function showSuggestions(fieldId, val) {
    if (val.length < 2) return hideSuggestions(fieldId);
    // Используем RUSSIAN_CITIES из части 5
    const matches = (window.RUSSIAN_CITIES || []).filter(c => c.toLowerCase().includes(val.toLowerCase())).slice(0, 5);
    
    let container = document.getElementById(`${fieldId}-suggestions`);
    if (!container) {
        container = document.createElement('div');
        container.id = `${fieldId}-suggestions`;
        container.className = 'suggestions-container';
        document.getElementById(fieldId).parentNode.appendChild(container);
    }
    
    container.innerHTML = matches.map(m => `<div onclick="applySuggestion('${fieldId}','${m}')">${m}</div>`).join('');
    container.style.display = 'block';
}

window.applySuggestion = function(id, val) {
    document.getElementById(id).value = val;
    hideSuggestions(id);
    if (id === 'map-search-input') TripRouteMap.searchAndSetPoint(val, TripRouteMap.currentMode || 'start');
};

function hideSuggestions(id) {
    const el = document.getElementById(`${id}-suggestions`);
    if (el) el.style.display = 'none';
}

// =============== ВСПОМОГАТЕЛЬНОЕ ===============
function loadStats() {
    fetch(`${API_BASE_URL}/stats`)
        .then(r => r.json())
        .then(data => {
            document.getElementById('users-count').textContent = data.users || 0;
            document.getElementById('trips-count').textContent = data.active_trips || 0;
        }).catch(() => {});
}

function updateUserUI() {
    const el = document.getElementById('user-name');
    if (el) el.textContent = currentUser.name;
}

function showNotification(msg, type) {
    const n = document.createElement('div');
    n.className = `notification ${type} show`;
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
}

function setupEventListeners() {
    tg.BackButton.onClick(() => {
        if (window.currentScreen !== 'welcome') showScreen('welcome');
    });
}

document.addEventListener('DOMContentLoaded', initApp);