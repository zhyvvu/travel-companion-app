// ====================== trip-route-map.js ======================
// Комплексный модуль для работы с маршрутами в форме создания поездки

let routeMap = null;
let startPlacemark = null;
let finishPlacemark = null;
let route = null;
let currentMode = 'start'; // 'start' или 'finish'
let searchControl = null;

// Данные маршрута для отправки на сервер
let routeData = {
    start_point: null,
    finish_point: null,
    distance: null,      // км
    duration: null,      // минуты
    polyline: null,      // геометрия маршрута
    bounds: null         // границы маршрута
};

// ====================== ОСНОВНЫЕ ФУНКЦИИ ======================

/**
 * Инициализирует карту маршрута
 */
function initRouteMap() {
    if (typeof ymaps === 'undefined') {
        console.error('❌ Яндекс.Карты API не загружен');
        return Promise.reject('Yandex Maps API not loaded');
    }
    
    return new Promise((resolve, reject) => {
        ymaps.ready(() => {
            try {
                // Создаем карту
                routeMap = new ymaps.Map('route-map', {
                    center: [55.76, 37.64],
                    zoom: 10,
                    controls: ['zoomControl', 'fullscreenControl']
                });
                
                console.log('✅ Карта маршрута инициализирована');
                
                // Инициализируем компоненты
                initMapControls();
                initMapEvents();
                
                resolve(routeMap);
                
            } catch (error) {
                console.error('❌ Ошибка инициализации карты:', error);
                reject(error);
            }
        });
    });
}

/**
 * Показывает карту маршрута
 */
function showRouteMap() {
    const container = document.getElementById('route-map-container');
    if (container) {
        container.style.display = 'block';
        
        // Если карта ещё не инициализирована
        if (!routeMap) {
            initRouteMap().then(() => {
                console.log('✅ Карта готова к использованию');
                fitMapToViewport();
            });
        } else {
            fitMapToViewport();
        }
    }
}

/**
 * Скрывает карту маршрута
 */
function hideRouteMap() {
    const container = document.getElementById('route-map-container');
    if (container) {
        container.style.display = 'none';
    }
}

/**
 * Подгоняет карту под размер контейнера
 */
function fitMapToViewport() {
    if (routeMap) {
        setTimeout(() => {
            routeMap.container.fitToViewport();
        }, 100);
    }
}

// ====================== УПРАВЛЕНИЕ ТОЧКАМИ МАРШРУТА ======================

/**
 * Устанавливает точку начала маршрута
 * @param {Array} coords - Координаты [широта, долгота]
 * @param {string} address - Адрес (опционально)
 */
function setStartPoint(coords, address = '') {
    // Удаляем старую метку
    if (startPlacemark) {
        routeMap.geoObjects.remove(startPlacemark);
    }
    
    // Создаем новую метку
    startPlacemark = new ymaps.Placemark(coords, {
        balloonContent: `<strong>Откуда:</strong> ${address || 'Точка на карте'}`,
        hintContent: 'Место отправления'
    }, {
        preset: 'islands#greenIcon',
        draggable: true
    });
    
    // Добавляем обработчик перетаскивания
    startPlacemark.events.add('dragend', function() {
        const newCoords = startPlacemark.geometry.getCoordinates();
        updatePointFromDrag('start', newCoords);
    });
    
    // Добавляем на карту
    routeMap.geoObjects.add(startPlacemark);
    
    // Сохраняем данные
    routeData.start_point = {
        lat: coords[0],
        lng: coords[1],
        address: address
    };
    
    // Обновляем поле ввода
    updateAddressField('trip-from', address || 'Точка на карте');
    
    // Строим маршрут, если есть вторая точка
    if (finishPlacemark) {
        buildRoute();
    }
    
    console.log('📍 Установлена точка старта:', routeData.start_point);
}

/**
 * Устанавливает точку окончания маршрута
 * @param {Array} coords - Координаты [широта, долгота]
 * @param {string} address - Адрес (опционально)
 */
function setFinishPoint(coords, address = '') {
    // Удаляем старую метку
    if (finishPlacemark) {
        routeMap.geoObjects.remove(finishPlacemark);
    }
    
    // Создаем новую метку
    finishPlacemark = new ymaps.Placemark(coords, {
        balloonContent: `<strong>Куда:</strong> ${address || 'Точка на карте'}`,
        hintContent: 'Место назначения'
    }, {
        preset: 'islands#redIcon',
        draggable: true
    });
    
    // Добавляем обработчик перетаскивания
    finishPlacemark.events.add('dragend', function() {
        const newCoords = finishPlacemark.geometry.getCoordinates();
        updatePointFromDrag('finish', newCoords);
    });
    
    // Добавляем на карту
    routeMap.geoObjects.add(finishPlacemark);
    
    // Сохраняем данные
    routeData.finish_point = {
        lat: coords[0],
        lng: coords[1],
        address: address
    };
    
    // Обновляем поле ввода
    updateAddressField('trip-to', address || 'Точка на карте');
    
    // Строим маршрут, если есть первая точка
    if (startPlacemark) {
        buildRoute();
    }
    
    console.log('🏁 Установлена точка финиша:', routeData.finish_point);
}

/**
 * Обновляет точку после перетаскивания
 */
function updatePointFromDrag(pointType, coords) {
    const isStart = pointType === 'start';
    
    // Геокодируем новые координаты
    ymaps.geocode(coords).then(function(res) {
        const firstGeoObject = res.geoObjects.get(0);
        const address = firstGeoObject ? firstGeoObject.getAddressLine() : 'Точка на карте';
        
        // Обновляем данные
        if (isStart) {
            routeData.start_point = {
                lat: coords[0],
                lng: coords[1],
                address: address
            };
            updateAddressField('trip-from', address);
        } else {
            routeData.finish_point = {
                lat: coords[0],
                lng: coords[1],
                address: address
            };
            updateAddressField('trip-to', address);
        }
        
        // Перестраиваем маршрут
        buildRoute();
        
        console.log(`📍 Точка ${pointType} обновлена:`, address);
    });
}

// ====================== ПОСТРОЕНИЕ МАРШРУТА ======================

/**
 * Строит маршрут между точками
 */
function buildRoute() {
    if (!startPlacemark || !finishPlacemark) {
        console.log('⚠️ Не хватает точек для маршрута');
        return;
    }
    
    const startCoords = startPlacemark.geometry.getCoordinates();
    const finishCoords = finishPlacemark.geometry.getCoordinates();
    
    // Удаляем старый маршрут
    if (route) {
        routeMap.geoObjects.remove(route);
    }
    
    console.log('🛣️ Построение маршрута...');
    
    // Создаем мультимаршрут
    route = new ymaps.multiRouter.MultiRoute({
        referencePoints: [startCoords, finishCoords],
        params: {
            routingMode: 'auto'
        }
    }, {
        boundsAutoApply: true,
        routeActiveStrokeWidth: 6,
        routeActiveStrokeColor: '#2196F3'
    });
    
    // Добавляем маршрут на карту
    routeMap.geoObjects.add(route);
    
    // Обработчик успешного построения
    route.model.events.add('requestsuccess', function() {
        const activeRoute = route.getActiveRoute();
        if (activeRoute) {
            // Получаем данные маршрута
            const distance = activeRoute.properties.get('distance');
            const duration = activeRoute.properties.get('duration');
            
            // Сохраняем данные
            routeData.distance = parseFloat((distance.value / 1000).toFixed(1)); // в км
            routeData.duration = Math.round(duration.value / 60); // в минутах
            routeData.polyline = activeRoute.properties.get('encodedCoordinates');
            routeData.bounds = routeMap.getBounds();
            
            console.log('✅ Маршрут построен:', {
                distance: routeData.distance + ' км',
                duration: routeData.duration + ' мин'
            });
            
            // Обновляем UI
            updateRouteInfo();
            updateArrivalTime();
            
            // Сохраняем данные в скрытое поле
            saveRouteData();
        }
    });
}

// ====================== ГЕОКОДИРОВАНИЕ ======================

/**
 * Ищет адрес и устанавливает точку
 */
function searchAndSetPoint(address, pointType) {
    if (!address.trim()) {
        alert('Введите адрес для поиска');
        return;
    }
    
    console.log(`🔍 Поиск адреса (${pointType}):`, address);
    
    ymaps.geocode(address).then(function(res) {
        const firstGeoObject = res.geoObjects.get(0);
        
        if (!firstGeoObject) {
            alert('Адрес не найден. Уточните запрос.');
            return;
        }
        
        const coords = firstGeoObject.geometry.getCoordinates();
        const foundAddress = firstGeoObject.getAddressLine();
        
        // Устанавливаем точку
        if (pointType === 'start') {
            setStartPoint(coords, foundAddress);
        } else {
            setFinishPoint(coords, foundAddress);
        }
        
        // Центрируем карту
        routeMap.setCenter(coords, 14);
        
        // Показываем карту, если скрыта
        showRouteMap();
        
    }).catch(function(error) {
        console.error('❌ Ошибка поиска адреса:', error);
        alert('Ошибка поиска адреса');
    });
}

/**
 * Геокодирует координаты в адрес
 */
function geocodeCoords(coords) {
    return new Promise((resolve, reject) => {
        ymaps.geocode(coords).then(function(res) {
            const firstGeoObject = res.geoObjects.get(0);
            if (firstGeoObject) {
                resolve(firstGeoObject.getAddressLine());
            } else {
                reject(new Error('Адрес не найден'));
            }
        }).catch(reject);
    });
}

// ====================== ОБНОВЛЕНИЕ UI ======================

/**
 * Обновляет информацию о маршруте
 */
function updateRouteInfo() {
    // Расстояние
    if (routeData.distance !== null) {
        document.getElementById('route-distance').textContent = routeData.distance + ' км';
    }
    
    // Время в пути
    if (routeData.duration !== null) {
        document.getElementById('route-duration').textContent = routeData.duration + ' мин';
    }
    
    // Адреса
    if (routeData.start_point?.address) {
        document.getElementById('start-address').textContent = 
            truncateAddress(routeData.start_point.address, 40);
    }
    
    if (routeData.finish_point?.address) {
        document.getElementById('finish-address').textContent = 
            truncateAddress(routeData.finish_point.address, 40);
    }
    
    // Показываем блок информации
    document.getElementById('route-info').style.display = 'block';
}

/**
 * Обновляет поле ввода адреса
 */
function updateAddressField(fieldId, address) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.value = address;
    }
}

/**
 * Обрезает длинный адрес
 */
function truncateAddress(address, maxLength) {
    return address.length > maxLength ? 
        address.substring(0, maxLength) + '...' : 
        address;
}

/**
 * Обновляет расчётное время прибытия
 */
function updateArrivalTime() {
    const dateInput = document.getElementById('trip-date');
    const timeInput = document.getElementById('trip-time');
    
    if (!dateInput.value || !timeInput.value || !routeData.duration) {
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
        document.getElementById('arrival-time').textContent = `${hours}:${minutes}`;
        document.getElementById('arrival-time-container').style.display = 'block';
        
        console.log('⏰ Расчётное время прибытия:', `${hours}:${minutes}`);
        
    } catch (error) {
        console.error('❌ Ошибка расчёта времени прибытия:', error);
    }
}

// ====================== СОХРАНЕНИЕ ДАННЫХ ======================

/**
 * Сохраняет данные маршрута в скрытое поле
 */
function saveRouteData() {
    const dataField = document.getElementById('route-data');
    if (dataField) {
        dataField.value = JSON.stringify(routeData);
        console.log('💾 Данные маршрута сохранены');
    }
}

/**
 * Возвращает данные маршрута
 */
function getRouteData() {
    return routeData;
}

/**
 * Очищает маршрут
 */
function clearRoute() {
    // Удаляем метки
    if (startPlacemark) {
        routeMap.geoObjects.remove(startPlacemark);
        startPlacemark = null;
    }
    
    if (finishPlacemark) {
        routeMap.geoObjects.remove(finishPlacemark);
        finishPlacemark = null;
    }
    
    // Удаляем маршрут
    if (route) {
        routeMap.geoObjects.remove(route);
        route = null;
    }
    
    // Сбрасываем данные
    routeData = {
        start_point: null,
        finish_point: null,
        distance: null,
        duration: null,
        polyline: null,
        bounds: null
    };
    
    // Очищаем скрытое поле
    const dataField = document.getElementById('route-data');
    if (dataField) {
        dataField.value = '';
    }
    
    // Скрываем информацию
    document.getElementById('route-info').style.display = 'none';
    document.getElementById('arrival-time-container').style.display = 'none';
    
    console.log('🗑️ Маршрут очищен');
}

// ====================== ОБРАБОТЧИКИ СОБЫТИЙ ======================

/**
 * Инициализирует обработчики событий карты
 */
function initMapEvents() {
    // Клик по карте
    routeMap.events.add('click', function(e) {
        const coords = e.get('coords');
        
        geocodeCoords(coords).then(address => {
            if (currentMode === 'start') {
                setStartPoint(coords, address);
            } else {
                setFinishPoint(coords, address);
            }
        }).catch(() => {
            if (currentMode === 'start') {
                setStartPoint(coords, 'Точка на карте');
            } else {
                setFinishPoint(coords, 'Точка на карте');
            }
        });
    });
}

/**
 * Инициализирует элементы управления
 */
function initMapControls() {
    // Кнопка выбора точки старта
    document.getElementById('btn-set-start')?.addEventListener('click', function() {
        currentMode = 'start';
        updateModeButtons();
        alert('Кликните на карте для выбора точки "Откуда"');
    });
    
    // Кнопка выбора точки финиша
    document.getElementById('btn-set-finish')?.addEventListener('click', function() {
        currentMode = 'finish';
        updateModeButtons();
        alert('Кликните на карте для выбора точки "Куда"');
    });
    
    // Кнопка поиска на карте
    document.getElementById('btn-search-on-map')?.addEventListener('click', function() {
        const query = prompt('Введите адрес для поиска на карте:');
        if (query) {
            searchAndSetPoint(query, currentMode);
        }
    });
    
    // Кнопка показать маршрут
    document.getElementById('btn-show-route-on-map')?.addEventListener('click', function() {
        const fromAddress = document.getElementById('trip-from').value.trim();
        const toAddress = document.getElementById('trip-to').value.trim();
        
        if (fromAddress && toAddress) {
            // Ищем оба адреса
            searchAndSetPoint(fromAddress, 'start');
            setTimeout(() => {
                searchAndSetPoint(toAddress, 'finish');
            }, 1000);
        } else if (fromAddress) {
            searchAndSetPoint(fromAddress, 'start');
        } else if (toAddress) {
            searchAndSetPoint(toAddress, 'finish');
        } else {
            showRouteMap();
        }
    });
    
    // Кнопка скрыть карту
    document.getElementById('btn-hide-map')?.addEventListener('click', hideRouteMap);
    
    // Кнопка поменять местами
    document.getElementById('btn-swap-route')?.addEventListener('click', function() {
        const fromField = document.getElementById('trip-from');
        const toField = document.getElementById('trip-to');
        
        // Меняем значения полей
        const temp = fromField.value;
        fromField.value = toField.value;
        toField.value = temp;
        
        // Если есть точки на карте - меняем их
        if (routeData.start_point && routeData.finish_point) {
            const tempPoint = routeData.start_point;
            routeData.start_point = routeData.finish_point;
            routeData.finish_point = tempPoint;
            
            // Обновляем метки
            if (startPlacemark && finishPlacemark) {
                setStartPoint([routeData.start_point.lat, routeData.start_point.lng], routeData.start_point.address);
                setFinishPoint([routeData.finish_point.lat, routeData.finish_point.lng], routeData.finish_point.address);
            }
        }
    });
}

/**
 * Обновляет состояние кнопок выбора режима
 */
function updateModeButtons() {
    const startBtn = document.getElementById('btn-set-start');
    const finishBtn = document.getElementById('btn-set-finish');
    
    if (startBtn && finishBtn) {
        startBtn.classList.toggle('active', currentMode === 'start');
        finishBtn.classList.toggle('active', currentMode === 'finish');
    }
}

// ====================== ПУБЛИЧНЫЙ API ======================

window.TripRouteMap = {
    init: initRouteMap,
    show: showRouteMap,
    hide: hideRouteMap,
    setStartPoint: setStartPoint,
    setFinishPoint: setFinishPoint,
    searchAndSetPoint: searchAndSetPoint,
    getRouteData: getRouteData,
    clearRoute: clearRoute,
    buildRoute: buildRoute
};

console.log('✅ Модуль TripRouteMap загружен');