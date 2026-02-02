// app.js - ПОЛНАЯ РАБОЧАЯ ВЕРСИЯ (с функциями управления бронированиями и поездками)
const tg = window.Telegram.WebApp;
const API_BASE_URL = "https://travel-api-n6r2.onrender.com";

let currentUser = null;
let authInProgress = false;
let userCars = [];
// Глобальная переменная для отслеживания инициализации автодополнения
let autocompleteInitializedFlag = false;

// Список городов России для автодополнения
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
window.RUSSIAN_CITIES = RUSSIAN_CITIES; // Теперь доступна глобально

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
        
        // 4. Готово
        if (tg.ready) tg.ready();
        console.log('✅ App ready');
        
        // 5. Показываем главный экран
        showScreen('welcome');
        
    } catch (error) {
        console.error('❌ App error:', error);
        showNotification('Ошибка загрузки приложения', 'error');
    }
});


// Функция для совместимости
function selectCity(fieldId, city) {
    const input = document.getElementById(fieldId);
    if (input) input.value = city;
    const suggestions = document.getElementById(`${fieldId}-suggestions`);
    if (suggestions) suggestions.style.display = 'none';
}
window.selectCity = selectCity;

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

// Авторизация
async function tryAuth(telegramUser) {
    if (authInProgress) return;
    authInProgress = true;
    
    console.log('🔐 Trying auth...');
    
    try {
        // Первый формат
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
    
    // Сбрасываем флаг инициализации автодополнения при смене экрана
    if (typeof autocompleteInitialized !== 'undefined') {
        autocompleteInitializedFlag = false;
    }
    
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
                // Инициализируем автодополнение
                setTimeout(() => {
                    if (typeof setupCityAutocomplete === 'function') {
                        setupCityAutocomplete();
                    }
                }, 100);
                
                // Очищаем маршрут при входе на экран
                setTimeout(() => {
                    if (typeof TripRouteMap !== 'undefined') {
                        TripRouteMap.clearRoute();
                        // Скрываем карту
                        document.getElementById('route-map-container').style.display = 'none';
                    }
                }, 50);
                break;
                
            case 'find-trip':
                initSearchForm();
                // СБРАСЫВАЕМ ФЛАГ и инициализируем автодополнение с задержкой
                setTimeout(() => {
                    console.log('🚀 Инициализируем автодополнение для find-trip');
                    if (typeof setupCityAutocomplete === 'function') {
                        setupCityAutocomplete();
                    } else {
                        console.error('❌ Функция setupCityAutocomplete не найдена!');
                    }
                }, 150);
                break;
                
            case 'create-trip-map':
                // Для экрана с картой
                setTimeout(() => {
                    console.log('🗺️ Инициализация карты на экране create-trip-map');
                    
                    if (typeof YandexMapsModule !== 'undefined') {
                        YandexMapsModule.initMap().then(() => {
                            console.log('✅ Карта на create-trip-map инициализирована');
                            YandexMapsModule.setCurrentMode('start');
                            initCreateTripMapForm();
                        }).catch(err => {
                            console.error('❌ Ошибка инициализации карты:', err);
                            showNotification('Ошибка загрузки карты. Обновите страницу.', 'error');
                        });
                    } else {
                        console.error('❌ Модуль YandexMapsModule не найден!');
                        showNotification('Ошибка загрузки модуля карт', 'error');
                    }
                }, 150);
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


// В app.js, там где инициализируешь экран карты
async function openMapScreen() {
    console.log('🗺️ Инициализация карты на экране create-trip-map');
    
    // Ждем секунду или проверяем наличие модуля
    if (!window.YandexMapsModule) {
        console.error('❌ Модуль YandexMapsModule не найден! Пытаемся подождать...');
        // Небольшая задержка на случай медленной загрузки
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (window.YandexMapsModule) {
        try {
            await window.YandexMapsModule.initMap();
        } catch (err) {
            console.error('Ошибка инициализации карты:', err);
        }
    } else {
        showNotification('Критическая ошибка: модуль карт не загружен', 'error');
    }
}

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
                                    ${trip.passengers_count > 0 ? `
                                        <button class="btn-small" onclick="showTripBookings(${trip.id})" style="margin-left: 10px;">
                                            <i class="fas fa-eye"></i> Посмотреть
                                        </button>
                                    ` : ''}
                                </div>
                                ${trip.status === 'active' ? `
                                    <div class="trip-actions" style="margin-top: 10px; display: flex; gap: 10px;">
                                        <button class="btn-small" onclick="showUpdateTripModal(${trip.id})">
                                            <i class="fas fa-edit"></i> Редактировать
                                        </button>
                                        <button class="btn-small btn-danger" onclick="cancelTrip(${trip.id})">
                                            <i class="fas fa-ban"></i> Отменить
                                        </button>
                                    </div>
                                ` : ''}
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
                                ${trip.status === 'active' ? `
                                    <div class="trip-actions" style="margin-top: 10px; display: flex; gap: 10px;">
                                        <button class="btn-small" onclick="updateBooking(${trip.id})">
                                            <i class="fas fa-edit"></i> Изменить места
                                        </button>
                                        <button class="btn-small btn-danger" onclick="cancelBooking(${trip.id})">
                                            <i class="fas fa-ban"></i> Отменить
                                        </button>
                                    </div>
                                ` : ''}
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

function updateCarSelectForMap() {
    const carSelect = document.getElementById('car-model-map');
    
    if (!carSelect) return;
    
    // Очищаем текущие опции
    carSelect.innerHTML = '<option value="">Выберите автомобиль</option>';
    
    // Если есть автомобили пользователя
    if (userCars && userCars.length > 0) {
        userCars.forEach(car => {
            const option = document.createElement('option');
            option.value = car.id;
            option.textContent = `${car.model} ${car.color ? `(${car.color})` : ''} ${car.is_default ? '⭐' : ''}`;
            if (car.is_default) {
                option.selected = true;
            }
            carSelect.appendChild(option);
        });
    } else {
        // Если нет автомобилей, добавляем опцию для добавления
        const option = document.createElement('option');
        option.value = "add_new";
        option.textContent = "➕ Добавить автомобиль";
        carSelect.appendChild(option);
    }
    
    // Обработчик выбора
    carSelect.addEventListener('change', function() {
        if (this.value === "add_new") {
            showAddCarModal();
            this.value = "";
        }
    });
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
    console.log('🚗 Инициализация формы создания поездки...');
    
    // Устанавливаем сегодняшнюю дату
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const dateInput = document.getElementById('trip-date');
    if (dateInput) {
        dateInput.value = todayStr;
        dateInput.min = todayStr;
    }
    
    // Время по умолчанию (+2 часа от текущего)
    const timeInput = document.getElementById('trip-time');
    if (timeInput) {
        const now = new Date();
        now.setHours(now.getHours() + 2);
        timeInput.value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }
    
    // Обновляем выбор автомобиля
    updateCarSelect();
    
    // Простое автодополнение (только логирование)
    setTimeout(() => {
        console.log('🔍 Настройка автодополнения...');
        
        const fromInput = document.getElementById('trip-from');
        const toInput = document.getElementById('trip-to');
        
        if (fromInput && toInput) {
            // Просто добавляем подсказку при вводе
            fromInput.addEventListener('input', function() {
                const value = this.value;
                if (value.length >= 2 && window.RUSSIAN_CITIES) {
                    const matches = window.RUSSIAN_CITIES.filter(city => 
                        city.toLowerCase().includes(value.toLowerCase())
                    ).slice(0, 3);
                    
                    if (matches.length > 0 && matches[0].toLowerCase() === value.toLowerCase()) {
                        // Автозаполнение если точное совпадение
                        this.value = matches[0];
                        console.log(`✅ Автозаполнено: ${matches[0]}`);
                    }
                }
            });
            
            toInput.addEventListener('input', function() {
                const value = this.value;
                if (value.length >= 2 && window.RUSSIAN_CITIES) {
                    const matches = window.RUSSIAN_CITIES.filter(city => 
                        city.toLowerCase().includes(value.toLowerCase())
                    ).slice(0, 3);
                    
                    if (matches.length > 0 && matches[0].toLowerCase() === value.toLowerCase()) {
                        this.value = matches[0];
                        console.log(`✅ Автозаполнено: ${matches[0]}`);
                    }
                }
            });
            
            console.log('✅ Простое автодополнение настроено');
        }
    }, 100);
    
    console.log('✅ Форма создания поездки инициализирована');
}

// Если нужно, добавьте вспомогательную функцию для базового автодополнения
function showSimpleCitySuggestions(fieldId, query) {
    console.log(`🔍 Простой поиск городов для "${query}" в поле ${fieldId}`);
    
    if (!window.RUSSIAN_CITIES || !Array.isArray(window.RUSSIAN_CITIES)) {
        console.error('❌ Список городов не доступен');
        return;
    }
    
    const queryLower = query.toLowerCase();
    const results = window.RUSSIAN_CITIES.filter(city => 
        city.toLowerCase().includes(queryLower)
    ).slice(0, 5);
    
    console.log(`Найдено ${results.length} городов:`, results);
    
    if (results.length === 0) return;
    
    // Просто показываем подсказку в консоли для отладки
    console.log(`💡 Подсказка для ${fieldId}: ${results.join(', ')}`);
    
    // Или можно вывести alert для тестирования
    // if (results.length > 0 && confirm(`Выбрать "${results[0]}"?`)) {
    //     document.getElementById(fieldId).value = results[0];
    // }
}

// Функция обновления времени прибытия из формы
function updateArrivalTimeFromForm() {
    if (typeof TripRouteMap !== 'undefined') {
        // TripRouteMap сам обновит время в своём модуле
        console.log('🔄 Обновление времени прибытия...');
    }
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

// =============== СОЗДАНИЕ ПОЕЗДКИ ===============

async function createTrip() {
    if (!currentUser) {
        alert("Необходимо авторизоваться");
        return;
    }

    const fromCity = document.getElementById('from-input').value;
    const toCity = document.getElementById('to-input').value;
    const date = document.getElementById('departure-date').value;
    const time = document.getElementById('departure-time').value;
    const seats = document.getElementById('seats-input').value;
    const price = document.getElementById('price-input').value;
    const description = document.getElementById('description-input').value;

    if (!fromCity || !toCity || !date || !time || !price) {
        alert("Пожалуйста, заполните все обязательные поля");
        return;
    }

    const departureDateTime = new Date(`${date}T${time}`);
    const isoDeparture = departureDateTime.toISOString();

    // Безопасно получаем длительность из модуля карты
    let durationMinutes = 0;
    let routeData = null;

    if (window.TripRouteMap && typeof window.TripRouteMap.getRouteData === 'function') {
        routeData = window.TripRouteMap.getRouteData();
        if (routeData && routeData.duration) {
            durationMinutes = Math.round(routeData.duration);
        }
    }

    const tripData = {
        from_city: fromCity,
        to_city: toCity,
        departure_time: isoDeparture,
        route_duration: durationMinutes, // Теперь отправляем реальное время
        seats_available: parseInt(seats),
        price: parseFloat(price),
        description: description,
        route_data: routeData
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/trips?user_id=${currentUser.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tripData)
        });

        const result = await response.json();

        if (result.success) {
            alert("Поездка успешно создана!");
            showSection('search');
            // Очистка
            document.getElementById('from-input').value = '';
            document.getElementById('to-input').value = '';
            if (window.TripRouteMap) window.TripRouteMap.clearRoute();
        } else {
            alert("Ошибка при создании: " + (result.detail || "Неизвестная ошибка"));
        }
    } catch (error) {
        console.error("Ошибка сети:", error);
        alert("Ошибка при создании поездки.");
    }
}

/**
 * Очищает форму создания поездки
 */
function clearCreateTripForm() {
    // Очищаем поля
    document.getElementById('trip-from').value = '';
    document.getElementById('trip-to').value = '';
    document.getElementById('trip-price').value = '';
    document.getElementById('trip-comment').value = '';
    
    // Очищаем карту
    if (typeof TripRouteMap !== 'undefined') {
        TripRouteMap.clearRoute();
    }
    
    // Скрываем карту
    document.getElementById('route-map-container').style.display = 'none';
    
    // Скрываем время прибытия
    document.getElementById('arrival-time-container').style.display = 'none';
}

// =============== ПОИСК ПОЕЗДОК ===============

async function searchTrips() {
    console.log('🔍 Поиск поездок...');
    
    const from_city = document.getElementById('from-input').value.trim();
    const to_city = document.getElementById('to-input').value.trim();
    const date = document.getElementById('date-input').value;
    const passengers = parseInt(document.getElementById('passengers-input').value);
    
    if (!from_city || !to_city || !date) {
        showNotification('Заполните поля "Откуда", "Куда" и "Дата"', 'warning');
        return;
    }
    
    try {
        const searchData = {
            from_city: from_city,
            to_city: to_city,
            date: date,
            passengers: passengers
        };
        
        console.log('📤 Данные поиска:', searchData);
        
        const response = await fetch(`${API_BASE_URL}/api/trips/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(searchData)
        });
        
        const result = await response.json();
        console.log('Результаты поиска:', result);
        
        if (response.ok && result.success) {
            displaySearchResults(result.trips);
        } else {
            showNotification(result.detail || 'Ошибка поиска', 'error');
        }
    } catch (error) {
        console.error('❌ Ошибка поиска:', error);
        showNotification('Ошибка при поиске поездок', 'error');
    }
}

/**
 * Проверяет и обновляет статус поездки на основе estimated_arrival
 * @param {Object} trip - Объект поездки
 * @returns {Object} Обновлённая поездка
 */
function checkAndUpdateTripStatus(trip) {
    // Если есть время прибытия и поездка ещё активна
    if (trip.estimated_arrival && trip.status === 'active') {
        const now = new Date();
        const arrivalTime = new Date(trip.estimated_arrival);
        
        // Если время прибытия уже прошло
        if (now > arrivalTime) {
            console.log(`🔄 Автоматическое завершение поездки #${trip.id}`);
            
            // Меняем статус локально (только для отображения)
            return {
                ...trip,
                status: 'completed',
                display_status: 'completed' // Дополнительное поле для UI
            };
        }
    }
    
    return trip;
}

/**
 * Возвращает текст статуса для отображения
 */
function getStatusText(status) {
    const statusMap = {
        'active': 'Активна',
        'completed': 'Завершена',
        'cancelled': 'Отменена'
    };
    return statusMap[status] || status;
}

/**
 * Возвращает CSS класс для статуса
 */
function getStatusClass(status) {
    const classMap = {
        'active': 'status-active',
        'completed': 'status-completed',
        'cancelled': 'status-cancelled'
    };
    return classMap[status] || 'status-unknown';
}


function displaySearchResults(trips) {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;

    if (!trips || trips.length === 0) {
        showEmptyState(resultsContainer);
        return;
    }

    const now = new Date();

    // 1. Сначала фильтруем: убираем те, что уже уехали
    const futureTrips = trips.filter(trip => {
        const tripDate = new Date(trip.departure_time || trip.departure.datetime);
        return tripDate > now;
    });

    // 2. Если после фильтрации пусто — показываем пустой экран
    if (futureTrips.length === 0) {
        showEmptyState(resultsContainer);
        return;
    }

    // 3. Проверяем и обновляем статусы (твоя логика)
    const updatedTrips = futureTrips.map(checkAndUpdateTripStatus);

    // 4. Отрисовка
    resultsContainer.innerHTML = updatedTrips.map(trip => `
        <div class="trip-card" onclick="showTripDetails(${trip.id})">
            <div class="trip-header">
                <div class="driver-info">
                    <div class="driver-avatar">
                        ${(trip.driver && trip.driver.avatar_initials) ? trip.driver.avatar_initials : 'П'}
                    </div>
                    <div>
                        <div class="driver-name">${trip.driver ? trip.driver.name : 'Водитель'}</div>
                        <div class="driver-rating">
                            <i class="fas fa-star"></i> ${trip.driver ? trip.driver.rating.toFixed(1) : '5.0'}
                        </div>
                    </div>
                </div>
                <div class="trip-price">${trip.seats.price_per_seat} ₽</div>
            </div>
            
            <div class="trip-route">
                <i class="fas fa-map-marker-alt"></i>
                <span>${trip.route.from}</span>
                <i class="fas fa-arrow-right"></i>
                <i class="fas fa-flag-checkered"></i>
                <span>${trip.route.to}</span>
                
                <span class="trip-status ${getStatusClass(trip.status || 'active')}">
                    ${getStatusText(trip.status || 'active')}
                </span>
            </div>
            
            <div class="trip-details">
                <div><i class="fas fa-calendar"></i> ${trip.departure.datetime}</div>
                <div><i class="fas fa-users"></i> ${trip.seats.available} мест</div>
                ${trip.car_info ? `<div><i class="fas fa-car"></i> ${trip.car_info.model}</div>` : ''}
                
                ${trip.estimated_arrival ? `
                    <div><i class="fas fa-hourglass-end"></i> Прибытие: ${formatArrivalTime(trip.estimated_arrival)}</div>
                ` : ''}
            </div>
            
            <div class="trip-actions">
                ${(trip.status === 'active' || !trip.status) ? `
                    <button class="btn-book" onclick="event.stopPropagation(); bookTrip(${trip.id})">
                        <i class="fas fa-check"></i> Забронировать
                    </button>
                ` : ''}
                
                <button class="btn-details" onclick="event.stopPropagation(); showTripDetails(${trip.id})">
                    <i class="fas fa-info-circle"></i> Подробнее
                </button>
            </div>
        </div>
    `).join('');
}

// Вспомогательная функция, чтобы не дублировать код пустого состояния
function showEmptyState(container) {
    container.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-search"></i>
            <p>Актуальные поездки не найдены</p>
            <p>Попробуйте изменить параметры поиска или загляните позже</p>
        </div>
    `;
}

/**
 * Форматирует время прибытия
 */
function formatArrivalTime(isoString) {
    try {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '--:--';
    }
}

// =============== ПОКАЗАТЬ ДЕТАЛИ ПОЕЗДКИ ===============

async function showTripDetails(tripId) {
    console.log('📋 Показать детали поездки:', tripId);
    // TODO: Реализовать показ деталей
    showNotification('Функция в разработке', 'info');
}

// =============== БРОНИРОВАНИЕ ПОЕЗДКИ ===============
async function bookTrip(tripId) {
    console.log('🎫 Бронирование поездки:', tripId);
    
    if (!currentUser) {
        showNotification('Пожалуйста, авторизуйтесь', 'warning');
        return;
    }
    
    // 1. Спрашиваем количество мест
    const seats = parseInt(prompt('Сколько мест хотите забронировать?', '1'));
    if (!seats || seats < 1) return;
    
    try {
        const bookingData = {
            driver_trip_id: tripId,
            booked_seats: seats
        };
        
        // 2. Отправляем запрос на бэкенд
        const response = await fetch(
            `${API_BASE_URL}/api/bookings/create?telegram_id=${currentUser.telegram_id}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(bookingData)
            }
        );
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            // --- УСПЕХ: Порядок действий ---

            // а) Показываем уведомление
            showNotification('✅ Место успешно забронировано!', 'success');
            
            // б) ЗАКРЫВАЕМ МОДАЛЬНОЕ ОКНО
            const modal = document.getElementById('trip-details-modal');
            if (modal) {
                modal.classList.remove('active');
            }

            // в) ОБНОВЛЯЕМ ЦИФРЫ В СПИСКЕ (без перезагрузки страницы)
            if (typeof currentTrips !== 'undefined' && Array.isArray(currentTrips)) {
                const tripIndex = currentTrips.findIndex(t => t.id === tripId);
                
                if (tripIndex !== -1) {
                    // Используем данные от сервера для точности
                    if (result.remaining_seats !== undefined) {
                        currentTrips[tripIndex].seats.available = result.remaining_seats;
                    } else {
                        currentTrips[tripIndex].seats.available -= seats;
                    }

                    // Перерисовываем результаты поиска с новыми цифрами
                    displaySearchResults(currentTrips);
                }
            }

            // г) Обновляем профиль (если есть такая функция)
            if (typeof loadUserProfile === 'function') {
                loadUserProfile();
            }

        } else {
            // Если сервер вернул ошибку (например, "Мест больше нет")
            showNotification(result.detail || 'Ошибка бронирования', 'error');
        }
    } catch (error) {
        console.error('❌ Ошибка бронирования:', error);
        showNotification('Ошибка бронирования', 'error');
    }
}

// =============== ПРОСТОЕ И РАБОЧЕЕ АВТОДОПОЛНЕНИЕ ГОРОДОВ ===============

function setupCityAutocomplete() {
    console.log('=== НАЧАЛО setupCityAutocomplete ===');
    
    // 1. Проверка доступности данных
    if (!window.RUSSIAN_CITIES) {
        console.error('❌ RUSSIAN_CITIES не доступна глобально!');
        console.log('Добавьте в начало app.js: window.RUSSIAN_CITIES = RUSSIAN_CITIES;');
        return;
    }
    
    console.log('✅ Данные доступны:', window.RUSSIAN_CITIES.length, 'городов');
    
    // 2. Определяем какое поле настраивать
    const fieldMap = {
        'find-trip': 'from-input',
        'create-trip': 'trip-from'
    };
    
    const fieldId = fieldMap[window.currentScreen];
    
    if (!fieldId) {
        console.log('ℹ️ Этот экран не требует автодополнения:', window.currentScreen);
        return;
    }
    
    // 3. Находим поле
    const input = document.getElementById(fieldId);
    if (!input) {
        console.error(`❌ Поле ${fieldId} не найдено!`);
        return;
    }
    
    console.log(`✅ Поле найдено: ${fieldId}`);
    
    // 4. ПРОСТЕЙШИЙ обработчик - только логирование
    input.addEventListener('input', function(e) {
        const value = e.target.value;
        console.log(`Ввод: "${value}" в поле ${fieldId}`);
        
        if (value.length >= 2) {
            const results = window.RUSSIAN_CITIES.filter(city => 
                city.toLowerCase().includes(value.toLowerCase())
            );
            
            console.log(`Найдено ${results.length} городов. Первые 3:`, results.slice(0, 3));
        }
    });
    
    // 5. Автоматический тест
    setTimeout(() => {
        input.value = 'Мо';
        console.log(`🔄 Автотест: заполнено "Мо" в поле ${fieldId}`);
        
        // Триггерим событие ввода
        input.dispatchEvent(new Event('input'));
    }, 300);
    
    console.log('=== КОНЕЦ setupCityAutocomplete ===');
}

function handleCityInput(e) {
    const input = e.target;
    const value = input.value.trim();
    const fieldId = input.id;
    
    console.log(`📝 Ввод в ${fieldId}: "${value}"`);
    
    if (value.length >= 2) {
        showCitySuggestionsSimple(fieldId, value);
    } else {
        hideCitySuggestions(fieldId);
    }
}

function handleCityFocus(e) {
    const input = e.target;
    const value = input.value.trim();
    
    if (value.length >= 2) {
        showCitySuggestionsSimple(input.id, value);
    }
}

function showCitySuggestionsSimple(fieldId, query) {
    console.log(`🔍 Поиск городов для: "${query}"`);
    
    // Проверяем список городов
    if (!window.RUSSIAN_CITIES || !Array.isArray(window.RUSSIAN_CITIES)) {
        console.error('❌ Список городов RUSSIAN_CITIES не найден или не массив');
        return;
    }
    
    // Ищем совпадения
    const queryLower = query.toLowerCase();
    const results = window.RUSSIAN_CITIES.filter(city => 
        city.toLowerCase().includes(queryLower)
    ).slice(0, 5);
    
    console.log(`📊 Найдено ${results.length} городов:`, results);
    
    if (results.length === 0) {
        console.log('ℹ️ Города не найдены');
        return;
    }
    
    // Создаем или находим контейнер
    let container = document.getElementById(`${fieldId}-suggestions`);
    
    if (!container) {
        container = document.createElement('div');
        container.id = `${fieldId}-suggestions`;
        container.style.cssText = `
            position: absolute;
            background: white;
            border: 1px solid #ccc;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 10000;
            max-height: 200px;
            overflow-y: auto;
            width: 100%;
            margin-top: 2px;
            display: none;
        `;
        
        const input = document.getElementById(fieldId);
        if (input && input.parentNode) {
            input.parentNode.style.position = 'relative';
            input.parentNode.appendChild(container);
        }
    }
    
    // Заполняем контейнер
    container.innerHTML = results.map(city => `
        <div style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #eee;"
             onclick="selectCitySimple('${fieldId}', '${city.replace(/'/g, "\\'")}')"
             onmouseover="this.style.background='#f5f5f5'"
             onmouseout="this.style.background='white'">
            <span style="color: #666; margin-right: 8px;">📍</span>
            ${city}
        </div>
    `).join('');
    
    // Показываем
    container.style.display = 'block';
    
    // Скрываем при клике вне
    setTimeout(() => {
        const clickHandler = (e) => {
            if (!container.contains(e.target) && e.target.id !== fieldId) {
                container.style.display = 'none';
                document.removeEventListener('click', clickHandler);
            }
        };
        document.addEventListener('click', clickHandler);
    }, 10);
}

function hideCitySuggestions(fieldId) {
    const container = document.getElementById(`${fieldId}-suggestions`);
    if (container) {
        container.style.display = 'none';
    }
}

// Глобальная функция для выбора города
window.selectCitySimple = function(fieldId, city) {
    const input = document.getElementById(fieldId);
    if (input) {
        input.value = city;
        console.log(`✅ Выбран город: ${city}`);
    }
    hideCitySuggestions(fieldId);
};

// Тестовая функция
window.debugAutocomplete = function() {
    console.log('=== ДЕБАГ АВТОДОПОЛНЕНИЯ ===');
    console.log('1. Текущий экран:', window.currentScreen);
    console.log('2. RUSSIAN_CITIES:', window.RUSSIAN_CITIES ? `${window.RUSSIAN_CITIES.length} городов` : 'НЕТ');
    console.log('3. Первые 3 города:', window.RUSSIAN_CITIES?.slice(0, 3));
    
    // Проверяем поля
    const testFields = ['from-input', 'to-input', 'trip-from', 'trip-to'];
    testFields.forEach(id => {
        const el = document.getElementById(id);
        console.log(`${id}:`, el ? 'НАЙДЕНО' : 'НЕ НАЙДЕНО');
    });
    
    // Запускаем настройку
    if (typeof setupCityAutocomplete === 'function') {
        console.log('4. Запускаем setupCityAutocomplete()...');
        setupCityAutocomplete();
    }
};

// =============== УПРАВЛЕНИЕ БРОНИРОВАНИЯМИ ===============

async function updateBooking(bookingId) {
    console.log('✏️ Обновление бронирования:', bookingId);
    
    if (!currentUser) {
        showNotification('Пожалуйста, авторизуйтесь', 'warning');
        return;
    }
    
    const seats = parseInt(prompt('Введите новое количество мест:', '1'));
    if (!seats || seats < 1) return;
    
    try {
        const updateData = {
            booked_seats: seats
        };
        
        const response = await fetch(
            `${API_BASE_URL}/api/bookings/${bookingId}?telegram_id=${currentUser.telegram_id}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            }
        );
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showNotification('✅ Бронирование обновлено!', 'success');
            // Обновляем профиль
            loadFullProfile();
        } else {
            showNotification(result.detail || 'Ошибка обновления', 'error');
        }
    } catch (error) {
        console.error('❌ Ошибка обновления бронирования:', error);
        showNotification('Ошибка обновления', 'error');
    }
}

async function cancelBooking(bookingId) {
    console.log('❌ Отмена бронирования:', bookingId);
    
    if (!currentUser || !confirm('Вы уверены, что хотите отменить бронирование?')) {
        return;
    }
    
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/bookings/${bookingId}/cancel?telegram_id=${currentUser.telegram_id}`,
            {
                method: 'POST'
            }
        );
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showNotification('✅ Бронирование отменено!', 'success');
            // Обновляем профиль
            loadFullProfile();
        } else {
            showNotification(result.detail || 'Ошибка отмены', 'error');
        }
    } catch (error) {
        console.error('❌ Ошибка отмены бронирования:', error);
        showNotification('Ошибка отмены', 'error');
    }
}

// =============== УПРАВЛЕНИЕ ПОЕЗДКАМИ (ВОДИТЕЛЬ) ===============

async function showUpdateTripModal(tripId) {
    console.log('✏️ Редактирование поездки:', tripId);
    
    try {
        // Получаем данные поездки
        const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}`);
        const result = await response.json();
        
        if (!response.ok || !result.success) {
            showNotification('Не удалось загрузить данные поездки', 'error');
            return;
        }
        
        const trip = result.trip;
        
        // Создаем модальное окно для редактирования
        const modalContent = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-edit"></i> Редактировать поездку</h3>
                    <button class="close-btn" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="update-trip-form" onsubmit="event.preventDefault(); updateTrip(${tripId})">
                        <div class="form-section">
                            <h4><i class="fas fa-route"></i> Маршрут</h4>
                            <div class="input-group">
                                <i class="fas fa-map-marker-alt"></i>
                                <input type="text" id="edit-trip-from" value="${trip.route.from}" placeholder="Откуда">
                            </div>
                            <div class="input-group">
                                <i class="fas fa-flag-checkered"></i>
                                <input type="text" id="edit-trip-to" value="${trip.route.to}" placeholder="Куда">
                            </div>
                        </div>
                        
                        <div class="form-section">
                            <h4><i class="fas fa-clock"></i> Дата и время</h4>
                            <div class="input-row">
                                <div class="input-group half">
                                    <i class="fas fa-calendar"></i>
                                    <input type="date" id="edit-trip-date" 
                                           value="${trip.departure.date}"
                                           min="${new Date().toISOString().split('T')[0]}">
                                </div>
                                <div class="input-group half">
                                    <i class="fas fa-clock"></i>
                                    <input type="time" id="edit-trip-time" value="${trip.departure.time}">
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-section">
                            <h4><i class="fas fa-car"></i> Детали поездки</h4>
                            <div class="input-row">
                                <div class="input-group half">
                                    <i class="fas fa-users"></i>
                                    <input type="number" id="edit-trip-seats" 
                                           value="${trip.seats.available}"
                                           min="1" max="10" placeholder="Количество мест">
                                </div>
                                <div class="input-group half">
                                    <i class="fas fa-money-bill-wave"></i>
                                    <input type="number" id="edit-trip-price" 
                                           value="${trip.seats.price_per_seat}"
                                           step="50" placeholder="Цена за место">
                                </div>
                            </div>
                            <div class="input-group">
                                <i class="fas fa-comment-alt"></i>
                                <input type="text" id="edit-trip-comment" 
                                       value="${trip.details.comment || ''}" 
                                       placeholder="Комментарий">
                            </div>
                        </div>
                        
                        <div class="modal-actions">
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save"></i> Сохранить изменения
                            </button>
                            <button type="button" class="btn-secondary" onclick="closeModal()">
                                <i class="fas fa-times"></i> Отмена
                            </button>
                            <button type="button" class="btn-danger" onclick="cancelTrip(${tripId})" style="margin-top: 10px;">
                                <i class="fas fa-ban"></i> Отменить поездку
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        showCustomModal(modalContent);
        
        // Инициализируем автодополнение для полей ввода городов
        setTimeout(() => {
            setupEditFormAutocomplete();
        }, 100);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки данных поездки:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
}

function setupEditFormAutocomplete() {
    const fromInput = document.getElementById('edit-trip-from');
    const toInput = document.getElementById('edit-trip-to');
    
    if (fromInput) {
        fromInput.addEventListener('input', function(e) {
            const value = e.target.value.trim();
            if (value.length >= 2) {
                showCitySuggestions('edit-trip-from', value);
            } else {
                hideSuggestions('edit-trip-from');
            }
        });
    }
    
    if (toInput) {
        toInput.addEventListener('input', function(e) {
            const value = e.target.value.trim();
            if (value.length >= 2) {
                showCitySuggestions('edit-trip-to', value);
            } else {
                hideSuggestions('edit-trip-to');
            }
        });
    }
}

async function updateTrip(tripId) {
    console.log('💾 Сохранение изменений поездки:', tripId);
    
    if (!currentUser) {
        showNotification('Пожалуйста, авторизуйтесь', 'warning');
        return;
    }
    
    // Собираем данные из формы
    const start_address = document.getElementById('edit-trip-from').value.trim();
    const finish_address = document.getElementById('edit-trip-to').value.trim();
    const dateStr = document.getElementById('edit-trip-date').value;
    const departure_time = document.getElementById('edit-trip-time').value;
    const available_seats = parseInt(document.getElementById('edit-trip-seats').value);
    const price_per_seat = parseFloat(document.getElementById('edit-trip-price').value);
    const comment = document.getElementById('edit-trip-comment').value.trim();
    
    // Валидация
    if (!start_address || !finish_address || !dateStr || !departure_time || !available_seats || !price_per_seat) {
        showNotification('Заполните все обязательные поля', 'warning');
        return;
    }
    
    // Преобразуем дату
    const departure_date = new Date(dateStr + 'T' + departure_time);
    
    try {
        const updateData = {
            start_address: start_address,
            finish_address: finish_address,
            departure_date: departure_date.toISOString(),
            departure_time: departure_time,
            available_seats: available_seats,
            price_per_seat: price_per_seat
        };
        
        if (comment) {
            updateData.comment = comment;
        }
        
        console.log('📤 Отправка обновления поездки:', updateData);
        
        const response = await fetch(
            `${API_BASE_URL}/api/trips/${tripId}?telegram_id=${currentUser.telegram_id}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            }
        );
        
        const result = await response.json();
        console.log('Ответ обновления поездки:', result);
        
        if (response.ok && result.success) {
            showNotification('✅ Поездка успешно обновлена!', 'success');
            closeModal();
            // Обновляем профиль
            loadFullProfile();
        } else {
            showNotification(result.detail || 'Ошибка обновления', 'error');
        }
    } catch (error) {
        console.error('❌ Ошибка обновления поездки:', error);
        showNotification('Ошибка обновления', 'error');
    }
}

async function cancelTrip(tripId) {
    console.log('❌ Отмена поездки:', tripId);
    
    if (!currentUser || !confirm('Вы уверены, что хотите отменить поездку? Все бронирования также будут отменены.')) {
        return;
    }
    
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/trips/${tripId}/cancel?telegram_id=${currentUser.telegram_id}`,
            {
                method: 'POST',
                headers: { 'Accept': 'application/json' }
            }
        );
        
        if (response.ok) {
            const result = await response.json();
            showNotification(`✅ Поездка отменена! Отменено бронирований: ${result.cancelled_bookings || 0}`, 'success');
            
            // Обновляем профиль
            loadFullProfile();
        } else {
            const errorText = await response.text();
            showNotification('Ошибка отмены поездки: ' + errorText, 'error');
        }
    } catch (error) {
        console.error('❌ Ошибка отмены поездки:', error);
        showNotification('Ошибка отмены', 'error');
    }
}

async function showTripBookings(tripId) {
    console.log('📋 Просмотр бронирований поездки:', tripId);
    
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/trips/${tripId}/bookings?telegram_id=${currentUser.telegram_id}`
        );
        
        const result = await response.json();
        
        if (!response.ok || !result.success) {
            showNotification('Не удалось загрузить бронирования', 'error');
            return;
        }
        
        const bookings = result.bookings || [];
        
        const modalContent = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-users"></i> Бронирования поездки</h3>
                    <button class="close-btn" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: 20px; color: #666; font-size: 14px;">
                        Всего бронирований: ${bookings.length}
                    </div>
                    
                    ${bookings.length > 0 ? `
                        <div class="bookings-list">
                            ${bookings.map(booking => `
                                <div class="booking-item" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #3498db;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                        <div style="font-weight: bold;">
                                            <i class="fas fa-user"></i> ${booking.passenger.name}
                                        </div>
                                        <span class="status-badge status-${booking.status}" style="padding: 3px 8px; border-radius: 12px; font-size: 12px;">
                                            ${booking.status}
                                        </span>
                                    </div>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 14px;">
                                        <div><i class="fas fa-chair"></i> Мест: ${booking.seats}</div>
                                        <div><i class="fas fa-money-bill-wave"></i> ${booking.price} ₽</div>
                                        ${booking.passenger.phone ? `<div><i class="fas fa-phone"></i> ${booking.passenger.phone}</div>` : ''}
                                        <div><i class="fas fa-star"></i> Рейтинг: ${booking.passenger.rating.toFixed(1)}</div>
                                    </div>
                                    ${booking.notes ? `
                                        <div style="margin-top: 10px; padding: 8px; background: #fff8e1; border-radius: 6px; font-size: 13px;">
                                            <i class="fas fa-comment"></i> ${booking.notes}
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="empty-state">
                            <i class="fas fa-users"></i>
                            <p>Пока нет бронирований</p>
                        </div>
                    `}
                    
                    <div class="modal-actions" style="margin-top: 20px;">
                        <button class="btn-secondary" onclick="closeModal()">
                            <i class="fas fa-times"></i> Закрыть
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        showCustomModal(modalContent);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки бронирований:', error);
        showNotification('Ошибка загрузки данных', 'error');
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
    
    // Кнопка поиска поездок
    const searchBtn = document.querySelector('.search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', searchTrips);
    }
    
    // Кнопка создания поездки
    const submitBtn = document.querySelector('.submit-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', createTrip);
    }
    
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

// Показать новую форму с картой
function showCreateTripWithMap() {
    if (!currentUser) {
        showNotification('Пожалуйста, авторизуйтесь', 'warning');
        return;
    }
    
    console.log('🗺️ Переход на экран с картой...');
    // ПРОСТО переходим на экран - карта инициализируется в showScreen()
    showScreen('create-trip-map');
}

// Инициализация формы с картой
function initCreateTripMapForm() {
    // Устанавливаем сегодняшнюю дату по умолчанию
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const dateInput = document.getElementById('trip-date-map');
    if (dateInput) {
        dateInput.value = todayStr;
        dateInput.min = todayStr;
    }
    
    // Время по умолчанию
    const timeInput = document.getElementById('trip-time-map');
    if (timeInput && !timeInput.value) {
        const now = new Date();
        now.setHours(now.getHours() + 2);
        timeInput.value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }
    
    // Обновляем выбор автомобиля
    updateCarSelectForMap();
    
    // Показываем подсказку по использованию карты
    console.log('✅ Форма с картой инициализирована');
    
    // Если карта не загрузилась, показываем инструкцию
    setTimeout(() => {
        if (!window.YandexMapsModule || !window.YandexMapsModule.isMapInitialized()) {
            showNotification('Карта загружается... Если не появится, обновите страницу', 'info');
        }
    }, 2000);
}

// Создать поездку с данными карты
async function createTripWithMap() {
    if (!window.YandexMapsModule || !window.YandexMapsModule.isMapInitialized()) {
        tg.showAlert("Ошибка: Карта не инициализирована");
        return;
    }

    const routeData = window.YandexMapsModule.getRouteData();
    if (!routeData.start_point || !routeData.finish_point) {
        tg.showAlert("Пожалуйста, выберите начальную и конечную точки на карте");
        return;
    }

    const date = document.getElementById('trip-date-map').value;
    const time = document.getElementById('trip-time-map').value;
    const seats = document.getElementById('seats-count-map').value;
    const price = document.getElementById('trip-price-map').value;
    const comment = document.getElementById('trip-comment-map').value;

    if (!date || !time || !price) {
        tg.showAlert("Заполните дату, время и стоимость");
        return;
    }

    const tripData = {
        from_location: routeData.start_point.address,
        to_location: routeData.finish_point.address,
        start_lat: routeData.start_point.lat,
        start_lng: routeData.start_point.lng,
        finish_lat: routeData.finish_point.lat,
        finish_lng: routeData.finish_point.lng,
        departure_date: date,
        departure_time: time,
        total_seats: parseInt(seats),
        price_per_seat: parseFloat(price),
        comment: comment,
        distance_km: routeData.distance,
        duration_min: routeData.duration
    };

    try {
        // Исправлен URL на /api/trips/create в соответствии с main.py
        const response = await fetch(`${API_BASE_URL}/api/trips/create?user_id=${currentUser.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tripData)
        });

        const result = await response.json();
        if (result.success) {
            tg.showAlert("Поездка успешно создана!");
            showScreen('welcome');
            loadStats(); 
        } else {
            tg.showAlert("Ошибка: " + (result.detail || result.message));
        }
    } catch (error) {
        console.error("Ошибка при создании поездки:", error);
        tg.showAlert("Не удалось отправить данные на сервер");
    }
}

// Вернуться к обычной форме создания
function goBackToCreateForm() {
    showScreen('create-trip');
}

// =============== ГЛОБАЛЬНЫЕ ФУНКЦИИ ===============

window.showScreen = showScreen;
window.loadFullProfile = loadFullProfile;
window.showAddCarModal = showAddCarModal;
window.setDefaultCar = setDefaultCar;
window.deleteCar = deleteCar;
window.saveCar = saveCar;
window.closeModal = closeModal;
window.selectCity = selectCity;
window.updateBooking = updateBooking;
window.cancelBooking = cancelBooking;
window.showUpdateTripModal = showUpdateTripModal;
window.updateTrip = updateTrip;
window.cancelTrip = cancelTrip;
window.showTripBookings = showTripBookings;
window.createTrip = createTrip;
window.searchTrips = searchTrips;
window.bookTrip = bookTrip;
window.showTripDetails = showTripDetails;

// =============== ТЕСТОВЫЕ ФУНКЦИИ ===============

window.testCityAutocomplete = function() {
    console.log('=== ТЕСТ АВТОДОПОЛНЕНИЯ ГОРОДОВ ===');
    
    // 1. Проверка базовых данных
    console.log('1. Данные доступны?');
    console.log('   - RUSSIAN_CITIES:', window.RUSSIAN_CITIES ? '✓ ' + window.RUSSIAN_CITIES.length + ' городов' : '✗ НЕТ');
    console.log('   - setupCityAutocomplete:', typeof setupCityAutocomplete === 'function' ? '✓ Есть' : '✗ НЕТ');
    
    // 2. Проверка полей на текущем экране
    console.log('2. Текущий экран:', window.currentScreen);
    
    const fieldsToCheck = window.currentScreen === 'find-trip' 
        ? ['from-input', 'to-input'] 
        : window.currentScreen === 'create-trip' 
            ? ['trip-from', 'trip-to'] 
            : [];
    
    console.log('3. Проверяемые поля:', fieldsToCheck);
    
    fieldsToCheck.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            console.log(`   ${id}: ✓ НАЙДЕНО`, {
                visible: el.offsetParent !== null,
                value: el.value,
                hasEvents: el._autocompleteHandler ? '✓ Да' : '✗ Нет'
            });
            
            // Тестируем ввод
            el.value = 'Мо';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            console.log(`   ${id}: Введено "Мо"`);
        } else {
            console.log(`   ${id}: ✗ НЕ НАЙДЕНО`);
        }
    });
    
    // 3. Запускаем настройку
    if (typeof setupCityAutocomplete === 'function') {
        console.log('4. Запускаем setupCityAutocomplete()...');
        const count = setupCityAutocomplete();
        console.log('5. Настроено полей:', count);
    }
    
    console.log('=== ТЕСТ ЗАВЕРШЕН ===');
};

window.debugApp = function() {
    console.log('=== ДЕБАГ ПРИЛОЖЕНИЯ ===');
    console.log('1. window.RUSSIAN_CITIES:', window.RUSSIAN_CITIES ? `${window.RUSSIAN_CITIES.length} городов` : 'НЕТ');
    console.log('2. window.currentScreen:', window.currentScreen);
    console.log('3. window.autocompleteInitialized:', window.autocompleteInitialized);
    console.log('4. Поля на экране:');
    
    const fields = ['from-input', 'to-input', 'trip-from', 'trip-to'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        console.log(`   ${id}:`, el ? `✓ "${el.value}"` : '✗ НЕТ');
    });
    
    // Тест поиска
    if (window.RUSSIAN_CITIES) {
        const testQuery = 'Мо';
        const results = window.RUSSIAN_CITIES.filter(city => 
            city.toLowerCase().includes(testQuery.toLowerCase())
        ).slice(0, 3);
        console.log(`5. Тест поиска "${testQuery}":`, results);
    }
};

// =============== ФУНКЦИИ ДЛЯ ФОРМЫ СОЗДАНИЯ ПОЕЗДКИ ===============

/**
 * Поменять местами поля "Откуда" и "Куда"
 */
function swapRoutePoints() {
    console.log('🔄 Меняем местами пункты маршрута');
    
    const fromField = document.getElementById('trip-from');
    const toField = document.getElementById('trip-to');
    
    if (!fromField || !toField) {
        console.error('❌ Не найдены поля маршрута');
        showNotification('Ошибка: поля маршрута не найдены', 'error');
        return;
    }
    
    // Меняем значения
    const temp = fromField.value;
    fromField.value = toField.value;
    toField.value = temp;
    
    console.log(`✅ Поменяли местами: "${temp}" ↔ "${fromField.value}"`);
    showNotification('Пункты маршрута поменяны местами', 'success');
    
    // Если есть данные на карте - обновляем их
    if (typeof TripRouteMap !== 'undefined') {
        const routeData = TripRouteMap.getRouteData();
        if (routeData && routeData.start_point && routeData.finish_point) {
            // Меняем точки местами
            const tempPoint = routeData.start_point;
            routeData.start_point = routeData.finish_point;
            routeData.finish_point = tempPoint;
            
            // Обновляем отображение
            TripRouteMap.updateRouteInfo?.();
            console.log('🗺️ Данные маршрута на карте обновлены');
        }
    }
}

/**
 * Показать маршрут на карте
 */
function showRouteOnMap() {
    console.log('🗺️ Показываем маршрут на карте...');
    
    const fromAddress = document.getElementById('trip-from')?.value.trim();
    const toAddress = document.getElementById('trip-to')?.value.trim();
    
    // Проверяем заполнены ли поля
    if (!fromAddress || !toAddress) {
        showNotification('Заполните оба поля: "Откуда" и "Куда"', 'warning');
        return;
    }
    
    // Показываем контейнер карты
    const mapContainer = document.getElementById('route-map-container');
    if (mapContainer) {
        mapContainer.style.display = 'block';
    }
    
    // Если модуль карт не загружен
    if (typeof TripRouteMap === 'undefined') {
        console.error('❌ Модуль TripRouteMap не загружен');
        showNotification('Карта не загружена. Обновите страницу.', 'error');
        return;
    }
    
    // Инициализируем карту если нужно
    if (typeof TripRouteMap.init === 'function') {
        TripRouteMap.init().then(() => {
            console.log('✅ Карта инициализирована, ищем адреса...');
            
            // Ищем первый адрес
            TripRouteMap.searchAndSetPoint(fromAddress, 'start');
            
            // Ищем второй адрес с задержкой
            setTimeout(() => {
                TripRouteMap.searchAndSetPoint(toAddress, 'finish');
                showNotification('Маршрут построен на карте', 'success');
            }, 1000);
            
        }).catch(err => {
            console.error('❌ Ошибка инициализации карты:', err);
            showNotification('Ошибка загрузки карты', 'error');
        });
    } else {
        // Карта уже инициализирована
        TripRouteMap.searchAndSetPoint(fromAddress, 'start');
        
        setTimeout(() => {
            TripRouteMap.searchAndSetPoint(toAddress, 'finish');
            showNotification('Маршрут построен на карте', 'success');
        }, 1000);
    }
}

/**
 * Скрыть карту
 */
function hideRouteMap() {
    console.log('👁️ Скрываем карту');
    
    const container = document.getElementById('route-map-container');
    if (container) {
        container.style.display = 'none';
        showNotification('Карта скрыта', 'info');
    }
}

/**
 * Обновить время прибытия на основе данных маршрута
 */
function updateArrivalTimeFromMap() {
    const dateInput = document.getElementById('trip-date');
    const timeInput = document.getElementById('trip-time');
    
    if (!dateInput?.value || !timeInput?.value) {
        return;
    }
    
    if (typeof TripRouteMap === 'undefined') {
        return;
    }
    
    const routeData = TripRouteMap.getRouteData();
    if (!routeData?.duration) {
        return;
    }
    
    try {
        // Время отправления
        const departureTime = new Date(dateInput.value + 'T' + timeInput.value);
        
        // Добавляем время в пути (минуты → миллисекунды)
        const arrivalTime = new Date(departureTime.getTime() + (routeData.duration * 60000));
        
        // Форматируем время
        const hours = arrivalTime.getHours().toString().padStart(2, '0');
        const minutes = arrivalTime.getMinutes().toString().padStart(2, '0');
        
        // Обновляем UI
        const arrivalTimeEl = document.getElementById('arrival-time');
        const container = document.getElementById('arrival-time-container');
        
        if (arrivalTimeEl) arrivalTimeEl.textContent = `${hours}:${minutes}`;
        if (container) container.style.display = 'block';
        
        console.log('⏰ Расчётное время прибытия:', `${hours}:${minutes}`);
        
    } catch (error) {
        console.error('❌ Ошибка расчёта времени прибытия:', error);
    }
}

/**
 * Инициализирует автодополнение для полей адресов
 */
function initAddressAutocomplete() {
    console.log('🔍 Инициализация автодополнения адресов...');
    
    const fromInput = document.getElementById('trip-from');
    const toInput = document.getElementById('trip-to');
    
    if (!fromInput || !toInput) {
        console.error('❌ Поля адресов не найдены');
        return;
    }
    
    // Проверяем список городов
    if (!window.RUSSIAN_CITIES || !Array.isArray(window.RUSSIAN_CITIES)) {
        console.error('❌ Список городов RUSSIAN_CITIES не загружен');
        return;
    }
    
    console.log(`✅ Список городов доступен: ${window.RUSSIAN_CITIES.length} городов`);
    
    // Простые обработчики для отладки
    fromInput.addEventListener('input', function(e) {
        const value = e.target.value;
        console.log(`Ввод в "Откуда": "${value}"`);
        
        // Просто логируем, без реальных подсказок
        if (value.length >= 2) {
            const results = window.RUSSIAN_CITIES.filter(city => 
                city.toLowerCase().includes(value.toLowerCase())
            ).slice(0, 3);
            
            if (results.length > 0) {
                console.log(`💡 Подсказки для "Откуда": ${results.join(', ')}`);
            }
        }
    });
    
    toInput.addEventListener('input', function(e) {
        const value = e.target.value;
        console.log(`Ввод в "Куда": "${value}"`);
        
        if (value.length >= 2) {
            const results = window.RUSSIAN_CITIES.filter(city => 
                city.toLowerCase().includes(value.toLowerCase())
            ).slice(0, 3);
            
            if (results.length > 0) {
                console.log(`💡 Подсказки для "Куда": ${results.join(', ')}`);
            }
        }
    });
    
    console.log('✅ Автодополнение адресов инициализировано');
}

/**
 * Показывает подсказки городов
 */
function showCitySuggestions(fieldId, query) {
    console.log(`🔍 Показываем подсказки для "${query}" (${fieldId})`);
    
    if (!window.RUSSIAN_CITIES || !Array.isArray(window.RUSSIAN_CITIES)) {
        console.error('❌ Список городов не доступен');
        return;
    }
    
    const queryLower = query.toLowerCase();
    const results = window.RUSSIAN_CITIES.filter(city => 
        city.toLowerCase().includes(queryLower)
    ).slice(0, 5);
    
    if (results.length === 0) {
        hideCitySuggestions(fieldId);
        return;
    }
    
    console.log(`Найдено ${results.length} городов:`, results);
    
    // Создаем или находим контейнер для подсказок
    let container = document.getElementById(`${fieldId}-suggestions`);
    
    if (!container) {
        container = document.createElement('div');
        container.id = `${fieldId}-suggestions`;
        container.className = 'city-suggestions';
        container.style.cssText = `
            position: absolute;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            z-index: 1000;
            max-height: 200px;
            overflow-y: auto;
            width: calc(100% - 30px); /* Учитываем padding поля ввода */
            margin-top: 5px;
            display: none;
        `;
        
        const input = document.getElementById(fieldId);
        if (input && input.parentNode) {
            input.parentNode.style.position = 'relative';
            input.parentNode.appendChild(container);
        }
    }
    
    // Заполняем контейнер
    container.innerHTML = results.map(city => `
        <div class="suggestion-item" 
             onclick="selectCitySimple('${fieldId}', '${city.replace(/'/g, "\\'")}')"
             style="padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #eee; font-size: 14px;"
             onmouseover="this.style.background='#f5f5f5'"
             onmouseout="this.style.background='white'">
            <span style="color: #666; margin-right: 10px;">📍</span>
            ${city}
        </div>
    `).join('');
    
    // Показываем контейнер
    container.style.display = 'block';
    
    // Скрываем при клике вне
    setTimeout(() => {
        const clickHandler = (e) => {
            if (!container.contains(e.target) && e.target.id !== fieldId) {
                hideCitySuggestions(fieldId);
                document.removeEventListener('click', clickHandler);
            }
        };
        document.addEventListener('click', clickHandler);
    }, 10);
}

/**
 * Скрывает подсказки городов
 */
function hideCitySuggestions(fieldId) {
    const container = document.getElementById(`${fieldId}-suggestions`);
    if (container) {
        container.style.display = 'none';
    }
}

// Сделать функции глобальными
window.showCitySuggestions = showCitySuggestions;
window.hideCitySuggestions = hideCitySuggestions;
window.swapRoutePoints = swapRoutePoints;
window.showRouteOnMap = showRouteOnMap;
window.hideRouteMap = hideRouteMap;
window.updateArrivalTimeFromMap = updateArrivalTimeFromMap;

window.testAutocompleteNow = function() {
    console.log('=== ТЕСТ АВТОДОПОЛНЕНИЯ СЕЙЧАС ===');
    
    // Простейший тест
    const input = document.getElementById('from-input');
    if (input && window.RUSSIAN_CITIES) {
        input.value = 'Мо';
        console.log('✅ Введено "Мо" в поле from-input');
        
        const results = window.RUSSIAN_CITIES.filter(city => 
            city.toLowerCase().includes('мо')
        ).slice(0, 3);
        
        console.log('🔍 Результаты поиска "Мо":', results);
        
        if (results.length > 0) {
            alert(`Автодополнение работает!\nНайдено: ${results.join(', ')}`);
        }
    } else {
        console.error('❌ Нет поля или списка городов');
    }
};