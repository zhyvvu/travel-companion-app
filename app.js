// app.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
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
        
    } catch (error) {
        console.error('❌ App error:', error);
        showNotification('Ошибка загрузки приложения', 'error');
    }
});

// Основная инициализация Telegram
async function initTelegram() {
    console.log('🔍 Инициализация Telegram...');
    
    // Проверяем данные Telegram
    const initData = tg.initData;
    const unsafeData = tg.initDataUnsafe;
    
    console.log('📱 InitData:', initData);
    console.log('📱 InitDataUnsafe:', unsafeData);
    
    if (unsafeData?.user) {
        // Есть данные пользователя
        console.log('✅ Telegram user found:', unsafeData.user);
        
        currentUser = {
            telegram_id: unsafeData.user.id,
            first_name: unsafeData.user.first_name,
            last_name: unsafeData.user.last_name || '',
            username: unsafeData.user.username,
            language_code: unsafeData.user.language_code
        };
        
        // Пробуем авторизоваться
        await tryAuth();
        
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
                    first_name: user.first_name,
                    last_name: user.last_name || '',
                    username: user.username,
                    language_code: user.language_code
                };
                
                await tryAuth();
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

// Попытка авторизации
async function tryAuth() {
    console.log('🔐 Trying auth...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/telegram`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: currentUser })
        });
        
        console.log('Auth status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Auth data:', data);
            
            if (data.success) {
                // Сохраняем данные
                currentUser = { ...currentUser, ...data.user };
                localStorage.setItem('travel_user', JSON.stringify(currentUser));
                showNotification('✅ Авторизация успешна', 'success');
            }
        }
    } catch (error) {
        console.error('Auth error:', error);
        // Используем сохраненные данные
        const saved = localStorage.getItem('travel_user');
        if (saved) {
            currentUser = JSON.parse(saved);
            showNotification('⚠️ Используем сохраненные данные', 'warning');
        }
    }
}

// Обновление интерфейса
function updateUI() {
    console.log('🎨 Updating UI, user:', currentUser);
    
    // Приветствие
    const welcomeTitle = document.getElementById('welcome-title');
    if (welcomeTitle) {
        welcomeTitle.textContent = `👋 Привет, ${currentUser.first_name}!`;
    }
    
    // Инфо пользователя
    const userInfo = document.getElementById('user-info');
    if (userInfo) {
        userInfo.innerHTML = `
            <div class="user-avatar">
                ${currentUser.first_name.charAt(0)}${currentUser.last_name?.charAt(0) || ''}
            </div>
            <div class="user-name">${currentUser.first_name}</div>
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

// Показ экрана - ИСПРАВЛЕННАЯ ВЕРСИЯ
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
        
        // Обработка специфичных экранов
        if (screenId === 'profile') {
            loadSimpleProfile();
        }
        
        // Кнопка назад в Telegram - ИСПРАВЛЕНИЕ ЗДЕСЬ
        if (tg && tg.BackButton) {
            console.log('🔘 BackButton доступен, метод:', typeof tg.BackButton.setText);
            
            if (screenId === 'welcome') {
                tg.BackButton.hide();
            } else {
                tg.BackButton.show();
                
                // ПРОВЕРЯЕМ КАКОЙ МЕТОД СУЩЕСТВУЕТ
                if (typeof tg.BackButton.setText === 'function') {
                    tg.BackButton.setText('Назад');
                } else if (typeof tg.BackButton.setText === 'function') {
                    tg.BackButton.setText('Назад');
                } else {
                    console.log('⚠️ Метод setText не найден, доступные методы:', Object.keys(tg.BackButton));
                }
            }
        }
    }
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
        // Запрос к API
        const response = await fetch(
            `${API_BASE_URL}/api/users/profile-full?telegram_id=${currentUser.telegram_id}`
        );
        
        console.log('Profile API status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Profile data:', data);
            
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
                // Ошибка API
                profileEl.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <h3>⚠️ Ошибка API</h3>
                        <p>${data.message || 'Неизвестная ошибка'}</p>
                        <button class="btn-secondary" onclick="loadSimpleProfile()" style="margin-top: 20px;">
                            <i class="fas fa-redo"></i> Повторить
                        </button>
                    </div>
                `;
            }
        } else {
            // HTTP ошибка
            const errorText = await response.text();
            console.error('HTTP error:', errorText);
            
            profileEl.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <h3>⚠️ Ошибка сервера</h3>
                    <p>Статус: ${response.status}</p>
                    <button class="btn-secondary" onclick="loadSimpleProfile()" style="margin-top: 20px;">
                        <i class="fas fa-redo"></i> Повторить
                    </button>
                </div>
            `;
        }
    } catch (error) {
        // Сетевая ошибка
        console.error('Network error:', error);
        
        profileEl.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <h3>⚠️ Ошибка сети</h3>
                <p>${error.message}</p>
                <p>Проверьте подключение к интернету</p>
                <button class="btn-secondary" onclick="loadSimpleProfile()" style="margin-top: 20px;">
                    <i class="fas fa-redo"></i> Повторить
                </button>
            </div>
        `;
    }
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