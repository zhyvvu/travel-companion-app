// app.js - ПОЛНАЯ РАБОЧАЯ ВЕРСИЯ
const tg = window.Telegram.WebApp;
const API_BASE_URL = "https://travel-api-n6r2.onrender.com";

let currentUser = null;
let authInProgress = false;
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

// =============== ИНИЦИАЛИЗАЦИЯ ===============

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 App starting...');
    
    try {
        // 1. Инициализируем Telegram
        await initTelegram();
        
        // 2. Настраиваем события
        setupEventListeners();
        
        // 3. Загружаем статистику
        await loadStats();
        
        // 4. Настраиваем автодополнение городов
        setupCityAutocomplete();
        
        // 5. Готово
        if (tg.ready) tg.ready();
        console.log('✅ App ready');
        
        // 6. Показываем главный экран
        showScreen('welcome');
        
    } catch (error) {
        console.error('❌ App error:', error);
        showNotification('Ошибка загрузки приложения', 'error');
    }
});

// Основная инициализация Telegram
async function initTelegram() {
    console.log('🔍 Инициализация Telegram...');
    
    // Проверяем данные Telegram
    const unsafeData = tg.initDataUnsafe;
    const initData = tg.initData;
    
    console.log('📱 InitDataUnsafe:', unsafeData);
    
    if (unsafeData?.user) {
        // Есть данные пользователя
        const user = unsafeData.user;
        console.log('✅ Telegram user found:', user);
        
        currentUser = {
            telegram_id: user.id,
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            username: user.username || '',
            language_code: user.language_code || 'ru',
            is_premium: user.is_premium || false
        };
        
        // Пробуем авторизоваться
        await tryAuth(user);
        
    } else if (initData) {
        // Пробуем распарсить initData
        console.log('🔍 Parsing initData...');
        try {
            const params = new URLSearchParams(initData);
            const userParam = params.get('user');
            if (userParam) {
                const user = JSON.parse(decodeURIComponent(userParam));
                console.log('✅ User from initData:', user);
                
                currentUser = {
                    telegram_id: user.id,
                    first_name: user.first_name || '',
                    last_name: user.last_name || '',
                    username: user.username || '',
                    language_code: user.language_code || 'ru',
                    is_premium: user.is_premium || false
                };
                
                await tryAuth(user);
            }
        } catch (e) {
            console.error('Parse error:', e);
        }
    }
    
    // Если пользователь не найден - тестовый режим
    if (!currentUser) {
        console.log('⚠️ No Telegram user, using test mode');
        currentUser = {
            telegram_id: 123456789,
            first_name: 'Тестовый',
            last_name: 'Пользователь',
            username: 'test_user',
            language_code: 'ru'
        };
        
        showNotification('🔧 Тестовый режим', 'info');
    }
    
    // Обновляем интерфейс
    updateUI();
}

// Авторизация - ИСПРАВЛЕННЫЙ ФОРМАТ
async function tryAuth(telegramUser) {
    if (authInProgress) return;
    authInProgress = true;
    
    console.log('🔐 Trying auth...');
    
    try {
        // ПРАВИЛЬНЫЙ ФОРМАТ ДЛЯ API
        const authData = {
            id: telegramUser.id,
            first_name: telegramUser.first_name || '',
            last_name: telegramUser.last_name || '',
            username: telegramUser.username || '',
            language_code: telegramUser.language_code || 'ru',
            is_premium: telegramUser.is_premium || false
        };
        
        console.log('📤 Sending auth data:', authData);
        
        const response = await fetch(`${API_BASE_URL}/api/auth/telegram`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(authData)
        });
        
        console.log('Auth status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Auth response:', data);
            
            if (data.success) {
                // Сохраняем данные пользователя
                currentUser = {
                    ...currentUser,
                    ...data.user,
                    token: data.token
                };
                
                localStorage.setItem('travel_user', JSON.stringify(currentUser));
                localStorage.setItem('last_auth_time', Date.now());
                
                // Загружаем автомобили пользователя
                await loadUserCars();
                
                showNotification('✅ Авторизация успешна', 'success');
                return true;
            } else {
                console.error('❌ Auth failed:', data.message);
                return false;
            }
        } else {
            const errorText = await response.text();
            console.error('❌ Auth HTTP error:', response.status, errorText);
            
            // Пробуем альтернативный формат
            return await tryAlternativeAuth(telegramUser);
        }
    } catch (error) {
        console.error('❌ Auth network error:', error);
        
        // Используем сохраненные данные
        const savedUser = localStorage.getItem('travel_user');
        const lastAuthTime = localStorage.getItem('last_auth_time');
        const hoursSinceLastAuth = lastAuthTime ? (Date.now() - lastAuthTime) / (1000 * 60 * 60) : 24;
        
        if (savedUser && hoursSinceLastAuth < 24) {
            currentUser = JSON.parse(savedUser);
            showNotification('⚠️ Используем сохраненные данные', 'warning');
            return true;
        }
        
        return false;
    } finally {
        authInProgress = false;
    }
}

// Альтернативный формат авторизации
async function tryAlternativeAuth(telegramUser) {
    console.log('🔄 Trying alternative auth format...');
    
    try {
        const authData = {
            user: telegramUser
        };
        
        const response = await fetch(`${API_BASE_URL}/api/auth/telegram`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(authData)
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Alternative auth success:', data);
            
            if (data.success) {
                currentUser = {
                    ...currentUser,
                    ...data.user,
                    token: data.token
                };
                
                localStorage.setItem('travel_user', JSON.stringify(currentUser));
                localStorage.setItem('last_auth_time', Date.now());
                
                await loadUserCars();
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('❌ Alternative auth error:', error);
        return false;
    }
}

// =============== ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ===============

function updateUI() {
    console.log('🎨 Updating UI, user:', currentUser);
    
    if (!currentUser) return;
    
    // Приветствие
    const welcomeTitle = document.getElementById('welcome-title');
    if (welcomeTitle) {
        welcomeTitle.textContent = `👋 Привет, ${currentUser.first_name || 'Друг'}!`;
    }
    
    // Инфо пользователя
    const userInfo = document.getElementById('user-info');
    if (userInfo) {
        userInfo.innerHTML = `
            <div class="user-avatar">
                ${(currentUser.first_name?.charAt(0) || '') + (currentUser.last_name?.charAt(0) || '') || 'U'}
            </div>
            <div class="user-name">${currentUser.first_name || 'Пользователь'}</div>
        `;
    }
}

// =============== УПРАВЛЕНИЕ ЭКРАНАМИ ===============

function showScreen(screenId) {
    console.log('🖥️ Showing screen:', screenId);
    
    // Скрываем все экраны
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none';
    });
    
    // Показываем выбранный
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.add('active');
        screen.style.display = 'block';
        window.currentScreen = screenId;
        
        // Обновляем активную кнопку навигации
        updateNavButtons(screenId);
        
        // Кнопка назад в Telegram
        if (tg && tg.BackButton) {
            if (screenId === 'welcome') {
                tg.BackButton.hide();
            } else {
                tg.BackButton.show();
            }
        }
        
        // Обработка специфичных экранов
        switch(screenId) {
            case 'profile':
                loadFullProfile();
                break;
            case 'create-trip':
                initCreateTripForm();
                break;
            case 'find-trip':
                initSearchForm();
                break;
        }
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

// =============== ПРОФИЛЬ ===============

async function loadFullProfile() {
    console.log('👤 Loading full profile...');
    
    if (!currentUser) {
        showNotification('Пожалуйста, авторизуйтесь', 'warning');
        showScreen('welcome');
        return;
    }
    
    const profileEl = document.getElementById('profile-data');
    if (!profileEl) {
        console.error('❌ No profile element');
        return;
    }
    
    // Показываем загрузку
    profileEl.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <h3>👤 Загружаем профиль...</h3>
            <div class="loader" style="margin: 20px auto;"></div>
            <p>Пользователь: ${currentUser.first_name}</p>
            <p>Telegram ID: ${currentUser.telegram_id}</p>
        </div>
    `;
    
    try {
        // Запрос к API
        const response = await fetch(
            `${API_BASE_URL}/api/users/profile-full?telegram_id=${currentUser.telegram_id}`,
            {
                headers: {
                    'Accept': 'application/json'
                }
            }
        );
        
        console.log('Profile API status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Profile data:', data);
            
            if (data.success) {
                displayFullProfile(data);
                showNotification('✅ Профиль загружен', 'success');
            } else {
                displayBasicProfile();
                showNotification('⚠️ Профиль не найден', 'warning');
            }
        } else if (response.status === 404) {
            // Пользователь не найден в базе
            displayBasicProfile();
        } else {
            const errorText = await response.text();
            console.error('HTTP error:', errorText);
            displayBasicProfile();
        }
    } catch (error) {
        console.error('❌ Network error:', error);
        displayBasicProfile();
        showNotification('⚠️ Ошибка загрузки профиля', 'error');
    }
}

function displayFullProfile(data) {
    const profileEl = document.getElementById('profile-data');
    if (!profileEl) return;
    
    const user = data.user || {};
    const cars = data.cars || [];
    const driverTrips = data.driver_trips || [];
    const passengerTrips = data.passenger_trips || [];
    
    // Определяем роль пользователя
    let userRole = 'Пассажир';
    if (user.role === 'driver') userRole = 'Водитель';
    if (user.role === 'both') userRole = 'Водитель и пассажир';
    if (driverTrips.length > 0 && passengerTrips.length === 0) userRole = 'Водитель';
    if (driverTrips.length === 0 && passengerTrips.length > 0) userRole = 'Пассажир';
    if (driverTrips.length > 0 && passengerTrips.length > 0) userRole = 'Водитель и пассажир';
    
    profileEl.innerHTML = `
        <div class="full-profile">
            <!-- Заголовок профиля -->
            <div class="profile-header">
                <div class="profile-avatar">
                    ${user.first_name?.charAt(0) || ''}${user.last_name?.charAt(0) || ''}
                </div>
                <div class="profile-name">${user.first_name || ''} ${user.last_name || ''}</div>
                <div class="profile-role">${userRole}</div>
                <div class="profile-stats">
                    <span><i class="fas fa-car"></i> ${driverTrips.length} поездок</span>
                    <span><i class="fas fa-user"></i> ${passengerTrips.length} бронирований</span>
                </div>
            </div>
            
            <!-- Статистика -->
            <div class="profile-section">
                <h3><i class="fas fa-chart-line"></i> Статистика</h3>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">${driverTrips.length}</div>
                        <div class="stat-label">Поездок как водитель</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${passengerTrips.length}</div>
                        <div class="stat-label">Поездок как пассажир</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${user.ratings?.driver?.toFixed(1) || '5.0'}</div>
                        <div class="stat-label">Рейтинг водителя</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${user.ratings?.passenger?.toFixed(1) || '5.0'}</div>
                        <div class="stat-label">Рейтинг пассажира</div>
                    </div>
                </div>
            </div>
            
            <!-- Автомобили -->
            <div class="profile-section">
                <div class="section-header">
                    <h3><i class="fas fa-car"></i> Мои автомобили (${cars.length})</h3>
                    <button class="btn-small" onclick="showAddCarModal()">
                        <i class="fas fa-plus"></i> Добавить
                    </button>
                </div>
                
                ${cars.length > 0 ? `
                    <div class="cars-list">
                        ${cars.map(car => `
                            <div class="car-card ${car.is_default ? 'default-car' : ''}">
                                <div class="car-header">
                                    <h4>${car.model} ${car.year ? `(${car.year})` : ''}</h4>
                                    ${car.is_default ? '<span class="default-badge">По умолчанию</span>' : ''}
                                </div>
                                <div class="car-details">
                                    ${car.color ? `<div><i class="fas fa-palette"></i> ${car.color}</div>` : ''}
                                    ${car.license_plate ? `<div><i class="fas fa-id-card"></i> ${car.license_plate}</div>` : ''}
                                    ${car.seats ? `<div><i class="fas fa-users"></i> ${car.seats} мест</div>` : ''}
                                </div>
                                <div class="car-actions">
                                    ${!car.is_default ? `
                                        <button class="btn-small" onclick="setDefaultCar(${car.id})">
                                            <i class="fas fa-star"></i> Сделать основным
                                        </button>
                                    ` : ''}
                                    <button class="btn-small btn-danger" onclick="deleteCar(${car.id})">
                                        <i class="fas fa-trash"></i> Удалить
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="empty-state">
                        <i class="fas fa-car"></i>
                        <p>У вас пока нет автомобилей</p>
                        <button class="btn-primary" onclick="showAddCarModal()">
                            <i class="fas fa-plus"></i> Добавить первый автомобиль
                        </button>
                    </div>
                `}
            </div>
            
            <!-- Поездки как водитель -->
            <div class="profile-section">
                <h3><i class="fas fa-road"></i> Мои поездки как водитель (${driverTrips.length})</h3>
                
                ${driverTrips.length > 0 ? `
                    <div class="trips-list">
                        ${driverTrips.map(trip => `
                            <div class="trip-item">
                                <div class="trip-route">
                                    <strong>${trip.from} → ${trip.to}</strong>
                                </div>
                                <div class="trip-info">
                                    <span><i class="fas fa-calendar"></i> ${trip.date}</span>
                                    <span><i class="fas fa-users"></i> ${trip.seats} мест</span>
                                    <span><i class="fas fa-money-bill-wave"></i> ${trip.price} ₽</span>
                                    <span class="status-badge status-${trip.status}">${trip.status}</span>
                                </div>
                                <div class="trip-passengers">
                                    <i class="fas fa-user-friends"></i> Пассажиров: ${trip.passengers_count}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="empty-state small">
                        <i class="fas fa-road"></i>
                        <p>У вас пока нет поездок как водитель</p>
                        <button class="btn-primary" onclick="showScreen('create-trip')">
                            <i class="fas fa-plus"></i> Создать первую поездку
                        </button>
                    </div>
                `}
            </div>
            
            <!-- Поездки как пассажир -->
            <div class="profile-section">
                <h3><i class="fas fa-user"></i> Мои поездки как пассажир (${passengerTrips.length})</h3>
                
                ${passengerTrips.length > 0 ? `
                    <div class="trips-list">
                        ${passengerTrips.map(trip => `
                            <div class="trip-item">
                                <div class="trip-route">
                                    <strong>${trip.from} → ${trip.to}</strong>
                                    <div class="trip-driver">
                                        <i class="fas fa-user"></i> ${trip.driver_name}
                                    </div>
                                </div>
                                <div class="trip-info">
                                    <span><i class="fas fa-calendar"></i> ${trip.date}</span>
                                    <span><i class="fas fa-users"></i> ${trip.seats} мест</span>
                                    <span><i class="fas fa-money-bill-wave"></i> ${trip.price} ₽</span>
                                    <span class="status-badge status-${trip.status}">${trip.status}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="empty-state small">
                        <i class="fas fa-user"></i>
                        <p>У вас пока нет поездок как пассажир</p>
                        <button class="btn-primary" onclick="showScreen('find-trip')">
                            <i class="fas fa-search"></i> Найти поездку
                        </button>
                    </div>
                `}
            </div>
        </div>
    `;
}

function displayBasicProfile() {
    const profileEl = document.getElementById('profile-data');
    if (!profileEl) return;
    
    profileEl.innerHTML = `
        <div class="profile-card" style="max-width: 600px; margin: 0 auto;">
            <div class="profile-header">
                <div class="profile-avatar">
                    ${currentUser.first_name.charAt(0)}${currentUser.last_name?.charAt(0) || ''}
                </div>
                <div class="profile-name">${currentUser.first_name} ${currentUser.last_name || ''}</div>
                <div class="profile-role">Новый пользователь</div>
            </div>
            
            <div style="padding: 20px; text-align: center;">
                <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4>👋 Добро пожаловать!</h4>
                    <p>Вы новый пользователь Travel Companion</p>
                    <p>Ваш ID: ${currentUser.telegram_id}</p>
                </div>
                
                <p>Начните с добавления автомобиля, чтобы создавать поездки:</p>
                
                <div style="margin-top: 30px;">
                    <button class="btn-primary" onclick="showAddCarModal()" style="margin: 10px; padding: 12px 24px;">
                        <i class="fas fa-plus"></i> Добавить первый автомобиль
                    </button>
                    <button class="btn-secondary" onclick="showScreen('create-trip')" style="margin: 10px; padding: 12px 24px;">
                        <i class="fas fa-plus-circle"></i> Создать первую поездку
                    </button>
                </div>
            </div>
        </div>
    `;
}

// =============== УПРАВЛЕНИЕ АВТОМОБИЛЯМИ ===============

async function loadUserCars() {
    if (!currentUser || !currentUser.telegram_id) return [];
    
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/users/cars?telegram_id=${currentUser.telegram_id}`,
            {
                headers: {
                    'Accept': 'application/json'
                }
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                userCars = data.cars || [];
                updateCarSelect();
                return userCars;
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

// ПОЛНАЯ ФУНКЦИЯ ДОБАВЛЕНИЯ АВТОМОБИЛЯ
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
    if (!currentUser) {
        showNotification('Пожалуйста, авторизуйтесь', 'warning');
        return;
    }
    
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
                await loadUserCars(); // Обновляем список авто
                loadFullProfile(); // Обновляем профиль
            } else {
                showNotification(data.message || 'Ошибка добавления авто', 'error');
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
    if (!currentUser || !confirm('Сделать этот автомобиль основным?')) return;
    
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
                await loadUserCars(); // Обновляем список
                loadFullProfile(); // Обновляем профиль
            }
        }
    } catch (error) {
        console.error('Ошибка установки авто по умолчанию:', error);
        showNotification('Ошибка обновления', 'error');
    }
}

async function deleteCar(carId) {
    if (!currentUser || !confirm('Удалить этот автомобиль?')) return;
    
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
                await loadUserCars(); // Обновляем список
                loadFullProfile(); // Обновляем профиль
            }
        }
    } catch (error) {
        console.error('Ошибка удаления авто:', error);
        showNotification('Ошибка удаления', 'error');
    }
}

// =============== СТАТИСТИКА ===============

async function loadStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/stats`);
        
        if (response.ok) {
            const stats = await response.json();
            const usersCount = document.getElementById('users-count');
            const tripsCount = document.getElementById('trips-count');
            
            if (usersCount) usersCount.textContent = stats.tables?.users || stats.users || 0;
            if (tripsCount) tripsCount.textContent = stats.tables?.active_trips || stats.trips || 0;
            
            console.log('📊 Stats loaded:', stats);
        } else {
            console.error('Failed to load stats:', response.status);
            setDefaultStats();
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
        setDefaultStats();
    }
}

function setDefaultStats() {
    const usersCount = document.getElementById('users-count');
    const tripsCount = document.getElementById('trips-count');
    
    if (usersCount) usersCount.textContent = '0';
    if (tripsCount) tripsCount.textContent = '0';
}

// =============== ФОРМЫ ===============

function initCreateTripForm() {
    // Устанавливаем сегодняшнюю дату по умолчанию
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('trip-date');
    if (dateInput) {
        dateInput.value = today;
        dateInput.min = today;
    }
    
    // Устанавливаем время по умолчанию (текущее + 2 часа)
    const now = new Date();
    now.setHours(now.getHours() + 2);
    const timeInput = document.getElementById('trip-time');
    if (timeInput) {
        timeInput.value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }
    
    // Обновляем выбор автомобиля
    updateCarSelect();
}

function initSearchForm() {
    // Устанавливаем сегодняшнюю дату по умолчанию
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('date-input');
    if (dateInput) {
        dateInput.value = today;
        dateInput.min = today;
    }
}

// =============== ОБРАБОТКА СОБЫТИЙ ===============

function setupEventListeners() {
    console.log('⚙️ Setting up events...');
    
    // Навигация
    document.querySelectorAll('[data-screen]').forEach(btn => {
        btn.addEventListener('click', function() {
            const screenId = this.dataset.screen;
            console.log('📱 Navigate to:', screenId);
            
            // Проверка авторизации для защищенных экранов
            if (['profile', 'create-trip', 'find-trip'].includes(screenId)) {
                if (!currentUser) {
                    showNotification('Пожалуйста, авторизуйтесь', 'warning');
                    return;
                }
            }
            
            showScreen(screenId);
        });
    });
    
    // Закрытие модалок
    document.querySelectorAll('.close-btn, .modal-close').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
    
    // Клик вне модального окна
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal();
        }
    });
    
    // Кнопка "Назад" в Telegram
    if (tg.BackButton) {
        tg.BackButton.onClick(() => {
            if (window.currentScreen !== 'welcome') {
                showScreen('welcome');
            } else {
                tg.close();
            }
        });
    }
    
    // Автодополнение городов (базовая настройка)
    setTimeout(() => {
        setupCityAutocomplete();
        console.log('City autocomplete initialized');
    }, 1000);
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

// =============== ГЛОБАЛЬНЫЕ ФУНКЦИИ ===============
window.showScreen = showScreen;
window.loadFullProfile = loadFullProfile;
window.showAddCarModal = showAddCarModal;
window.setDefaultCar = setDefaultCar;
window.deleteCar = deleteCar;
window.saveCar = saveCar;
window.closeModal = closeModal;