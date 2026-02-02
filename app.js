/**
 * ПОЛНЫЙ И ИСПРАВЛЕННЫЙ APP.JS (ВСЕ 9 ЧАСТЕЙ)
 */

// =============== 1. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===============
const tg = window.Telegram.WebApp;
const API_BASE_URL = "https://travel-api-n6r2.onrender.com"; // СЮДА НУЖНО ВСТАВИТЬ ВАШ РЕАЛЬНЫЙ URL
let currentUser = null;
let currentTrips = [];
window.currentScreen = 'welcome';
window.autocompleteInitialized = false;

// =============== 2. ИНИЦИАЛИЗАЦИЯ ===============
function initApp() {
    console.log('🚀 Старт приложения...');
    tg.expand();
    tg.ready();

    // Получение данных пользователя из Telegram
    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
        currentUser = {
            id: tg.initDataUnsafe.user.id,
            telegram_id: tg.initDataUnsafe.user.id,
            first_name: tg.initDataUnsafe.user.first_name,
            last_name: tg.initDataUnsafe.user.last_name,
            username: tg.initDataUnsafe.user.username,
            name: `${tg.initDataUnsafe.user.first_name} ${tg.initDataUnsafe.user.last_name || ''}`.trim()
        };
        console.log('👤 Пользователь:', currentUser);
        updateUserUI();
    } else {
        // Режим отладки для браузера
        console.warn('⚠️ Данные Telegram не найдены, режим отладки');
        currentUser = { id: 12345, telegram_id: 12345, name: "Debug User" };
        updateUserUI();
    }

    setupEventListeners();
    loadStats();
    showScreen('welcome');
}

// =============== 3. НАВИГАЦИЯ И ИНТЕРФЕЙС ===============
function showScreen(screenId) {
    console.log('📱 Переход на экран:', screenId);
    window.currentScreen = screenId;

    // Скрываем все экраны
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });
    
    // Показываем активный
    const activeScreen = document.getElementById(screenId);
    if (activeScreen) {
        activeScreen.classList.add('active');
        activeScreen.style.display = 'block';
    }

    // Специфическая инициализация
    if (screenId === 'profile') loadFullProfile();
    if (screenId === 'create-trip-map') {
        if (typeof TripRouteMap !== 'undefined' && TripRouteMap.init) {
            TripRouteMap.init();
        }
    }
    
    // Настройка автодополнения (Часть 9)
    setupCityAutocomplete();

    // Кнопка Back в Telegram
    if (screenId === 'welcome') {
        tg.BackButton.hide();
    } else {
        tg.BackButton.show();
    }
}

function updateUserUI() {
    const userNameEl = document.getElementById('user-name');
    if (userNameEl) userNameEl.textContent = currentUser.name;
    
    const welcomeTitle = document.getElementById('welcome-title');
    if (welcomeTitle) welcomeTitle.textContent = `👋 Привет, ${currentUser.first_name || 'друг'}!`;
}

// =============== 4. РАБОТА С БАЗОЙ ДАННЫХ (FETCH) ===============

async function loadStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/stats`);
        if (!response.ok) throw new Error('Ошибка сети');
        const stats = await response.json();
        
        const uCount = document.getElementById('users-count');
        const tCount = document.getElementById('trips-count');
        
        if (uCount) uCount.textContent = stats.users || stats.tables?.users || 0;
        if (tCount) tCount.textContent = stats.active_trips || stats.tables?.active_trips || 0;
    } catch (error) {
        console.error('❌ Ошибка статистики:', error);
        // Не блокируем работу, если статистика не загрузилась
    }
}

async function loadFullProfile() {
    if (!currentUser) return;
    const profileContainer = document.getElementById('profile-data');
    if (profileContainer) profileContainer.innerHTML = '<div class="loader">Загрузка...</div>';

    try {
        const res = await fetch(`${API_BASE_URL}/api/users/${currentUser.telegram_id}/full`);
        const data = await res.json();
        
        if (data.success) {
            renderFullProfile(data);
        } else {
            showNotification('Ошибка загрузки профиля', 'error');
        }
    } catch (e) {
        console.error('Ошибка профиля:', e);
    }
}

function renderFullProfile(data) {
    const container = document.getElementById('profile-data');
    if (!container) return;

    let html = `
        <div class="user-main-info">
            <h3>${data.user.name}</h3>
            <p>@${data.user.username || 'no_username'}</p>
        </div>
        <div class="cars-section">
            <h4>🚗 Мои автомобили</h4>
            <div id="cars-list">${renderCars(data.cars)}</div>
            <button class="btn-add-car" onclick="showAddCarModal()">+ Добавить авто</button>
        </div>
        <div class="my-trips-section">
            <h4>📅 Мои поездки (Водитель)</h4>
            <div id="driver-trips">${renderDriverTrips(data.trips)}</div>
        </div>
    `;
    container.innerHTML = html;
}

// =============== 5. АВТОДОПОЛНЕНИЕ (RUSSIAN_CITIES) ===============

function setupCityAutocomplete() {
    const fieldMap = {
        'find-trip': ['find-from', 'find-to'],
        'create-trip-map': ['map-search-input']
    };

    const fieldIds = fieldMap[window.currentScreen];
    if (!fieldIds) return;

    fieldIds.forEach(id => {
        const input = document.getElementById(id);
        if (input && !input._autocompleteBound) {
            input.addEventListener('input', (e) => showCitySuggestionsSimple(id, e.target.value));
            input._autocompleteBound = true;
        }
    });
}

function showCitySuggestionsSimple(fieldId, query) {
    if (query.length < 2 || !window.RUSSIAN_CITIES) {
        hideCitySuggestions(fieldId);
        return;
    }

    const matches = window.RUSSIAN_CITIES.filter(c => 
        c.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);

    let container = document.getElementById(`${fieldId}-suggestions`);
    if (!container) {
        container = document.createElement('div');
        container.id = `${fieldId}-suggestions`;
        container.className = 'city-suggestions';
        const input = document.getElementById(fieldId);
        input.parentNode.style.position = 'relative';
        input.parentNode.appendChild(container);
    }

    container.innerHTML = matches.map(city => `
        <div class="suggestion-item" onclick="selectCitySimple('${fieldId}', '${city.replace(/'/g, "\\'")}')">
            📍 ${city}
        </div>
    `).join('');
    container.style.display = matches.length ? 'block' : 'none';
}

window.selectCitySimple = function(fieldId, city) {
    const input = document.getElementById(fieldId);
    if (input) input.value = city;
    hideCitySuggestions(fieldId);
    
    // Если это поиск на карте, инициируем поиск в Яндекс.Картах
    if (fieldId === 'map-search-input' && typeof TripRouteMap !== 'undefined') {
        TripRouteMap.searchAndSetPoint(city, TripRouteMap.currentMode || 'start');
    }
};

function hideCitySuggestions(fieldId) {
    const container = document.getElementById(`${fieldId}-suggestions`);
    if (container) container.style.display = 'none';
}

// =============== 6. ПОИСК И БРОНИРОВАНИЕ (ЧАСТЬ 6) ===============

async function searchTrips() {
    const from = document.getElementById('find-from').value.trim();
    const to = document.getElementById('find-to').value.trim();
    const date = document.getElementById('find-date').value;

    if (!from || !to || !date) {
        showNotification('Заполните все поля поиска', 'warning');
        return;
    }

    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '<div class="loader">Ищем поездки...</div>';

    try {
        const response = await fetch(`${API_BASE_URL}/api/trips/search`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ from_city: from, to_city: to, date: date })
        });
        const result = await response.json();
        
        if (result.success && result.trips.length > 0) {
            currentTrips = result.trips;
            renderSearchResults(result.trips);
        } else {
            resultsContainer.innerHTML = '<div class="empty-state">Поездок не найдено</div>';
        }
    } catch (e) {
        showNotification('Ошибка связи с сервером', 'error');
    }
}

function renderSearchResults(trips) {
    const container = document.getElementById('search-results');
    container.innerHTML = trips.map(trip => `
        <div class="trip-card">
            <div class="trip-time">${new Date(trip.departure_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            <div class="trip-main">
                <div class="trip-route">${trip.from_city} ➔ ${trip.to_city}</div>
                <div class="trip-driver">🚗 ${trip.driver.name}</div>
            </div>
            <div class="trip-price">${trip.price} ₽</div>
            <button onclick="bookTrip(${trip.id})" class="btn-book">Выбрать</button>
        </div>
    `).join('');
}

// =============== 7. ЯНДЕКС КАРТЫ (ЧАСТЬ 9) ===============

window.setMapMode = function(mode) {
    if (typeof TripRouteMap !== 'undefined') {
        TripRouteMap.setMode(mode);
        document.getElementById('btn-set-start').classList.toggle('active', mode === 'start');
        document.getElementById('btn-set-finish').classList.toggle('active', mode === 'finish');
    }
};

window.clearMapRoute = function() {
    if (typeof TripRouteMap !== 'undefined') TripRouteMap.clear();
};

async function createTripWithMap() {
    if (!currentUser) return;
    
    // Получаем данные из модуля карты
    const routeData = typeof TripRouteMap !== 'undefined' ? TripRouteMap.getRouteData() : null;
    
    if (!routeData || !routeData.start_point || !routeData.finish_point) {
        showNotification('Выберите маршрут на карте', 'warning');
        return;
    }

    const tripData = {
        driver_id: currentUser.telegram_id,
        from_city: routeData.start_address || 'Неизвестно',
        to_city: routeData.finish_address || 'Неизвестно',
        departure_time: `${document.getElementById('trip-date-map').value}T${document.getElementById('trip-time-map').value}`,
        price: parseFloat(document.getElementById('trip-price-map').value),
        seats_available: parseInt(document.getElementById('seats-count-map').value),
        comment: document.getElementById('trip-comment-map').value,
        distance: routeData.distance,
        duration: routeData.duration
    };

    try {
        const res = await fetch(`${API_BASE_URL}/api/trips`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(tripData)
        });
        if (res.ok) {
            showNotification('✅ Поездка создана!', 'success');
            showScreen('welcome');
        }
    } catch (e) {
        showNotification('Ошибка создания', 'error');
    }
}

// =============== 8. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===============

function showNotification(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `notification ${type} show`;
    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function setupEventListeners() {
    // Кнопка Назад Telegram
    tg.BackButton.onClick(() => {
        if (window.currentScreen !== 'welcome') showScreen('welcome');
    });

    // Обработка кликов вне модалок и подсказок
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.input-group')) {
            document.querySelectorAll('.city-suggestions').forEach(s => s.style.display = 'none');
        }
    });
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', initApp);