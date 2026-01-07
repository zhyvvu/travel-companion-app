// app.js - ПОЛНАЯ ВЕРСИЯ С УПРАВЛЕНИЕМ АВТОМОБИЛЯМИ
const tg = window.Telegram.WebApp;

// Конфигурация API
const API_BASE_URL = "https://travel-api-n6r2.onrender.com";

// Состояние приложения
let currentUser = null;
let authInProgress = false;
let currentScreen = 'welcome';
let userCars = [];

const RUSSIAN_CITIES = [
    'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань',
    'Нижний Новгород', 'Челябинск', 'Самара', 'Омск', 'Ростов-на-Дону',
    'Уфа', 'Красноярск', 'Пермь', 'Воронеж', 'Волгоград',
    'Краснодар', 'Саратов', 'Тюмень', 'Тольятти', 'Ижевск',
    'Барнаул', 'Ульяновск', 'Иркутск', 'Хабаровск', 'Ярославль',
    'Владивосток', 'Махачкала', 'Томск', 'Оренбург', 'Кемерово',
    'Новокузнецк', 'Рязань', 'Астрахань', 'Набережные Челны', 'Пенза',
    'Липецк', 'Киров', 'Чебоксары', 'Калининград', 'Тула',
    'Курск', 'Сочи', 'Ставрополь', 'Магнитогорск', 'Брянск',
    'Севастополь', 'Нижний Тагил', 'Дзержинск', 'Орск', 'Сургут'
];

// =============== ОСНОВНЫЕ ФУНКЦИИ ===============

function getTelegramUser() {
    if (tg.initDataUnsafe?.user) {
        return tg.initDataUnsafe.user;
    }
    
    if (tg.initData) {
        try {
            const params = new URLSearchParams(tg.initData);
            const userParam = params.get('user');
            if (userParam) {
                return JSON.parse(decodeURIComponent(userParam));
            }
        } catch (e) {
            console.error('Error parsing initData:', e);
        }
    }
    
    return null;
}

function requireAuth(action = 'выполнить это действие') {
    if (!currentUser || !currentUser.telegram_id) {
        showNotification(`Пожалуйста, авторизуйтесь чтобы ${action}`, 'warning');
        showScreen('welcome');
        return false;
    }
    return true;
}

// =============== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ===============

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Telegram Web App initialized');
    
    try {
        await initApp();
        setupEventListeners();
        loadStats();
        setupCityAutocomplete();
        
        if (tg.ready) tg.ready();
        console.log('App ready');
    } catch (error) {
        console.error('Error during initialization:', error);
        showNotification('Ошибка загрузки приложения', 'error');
    }
});

async function initApp() {
    try {
        console.log('Initializing app...');
        const telegramUser = getTelegramUser();
        
        if (telegramUser) {
            console.log('✅ Telegram User found:', telegramUser);
            
            currentUser = {
                telegram_id: telegramUser.id,
                first_name: telegramUser.first_name,
                last_name: telegramUser.last_name || '',
                username: telegramUser.username,
                language_code: telegramUser.language_code,
                is_premium: telegramUser.is_premium || false
            };
            
            await authenticateUser(telegramUser);
            
            try {
                if (tg.expand) tg.expand();
                if (tg.setHeaderColor) tg.setHeaderColor('#2481cc');
                if (tg.setBackgroundColor) tg.setBackgroundColor('#f5f5f5');
            } catch (e) {
                console.log('Некоторые функции WebApp не поддерживаются');
            }
            
        } else {
            console.warn('❌ Telegram user data not available');
            
            const isDevMode = window.location.hostname === 'localhost' || 
                             window.location.hostname === '127.0.0.1';
            
            if (isDevMode) {
                console.log('🔧 Development mode: using test user');
                initTestUser();
            } else {
                showNotification('Откройте приложение через Telegram бота', 'warning');
                showTelegramWarning();
            }
        }
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showNotification('Ошибка загрузки приложения', 'error');
        
        if (window.location.hostname === 'localhost' || 
            window.location.hostname === '127.0.0.1') {
            initTestUser();
        }
    }
    
    console.log('App initialized');
    updateWelcomeMessage();
}

function showTelegramWarning() {
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
        const warningHtml = `
            <div class="telegram-warning">
                <h3>⚠️ Откройте через Telegram</h3>
                <p>Это приложение работает только внутри Telegram.</p>
                <p>Чтобы начать:</p>
                <ol>
                    <li>Откройте Telegram</li>
                    <li>Найдите бота @TravelCompanionBot</li>
                    <li>Нажмите /start</li>
                    <li>Нажмите кнопку "Открыть Travel Companion"</li>
                </ol>
                <p><strong>Тестовый режим:</strong></p>
                <button class="btn-test-mode" onclick="initTestUser()">
                    <i class="fas fa-flask"></i> Войти в тестовом режиме
                </button>
            </div>
        `;
        
        const welcomeCard = welcomeScreen.querySelector('.welcome-card');
        if (welcomeCard) {
            welcomeCard.innerHTML += warningHtml;
        }
    }
}

function initTestUser() {
    currentUser = {
        telegram_id: 123456789,
        first_name: 'Тестовый',
        last_name: 'Пользователь',
        username: 'test_user',
        language_code: 'ru'
    };
    
    updateUserInfo();
    updateWelcomeMessage();
    showNotification('🔧 Тестовый режим активирован', 'info');
}

async function authenticateUser(telegramUser) {
    if (authInProgress) return;
    authInProgress = true;
    
    const userInfoEl = document.getElementById('user-info');
    if (userInfoEl) {
        userInfoEl.innerHTML = `<div class="loader"></div>`;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/telegram`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                user: {
                    id: telegramUser.id,
                    first_name: telegramUser.first_name,
                    last_name: telegramUser.last_name || '',
                    username: telegramUser.username,
                    language_code: telegramUser.language_code,
                    is_premium: telegramUser.is_premium || false
                }
            })
        });
        
        console.log('Auth response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Auth data:', data);
            
            if (data.success) {
                currentUser = {
                    ...currentUser,
                    ...data.user,
                    token: data.token
                };
                
                localStorage.setItem('travel_user', JSON.stringify(currentUser));
                localStorage.setItem('last_auth_time', Date.now());
                
                updateUserInfo();
                updateWelcomeMessage();
                
                await loadUserCars();
                
                showNotification('✅ Авторизация успешна', 'success');
            } else {
                throw new Error(data.message || 'Ошибка авторизации');
            }
        } else {
            const errorText = await response.text();
            console.error('Auth failed:', errorText);
            throw new Error('Ошибка сервера при авторизации');
        }
    } catch (error) {
        console.error('Ошибка аутентификации:', error);
        
        const savedUser = localStorage.getItem('travel_user');
        const lastAuthTime = localStorage.getItem('last_auth_time');
        const hoursSinceLastAuth = lastAuthTime ? (Date.now() - lastAuthTime) / (1000 * 60 * 60) : 24;
        
        if (savedUser && hoursSinceLastAuth < 24) {
            currentUser = JSON.parse(savedUser);
            updateUserInfo();
            updateWelcomeMessage();
            showNotification('⚠️ Используем сохраненные данные', 'warning');
        } else {
            showNotification('❌ Ошибка авторизации. Проверьте подключение', 'error');
            if (userInfoEl) {
                userInfoEl.innerHTML = `
                    <button class="btn-retry-auth" onclick="retryAuth()">
                        <i class="fas fa-redo"></i> Повторить
                    </button>
                `;
            }
        }
    } finally {
        authInProgress = false;
    }
}

async function retryAuth() {
    const telegramUser = getTelegramUser();
    if (!telegramUser) {
        showNotification('Данные Telegram недоступны', 'error');
        return;
    }
    
    await authenticateUser(telegramUser);
}

function updateUserInfo() {
    if (!currentUser) {
        const userInfoEl = document.getElementById('user-info');
        if (userInfoEl) {
            userInfoEl.innerHTML = `
                <div class="user-info-unauth">
                    <button class="btn-small" onclick="initApp()">
                        <i class="fas fa-sign-in-alt"></i> Войти
                    </button>
                </div>
            `;
        }
        return;
    }
    
    const userInfoEl = document.getElementById('user-info');
    if (userInfoEl) {
        userInfoEl.innerHTML = `
            <div class="user-avatar">
                ${currentUser.first_name.charAt(0)}${currentUser.last_name?.charAt(0) || ''}
            </div>
            <div class="user-name">
                ${currentUser.first_name}
            </div>
        `;
    }
}

function updateWelcomeMessage() {
    if (!currentUser) return;
    
    const welcomeTitle = document.getElementById('welcome-title');
    if (welcomeTitle) {
        welcomeTitle.textContent = `👋 Привет, ${currentUser.first_name}!`;
    }
}

// =============== УПРАВЛЕНИЕ АВТОМОБИЛЯМИ ===============

async function loadUserCars() {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/users/cars?telegram_id=${currentUser.telegram_id}`
        );
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                userCars = data.cars || [];
                updateCarSelect();
                return data.cars;
            }
        }
        return [];
    } catch (error) {
        console.error('Ошибка загрузки автомобилей:', error);
        return [];
    }
}

function updateCarSelect() {
    const carSelect = document.getElementById('car-model-select');
    const carModelInput = document.getElementById('car-model');
    
    if (carSelect && carModelInput) {
        carSelect.innerHTML = '<option value="">Выберите автомобиль</option>';
        
        if (userCars.length > 0) {
            userCars.forEach(car => {
                const option = document.createElement('option');
                option.value = car.id;
                option.textContent = `${car.model} ${car.color ? `(${car.color})` : ''} ${car.is_default ? '⭐' : ''}`;
                if (car.is_default) {
                    option.selected = true;
                    carModelInput.value = car.model;
                }
                carSelect.appendChild(option);
            });
            
            carSelect.style.display = 'block';
            carModelInput.style.display = 'none';
        } else {
            carSelect.style.display = 'none';
            carModelInput.style.display = 'block';
        }
    }
}

function getSelectedCar() {
    const carSelect = document.getElementById('car-model-select');
    const carModelInput = document.getElementById('car-model');
    
    if (carSelect && carSelect.style.display !== 'none') {
        const selectedCarId = carSelect.value;
        if (selectedCarId) {
            return userCars.find(car => car.id == selectedCarId);
        }
    }
    
    if (carModelInput && carModelInput.style.display !== 'none') {
        return {
            model: carModelInput.value,
            color: null,
            seats: 4
        };
    }
    
    return null;
}

function showAddCarModal() {
    const modalContent = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-car"></i> Добавить автомобиль</h3>
                <button class="close-btn" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="add-car-form" onsubmit="event.preventDefault(); saveCar()">
                    <div class="input-group">
                        <i class="fas fa-car"></i>
                        <input type="text" id="new-car-model" placeholder="Модель автомобиля *" required>
                    </div>
                    
                    <div class="input-row">
                        <div class="input-group half">
                            <i class="fas fa-palette"></i>
                            <input type="text" id="new-car-color" placeholder="Цвет">
                        </div>
                        <div class="input-group half">
                            <i class="fas fa-id-card"></i>
                            <input type="text" id="new-car-plate" placeholder="Госномер">
                        </div>
                    </div>
                    
                    <div class="input-row">
                        <div class="input-group half">
                            <i class="fas fa-calendar"></i>
                            <input type="number" id="new-car-year" placeholder="Год выпуска" min="1990" max="2024">
                        </div>
                        <div class="input-group half">
                            <i class="fas fa-users"></i>
                            <select id="new-car-seats">
                                <option value="2">2 места</option>
                                <option value="4" selected>4 места</option>
                                <option value="5">5 мест</option>
                                <option value="7">7 мест</option>
                                <option value="8">8 мест</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="input-group">
                        <i class="fas fa-car-side"></i>
                        <select id="new-car-type">
                            <option value="">Тип автомобиля</option>
                            <option value="sedan">Седан</option>
                            <option value="hatchback">Хэтчбек</option>
                            <option value="suv">Внедорожник</option>
                            <option value="minivan">Минивэн</option>
                            <option value="coupe">Купе</option>
                        </select>
                    </div>
                    
                    <div class="checkbox-group">
                        <input type="checkbox" id="new-car-default" checked>
                        <label for="new-car-default">Использовать как основной автомобиль</label>
                    </div>
                    
                    <div class="modal-actions">
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-save"></i> Сохранить
                        </button>
                        <button type="button" class="btn-secondary" onclick="closeModal()">
                            <i class="fas fa-times"></i> Отмена
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    showCustomModal(modalContent);
}

async function saveCar() {
    const model = document.getElementById('new-car-model').value.trim();
    const color = document.getElementById('new-car-color').value.trim();
    const plate = document.getElementById('new-car-plate').value.trim();
    const year = document.getElementById('new-car-year').value;
    const seats = document.getElementById('new-car-seats').value;
    const carType = document.getElementById('new-car-type').value;
    const isDefault = document.getElementById('new-car-default').checked;
    
    if (!model) {
        showNotification('Введите модель автомобиля', 'warning');
        return;
    }
    
    try {
        const carData = {
            model: model,
            color: color || null,
            license_plate: plate || null,
            year: year ? parseInt(year) : null,
            seats: parseInt(seats),
            car_type: carType || null,
            is_default: isDefault
        };
        
        const response = await fetch(
            `${API_BASE_URL}/api/users/cars?telegram_id=${currentUser.telegram_id}`,
            {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(carData)
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                showNotification('✅ Автомобиль добавлен', 'success');
                closeModal();
                await loadUserCars();
            }
        } else {
            const errorText = await response.text();
            showNotification(`Ошибка: ${errorText}`, 'error');
        }
    } catch (error) {
        console.error('Ошибка сохранения авто:', error);
        showNotification('Ошибка сохранения', 'error');
    }
}

async function setDefaultCar(carId) {
    if (!confirm('Сделать этот автомобиль основным?')) return;
    
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/users/cars/${carId}?telegram_id=${currentUser.telegram_id}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_default: true })
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                showNotification('✅ Автомобиль установлен как основной', 'success');
                await loadUserCars();
            }
        }
    } catch (error) {
        console.error('Ошибка установки авто по умолчанию:', error);
        showNotification('Ошибка обновления', 'error');
    }
}

async function deleteCar(carId) {
    if (!confirm('Удалить этот автомобиль?')) return;
    
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/users/cars/${carId}?telegram_id=${currentUser.telegram_id}`,
            {
                method: 'DELETE'
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                showNotification('✅ Автомобиль удален', 'success');
                await loadUserCars();
            }
        }
    } catch (error) {
        console.error('Ошибка удаления авто:', error);
        showNotification('Ошибка удаления', 'error');
    }
}

// =============== ПРОФИЛЬ (ИСПРАВЛЕННАЯ ВЕРСИЯ) ===============

async function loadProfile() {
    console.log("🔍 ФУНКЦИЯ loadProfile ВЫЗВАНА!");
    
    if (!requireAuth('просматривать профиль')) {
        console.log("❌ Авторизация не пройдена");
        return;
    }
    
    const profileEl = document.getElementById('profile-data');
    if (!profileEl) {
        console.error("❌ Элемент profile-data не найден!");
        return;
    }
    
    // Показываем простой текст сразу
    profileEl.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <h3>🔄 Загружаем профиль...</h3>
            <div class="loader" style="margin: 20px auto;"></div>
            <p>Telegram ID: ${currentUser.telegram_id}</p>
            <p>API: ${API_BASE_URL}/api/users/profile-full?telegram_id=${currentUser.telegram_id}</p>
        </div>
    `;
    
    console.log('🔄 Загрузка профиля...');
    console.log('Telegram ID:', currentUser.telegram_id);
    console.log('API URL:', `${API_BASE_URL}/api/users/profile-full?telegram_id=${currentUser.telegram_id}`);
    
    try {
        const startTime = Date.now();
        const response = await fetch(
            `${API_BASE_URL}/api/users/profile-full?telegram_id=${currentUser.telegram_id}`
        );
        const endTime = Date.now();
        
        console.log(`⏱️  Время ответа: ${endTime - startTime}ms`);
        console.log('📊 Статус ответа:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Данные профиля:', data);
            
            if (data.success) {
                // Простое отображение для теста
                profileEl.innerHTML = `
                    <div class="profile-card" style="max-width: 600px; margin: 0 auto;">
                        <div class="profile-header">
                            <div class="profile-avatar">
                                ${data.user.first_name.charAt(0)}${data.user.last_name?.charAt(0) || ''}
                            </div>
                            <div class="profile-name">${data.user.first_name} ${data.user.last_name || ''}</div>
                            <div class="profile-role">${data.user.role || 'Пассажир'}</div>
                        </div>
                        
                        <div style="padding: 20px; text-align: center;">
                            <h3>✅ Профиль загружен!</h3>
                            <p><strong>Имя:</strong> ${data.user.first_name}</p>
                            <p><strong>Телеграм ID:</strong> ${data.user.telegram_id}</p>
                            <p><strong>Рейтинг водителя:</strong> ${data.user.ratings?.driver || '5.0'}</p>
                            <p><strong>Автомобилей:</strong> ${data.cars?.length || 0}</p>
                            <p><strong>Поездок как водитель:</strong> ${data.driver_trips?.length || 0}</p>
                            <p><strong>Поездок как пассажир:</strong> ${data.passenger_trips?.length || 0}</p>
                            
                            <div style="margin-top: 30px;">
                                <button class="btn-primary" onclick="showAddCarModal()">
                                    <i class="fas fa-plus"></i> Добавить автомобиль
                                </button>
                                <button class="btn-secondary" onclick="showScreen('welcome')" style="margin-left: 10px;">
                                    <i class="fas fa-home"></i> На главную
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                console.log("✅ Профиль отображен успешно");
            } else {
                console.error("❌ API вернул success=false:", data);
                profileEl.innerHTML = `
                    <div class="error" style="text-align: center; padding: 40px;">
                        <h3>⚠️ Ошибка API</h3>
                        <p>${data.message || 'Неизвестная ошибка'}</p>
                        <button class="btn-primary" onclick="loadProfile()" style="margin-top: 20px;">
                            <i class="fas fa-redo"></i> Повторить
                        </button>
                    </div>
                `;
            }
        } else {
            const errorText = await response.text();
            console.error('❌ Ошибка HTTP:', response.status, errorText);
            profileEl.innerHTML = `
                <div class="error" style="text-align: center; padding: 40px;">
                    <h3>⚠️ Ошибка сервера: ${response.status}</h3>
                    <p>${errorText || 'Нет деталей ошибки'}</p>
                    <button class="btn-primary" onclick="loadProfile()" style="margin-top: 20px;">
                        <i class="fas fa-redo"></i> Повторить
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error('❌ Ошибка сети:', error);
        profileEl.innerHTML = `
            <div class="error" style="text-align: center; padding: 40px;">
                <h3>⚠️ Ошибка сети</h3>
                <p>${error.message}</p>
                <p>Проверьте подключение к интернету</p>
                <button class="btn-primary" onclick="loadProfile()" style="margin-top: 20px;">
                    <i class="fas fa-redo"></i> Повторить
                </button>
            </div>
        `;
    }
}

// =============== СОЗДАНИЕ ПОЕЗДКИ ===============

async function createTrip() {
    if (!requireAuth('создать поездку')) return;
    
    if (userCars.length === 0) {
        const addCar = confirm('Для создания поездки нужно добавить автомобиль. Добавить сейчас?');
        if (addCar) {
            showAddCarModal();
            return;
        } else {
            showNotification('❌ Невозможно создать поездку без автомобиля', 'error');
            return;
        }
    }
    
    const from = document.getElementById('trip-from').value.trim();
    const to = document.getElementById('trip-to').value.trim();
    const date = document.getElementById('trip-date').value;
    const time = document.getElementById('trip-time').value;
    const seats = document.getElementById('seats-count').value;
    const price = document.getElementById('trip-price').value;
    const comment = document.getElementById('trip-comment').value.trim();
    
    const selectedCar = getSelectedCar();
    if (!selectedCar || !selectedCar.model) {
        showNotification('Выберите автомобиль', 'warning');
        return;
    }
    
    if (!from || !to || !date || !time || !seats || !price) {
        showNotification('Заполните все обязательные поля', 'warning');
        return;
    }
    
    if (parseFloat(price) <= 0) {
        showNotification('Цена должна быть больше 0', 'warning');
        return;
    }
    
    if (parseInt(seats) <= 0) {
        showNotification('Количество мест должно быть больше 0', 'warning');
        return;
    }
    
    try {
        const tripData = {
            departure_date: `${date}T${time}:00`,
            departure_time: time,
            start_address: from,
            finish_address: to,
            available_seats: parseInt(seats),
            price_per_seat: parseFloat(price),
            comment: comment || null
        };
        
        console.log('Creating trip with car:', selectedCar);
        
        const response = await fetch(
            `${API_BASE_URL}/api/trips/create?telegram_id=${currentUser.telegram_id}`,
            {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(tripData)
            }
        );
        
        console.log('Create trip response status:', response.status);
        
        const responseText = await response.text();
        console.log('Create trip response body:', responseText);
        
        if (response.ok) {
            const data = JSON.parse(responseText);
            if (data.success) {
                showNotification('🎉 Поездка успешно создана!', 'success');
                showScreen('welcome');
                clearTripForm();
                loadStats();
            } else {
                showNotification(data.message || 'Ошибка создания поездки', 'error');
            }
        } else {
            console.error('Create trip error:', responseText);
            showNotification(`Ошибка сервера: ${response.status}`, 'error');
        }
    } catch (error) {
        console.error('Ошибка создания поездки:', error);
        showNotification('Ошибка подключения к серверу', 'error');
    }
}

function clearTripForm() {
    document.getElementById('trip-from').value = '';
    document.getElementById('trip-to').value = '';
    document.getElementById('trip-price').value = '';
    document.getElementById('trip-comment').value = '';
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('trip-date').value = tomorrow.toISOString().split('T')[0];
    
    document.querySelectorAll('.clear-city-btn').forEach(btn => {
        if (btn) btn.style.display = 'none';
    });
    
    updateCarSelect();
}

// =============== СЛУШАТЕЛИ СОБЫТИЙ ===============

function setupEventListeners() {
    const today = new Date().toISOString().split('T')[0];
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        if (input) {
            input.value = today;
            input.min = today;
        }
    });
    
    const now = new Date();
    now.setHours(now.getHours() + 2);
    const timeInputs = document.querySelectorAll('input[type="time"]');
    timeInputs.forEach(input => {
        if (input) {
            input.value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        }
    });
    
    // ВАЖНОЕ ИСПРАВЛЕНИЕ: Добавляем обработчики для навигации
    document.querySelectorAll('[data-screen]').forEach(btn => {
        btn.addEventListener('click', function() {
            console.log("🎯 Нажата кнопка навигации:", this.dataset.screen);
            
            // Для профиля проверяем авторизацию
            if (this.dataset.screen === 'profile' || 
                this.dataset.screen === 'create-trip' || 
                this.dataset.screen === 'find-trip') {
                if (!requireAuth('перейти в этот раздел')) return;
            }
            
            showScreen(this.dataset.screen);
        });
    });
    
    document.querySelectorAll('.modal-close, .close-btn').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
    
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal();
        }
    });
    
    setupCityInputListeners();
    
    const searchBtn = document.querySelector('.search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', searchTrips);
    }
    
    const createTripBtn = document.querySelector('.submit-btn');
    if (createTripBtn) {
        createTripBtn.addEventListener('click', createTrip);
    }
    
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (currentScreen === 'find-trip') {
                    if (!requireAuth('искать поездки')) return;
                    searchTrips();
                } else if (currentScreen === 'create-trip') {
                    if (!requireAuth('создать поездку')) return;
                    createTrip();
                }
            }
        });
    });
    
    if (tg.BackButton) {
        tg.BackButton.onClick(() => {
            if (currentScreen !== 'welcome') {
                showScreen('welcome');
            } else {
                tg.close();
            }
        });
    }
    
    // Дополнительная отладка
    console.log("🎯 Обработчики событий установлены");
}

// =============== АВТОДОПОЛНЕНИЕ ГОРОДОВ ===============
function setupCityAutocomplete() {
    const cityInputs = ['from-input', 'to-input', 'trip-from', 'trip-to'];
    
    cityInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (!input) return;
        
        input.addEventListener('input', function(e) {
            const value = e.target.value.trim();
            if (value.length >= 2) {
                showCitySuggestions(inputId, value);
            } else {
                hideSuggestions(inputId);
            }
        });
        
        input.addEventListener('focus', function(e) {
            const value = e.target.value.trim();
            if (value.length >= 2) {
                showCitySuggestions(inputId, value);
            }
        });
    });
}

function showCitySuggestions(inputId, query) {
    const input = document.getElementById(inputId);
    const suggestionsDiv = document.getElementById(`${inputId}-suggestions`) || 
                           createSuggestionsContainer(inputId, input);
    
    const filteredCities = RUSSIAN_CITIES.filter(city => 
        city.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);
    
    if (filteredCities.length === 0) {
        suggestionsDiv.style.display = 'none';
        return;
    }
    
    suggestionsDiv.innerHTML = filteredCities.map(city => 
        `<div class="suggestion-item" onclick="selectCity('${inputId}', '${city}')">
            <i class="fas fa-city"></i> ${city}
        </div>`
    ).join('');
    
    suggestionsDiv.style.display = 'block';
}

function createSuggestionsContainer(inputId, input) {
    const container = document.createElement('div');
    container.id = `${inputId}-suggestions`;
    container.className = 'suggestions-container';
    input.parentNode.appendChild(container);
    return container;
}

function selectCity(inputId, city) {
    const input = document.getElementById(inputId);
    input.value = city;
    hideSuggestions(inputId);
}

function hideSuggestions(inputId) {
    const suggestionsDiv = document.getElementById(`${inputId}-suggestions`);
    if (suggestionsDiv) {
        suggestionsDiv.style.display = 'none';
    }
}

function setupCityInputListeners() {
    const cityInputs = [
        { id: 'from-input', container: 'search-form' },
        { id: 'to-input', container: 'search-form' },
        { id: 'trip-from', container: 'trip-form' },
        { id: 'trip-to', container: 'trip-form' }
    ];
    
    cityInputs.forEach(({ id, container }) => {
        const input = document.getElementById(id);
        if (!input) return;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'city-input-wrapper';
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);
        
        const clearBtn = document.createElement('button');
        clearBtn.className = 'clear-city-btn';
        clearBtn.innerHTML = '<i class="fas fa-times"></i>';
        clearBtn.type = 'button';
        clearBtn.onclick = () => {
            input.value = '';
            clearBtn.style.display = 'none';
            hideAutocomplete(id);
            input.focus();
        };
        wrapper.appendChild(clearBtn);
        
        const autocompleteList = document.createElement('div');
        autocompleteList.className = 'autocomplete-list';
        autocompleteList.id = `${id}-autocomplete`;
        wrapper.appendChild(autocompleteList);
        
        input.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            clearBtn.style.display = value ? 'block' : 'none';
            
            if (value.length >= 2) {
                showCityAutocomplete(id, value);
            } else {
                hideAutocomplete(id);
            }
        });
        
        input.addEventListener('focus', (e) => {
            const value = e.target.value.trim();
            if (value.length >= 2) {
                showCityAutocomplete(id, value);
            }
        });
        
        input.addEventListener('blur', () => {
            setTimeout(() => hideAutocomplete(id), 200);
        });
        
        input.addEventListener('keydown', (e) => {
            const autocompleteList = document.getElementById(`${id}-autocomplete`);
            const items = autocompleteList?.querySelectorAll('.autocomplete-item');
            
            if (!autocompleteList || !items || items.length === 0) return;
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                focusNextItem(items, 0);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                focusNextItem(items, items.length - 1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const focused = autocompleteList.querySelector('.autocomplete-item.focused');
                if (focused) {
                    input.value = focused.dataset.city;
                    hideAutocomplete(id);
                    clearBtn.style.display = 'block';
                }
            } else if (e.key === 'Escape') {
                hideAutocomplete(id);
            }
        });
    });
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.city-input-wrapper')) {
            cityInputs.forEach(({ id }) => hideAutocomplete(id));
        }
    });
    
    setTimeout(() => {
        setupCityAutocomplete();
        console.log('City autocomplete initialized');
    }, 1000);
}

function focusNextItem(items, startIndex) {
    let focusedIndex = -1;
    
    items.forEach((item, index) => {
        if (item.classList.contains('focused')) {
            item.classList.remove('focused');
            focusedIndex = index;
        }
    });
    
    const nextIndex = focusedIndex >= 0 ? 
        (focusedIndex + 1) % items.length : startIndex;
    
    items[nextIndex].classList.add('focused');
    items[nextIndex].scrollIntoView({ block: 'nearest' });
}

function showCityAutocomplete(inputId, query) {
    const autocompleteList = document.getElementById(`${inputId}-autocomplete`);
    if (!autocompleteList) return;
    
    const filteredCities = RUSSIAN_CITIES.filter(city => 
        city.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 8);
    
    if (filteredCities.length === 0) {
        hideAutocomplete(inputId);
        return;
    }
    
    let html = '';
    filteredCities.forEach(city => {
        const highlighted = highlightMatch(city, query);
        html += `
            <div class="autocomplete-item" data-city="${city}">
                <i class="fas fa-city" style="margin-right: 8px; color: #666;"></i>
                ${highlighted}
            </div>
        `;
    });
    
    autocompleteList.innerHTML = html;
    autocompleteList.style.display = 'block';
    
    autocompleteList.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
            const input = document.getElementById(inputId);
            input.value = item.dataset.city;
            hideAutocomplete(inputId);
            
            const clearBtn = input.parentNode.querySelector('.clear-city-btn');
            if (clearBtn) clearBtn.style.display = 'block';
            
            if (inputId === 'from-input' || inputId === 'trip-from') {
                setTimeout(() => {
                    const nextInput = inputId === 'from-input' ? 
                        document.getElementById('to-input') : 
                        document.getElementById('trip-to');
                    if (nextInput) nextInput.focus();
                }, 100);
            }
        });
        
        item.addEventListener('mouseover', () => {
            item.classList.add('focused');
        });
        
        item.addEventListener('mouseout', () => {
            item.classList.remove('focused');
        });
    });
}

function highlightMatch(text, query) {
    if (!query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span class="autocomplete-highlight">$1</span>');
}

function hideAutocomplete(inputId) {
    const autocompleteList = document.getElementById(`${inputId}-autocomplete`);
    if (autocompleteList) {
        autocompleteList.style.display = 'none';
    }
}

// =============== УПРАВЛЕНИЕ ЭКРАНАМИ ===============

function showScreen(screenId) {
    console.log("🔄 Переключаемся на экран:", screenId);
    
    // Скрываем все экраны
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none';
    });
    
    // Показываем нужный экран
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.add('active');
        screen.style.display = 'block';
        currentScreen = screenId;
        
        // Обновляем навигацию
        updateNavButtons(screenId);
        
        // Управление кнопкой "Назад" в Telegram
        if (tg.BackButton) {
            if (screenId === 'welcome') {
                tg.BackButton.hide();
            } else {
                tg.BackButton.show();
                tg.BackButton.setText('Назад');
            }
        }
        
        // Загружаем данные для экрана
        switch(screenId) {
            case 'profile':
                console.log("🎯 Загружаем профиль...");
                loadProfile();
                break;
            case 'create-trip':
                console.log("🎯 Показываем форму создания поездки");
                break;
            case 'find-trip':
                console.log("🎯 Показываем поиск поездок");
                break;
        }
        
        console.log("✅ Экран переключен:", screenId);
    } else {
        console.error("❌ Экран не найден:", screenId);
    }
}

function updateNavButtons(activeScreen) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.screen === activeScreen) {
            btn.classList.add('active');
        }
    });
}

// =============== ПОИСК ПОЕЗДОК ===============
async function searchTrips() {
    if (!requireAuth('искать поездки')) return;
    
    const from = document.getElementById('from-input').value.trim();
    const to = document.getElementById('to-input').value.trim();
    const date = document.getElementById('date-input').value;
    const passengers = document.getElementById('passengers-input').value;
    
    if (!from || !to || !date) {
        showNotification('Заполните все поля поиска', 'warning');
        return;
    }
    
    try {
        const resultsEl = document.getElementById('search-results');
        resultsEl.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Ищем поездки...</p>
            </div>
        `;
        
        const response = await fetch(`${API_BASE_URL}/api/trips/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                from_city: from,
                to_city: to,
                date: date,
                passengers: parseInt(passengers)
            })
        });
        
        console.log('Search response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Search results:', data);
            
            if (data.success) {
                displaySearchResults(data.trips);
            } else {
                showNotification('Ошибка поиска', 'error');
                resultsEl.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Ошибка при поиске поездок</p>
                    </div>
                `;
            }
        } else {
            const errorText = await response.text();
            console.error('Search failed:', response.status, errorText);
            showNotification('Сервер недоступен', 'error');
            resultsEl.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-server"></i>
                    <p>Сервер недоступен. Проверьте подключение.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Ошибка поиска:', error);
        showNotification('Ошибка подключения к серверу', 'error');
        document.getElementById('search-results').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-wifi-slash"></i>
                <p>Ошибка сети. Проверьте подключение к интернету.</p>
            </div>
        `;
    }
}

function displaySearchResults(trips) {
    const resultsEl = document.getElementById('search-results');
    
    if (!trips || trips.length === 0) {
        resultsEl.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>Поездки не найдены</h3>
                <p>Попробуйте изменить параметры поиска</p>
                <button class="btn-secondary" onclick="clearSearchForm()">
                    <i class="fas fa-redo"></i> Очистить форму
                </button>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="search-header">
            <h3>Найдено поездок: ${trips.length}</h3>
            <button class="btn-small" onclick="clearSearchForm()">
                <i class="fas fa-times"></i> Очистить
            </button>
        </div>
    `;
    
    trips.forEach(trip => {
        const timeOnly = trip.departure?.datetime?.split(' ')[1] || trip.departure?.time || '--:--';
        
        html += `
            <div class="trip-card" onclick="showTripDetails(${trip.id})">
                <div class="trip-header">
                    <div class="driver-info">
                        <div class="driver-avatar">
                            ${trip.driver?.avatar_initials || '??'}
                        </div>
                        <div>
                            <div class="driver-name">${trip.driver?.name || 'Неизвестный водитель'}</div>
                            <div class="driver-rating">
                                ⭐ ${trip.driver?.rating?.toFixed(1) || '5.0'}
                            </div>
                        </div>
                    </div>
                    <div class="trip-price">
                        <span class="price">${trip.seats?.price_per_seat || 0} ₽</span>
                        <span class="per-seat">за место</span>
                    </div>
                </div>
                
                <div class="trip-route">
                    <div class="route-from">
                        <i class="fas fa-map-marker-alt" style="color: #e74c3c;"></i>
                        <span class="route-city">${trip.route?.from_city || trip.route?.from?.split(',')[0] || 'Не указано'}</span>
                    </div>
                    <div class="route-arrow">
                        <i class="fas fa-arrow-right"></i>
                    </div>
                    <div class="route-to">
                        <i class="fas fa-flag-checkered" style="color: #27ae60;"></i>
                        <span class="route-city">${trip.route?.to_city || trip.route?.to?.split(',')[0] || 'Не указано'}</span>
                    </div>
                </div>
                
                <div class="trip-details">
                    <div class="detail-item">
                        <i class="fas fa-calendar"></i>
                        <span>${trip.departure?.date || '--.--.----'}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-clock"></i>
                        <span>${timeOnly}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-user-friends"></i>
                        <span>${trip.seats?.available || 0} мест</span>
                    </div>
                </div>
                
                ${trip.car_info ? `
                    <div class="trip-car">
                        <i class="fas fa-car"></i>
                        <span>${trip.car_info.model || ''} ${trip.car_info.color ? `• ${trip.car_info.color}` : ''}</span>
                    </div>
                ` : ''}
                
                ${trip.details?.comment ? `
                    <div class="trip-comment">
                        <i class="fas fa-comment"></i>
                        <span>${trip.details.comment}</span>
                    </div>
                ` : ''}
                
                <div class="trip-actions">
                    <button class="btn-book" onclick="event.stopPropagation(); bookTrip(${trip.id})">
                        <i class="fas fa-check"></i> Забронировать
                    </button>
                    <button class="btn-details" onclick="event.stopPropagation(); showTripDetails(${trip.id})">
                        <i class="fas fa-info-circle"></i> Подробнее
                    </button>
                </div>
            </div>
        `;
    });
    
    resultsEl.innerHTML = html;
}

function clearSearchForm() {
    document.getElementById('from-input').value = '';
    document.getElementById('to-input').value = '';
    document.getElementById('date-input').value = new Date().toISOString().split('T')[0];
    document.getElementById('passengers-input').value = '1';
    
    document.querySelectorAll('.clear-city-btn').forEach(btn => {
        if (btn) btn.style.display = 'none';
    });
    
    const resultsEl = document.getElementById('search-results');
    if (resultsEl) {
        resultsEl.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>Начните поиск поездок</h3>
                <p>Заполните форму выше для поиска</p>
            </div>
        `;
    }
}

// =============== БРОНИРОВАНИЯ ===============
async function bookTrip(tripId) {
    if (!requireAuth('забронировать поездку')) return;
    
    try {
        const bookingData = {
            driver_trip_id: tripId,
            booked_seats: 1
        };
        
        const response = await fetch(
            `${API_BASE_URL}/api/bookings/create?telegram_id=${currentUser.telegram_id}`,
            {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(bookingData)
            }
        );
        
        console.log('Booking response:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                showNotification('✅ Место успешно забронировано!', 'success');
                closeModal();
            } else {
                showNotification(data.message || 'Ошибка бронирования', 'error');
            }
        } else {
            const errorText = await response.text();
            console.error('Booking error:', errorText);
            showNotification(`Ошибка бронирования: ${response.status}`, 'error');
        }
    } catch (error) {
        console.error('Ошибка бронирования:', error);
        showNotification('Ошибка подключения к серверу', 'error');
    }
}

// =============== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===============

function showCustomModal(content) {
    const modal = document.getElementById('modal');
    if (modal) {
        modal.innerHTML = content;
        modal.style.display = 'block';
    }
}

function closeModal() {
    const modal = document.getElementById('modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function loadStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/stats`);
        if (response.ok) {
            const stats = await response.json();
            const usersCount = document.getElementById('users-count');
            const tripsCount = document.getElementById('trips-count');
            
            if (usersCount) usersCount.textContent = stats.tables?.users || 0;
            if (tripsCount) tripsCount.textContent = stats.tables?.active_trips || 0;
        } else {
            console.error('Failed to load stats:', response.status);
            const usersCount = document.getElementById('users-count');
            const tripsCount = document.getElementById('trips-count');
            if (usersCount) usersCount.textContent = '0';
            if (tripsCount) tripsCount.textContent = '0';
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
        const usersCount = document.getElementById('users-count');
        const tripsCount = document.getElementById('trips-count');
        if (usersCount) usersCount.textContent = '0';
        if (tripsCount) tripsCount.textContent = '0';
    }
}

function showNotification(message, type = 'info') {
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

async function showTripDetails(tripId) {
    if (!requireAuth('просматривать детали поездки')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}`);
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.success) {
                const trip = data.trip;
                const modalContent = `
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>${trip.route.from} → ${trip.route.to}</h3>
                            <button class="close-btn" onclick="closeModal()">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="trip-detail">
                                <div class="detail-section">
                                    <h4><i class="fas fa-user"></i> Водитель</h4>
                                    <div class="detail-item">
                                        <span class="label">Имя:</span>
                                        <span class="value">${trip.driver.name}</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="label">Рейтинг:</span>
                                        <span class="value">⭐ ${trip.driver.rating.toFixed(1)}</span>
                                    </div>
                                </div>
                                
                                <div class="detail-section">
                                    <h4><i class="fas fa-route"></i> Маршрут</h4>
                                    <div class="detail-item">
                                        <span class="label">Откуда:</span>
                                        <span class="value">${trip.route.from}</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="label">Куда:</span>
                                        <span class="value">${trip.route.to}</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="label">Дата и время:</span>
                                        <span class="value">${trip.departure.datetime}</span>
                                    </div>
                                </div>
                                
                                <div class="detail-section">
                                    <h4><i class="fas fa-money-bill-wave"></i> Цена</h4>
                                    <div class="detail-item">
                                        <span class="label">Цена за место:</span>
                                        <span class="value">${trip.seats.price_per_seat} ₽</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="label">Свободных мест:</span>
                                        <span class="value">${trip.seats.available}</span>
                                    </div>
                                </div>
                                
                                <div class="modal-actions">
                                    <button class="btn-primary" onclick="bookTrip(${trip.id})">
                                        <i class="fas fa-check"></i>
                                        Забронировать место
                                    </button>
                                    <button class="btn-secondary" onclick="closeModal()">
                                        <i class="fas fa-times"></i>
                                        Закрыть
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                showCustomModal(modalContent);
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки деталей:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
}

// =============== ГЛОБАЛЬНЫЕ ФУНКЦИИ ===============
window.showScreen = showScreen;
window.searchTrips = searchTrips;
window.createTrip = createTrip;
window.bookTrip = bookTrip;
window.showTripDetails = showTripDetails;
window.clearSearchForm = clearSearchForm;
window.clearTripForm = clearTripForm;
window.closeModal = closeModal;
window.showAddCarModal = showAddCarModal;
window.setDefaultCar = setDefaultCar;
window.deleteCar = deleteCar;
window.saveCar = saveCar;
window.retryAuth = retryAuth;
window.initApp = initApp;
window.initTestUser = initTestUser;
window.selectCity = selectCity;