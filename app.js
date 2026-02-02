const tg = window.Telegram.WebApp;
const API_BASE_URL = "https://travel-api-n6r2.onrender.com";

let currentUser = JSON.parse(localStorage.getItem('travel_user')) || null;
let userCars = [];
let currentTrips = []; // Для хранения результатов поиска

// =============== ИНИЦИАЛИЗАЦИЯ ===============

document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await initTelegram();
    showScreen('welcome');
    if (tg.ready) tg.ready();
});

async function initTelegram() {
    const user = tg.initDataUnsafe?.user;
    if (user) {
        currentUser = {
            telegram_id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username
        };
        await tryAuth(currentUser);
    } else if (!currentUser) {
        // Тестовый режим для браузера
        currentUser = { telegram_id: 123456789, first_name: 'Тестовый' };
        showNotification('🔧 Тестовый режим', 'info');
    }
    updateUI();
}

async function tryAuth(userData) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/telegram`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        const data = await response.json();
        if (data.success) {
            currentUser = { ...currentUser, ...data.user };
            localStorage.setItem('travel_user', JSON.stringify(currentUser));
            await loadUserCars();
        }
    } catch (e) { console.error('Auth error:', e); }
}

// =============== УПРАВЛЕНИЕ ЭКРАНАМИ ===============

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    const target = document.getElementById(screenId);
    if (target) {
        target.style.display = 'block';
        target.classList.add('active');
    }

    // Навигация Telegram
    if (screenId === 'welcome') tg.BackButton.hide();
    else tg.BackButton.show();

    // Логика инициализации конкретных экранов
    if (screenId === 'profile') loadFullProfile();
    if (screenId === 'create-trip' || screenId === 'find-trip') {
        renderCarSelects(); // Обновляем список машин во всех формах
        setTimeout(() => typeof setupCityAutocomplete === 'function' && setupCityAutocomplete(), 100);
    }
}

// =============== МАШИНЫ (УНИВЕРСАЛЬНО) ===============

async function loadUserCars() {
    if (!currentUser) return;
    const res = await fetch(`${API_BASE_URL}/api/users/cars?telegram_id=${currentUser.telegram_id}`);
    const data = await res.json();
    if (data.success) {
        userCars = data.cars || [];
        renderCarSelects();
    }
}

// Одна функция для обновления всех select-ов с машинами в приложении
function renderCarSelects() {
    // Ищем все элементы выбора авто (на обычном экране и на экране с картой)
    const selectors = ['car-model-select', 'car-model-map', 'car-select']; 
    
    selectors.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        let options = userCars.map(car => 
            `<option value="${car.id}" ${car.is_default ? 'selected' : ''}>
                ${car.model} ${car.color ? `(${car.color})` : ''}
            </option>`
        ).join('');

        el.innerHTML = options || '<option value="">Сначала добавьте авто в профиле</option>';
    });
}

// =============== СОЗДАНИЕ ПОЕЗДКИ (ОБНОВЛЕНО) ===============

async function submitTrip() {
    // Определяем, с какого экрана собираем данные (карта или простая форма)
    const isMapMode = window.currentScreen === 'create-trip-map';
    const prefix = isMapMode ? '-map' : '';

    const carId = document.getElementById(`car-model${prefix}`)?.value || 
                  document.getElementById('car-select')?.value;

    if (!carId) {
        showNotification('Пожалуйста, выберите автомобиль', 'warning');
        return;
    }

    const tripData = {
        from_location: document.getElementById(`from-city${prefix}`).value,
        to_location: document.getElementById(`to-city${prefix}`).value,
        departure_time: document.getElementById(`departure-time${prefix}`).value,
        available_seats: parseInt(document.getElementById(`seats-count${prefix}`).value),
        price_per_seat: parseFloat(document.getElementById(`price${prefix}`).value),
        car_id: parseInt(carId),
        description: document.getElementById(`comment${prefix}`)?.value || ""
    };

    // Валидация
    if (!tripData.from_location || !tripData.to_location || !tripData.departure_time) {
        showNotification('Заполните основные поля', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/trips/create?telegram_id=${currentUser.telegram_id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tripData)
        });

        const result = await response.json();
        if (response.ok) {
            showNotification('✅ Поездка создана!', 'success');
            showScreen('welcome');
        } else {
            showNotification(result.detail || 'Ошибка создания', 'error');
        }
    } catch (e) {
        showNotification('Ошибка сети', 'error');
    }
}

// =============== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===============

function updateUI() {
    const title = document.getElementById('welcome-title');
    if (title && currentUser) title.textContent = `👋 Привет, ${currentUser.first_name}!`;
}

function showNotification(text, type = 'info') {
    // Твоя логика уведомлений (Toast или tg.showAlert)
    console.log(`[${type}] ${text}`);
    tg.showAlert(text);
}

function setupEventListeners() {
    // Навигация
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => showScreen(btn.dataset.screen);
    });
    
    // Кнопка назад в TG
    tg.onEvent('backButtonClicked', () => showScreen('welcome'));
}