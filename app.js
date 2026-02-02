// =============== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===============
const tg = window.Telegram.WebApp;
const API_BASE_URL = 'https://your-backend-api.com'; // ЗАМЕНИТЕ НА ВАШ URL
let currentUser = null;
let currentTrips = [];
window.currentScreen = 'welcome';

// Согласованные ID полей (чтобы не было путаницы между частями)
// Поиск: 'from-input', 'to-input', 'date-input'
// Создание: 'trip-from', 'trip-to', 'trip-date', 'trip-time'

// =============== ИНИЦИАЛИЗАЦИЯ ===============
function initApp() {
    console.log('🚀 App starting...');
    tg.expand();
    tg.ready();

    // Загрузка данных пользователя из Telegram
    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
        currentUser = {
            id: tg.initDataUnsafe.user.id,
            telegram_id: tg.initDataUnsafe.user.id,
            first_name: tg.initDataUnsafe.user.first_name,
            last_name: tg.initDataUnsafe.user.last_name,
            username: tg.initDataUnsafe.user.username,
            name: `${tg.initDataUnsafe.user.first_name} ${tg.initDataUnsafe.user.last_name || ''}`.trim()
        };
        console.log('👤 User identified:', currentUser);
        updateUserUI();
    }

    setupEventListeners();
    loadStats();
    showScreen('welcome');
}

// =============== НАВИГАЦИЯ ===============
function showScreen(screenId) {
    console.log('📱 Switching to screen:', screenId);
    window.currentScreen = screenId;

    // Скрываем все экраны
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    
    // Показываем нужный
    const activeScreen = document.getElementById(screenId);
    if (activeScreen) {
        activeScreen.classList.add('active');
    }

    // Инициализация специфических форм
    if (screenId === 'create-trip') initCreateTripForm();
    if (screenId === 'find-trip') initSearchForm();
    if (screenId === 'profile') loadFullProfile();
    
    // Настройка автодополнения для текущего экрана
    setupCityAutocomplete();

    // Управление кнопкой "Назад" в TG
    if (screenId === 'welcome') {
        tg.BackButton.hide();
    } else {
        tg.BackButton.show();
    }
}

// =============== СТАТИСТИКА ===============
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/stats`);
        if (response.ok) {
            const stats = await response.json();
            const uCount = document.getElementById('users-count');
            const tCount = document.getElementById('trips-count');
            if (uCount) uCount.textContent = stats.tables?.users || stats.users || 0;
            if (tCount) tCount.textContent = stats.tables?.active_trips || stats.trips || 0;
        }
    } catch (error) {
        console.error('Ошибка статистики:', error);
        setDefaultStats();
    }
}

function setDefaultStats() {
    ['users-count', 'trips-count'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '0';
    });
}

// =============== ПРОФИЛЬ И МАШИНЫ ===============
async function loadFullProfile() {
    if (!currentUser) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/users/${currentUser.telegram_id}/full`);
        const data = await res.json();
        if (data.success) {
            renderUserCars(data.cars || []);
            renderUserTrips(data.trips || []);
        }
    } catch (e) {
        showNotification('Ошибка загрузки профиля', 'error');
    }
}

function renderUserCars(cars) {
    const container = document.getElementById('cars-list');
    if (!container) return;
    container.innerHTML = cars.map(car => `
        <div class="car-card">
            <div class="car-info">
                <strong>${car.brand} ${car.model}</strong>
                <span>${car.color} • ${car.plate_number}</span>
            </div>
            <button onclick="deleteCar(${car.id})" class="btn-icon"><i class="fas fa-trash"></i></button>
        </div>
    `).join('') || '<p>Машины не добавлены</p>';
}

// =============== СОЗДАНИЕ ПОЕЗДКИ ===============
async function createTrip() {
    if (!currentUser) return showNotification('Авторизуйтесь', 'warning');

    const fromCity = document.getElementById('trip-from').value;
    const toCity = document.getElementById('trip-to').value;
    const date = document.getElementById('trip-date').value;
    const time = document.getElementById('trip-time').value;
    const seats = document.getElementById('trip-seats')?.value || 1;
    const price = document.getElementById('trip-price').value;

    if (!fromCity || !toCity || !date || !time || !price) {
        return showNotification('Заполните все поля', 'warning');
    }

    const tripData = {
        from_city: fromCity,
        to_city: toCity,
        departure_time: `${date}T${time}`,
        seats_available: parseInt(seats),
        price: parseFloat(price),
        driver_id: currentUser.telegram_id
    };

    try {
        const res = await fetch(`${API_BASE_URL}/api/trips`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

// =============== ПОИСК И БРОНИРОВАНИЕ ===============
async function searchTrips() {
    const from = document.getElementById('from-input').value.trim();
    const to = document.getElementById('to-input').value.trim();
    const date = document.getElementById('date-input').value;

    if (!from || !to || !date) return showNotification('Заполните поля поиска', 'warning');

    try {
        const res = await fetch(`${API_BASE_URL}/api/trips/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from_city: from, to_city: to, date: date })
        });
        const result = await res.json();
        if (result.success) {
            currentTrips = result.trips;
            displaySearchResults(result.trips);
        }
    } catch (e) {
        showNotification('Ошибка поиска', 'error');
    }
}

function displaySearchResults(trips) {
    const container = document.getElementById('search-results');
    if (!container) return;

    if (!trips || trips.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>Поездок не найдено</p></div>`;
        return;
    }

    container.innerHTML = trips.map(trip => `
        <div class="trip-card">
            <div class="trip-header">
                <span>${trip.driver.name}</span>
                <strong>${trip.price} ₽</strong>
            </div>
            <div class="trip-route">
                ${trip.from_city} → ${trip.to_city}
            </div>
            <button onclick="bookTrip(${trip.id})" class="btn-book">Забронировать</button>
        </div>
    `).join('');
}

async function bookTrip(tripId) {
    const seats = prompt('Сколько мест?', '1');
    if (!seats) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/bookings?user_id=${currentUser.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trip_id: tripId, seats: parseInt(seats) })
        });
        if (res.ok) {
            showNotification('✅ Забронировано!', 'success');
            searchTrips(); // Обновляем список
        }
    } catch (e) {
        showNotification('Ошибка бронирования', 'error');
    }
}

// =============== АВТОДОПОЛНЕНИЕ ГОРОДОВ ===============
function setupCityAutocomplete() {
    const fieldMap = {
        'find-trip': ['from-input', 'to-input'],
        'create-trip': ['trip-from', 'trip-to']
    };

    const fields = fieldMap[window.currentScreen];
    if (!fields) return;

    fields.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', (e) => showCitySuggestions(id, e.target.value));
        }
    });
}

function showCitySuggestions(fieldId, query) {
    if (query.length < 2 || !window.RUSSIAN_CITIES) return hideCitySuggestions(fieldId);

    const matches = window.RUSSIAN_CITIES.filter(c => 
        c.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);

    let container = document.getElementById(`${fieldId}-suggestions`);
    if (!container) {
        container = document.createElement('div');
        container.id = `${fieldId}-suggestions`;
        container.className = 'suggestions-box';
        document.getElementById(fieldId).parentNode.appendChild(container);
    }

    container.innerHTML = matches.map(city => `
        <div class="suggestion-item" onclick="selectCity('${fieldId}', '${city}')">
            📍 ${city}
        </div>
    `).join('');
    container.style.display = matches.length ? 'block' : 'none';
}

function selectCity(fieldId, city) {
    const input = document.getElementById(fieldId);
    if (input) input.value = city;
    hideCitySuggestions(fieldId);
}

function hideCitySuggestions(fieldId) {
    const container = document.getElementById(`${fieldId}-suggestions`);
    if (container) container.style.display = 'none';
}

// =============== СИСТЕМНЫЕ ФУНКЦИИ ===============
function setupEventListeners() {
    // Навигация по атрибутам data-screen
    document.querySelectorAll('[data-screen]').forEach(btn => {
        btn.addEventListener('click', () => showScreen(btn.dataset.screen));
    });

    // Кнопка поиска
    const sBtn = document.getElementById('do-search');
    if (sBtn) sBtn.addEventListener('click', searchTrips);

    // Кнопка создания
    const cBtn = document.getElementById('do-create');
    if (cBtn) cBtn.addEventListener('click', createTrip);

    // Telegram Back Button
    tg.BackButton.onClick(() => {
        if (window.currentScreen !== 'welcome') showScreen('welcome');
    });
}

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

// Экспорт функций для HTML
window.deleteCar = async (id) => { /* Логика удаления */ };
window.selectCity = selectCity;
window.bookTrip = bookTrip;

// Запуск
document.addEventListener('DOMContentLoaded', initApp);