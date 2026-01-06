// app.js - ОПТИМИЗИРОВАННЫЙ ДЛЯ TELEGRAM WEB APP
const tg = window.Telegram.WebApp;

// Конфигурация API
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://127.0.0.1:8000' 
    : 'https://travel-api-n6r2.onrender.com'; // ← ВАШ URL ЗДЕСЬ

// Состояние приложения
let currentUser = null;
let authInProgress = false;

// Проверка, запущены ли мы в Telegram
function isInTelegramWebApp() {
    return window.Telegram && window.Telegram.WebApp && 
           window.Telegram.WebApp.initDataUnsafe && 
           window.Telegram.WebApp.initDataUnsafe.user;
}

let currentScreen = 'welcome';

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

// =============== ОБЯЗАТЕЛЬНАЯ АВТОРИЗАЦИЯ ===============
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
    
    // Настройка Telegram Web App
    tg.expand();
    tg.setHeaderColor('#2481cc');
    tg.setBackgroundColor('#f5f5f5');
    
    // Инициализация приложения
    await initApp();
    setupEventListeners();
    loadStats();
    setupCityAutocomplete();
    
    // Готовность приложения
    tg.ready();
    console.log('App ready');
});

// Инициализация приложения
async function initApp() {
    try {
        // Проверяем, находимся ли мы внутри Telegram
        if (window.Telegram && window.Telegram.WebApp) {
            const telegramUser = tg.initDataUnsafe?.user;
            
            if (telegramUser) {
                console.log('Telegram User found:', telegramUser);
                
                // Сохраняем данные пользователя Telegram
                currentUser = {
                    telegram_id: telegramUser.id,
                    first_name: telegramUser.first_name,
                    last_name: telegramUser.last_name || '',
                    username: telegramUser.username,
                    language_code: telegramUser.language_code,
                    is_premium: telegramUser.is_premium || false
                };
                
                // Авторизуем пользователя
                await authenticateUser(telegramUser);
            } else {
                console.warn('Telegram user data not available in initDataUnsafe');
                showNotification('Откройте приложение через Telegram бота', 'warning');
                initTestUser();
            }
        } else {
            console.warn('Not in Telegram Web App. Running in browser mode.');
            initTestUser();
        }
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showNotification('Ошибка загрузки приложения', 'error');
        initTestUser(); // Фолбэк на тестового пользователя
    }
    
    // Убираем кружок загрузки
    tg.ready();
    tg.expand();
    console.log('App initialized successfully');

    // Обновляем приветствие
    updateWelcomeMessage();
}

// Тестовый пользователь для локальной разработки
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
    
    // Показываем сообщение о тестовом режиме
    showNotification('🔧 Режим разработки: Тестовый пользователь', 'info');
}

// Аутентификация пользователя
async function authenticateUser(telegramUser) {
    if (authInProgress) return;
    authInProgress = true;
    
    // Показываем лоадер
    document.getElementById('user-info').innerHTML = `
        <div class="loader"></div>
    `;
    
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
                // Обновляем данные пользователя
                currentUser = {
                    ...currentUser,
                    ...data.user,
                    token: data.token
                };
                
                // Сохраняем в localStorage
                localStorage.setItem('travel_user', JSON.stringify(currentUser));
                localStorage.setItem('last_auth_time', Date.now());
                
                // Обновляем UI
                updateUserInfo();
                updateWelcomeMessage();
                
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
        
        // Пробуем загрузить из localStorage (проверяем, не устарели ли данные)
        const savedUser = localStorage.getItem('travel_user');
        const lastAuthTime = localStorage.getItem('last_auth_time');
        const hoursSinceLastAuth = lastAuthTime ? (Date.now() - lastAuthTime) / (1000 * 60 * 60) : 24;
        
        // Если данные свежие (менее 24 часов), используем их
        if (savedUser && hoursSinceLastAuth < 24) {
            currentUser = JSON.parse(savedUser);
            updateUserInfo();
            updateWelcomeMessage();
            showNotification('⚠️ Используем сохраненные данные', 'warning');
        } else {
            showNotification('❌ Ошибка авторизации. Проверьте подключение', 'error');
            // Показываем кнопку для повторной попытки
            document.getElementById('user-info').innerHTML = `
                <button class="btn-retry-auth" onclick="retryAuth()">
                    <i class="fas fa-redo"></i> Повторить
                </button>
            `;
        }
    } finally {
        authInProgress = false;
    }
}

// Повторная попытка авторизации
async function retryAuth() {
    if (!tg.initDataUnsafe?.user) {
        showNotification('Данные Telegram недоступны', 'error');
        return;
    }
    
    await authenticateUser(tg.initDataUnsafe.user);
}

// =============== СЛУШАТЕЛИ СОБЫТИЙ ===============
function setupEventListeners() {
    // Устанавливаем сегодняшнюю дату по умолчанию
    const today = new Date().toISOString().split('T')[0];
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        input.value = today;
        input.min = today;
    });
    
    // Устанавливаем время по умолчанию (текущее + 2 часа)
    const now = new Date();
    now.setHours(now.getHours() + 2);
    const timeInputs = document.querySelectorAll('input[type="time"]');
    timeInputs.forEach(input => {
        input.value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    });
    
    // Слушатели для навигации
    document.querySelectorAll('[data-screen]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!requireAuth('перейти в этот раздел')) return;
            showScreen(btn.dataset.screen);
        });
    });
    
    // Закрытие модальных окон
    document.querySelectorAll('.modal-close, .close-btn').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
    
    // Клик вне модального окна
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal();
        }
    });
    
    // Обработчики для полей ввода городов
    setupCityInputListeners();
    
    // Обработчик кнопки поиска
    const searchBtn = document.querySelector('.search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', searchTrips);
    }
    
    // Обработчик кнопки создания поездки
    const createTripBtn = document.querySelector('.submit-btn');
    if (createTripBtn) {
        createTripBtn.addEventListener('click', createTrip);
    }
    
    // Обработчики клавиш Enter в формах
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
    
    // Настройка кнопки "Назад" Telegram
    if (tg.BackButton) {
        tg.BackButton.onClick(() => {
            if (currentScreen !== 'welcome') {
                showScreen('welcome');
            } else {
                tg.close();
            }
        });
    }
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
    // Поля для автодополнения городов
    const cityInputs = [
        { id: 'from-input', container: 'search-form' },
        { id: 'to-input', container: 'search-form' },
        { id: 'trip-from', container: 'trip-form' },
        { id: 'trip-to', container: 'trip-form' }
    ];
    
    cityInputs.forEach(({ id, container }) => {
        const input = document.getElementById(id);
        if (!input) return;
        
        // Создаем контейнер для автодополнения
        const wrapper = document.createElement('div');
        wrapper.className = 'city-input-wrapper';
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);
        
        // Кнопка очистки
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
        
        // Контейнер для списка автодополнения
        const autocompleteList = document.createElement('div');
        autocompleteList.className = 'autocomplete-list';
        autocompleteList.id = `${id}-autocomplete`;
        wrapper.appendChild(autocompleteList);
        
        // Обработчики событий
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
            // Небольшая задержка, чтобы можно было кликнуть по автодополнению
            setTimeout(() => hideAutocomplete(id), 200);
        });
        
        // Обработка клавиш
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
    
    // Клик по документу для скрытия автодополнения
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.city-input-wrapper')) {
            cityInputs.forEach(({ id }) => hideAutocomplete(id));
        }
    });
    
    // Запускаем автодополнение после загрузки
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
    
    // Фильтруем города по запросу
    const filteredCities = RUSSIAN_CITIES.filter(city => 
        city.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 8); // Ограничиваем 8 результатами
    
    if (filteredCities.length === 0) {
        hideAutocomplete(inputId);
        return;
    }
    
    // Создаем HTML для списка
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
    
    // Добавляем обработчики кликов
    autocompleteList.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
            const input = document.getElementById(inputId);
            input.value = item.dataset.city;
            hideAutocomplete(inputId);
            
            // Показываем кнопку очистки
            const clearBtn = input.parentNode.querySelector('.clear-city-btn');
            if (clearBtn) clearBtn.style.display = 'block';
            
            // Переходим к следующему полю, если нужно
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
    // Для экрана приветствия не требуется авторизация
    if (screenId === 'welcome') {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
            screen.style.display = 'none';
        });
        
        const screen = document.getElementById(screenId);
        if (screen) {
            screen.classList.add('active');
            screen.style.display = 'block';
            currentScreen = screenId;
            updateNavButtons(screenId);
            
            if (tg.BackButton) {
                tg.BackButton.hide();
            }
        }
        return;
    }
    
    // Для других экранов проверяем авторизацию
    if (!currentUser || !currentUser.telegram_id) {
        showNotification('Пожалуйста, авторизуйтесь', 'warning');
        return;
    }
    
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none';
    });
    
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.add('active');
        screen.style.display = 'block';
        currentScreen = screenId;
        
        // Настройка кнопки "Назад" в Telegram
        if (tg.BackButton) {
            if (screenId === 'welcome') {
                tg.BackButton.hide();
            } else {
                tg.BackButton.show();
                tg.BackButton.setText('Назад');
            }
        }
        
        updateNavButtons(screenId);
        
        // Загружаем данные для экрана
        switch(screenId) {
            case 'profile':
                loadProfile();
                break;
            case 'my-trips':
                loadMyTrips();
                break;
        }
    }
}

// Обновить навигационные кнопки
function updateNavButtons(activeScreen) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.screen === activeScreen) {
            btn.classList.add('active');
        }
    });
}

// Обновить информацию о пользователе
function updateUserInfo() {
    if (!currentUser) {
        document.getElementById('user-info').innerHTML = `
            <div class="user-info-unauth">
                <button class="btn-small" onclick="initApp()">
                    <i class="fas fa-sign-in-alt"></i> Войти
                </button>
            </div>
        `;
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

// Обновить приветственное сообщение
function updateWelcomeMessage() {
    if (!currentUser) return;
    
    const welcomeTitle = document.getElementById('welcome-title');
    if (welcomeTitle) {
        welcomeTitle.textContent = `👋 Привет, ${currentUser.first_name}!`;
    }
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

// Отобразить результаты поиска
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
        const timeOnly = trip.departure.datetime.split(' ')[1];
        
        html += `
            <div class="trip-card" onclick="showTripDetails(${trip.id})">
                <div class="trip-header">
                    <div class="driver-info">
                        <div class="driver-avatar">
                            ${trip.driver.avatar_initials}
                        </div>
                        <div>
                            <div class="driver-name">${trip.driver.name}</div>
                            <div class="driver-rating">
                                ⭐ ${trip.driver.rating.toFixed(1)}
                            </div>
                        </div>
                    </div>
                    <div class="trip-price">
                        <span class="price">${trip.seats.price_per_seat} ₽</span>
                        <span class="per-seat">за место</span>
                    </div>
                </div>
                
                <div class="trip-route">
                    <div class="route-from">
                        <i class="fas fa-map-marker-alt" style="color: #e74c3c;"></i>
                        <span class="route-city">${trip.route.from_city || trip.route.from.split(',')[0]}</span>
                    </div>
                    <div class="route-arrow">
                        <i class="fas fa-arrow-right"></i>
                    </div>
                    <div class="route-to">
                        <i class="fas fa-flag-checkered" style="color: #27ae60;"></i>
                        <span class="route-city">${trip.route.to_city || trip.route.to.split(',')[0]}</span>
                    </div>
                </div>
                
                <div class="trip-details">
                    <div class="detail-item">
                        <i class="fas fa-calendar"></i>
                        <span>${trip.departure.date}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-clock"></i>
                        <span>${timeOnly}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-user-friends"></i>
                        <span>${trip.seats.available} мест</span>
                    </div>
                </div>
                
                ${trip.car_info ? `
                    <div class="trip-car">
                        <i class="fas fa-car"></i>
                        <span>${trip.car_info.model} • ${trip.car_info.color}</span>
                    </div>
                ` : ''}
                
                ${trip.details.comment ? `
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

// Очистить форму поиска
function clearSearchForm() {
    document.getElementById('from-input').value = '';
    document.getElementById('to-input').value = '';
    document.getElementById('date-input').value = new Date().toISOString().split('T')[0];
    document.getElementById('passengers-input').value = '1';
    
    // Скрываем кнопки очистки
    document.querySelectorAll('.clear-city-btn').forEach(btn => {
        btn.style.display = 'none';
    });
    
    // Очищаем результаты
    document.getElementById('search-results').innerHTML = `
        <div class="empty-state">
            <i class="fas fa-search"></i>
            <h3>Начните поиск поездок</h3>
            <p>Заполните форму выше для поиска</p>
        </div>
    `;
}

// Показать детали поездки
async function showTripDetails(tripId) {
    if (!requireAuth('просматривать детали поездки')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}`);
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.success) {
                const trip = data.trip;
                const modalBody = document.getElementById('trip-details-modal');
                
                if (modalBody) {
                    modalBody.innerHTML = `
                        <div class="trip-detail">
                            <h3>${trip.route.from} → ${trip.route.to}</h3>
                            
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
                                <div class="detail-item">
                                    <span class="label">Поездок:</span>
                                    <span class="value">${trip.driver.total_trips}</span>
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
                            
                            ${trip.car_info ? `
                                <div class="detail-section">
                                    <h4><i class="fas fa-car"></i> Автомобиль</h4>
                                    <div class="detail-item">
                                        <span class="label">Модель:</span>
                                        <span class="value">${trip.car_info.model}</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="label">Цвет:</span>
                                        <span class="value">${trip.car_info.color}</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="label">Госномер:</span>
                                        <span class="value">${trip.car_info.plate}</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="label">Мест:</span>
                                        <span class="value">${trip.car_info.seats}</span>
                                    </div>
                                </div>
                            ` : ''}
                            
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
                                <div class="detail-item">
                                    <span class="label">Общая стоимость:</span>
                                    <span class="value">${trip.seats.total_price} ₽</span>
                                </div>
                            </div>
                            
                            ${trip.details.comment ? `
                                <div class="detail-section">
                                    <h4><i class="fas fa-comment"></i> Комментарий</h4>
                                    <p>${trip.details.comment}</p>
                                </div>
                            ` : ''}
                            
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
                    `;
                    
                    document.getElementById('modal').style.display = 'block';
                }
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки деталей:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
}

// =============== СОЗДАНИЕ ПОЕЗДКИ ===============
async function createTrip() {
    if (!requireAuth('создать поездку')) return;
    
    const from = document.getElementById('trip-from').value.trim();
    const to = document.getElementById('trip-to').value.trim();
    const date = document.getElementById('trip-date').value;
    const time = document.getElementById('trip-time').value;
    const carModel = document.getElementById('car-model').value.trim();
    const seats = document.getElementById('seats-count').value;
    const price = document.getElementById('trip-price').value;
    const comment = document.getElementById('trip-comment').value.trim();
    
    // Проверка полей
    if (!from || !to || !date || !time || !carModel || !seats || !price) {
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
        
        console.log('Creating trip:', tripData);
        
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
        
        console.log('Create trip response:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                showNotification('🎉 Поездка успешно создана!', 'success');
                showScreen('welcome');
                clearTripForm();
                loadStats(); // Обновляем статистику
            } else {
                showNotification(data.message || 'Ошибка создания поездки', 'error');
            }
        } else {
            const errorText = await response.text();
            console.error('Create trip error:', errorText);
            showNotification(`Ошибка сервера: ${response.status}`, 'error');
        }
    } catch (error) {
        console.error('Ошибка создания поездки:', error);
        showNotification('Ошибка подключения к серверу', 'error');
    }
}

// Очистить форму создания
function clearTripForm() {
    document.getElementById('trip-from').value = '';
    document.getElementById('trip-to').value = '';
    document.getElementById('car-model').value = '';
    document.getElementById('seats-count').value = '3';
    document.getElementById('trip-price').value = '';
    document.getElementById('trip-comment').value = '';
    
    // Устанавливаем завтрашнюю дату
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('trip-date').value = tomorrow.toISOString().split('T')[0];
    
    // Скрываем кнопки очистки
    document.querySelectorAll('.clear-city-btn').forEach(btn => {
        btn.style.display = 'none';
    });
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

// =============== ПРОФИЛЬ ===============
async function loadProfile() {
    if (!requireAuth('просматривать профиль')) return;
    
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/auth/me?telegram_id=${currentUser.telegram_id}`
        );
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                displayProfile(data.user);
            }
        } else {
            // Показываем базовую информацию из currentUser
            displayBasicProfile();
        }
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        displayBasicProfile();
    }
}

// Отобразить профиль
function displayProfile(userData) {
    const profileEl = document.getElementById('profile-data');
    
    profileEl.innerHTML = `
        <div class="profile-card">
            <div class="profile-header">
                <div class="profile-avatar">
                    ${userData.first_name.charAt(0)}${userData.last_name?.charAt(0) || ''}
                </div>
                <div class="profile-name">${userData.first_name} ${userData.last_name || ''}</div>
                <div class="profile-role">${userData.role === 'driver' ? 'Водитель' : userData.role === 'both' ? 'Водитель и пассажир' : 'Пассажир'}</div>
            </div>
            
            <div class="profile-stats">
                <div class="stat-card">
                    <span class="stat-value">${userData.stats.driver_trips || 0}</span>
                    <span class="stat-label">Поездок как водитель</span>
                </div>
                <div class="stat-card">
                    <span class="stat-value">${userData.stats.passenger_trips || 0}</span>
                    <span class="stat-label">Поездок как пассажир</span>
                </div>
                <div class="stat-card">
                    <span class="stat-value">${userData.ratings.driver?.toFixed(1) || '5.0'}</span>
                    <span class="stat-label">Рейтинг водителя</span>
                </div>
                <div class="stat-card">
                    <span class="stat-value">${userData.ratings.passenger?.toFixed(1) || '5.0'}</span>
                    <span class="stat-label">Рейтинг пассажира</span>
                </div>
            </div>
            
            ${userData.car_info && userData.car_info.model ? `
                <div class="car-info-section">
                    <h4><i class="fas fa-car"></i> Автомобиль</h4>
                    <div class="car-details">
                        <div class="car-detail">
                            <span class="label">Модель:</span>
                            <span class="value">${userData.car_info.model}</span>
                        </div>
                        <div class="car-detail">
                            <span class="label">Цвет:</span>
                            <span class="value">${userData.car_info.color}</span>
                        </div>
                        <div class="car-detail">
                            <span class="label">Госномер:</span>
                            <span class="value">${userData.car_info.plate}</span>
                        </div>
                        <div class="car-detail">
                            <span class="label">Мест:</span>
                            <span class="value">${userData.car_info.seats}</span>
                        </div>
                    </div>
                </div>
            ` : `
                <div class="no-car-section">
                    <p><i class="fas fa-car"></i> У вас пока нет автомобиля</p>
                    <button class="btn-primary" onclick="addCar()">
                        <i class="fas fa-plus"></i> Добавить автомобиль
                    </button>
                </div>
            `}
            
            <div class="profile-actions">
                <button class="btn-secondary" onclick="editProfile()">
                    <i class="fas fa-edit"></i> Редактировать профиль
                </button>
                <button class="btn-secondary" onclick="showMyTrips()">
                    <i class="fas fa-route"></i> Мои поездки
                </button>
            </div>
        </div>
    `;
}

function displayBasicProfile() {
    const profileEl = document.getElementById('profile-data');
    
    profileEl.innerHTML = `
        <div class="profile-card">
            <div class="profile-header">
                <div class="profile-avatar">
                    ${currentUser.first_name.charAt(0)}${currentUser.last_name?.charAt(0) || ''}
                </div>
                <div class="profile-name">${currentUser.first_name} ${currentUser.last_name || ''}</div>
                <div class="profile-role">Пассажир</div>
            </div>
            
            <p>Данные профиля загружаются...</p>
            
            <div class="profile-actions">
                <button class="btn-primary" onclick="addCar()">
                    <i class="fas fa-plus"></i> Добавить автомобиль
                </button>
            </div>
        </div>
    `;
}

// Добавить автомобиль
async function addCar() {
    if (!requireAuth('добавить автомобиль')) return;
    
    const model = prompt('Введите модель автомобиля:');
    if (!model) return;
    
    const color = prompt('Введите цвет автомобиля:', 'Черный');
    const plate = prompt('Введите госномер (например, А123АА777):');
    const seats = prompt('Количество мест (включая водителя):', '4');
    
    try {
        const updateData = {
            has_car: true,
            car_model: model,
            car_color: color,
            car_plate: plate,
            car_seats: parseInt(seats) || 4
        };
        
        const response = await fetch(
            `${API_BASE_URL}/api/users/update?telegram_id=${currentUser.telegram_id}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                showNotification('✅ Автомобиль добавлен! Теперь вы можете создавать поездки', 'success');
                loadProfile();
            }
        }
    } catch (error) {
        console.error('Ошибка добавления авто:', error);
        showNotification('Ошибка обновления профиля', 'error');
    }
}

// Редактировать профиль
function editProfile() {
    showNotification('Функция в разработке', 'info');
}

// Показать мои поездки
function showMyTrips() {
    showScreen('my-trips');
}

// =============== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===============

// Загрузить мои поездки
async function loadMyTrips() {
    if (!requireAuth('просматривать мои поездки')) return;
    
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/trips/my?telegram_id=${currentUser.telegram_id}`
        );
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                const tripsEl = document.getElementById('profile-data');
                tripsEl.innerHTML = `
                    <div class="my-trips-container">
                        <h3>Мои поездки</h3>
                        
                        <div class="trips-section">
                            <h4>🚗 Как водитель (${data.trips.as_driver.length})</h4>
                            ${data.trips.as_driver.map(trip => `
                                <div class="trip-item">
                                    <div>${trip.route.from} → ${trip.route.to}</div>
                                    <div class="trip-info">
                                        <span>${trip.date}</span>
                                        <span>${trip.available_seats} мест</span>
                                        <span class="status ${trip.status}">${trip.status}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        
                        <div class="trips-section">
                            <h4>👤 Как пассажир (${data.trips.as_passenger.length})</h4>
                            ${data.trips.as_passenger.map(booking => `
                                <div class="trip-item">
                                    <div>${booking.route.from} → ${booking.route.to}</div>
                                    <div class="trip-info">
                                        <span>${booking.date}</span>
                                        <span>${booking.seats} мест</span>
                                        <span class="status ${booking.status}">${booking.status}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки моих поездок:', error);
        showNotification('Ошибка загрузки поездок', 'error');
    }
}

// Загрузить статистику
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
            // Устанавливаем дефолтные значения
            document.getElementById('users-count').textContent = '0';
            document.getElementById('trips-count').textContent = '0';
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
        // Устанавливаем дефолтные значения при ошибке
        document.getElementById('users-count').textContent = '0';
        document.getElementById('trips-count').textContent = '0';
    }
}

// Показать уведомление
function showNotification(message, type = 'info') {
    // Удаляем предыдущие уведомления
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Анимация появления
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Автоматическое скрытие
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Закрыть модальное окно
function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

// Глобальное экспортирование функций для использования в HTML
window.showScreen = showScreen;
window.searchTrips = searchTrips;
window.createTrip = createTrip;
window.bookTrip = bookTrip;
window.showTripDetails = showTripDetails;
window.clearSearchForm = clearSearchForm;
window.clearTripForm = clearTripForm;
window.closeModal = closeModal;
window.addCar = addCar;
window.editProfile = editProfile;
window.showMyTrips = showMyTrips;
window.retryAuth = retryAuth;
window.initApp = initApp;