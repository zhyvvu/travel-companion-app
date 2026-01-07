// app.js - ФИНАЛЬНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ
const tg = window.Telegram.WebApp;
const API_BASE_URL = "https://travel-api-n6r2.onrender.com";

let currentUser = null;

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 App starting...');
    
    try {
        // 1. Инициализируем Telegram
        await initTelegram();
        
        // 2. Настраиваем события
        setupBasicEvents();
        
        // 3. Готово
        if (tg.ready) tg.ready();
        console.log('✅ App ready');
        
        // 4. Показываем главный экран
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
            language_code: user.language_code || 'ru'
        };
        
        // Пробуем авторизоваться (корректный формат)
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
                    language_code: user.language_code || 'ru'
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

// Попытка авторизации - ИСПРАВЛЕННЫЙ ФОРМАТ
async function tryAuth(telegramUser) {
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
            console.log('✅ Auth success:', data);
            
            if (data.success) {
                // Сохраняем данные
                currentUser = { ...currentUser, ...data.user };
                localStorage.setItem('travel_user', JSON.stringify(currentUser));
                showNotification('✅ Авторизация успешна', 'success');
                return true;
            } else {
                console.error('❌ Auth failed:', data);
                showNotification('Авторизация не удалась', 'warning');
                return false;
            }
        } else {
            // Пробуем понять ошибку
            const errorText = await response.text();
            console.error('❌ Auth error response:', errorText);
            
            // Попробуем альтернативный формат
            const alternativeResponse = await tryAlternativeAuth(telegramUser);
            return alternativeResponse;
        }
    } catch (error) {
        console.error('❌ Auth network error:', error);
        // Используем сохраненные данные
        const saved = localStorage.getItem('travel_user');
        if (saved) {
            currentUser = JSON.parse(saved);
            showNotification('⚠️ Используем сохраненные данные', 'warning');
            return true;
        }
        return false;
    }
}

// Альтернативный формат авторизации
async function tryAlternativeAuth(telegramUser) {
    console.log('🔄 Trying alternative auth format...');
    
    try {
        // Формат, который ожидает API
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
                currentUser = { ...currentUser, ...data.user };
                localStorage.setItem('travel_user', JSON.stringify(currentUser));
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('❌ Alternative auth error:', error);
        return false;
    }
}

// Обновление интерфейса
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

// Настройка событий
function setupBasicEvents() {
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
}

// Показ экрана - ОКОНЧАТЕЛЬНО ИСПРАВЛЕННАЯ ВЕРСИЯ
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
        
        // Обновляем активную кнопку навигации
        updateNavButtons(screenId);
        
        // Кнопка назад в Telegram - БЕЗ setText
        if (tg && tg.BackButton) {
            console.log('🔘 BackButton доступен');
            
            if (screenId === 'welcome') {
                tg.BackButton.hide();
            } else {
                tg.BackButton.show();
                // НЕ используем setText, чтобы избежать ошибки
            }
        }
        
        // Обработка специфичных экранов
        if (screenId === 'profile') {
            loadSimpleProfile();
        }
    }
}

// Обновление кнопок навигации
function updateNavButtons(activeScreen) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.screen === activeScreen) {
            btn.classList.add('active');
        }
    });
}

// Простая загрузка профиля
async function loadSimpleProfile() {
    console.log('👤 Loading simple profile...');
    
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
        // Запрос к API с обработкой ошибки 404
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
                // Простое отображение
                profileEl.innerHTML = `
                    <div class="profile-card" style="max-width: 600px; margin: 0 auto;">
                        <div class="profile-header">
                            <div class="profile-avatar">
                                ${data.user.first_name.charAt(0)}${data.user.last_name?.charAt(0) || ''}
                            </div>
                            <div class="profile-name">${data.user.first_name} ${data.user.last_name || ''}</div>
                            <div class="profile-role">${data.user.role || 'Пользователь'}</div>
                        </div>
                        
                        <div style="padding: 20px;">
                            <h4>✅ Профиль загружен!</h4>
                            <div style="margin: 20px 0;">
                                <p><strong>Имя:</strong> ${data.user.first_name}</p>
                                <p><strong>Рейтинг:</strong> ⭐ ${data.user.ratings?.driver || '5.0'}</p>
                                <p><strong>Автомобилей:</strong> ${data.cars?.length || 0}</p>
                                <p><strong>Поездок:</strong> ${data.driver_trips?.length || 0}</p>
                            </div>
                            
                            <button class="btn-primary" onclick="showAddCarModal()" style="margin: 10px;">
                                <i class="fas fa-plus"></i> Добавить авто
                            </button>
                        </div>
                    </div>
                `;
                
                showNotification('✅ Профиль загружен', 'success');
            } else {
                showErrorMessage('Ошибка API: ' + (data.message || 'Неизвестная ошибка'));
            }
        } else if (response.status === 404) {
            // Пользователь не найден в базе - создаем его
            showNewUserProfile();
        } else {
            const errorText = await response.text();
            console.error('HTTP error:', errorText);
            showErrorMessage('Ошибка сервера: ' + response.status);
        }
    } catch (error) {
        console.error('❌ Network error:', error);
        showErrorMessage('Ошибка сети: ' + error.message);
    }
}

// Показать профиль для нового пользователя
function showNewUserProfile() {
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
                
                <p>У вас пока нет:</p>
                <div style="margin: 20px 0;">
                    <div style="display: flex; align-items: center; margin: 10px 0;">
                        <i class="fas fa-car" style="color: #666; margin-right: 10px;"></i>
                        <span>Добавленных автомобилей</span>
                    </div>
                    <div style="display: flex; align-items: center; margin: 10px 0;">
                        <i class="fas fa-road" style="color: #666; margin-right: 10px;"></i>
                        <span>Созданных поездок</span>
                    </div>
                    <div style="display: flex; align-items: center; margin: 10px 0;">
                        <i class="fas fa-star" style="color: #666; margin-right: 10px;"></i>
                        <span>Рейтинга</span>
                    </div>
                </div>
                
                <div style="margin-top: 30px;">
                    <button class="btn-primary" onclick="showAddCarModal()" style="margin: 10px;">
                        <i class="fas fa-plus"></i> Добавить первый автомобиль
                    </button>
                    <button class="btn-secondary" onclick="showScreen('create-trip')" style="margin: 10px;">
                        <i class="fas fa-plus-circle"></i> Создать первую поездку
                    </button>
                </div>
            </div>
        </div>
    `;
    
    showNotification('👋 Добро пожаловать в Travel Companion!', 'info');
}

// Показать сообщение об ошибке
function showErrorMessage(message) {
    const profileEl = document.getElementById('profile-data');
    if (!profileEl) return;
    
    profileEl.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <h3>⚠️ Ошибка</h3>
            <div style="background: #ffebee; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p>${message}</p>
            </div>
            <button class="btn-secondary" onclick="loadSimpleProfile()" style="margin-top: 20px;">
                <i class="fas fa-redo"></i> Повторить
            </button>
            <button class="btn-primary" onclick="showScreen('welcome')" style="margin-top: 20px; margin-left: 10px;">
                <i class="fas fa-home"></i> На главную
            </button>
        </div>
    `;
}

// Вспомогательные функции
function showAddCarModal() {
    const modalContent = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-car"></i> Добавить автомобиль</h3>
                <button class="close-btn" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <p style="text-align: center; padding: 20px;">
                    📝 Функция добавления автомобиля<br>
                    <small>(В разработке)</small>
                </p>
                <div class="modal-actions">
                    <button class="btn-secondary" onclick="closeModal()">
                        <i class="fas fa-times"></i> Закрыть
                    </button>
                </div>
            </div>
        </div>
    `;
    
    showCustomModal(modalContent);
}

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

// Экспорт функций
window.showScreen = showScreen;
window.loadSimpleProfile = loadSimpleProfile;
window.showAddCarModal = showAddCarModal;
window.closeModal = closeModal;