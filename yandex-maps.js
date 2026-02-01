// ====================== yandex-maps.js ======================
// Модуль для работы с Яндекс.Картами в Travel Companion

// Глобальные переменные для работы с картой
let map = null;
let startPlacemark = null;
let finishPlacemark = null;
let route = null;
let currentMode = 'start'; // 'start' или 'finish'
let searchControl = null;

// Данные маршрута, которые будут отправляться на сервер
let routeData = {
    start_point: null,
    finish_point: null,
    distance: null,
    duration: null,
    polyline: null
};

// ====================== ИНИЦИАЛИЗАЦИЯ КАРТЫ ======================

/**
 * Инициализирует Яндекс.Карту в указанном контейнере
 * @returns {Promise} Промис, который разрешится когда карта будет готова
 */

//функция для показа уведомлений
function showNotification(message, type = 'info') {
    // Используем существующую функцию из app.js или создаем простую версию
    if (window.showNotification) {
        window.showNotification(message, type);
    } else {
        // Простая fallback-реализация
        console.log(`${type.toUpperCase()}: ${message}`);
        alert(`${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'} ${message}`);
    }
}

// ====================== ИНИЦИАЛИЗАЦИЯ КАРТЫ ======================

/**
 * Инициализирует Яндекс.Карту в указанном контейнере
 * @returns {Promise} Промис, который разрешится когда карта будет готова
 */
function initYandexMap() {
    // 1. ПРЕДОХРАНИТЕЛЬ: если карта уже есть, просто выходим
    if (map !== null) {
        console.log('🗺️ Карта уже инициализирована, пропускаем создание.');
        clearRoute(); // Очищаем старые точки, если они были
        return;
    }

    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;

    console.log('🗺️ Инициализация новой карты...');
    
    // 2. Создаем карту только один раз
    map = new ymaps.Map("map", {
        center: [45.035474, 38.975313], // Краснодар (или свой центр)
        zoom: 12,
        controls: ['zoomControl', 'geolocationControl']
    });
    return new Promise((resolve, reject) => {
        // 1. Проверяем, загружена ли API Яндекс.Карт
        if (typeof ymaps === 'undefined') {
            console.error('❌ Яндекс.Карты API не загружен');
            showNotification('Карты временно недоступны', 'error');
            reject(new Error('Yandex Maps API not loaded'));
            return;
        }
        
        // 2. Ждем готовности API - ВАЖНО: ymaps.options доступен только внутри ymaps.ready!
        ymaps.ready(() => {
            try {
                // 4. Проверяем существование контейнера
                const mapContainer = document.getElementById('yandex-map');
                if (!mapContainer) {
                    console.error('❌ Контейнер карты не найден (id="yandex-map")');
                    showNotification('Ошибка: контейнер карты не найден', 'error');
                    reject(new Error('Map container not found'));
                    return;
                }
                
                console.log('✅ Контейнер карты найден:', mapContainer);
                
                // 5. Создаем карту
                map = new ymaps.Map('yandex-map', {
                    center: [55.76, 37.64], // Центр - Москва
                    zoom: 10,
                    controls: ['zoomControl', 'fullscreenControl']
                });
                
                console.log('✅ Яндекс.Карта инициализирована');
                
                // 6. Инициализируем остальные компоненты
                initSearchControl();
                initMapEvents();
                initMapControls();
                resetRouteData();
                
                resolve(map);
                
            } catch (error) {
                console.error('❌ Ошибка инициализации карты:', error);
                showNotification('Ошибка загрузки карты', 'error');
                reject(error);
            }
        });
    });
}

/**
 * Инициализирует контроль поиска на карте
 */
function initSearchControl() {
    console.log('ℹ️ Поиск suggest недоступен в бесплатной версии API Яндекс.Карт');
}

/**
 * Инициализирует обработчики событий карты
 */
function initMapEvents() {
    // Обработчик клика по карте
    map.events.add('click', function(e) {
        const coords = e.get('coords');
        
        // Геокодируем координаты в адрес
        geocodeCoordinates(coords).then(address => {
            if (currentMode === 'start') {
                setStartPoint(coords, address);
            } else {
                setFinishPoint(coords, address);
            }
        }).catch(error => {
            console.error('Ошибка геокодирования:', error);
            // Устанавливаем точку без адреса
            if (currentMode === 'start') {
                setStartPoint(coords, 'Точка на карте');
            } else {
                setFinishPoint(coords, 'Точка на карте');
            }
        });
    });
    
    // Обработчик изменения масштаба/центра
    map.events.add('boundschange', function() {
        updateMapControlsVisibility();
    });
}

// ====================== УПРАВЛЕНИЕ ТОЧКАМИ МАРШРУТА ======================

/**
 * Устанавливает точку старта на карте
 * @param {Array} coords - Координаты [широта, долгота]
 * @param {string} address - Адрес точки
 */
function setStartPoint(coords, address = '') {
    // Удаляем старую метку, если есть
    if (startPlacemark) {
        map.geoObjects.remove(startPlacemark);
    }
    
    // Создаем новую метку
    startPlacemark = new ymaps.Placemark(coords, {
        balloonContent: `<strong>Откуда:</strong> ${address || 'Точка на карте'}`
    }, {
        preset: 'islands#greenDotIconWithCaption',
        iconColor: '#4CAF50',
        draggable: true
    });
    
    // Добавляем метку на карту
    map.geoObjects.add(startPlacemark);
    
    // Центрируем карту на новой точке
    map.setCenter(coords, 14);
    
    // Сохраняем данные
    routeData.start_point = {
        lat: coords[0],
        lng: coords[1],
        address: address
    };
    
    // Обновляем отображение адреса
    updateAddressDisplay('start-address', address || 'Точка на карте');
    
    // Строим маршрут, если уже есть точка финиша
    if (finishPlacemark) {
        buildRoute();
    }
    
    // Обновляем информацию о маршруте
    updateRouteInfo();
    
    console.log('📍 Установлена точка старта:', routeData.start_point);
}

/**
 * Устанавливает точку финиша на карте
 * @param {Array} coords - Координаты [широта, долгота]
 * @param {string} address - Адрес точки
 */
function setFinishPoint(coords, address = '') {
    // Удаляем старую метку, если есть
    if (finishPlacemark) {
        map.geoObjects.remove(finishPlacemark);
    }
    
    // Создаем новую метку
    finishPlacemark = new ymaps.Placemark(coords, {
        balloonContent: `<strong>Куда:</strong> ${address || 'Точка на карте'}`
    }, {
        preset: 'islands#redDotIconWithCaption',
        iconColor: '#F44336',
        draggable: true
    });
    
    // Добавляем метку на карту
    map.geoObjects.add(finishPlacemark);
    
    // Сохраняем данные
    routeData.finish_point = {
        lat: coords[0],
        lng: coords[1],
        address: address
    };
    
    // Обновляем отображение адреса
    updateAddressDisplay('finish-address', address || 'Точка на карте');
    
    // Строим маршрут, если уже есть точка старта
    if (startPlacemark) {
        buildRoute();
    }
    
    // Обновляем информацию о маршруте
    updateRouteInfo();
    
    console.log('🏁 Установлена точка финиша:', routeData.finish_point);
}

/**
 * Геокодирует координаты в адрес
 * @param {Array} coords - Координаты [широта, долгота]
 * @returns {Promise<string>} Промис с адресом
 */
function geocodeCoordinates(coords) {
    return new Promise((resolve, reject) => {
        ymaps.geocode(coords).then(function(res) {
            const firstGeoObject = res.geoObjects.get(0);
            if (firstGeoObject) {
                const address = firstGeoObject.getAddressLine();
                resolve(address);
            } else {
                reject(new Error('Адрес не найден'));
            }
        }).catch(reject);
    });
}

// ====================== ПОСТРОЕНИЕ МАРШРУТА ======================

/**
 * Строит маршрут между точками старта и финиша
 */
function buildRoute() {
    if (!startPlacemark || !finishPlacemark) {
        console.log('⚠️ Не хватает точек для построения маршрута');
        return;
    }
    
    const startCoords = startPlacemark.geometry.getCoordinates();
    const finishCoords = finishPlacemark.geometry.getCoordinates();
    
    // Удаляем старый маршрут, если есть
    if (route) {
        map.geoObjects.remove(route);
    }
    
    console.log('🛣️ Построение маршрута...');
    
    // Создаем мультимаршрут
    route = new ymaps.multiRouter.MultiRoute({
        referencePoints: [
            startCoords,
            finishCoords
        ],
        params: {
            routingMode: 'auto' // 'auto', 'masstransit', 'pedestrian'
        }
    }, {
        boundsAutoApply: true, // Автоматически подгонять карту под маршрут
        routeActiveStrokeWidth: 6,
        routeActiveStrokeColor: '#2196F3',
        routeStrokeWidth: 4,
        routeStrokeColor: '#666666'
    });
    
    // Добавляем маршрут на карту
    map.geoObjects.add(route);
    
    // Получаем данные о маршруте
    route.model.events.add('requestsuccess', function() {
        const activeRoute = route.getActiveRoute();
        if (activeRoute) {
            // Получаем дистанцию и время
            const distance = activeRoute.properties.get('distance');
            const duration = activeRoute.properties.get('duration');
            
            // Сохраняем данные
            routeData.distance = parseFloat((distance.value / 1000).toFixed(1)); // Конвертируем в км
            routeData.duration = Math.round(duration.value / 60); // Конвертируем в минуты
            routeData.polyline = activeRoute.properties.get('encodedCoordinates');
            
            console.log('✅ Маршрут построен:', {
                distance: routeData.distance + ' км',
                duration: routeData.duration + ' мин'
            });
            
            // Обновляем информацию о маршруте
            updateRouteInfo();
            
            // Показываем блок с информацией
            document.getElementById('route-info').style.display = 'block';
        }
    });
    
    // Обработчик ошибки построения маршрута
    route.model.events.add('requestfail', function() {
        console.error('❌ Ошибка построения маршрута');
        showNotification('Не удалось построить маршрут', 'error');
    });
}

// ====================== ЭЛЕМЕНТЫ УПРАВЛЕНИЯ ======================

/**
 * Инициализирует элементы управления картой
 */
function initMapControls() {
    // Кнопка "Откуда"
    const btnStart = document.getElementById('btn-set-start');
    if (btnStart) {
        btnStart.addEventListener('click', function() {
            setCurrentMode('start');
        });
    }
    
    // Кнопка "Куда"
    const btnFinish = document.getElementById('btn-set-finish');
    if (btnFinish) {
        btnFinish.addEventListener('click', function() {
            setCurrentMode('finish');
        });
    }
    
    // Кнопка "Очистить"
    const btnClear = document.getElementById('btn-clear-route');
    if (btnClear) {
        btnClear.addEventListener('click', clearRoute);
    }
    
    // Поле поиска
    const searchInput = document.getElementById('map-search-input');
    const searchBtn = document.getElementById('map-search-btn');
    
    if (searchInput && searchBtn) {
        // Поиск по Enter
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch(searchInput.value);
            }
        });
        
        // Поиск по кнопке
        searchBtn.addEventListener('click', function() {
            performSearch(searchInput.value);
        });
    }
}

/**
 * Устанавливает текущий режим выбора точки
 * @param {string} mode - 'start' или 'finish'
 */
function setCurrentMode(mode) {
    currentMode = mode;
    
    // Обновляем стили кнопок
    const btnStart = document.getElementById('btn-set-start');
    const btnFinish = document.getElementById('btn-set-finish');
    
    if (btnStart && btnFinish) {
        if (mode === 'start') {
            btnStart.classList.add('active');
            btnFinish.classList.remove('active');
            btnStart.innerHTML = '<i class="fas fa-map-marker-alt"></i> Выбираем "Откуда"';
            btnFinish.innerHTML = '<i class="fas fa-flag-checkered"></i> Куда';
        } else {
            btnStart.classList.remove('active');
            btnFinish.classList.add('active');
            btnStart.innerHTML = '<i class="fas fa-map-marker-alt"></i> Откуда';
            btnFinish.innerHTML = '<i class="fas fa-flag-checkered"></i> Выбираем "Куда"';
        }
    }
    
    showNotification(`Режим: Выберите точку "${mode === 'start' ? 'Откуда' : 'Куда'}" на карте`, 'info');
}

/**
 * Выполняет поиск по адресу
 * @param {string} query - Поисковый запрос
 */
function performSearch(query) {
    if (!query || !query.trim()) {
        showNotification('Введите адрес для поиска', 'warning');
        return;
    }
    
    // Вместо suggest используем простое геокодирование
    console.log('🔍 Геокодируем адрес:', query);
    showNotification(`Ищем "${query}"...`, 'info');
    
    ymaps.geocode(query).then(function(res) {
        const firstGeoObject = res.geoObjects.get(0);
        if (firstGeoObject) {
            const coords = firstGeoObject.geometry.getCoordinates();
            const address = firstGeoObject.getAddressLine();
            
            // В зависимости от текущего режима устанавливаем точку
            if (currentMode === 'start') {
                setStartPoint(coords, address);
                showNotification(`Установлена точка старта: ${address}`, 'success');
            } else {
                setFinishPoint(coords, address);
                showNotification(`Установлена точка финиша: ${address}`, 'success');
            }
            
            // Центрируем карту на найденной точке
            map.setCenter(coords, 14);
            
        } else {
            showNotification('Адрес не найден', 'warning');
        }
    }).catch(error => {
        console.error('❌ Ошибка геокодирования:', error);
        showNotification('Ошибка поиска адреса', 'error');
    });
}

/**
 * Очищает все точки и маршрут
 */
function clearRoute() {
    // Удаляем метки с карты
    if (startPlacemark) {
        map.geoObjects.remove(startPlacemark);
        startPlacemark = null;
    }
    
    if (finishPlacemark) {
        map.geoObjects.remove(finishPlacemark);
        finishPlacemark = null;
    }
    
    // Удаляем маршрут
    if (route) {
        map.geoObjects.remove(route);
        route = null;
    }
    
    // Сбрасываем данные
    resetRouteData();
    
    // Обновляем отображение
    updateAddressDisplay('start-address', 'Не выбрано');
    updateAddressDisplay('finish-address', 'Не выбрано');
    
    // Скрываем блок информации
    document.getElementById('route-info').style.display = 'none';
    
    // Сбрасываем режим
    setCurrentMode('start');
    
    console.log('🗑️ Маршрут очищен');
    showNotification('Маршрут очищен', 'info');
}

// ====================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ======================

/**
 * Сбрасывает данные маршрута
 */
function resetRouteData() {
    routeData = {
        start_point: null,
        finish_point: null,
        distance: null,
        duration: null,
        polyline: null
    };
}

/**
 * Обновляет отображение информации о маршруте
 */
function updateRouteInfo() {
    // Обновляем дистанцию
    if (routeData.distance !== null) {
        document.getElementById('route-distance').textContent = routeData.distance;
    }
    
    // Обновляем время
    if (routeData.duration !== null) {
        document.getElementById('route-duration').textContent = routeData.duration;
    }
}

/**
 * Обновляет отображение адреса
 * @param {string} elementId - ID элемента
 * @param {string} address - Адрес для отображения
 */
function updateAddressDisplay(elementId, address) {
    const element = document.getElementById(elementId);
    if (element) {
        // Обрезаем длинный адрес
        const maxLength = 40;
        const displayAddress = address.length > maxLength 
            ? address.substring(0, maxLength) + '...' 
            : address;
        
        element.textContent = displayAddress;
        element.title = address; // Полный адрес в tooltip
    }
}

/**
 * Обновляет видимость элементов управления
 */
function updateMapControlsVisibility() {
    // Можно добавить логику скрытия/показа элементов при масштабировании
}

/**
 * Проверяет, готов ли маршрут для отправки
 * @returns {boolean} True если маршрут готов
 */
function isRouteReady() {
    return routeData.start_point !== null && 
           routeData.finish_point !== null && 
           routeData.duration !== null;
}

/**
 * Получает данные маршрута для отправки на сервер
 * @returns {Object} Данные маршрута
 */
function getRouteData() {
    return routeData;
}

/**
 * Проверяет, инициализирована ли карта
 * @returns {boolean} True если карта инициализирована
 */
function isMapInitialized() {
    return map !== null;
}

// ====================== ПУБЛИЧНЫЙ API МОДУЛЯ ======================

// Экспортируем функции, которые будут доступны из других файлов
// Экспортируем функции наружу под именем YandexMapsModule
// В самом конце файла yandex-maps.js
window.YandexMapsModule = {
    initMap: initYandexMap,
    // Добавляем вот эту функцию:
    isMapInitialized: function() {
        return map !== null; 
    },
    setCurrentMode: function(mode) {
        currentMode = mode;
        console.log('📍 Режим карты изменен на:', mode);
    },
    getRouteData: function() {
        return routeData;
    },
    clearRoute: function() {
        if (map) {
            map.geoObjects.removeAll();
            if (typeof resetRouteData === 'function') resetRouteData();
        }
    }
};

console.log('✅ Модуль Яндекс.Карт загружен');

