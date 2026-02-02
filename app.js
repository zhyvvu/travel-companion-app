// =============== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И КОНСТАНТЫ ===============
const tg = window.Telegram.WebApp;
const API_BASE_URL = 'https://your-backend-api.com'; // Замените на ваш URL
let currentUser = null;
let currentTrips = [];
window.currentScreen = 'welcome';
window.autocompleteInitialized = false;

// =============== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ===============
function initApp() {
    console.log('🚀 Инициализация Mini App...');
    tg.expand();
    tg.ready();

    // 1. Получаем данные из Telegram
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

    // 2. Настраиваем события
    setupEventListeners();
    
    // 3. Загружаем начальные данные
    loadStats();
    
    // 4. Показываем стартовый экран
    showScreen('welcome');
}

// =============== ОБРАБОТКА ИНТЕРФЕЙСА (UI) ===============

function updateUserUI() {
    const userNameEl = document.getElementById('user-name');
    if (userNameEl && currentUser) {
        userNameEl.textContent = currentUser.name;
    }
}

function showScreen(screenId) {
    console.log('📱 Переход на экран:', screenId);
    window.currentScreen = screenId;

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const activeScreen = document.getElementById(screenId);
    if (activeScreen) {
        activeScreen.classList.add('active');
    }

    // Специфическая логика для экранов
    if (screenId === 'profile') loadFullProfile();
    if (screenId === 'create-trip') initAddressAutocomplete();
    if (screenId === 'create-trip-map') initCreateTripMapForm();

    // Автодополнение городов
    setupCityAutocomplete();

    // Кнопка назад
    if (tg.BackButton) {
        if (screenId === 'welcome') tg.BackButton.hide();
        else tg.BackButton.show();
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
            if (uCount) uCount.textContent = stats.users || 0;
            if (tCount) tCount.textContent = stats.active_trips || 0;
        }
    } catch (error) {
        console.error('❌ Ошибка статистики:', error);
    }
}

// =============== АВТОДОПОЛНЕНИЕ (ЯНДЕКС + RUSSIAN_CITIES) ===============

function setupCityAutocomplete() {
    console.log('=== Настройка автодополнения (синхронизация с HTML) ===');
    
    // Карта соответствия: экран -> массив ID полей в твоем HTML
    const fieldMap = {
        'find-trip': ['find-from', 'find-to'],
        'create-trip-map': ['map-search-input'] // Для поиска на карте
    };

    const fieldIds = fieldMap[window.currentScreen];
    if (!fieldIds) {
        console.log('Автодополнение для экрана ' + window.currentScreen + ' не требуется');
        return;
    }

    fieldIds.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            if (!input._autocompleteBound) {
                input.addEventListener('input', handleCityInput);
                input.addEventListener('focus', handleCityFocus);
                input._autocompleteBound = true;
                console.log(`✅ Обработчик привязан к: ${id}`);
            }
        } else {
            console.warn(`⚠️ Элемент с ID "${id}" не найден в HTML`);
        }
    });
}

function handleCityInput(e) {
    const value = e.target.value.trim();
    if (value.length >= 2) showCitySuggestionsSimple(e.target.id, value);
    else hideCitySuggestions(e.target.id);
}

function handleCityFocus(e) {
    if (e.target.value.length >= 2) showCitySuggestionsSimple(e.target.id, e.target.value);
}

/**
 * Обновленная функция отрисовки подсказок под правильными контейнерами
 */
function showCitySuggestionsSimple(fieldId, query) {
    if (!window.RUSSIAN_CITIES) return;

    const queryLower = query.toLowerCase();
    const results = window.RUSSIAN_CITIES.filter(city => 
        city.toLowerCase().includes(queryLower)
    ).slice(0, 5);

    // В HTML у нас контейнеры называются "${fieldId}-suggestions"
    let container = document.getElementById(`${fieldId}-suggestions`);
    
    // Если контейнера нет в HTML, создаем его динамически
    if (!container) {
        container = document.createElement('div');
        container.id = `${fieldId}-suggestions`;
        container.className = 'city-suggestions';
        const input = document.getElementById(fieldId);
        if (input && input.parentNode) {
            input.parentNode.style.position = 'relative';
            input.parentNode.appendChild(container);
        }
    }

    if (results.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.innerHTML = results.map(city => `
        <div class="suggestion-item" 
             style="padding:12px; cursor:pointer; border-bottom:1px solid #eee; background: white;" 
             onclick="selectCitySimple('${fieldId}', '${city.replace(/'/g, "\\'")}')">
            📍 ${city}
        </div>
    `).join('');
    
    container.style.display = 'block';
}

window.selectCitySimple = function(fieldId, city) {
    const input = document.getElementById(fieldId);
    if (input) input.value = city;
    hideCitySuggestions(fieldId);
};

function hideCitySuggestions(fieldId) {
    const container = document.getElementById(`${fieldId}-suggestions`);
    if (container) container.style.display = 'none';
}

// =============== ПОИСК И БРОНИРОВАНИЕ ===============

async function searchTrips() {
    const from = document.getElementById('from-input').value;
    const to = document.getElementById('to-input').value;
    const date = document.getElementById('date-input').value;

    if (!from || !to || !date) {
        showNotification('Заполните все поля', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/trips/search`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ from_city: from, to_city: to, date: date })
        });
        const result = await response.json();
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

    if (trips.length === 0) {
        container.innerHTML = '<p>Поездок не найдено</p>';
        return;
    }

    container.innerHTML = trips.map(trip => `
        <div class="trip-card">
            <div class="trip-info">
                <strong>${trip.from_city} ➔ ${trip.to_city}</strong>
                <div>Водитель: ${trip.driver.name} | Мест: ${trip.seats.available}</div>
            </div>
            <button onclick="bookTrip(${trip.id})" class="btn-book">${trip.price} ₽</button>
        </div>
    `).join('');
}

async function bookTrip(tripId) {
    if (!currentUser) return showNotification('Авторизуйтесь', 'warning');

    const seats = parseInt(prompt('Сколько мест хотите забронировать?', '1'));
    if (!seats || seats < 1) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/bookings/create?telegram_id=${currentUser.telegram_id}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ driver_trip_id: tripId, booked_seats: seats })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showNotification('✅ Успешно забронировано!', 'success');
            // Обновляем количество мест в локальном списке
            if (Array.isArray(currentTrips)) {
                const idx = currentTrips.findIndex(t => t.id === tripId);
                if (idx !== -1) {
                    currentTrips[idx].seats.available = result.remaining_seats || (currentTrips[idx].seats.available - seats);
                    displaySearchResults(currentTrips);
                }
            }
        } else {
            showNotification(result.detail || 'Ошибка бронирования', 'error');
        }
    } catch (e) {
        showNotification('Ошибка сервера', 'error');
    }
}

// =============== УПРАВЛЕНИЕ ПОЕЗДКАМИ (ОТМЕНА / ПРОСМОТР) ===============

async function cancelTrip(tripId) {
    if (!currentUser || !confirm('Вы уверены? Все бронирования будут отменены.')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}/cancel?telegram_id=${currentUser.telegram_id}`, {
            method: 'POST'
        });
        if (response.ok) {
            const result = await response.json();
            showNotification(`✅ Отменено! Бронирований удалено: ${result.cancelled_bookings || 0}`, 'success');
            loadFullProfile();
        }
    } catch (e) {
        showNotification('Ошибка отмены', 'error');
    }
}

async function showTripBookings(tripId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}/bookings?telegram_id=${currentUser.telegram_id}`);
        const result = await response.json();
        if (response.ok && result.success) {
            let content = `<h3>Бронирования</h3>`;
            result.bookings.forEach(b => {
                content += `<div class="booking-item">👤 ${b.passenger.name} | Мест: ${b.seats}</div>`;
            });
            showCustomModal(content || 'Нет бронирований');
        }
    } catch (e) {
        showNotification('Ошибка загрузки', 'error');
    }
}

// =============== КАРТЫ ЯНДЕКС (МАРШРУТЫ) ===============

function swapRoutePoints() {
    const fromField = document.getElementById('trip-from');
    const toField = document.getElementById('trip-to');
    if (fromField && toField) {
        const temp = fromField.value;
        fromField.value = toField.value;
        toField.value = temp;
        showNotification('Пункты маршрута поменяны', 'success');
    }
}

async function showRouteOnMap() {
    const from = document.getElementById('trip-from')?.value;
    const to = document.getElementById('trip-to')?.value;

    if (!from || !to) return showNotification('Заполните адреса', 'warning');

    const container = document.getElementById('route-map-container');
    if (container) container.style.display = 'block';

    if (typeof TripRouteMap !== 'undefined' && typeof TripRouteMap.init === 'function') {
        await TripRouteMap.init();
        TripRouteMap.searchAndSetPoint(from, 'start');
        setTimeout(() => TripRouteMap.searchAndSetPoint(to, 'finish'), 1000);
    }
}

// =============== УВЕДОМЛЕНИЯ И МОДАЛКИ ===============

function showNotification(message, type = 'info') {
    document.querySelectorAll('.notification').forEach(n => n.remove());
    const n = document.createElement('div');
    n.className = `notification ${type}`;
    n.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => {
        n.classList.remove('show');
        setTimeout(() => n.remove(), 300);
    }, 3000);
}

function showCustomModal(content) {
    const m = document.getElementById('modal');
    if (m) {
        m.innerHTML = `<div class="modal-content"><span class="close-btn" onclick="closeModal()">&times;</span>${content}</div>`;
        m.style.display = 'block';
    }
}

function closeModal() {
    const m = document.getElementById('modal');
    if (m) m.style.display = 'none';
}

// =============== СОБЫТИЯ ===============

function setupEventListeners() {
    // Навигация по экранам
    document.querySelectorAll('[data-screen]').forEach(btn => {
        btn.addEventListener('click', function() {
            showScreen(this.dataset.screen);
        });
    });

    // Поиск
    const searchBtn = document.querySelector('.search-btn');
    if (searchBtn) searchBtn.addEventListener('click', searchTrips);

    // Модалки
    window.addEventListener('click', (e) => {
        if (e.target.id === 'modal') closeModal();
    });

    // Кнопка назад Telegram
    if (tg.BackButton) {
        tg.BackButton.onClick(() => {
            if (window.currentScreen !== 'welcome') showScreen('welcome');
            else tg.close();
        });
    }
}

// =============== ЭКСПОРТ В WINDOW ===============
window.closeModal = closeModal;
window.bookTrip = bookTrip;
window.cancelTrip = cancelTrip;
window.showTripBookings = showTripBookings;
window.swapRoutePoints = swapRoutePoints;
window.showRouteOnMap = showRouteOnMap;

document.addEventListener('DOMContentLoaded', initApp);