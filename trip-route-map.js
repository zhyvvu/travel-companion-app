// ====================== trip-route-map.js ======================
// Комплексный модуль для работы с маршрутами в форме создания поездки

// Глобальный объект для Яндекс Карт
window.YandexMapsModule = (function() {
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
    
    // ====================== ПУБЛИЧНЫЕ МЕТОДЫ ======================
    
    /**
     * Инициализирует карту маршрута
     */
    function initRouteMap() {
        console.log('🗺️ Инициализация карты маршрута...');
        
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
     * Инициализирует карту на новом экране create-trip-map
     */
    function initMap() {
        console.log('🗺️ Инициализация карты на экране create-trip-map...');
        
        if (typeof ymaps === 'undefined') {
            console.error('❌ Яндекс.Карты API не загружен');
            return Promise.reject('Yandex Maps API not loaded');
        }
        
        return new Promise((resolve, reject) => {
            ymaps.ready(() => {
                try {
                    // Создаем карту
                    routeMap = new ymaps.Map('yandex-map', {
                        center: [55.76, 37.64],
                        zoom: 10,
                        controls: ['zoomControl', 'fullscreenControl']
                    });
                    
                    console.log('✅ Карта на create-trip-map инициализирована');
                    
                    // Инициализируем компоненты для нового экрана
                    initCreateTripMapControls();
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
     * Проверяет, инициализирована ли карта
     */
    function isMapInitialized() {
        return routeMap !== null;
    }
    
    /**
     * Устанавливает текущий режим (start/finish)
     */
    function setCurrentMode(mode) {
        if (mode === 'start' || mode === 'finish') {
            currentMode = mode;
            updateModeButtons();
            console.log(`📌 Режим установлен: ${mode}`);
        }
    }
    
    /**
     * Получить данные маршрута
     */
    function getRouteData() {
        return routeData;
    }
    
    /**
     * Очистить маршрут
     */
    function clearRoute() {
        console.log('🗑️ Очистка маршрута...');
        
        // Удаляем метки
        if (startPlacemark && routeMap) {
            routeMap.geoObjects.remove(startPlacemark);
            startPlacemark = null;
        }
        
        if (finishPlacemark && routeMap) {
            routeMap.geoObjects.remove(finishPlacemark);
            finishPlacemark = null;
        }
        
        // Удаляем маршрут
        if (route && routeMap) {
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
        
        // Обновляем UI
        updateRouteInfo();
        
        console.log('✅ Маршрут очищен');
    }
    
    /**
     * Построить маршрут
     */
    function buildRoute() {
        if (!startPlacemark || !finishPlacemark || !routeMap) {
            console.log('⚠️ Не хватает точек для маршрута или карта не инициализирована');
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
                
                // Сохраняем данные в скрытое поле
                saveRouteData();
            }
        });
    }
    
    // ====================== ПРИВАТНЫЕ МЕТОДЫ ======================
    
    /**
     * Инициализирует элементы управления для старой формы
     */
    function initMapControls() {
        console.log('🎮 Инициализация элементов управления картой...');
        
        // Кнопка выбора точки старта
        const startBtn = document.getElementById('btn-set-start');
        if (startBtn) {
            startBtn.addEventListener('click', function() {
                currentMode = 'start';
                updateModeButtons();
                showNotification('Кликните на карте для выбора точки "Откуда"', 'info');
            });
        }
        
        // Кнопка выбора точки финиша
        const finishBtn = document.getElementById('btn-set-finish');
        if (finishBtn) {
            finishBtn.addEventListener('click', function() {
                currentMode = 'finish';
                updateModeButtons();
                showNotification('Кликните на карте для выбора точки "Куда"', 'info');
            });
        }
        
        // Кнопка поиска на карте
        const searchBtn = document.getElementById('btn-search-on-map');
        if (searchBtn) {
            searchBtn.addEventListener('click', function() {
                const query = prompt('Введите адрес для поиска на карте:');
                if (query) {
                    searchAndSetPoint(query, currentMode);
                }
            });
        }
    }
    
    /**
     * Инициализирует элементы управления для новой формы с картой
     */
    function initCreateTripMapControls() {
        console.log('🎮 Инициализация элементов управления для create-trip-map...');
        
        // Кнопка выбора точки старта
        const startBtn = document.getElementById('btn-set-start');
        if (startBtn) {
            startBtn.addEventListener('click', function() {
                setCurrentMode('start');
                showNotification('Кликните на карте для выбора точки "Откуда"', 'info');
            });
        }
        
        // Кнопка выбора точки финиша
        const finishBtn = document.getElementById('btn-set-finish');
        if (finishBtn) {
            finishBtn.addEventListener('click', function() {
                setCurrentMode('finish');
                showNotification('Кликните на карте для выбора точки "Куда"', 'info');
            });
        }
        
        // Кнопка очистки маршрута
        const clearBtn = document.getElementById('btn-clear-route');
        if (clearBtn) {
            clearBtn.addEventListener('click', function() {
                clearRoute();
                showNotification('Маршрут очищен', 'info');
            });
        }
        
        // Поиск по адресу
        const searchInput = document.getElementById('map-search-input');
        const searchBtn = document.getElementById('map-search-btn');
        
        if (searchInput && searchBtn) {
            searchBtn.addEventListener('click', function() {
                const query = searchInput.value.trim();
                if (query) {
                    searchAndSetPoint(query, currentMode);
                }
            });
            
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    const query = searchInput.value.trim();
                    if (query) {
                        searchAndSetPoint(query, currentMode);
                    }
                }
            });
        }
    }
    
    /**
     * Ищет адрес и устанавливает точку
     */
    function searchAndSetPoint(address, pointType) {
        if (!address.trim()) {
            showNotification('Введите адрес для поиска', 'warning');
            return;
        }
        
        console.log(`🔍 Поиск адреса (${pointType}):`, address);
        
        ymaps.geocode(address).then(function(res) {
            const firstGeoObject = res.geoObjects.get(0);
            
            if (!firstGeoObject) {
                showNotification('Адрес не найден. Уточните запрос.', 'warning');
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
            if (routeMap) {
                routeMap.setCenter(coords, 14);
            }
            
            showNotification(`Точка установлена: ${foundAddress}`, 'success');
            
        }).catch(function(error) {
            console.error('❌ Ошибка поиска адреса:', error);
            showNotification('Ошибка поиска адреса', 'error');
        });
    }
    
    /**
     * Устанавливает точку начала маршрута
     */
    function setStartPoint(coords, address = '') {
        if (!routeMap) return;
        
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
        
        console.log('📍 Установлена точка старта:', routeData.start_point);
        
        // Строим маршрут, если есть вторая точка
        if (finishPlacemark) {
            buildRoute();
        }
        
        // Обновляем UI
        updateRouteInfo();
    }
    
    /**
     * Устанавливает точку окончания маршрута
     */
    function setFinishPoint(coords, address = '') {
        if (!routeMap) return;
        
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
        
        console.log('🏁 Установлена точка финиша:', routeData.finish_point);
        
        // Строим маршрут, если есть первая точка
        if (startPlacemark) {
            buildRoute();
        }
        
        // Обновляем UI
        updateRouteInfo();
    }
    
    /**
     * Инициализирует обработчики событий карты
     */
    function initMapEvents() {
        if (!routeMap) return;
        
        // Клик по карте
        routeMap.events.add('click', function(e) {
            const coords = e.get('coords');
            
            // Геокодируем координаты в адрес
            ymaps.geocode(coords).then(function(res) {
                const firstGeoObject = res.geoObjects.get(0);
                const address = firstGeoObject ? firstGeoObject.getAddressLine() : 'Точка на карте';
                
                if (currentMode === 'start') {
                    setStartPoint(coords, address);
                } else {
                    setFinishPoint(coords, address);
                }
                
            }).catch(function() {
                // Если геокодирование не удалось, используем координаты
                if (currentMode === 'start') {
                    setStartPoint(coords, 'Точка на карте');
                } else {
                    setFinishPoint(coords, 'Точка на карте');
                }
            });
        });
    }
    
    /**
     * Обновляет информацию о маршруте в UI
     */
    function updateRouteInfo() {
        // Для старой формы
        if (document.getElementById('route-distance')) {
            if (routeData.distance !== null) {
                document.getElementById('route-distance').textContent = routeData.distance + ' км';
            }
            
            if (routeData.duration !== null) {
                document.getElementById('route-duration').textContent = routeData.duration + ' мин';
            }
            
            if (routeData.start_point?.address) {
                document.getElementById('start-address').textContent = 
                    truncateAddress(routeData.start_point.address, 40);
            }
            
            if (routeData.finish_point?.address) {
                document.getElementById('finish-address').textContent = 
                    truncateAddress(routeData.finish_point.address, 40);
            }
            
            // Показываем блок информации
            const routeInfo = document.getElementById('route-info');
            if (routeInfo && (routeData.start_point || routeData.finish_point)) {
                routeInfo.style.display = 'block';
            }
        }
        
        // Для новой формы create-trip-map
        if (document.getElementById('route-info') && document.getElementById('route-info').classList.contains('route-info')) {
            const routeInfo = document.getElementById('route-info');
            const distanceSpan = document.querySelector('#route-info #route-distance');
            const durationSpan = document.querySelector('#route-info #route-duration');
            const startSpan = document.querySelector('#route-info #start-address');
            const finishSpan = document.querySelector('#route-info #finish-address');
            
            if (distanceSpan && routeData.distance !== null) {
                distanceSpan.textContent = routeData.distance + ' км';
            }
            
            if (durationSpan && routeData.duration !== null) {
                durationSpan.textContent = routeData.duration + ' мин';
            }
            
            if (startSpan && routeData.start_point?.address) {
                startSpan.textContent = routeData.start_point.address;
            }
            
            if (finishSpan && routeData.finish_point?.address) {
                finishSpan.textContent = routeData.finish_point.address;
            }
            
            // Показываем блок, если есть данные
            if (routeData.start_point || routeData.finish_point) {
                routeInfo.style.display = 'block';
            }
        }
    }
    
    /**
     * Обновляет состояние кнопок выбора режима
     */
    function updateModeButtons() {
        // Для старой формы
        const oldStartBtn = document.getElementById('btn-set-start');
        const oldFinishBtn = document.getElementById('btn-set-finish');
        
        if (oldStartBtn && oldFinishBtn) {
            oldStartBtn.classList.toggle('active', currentMode === 'start');
            oldFinishBtn.classList.toggle('active', currentMode === 'finish');
        }
        
        // Для новой формы
        const newStartBtn = document.getElementById('btn-set-start');
        const newFinishBtn = document.getElementById('btn-set-finish');
        
        if (newStartBtn && newFinishBtn) {
            newStartBtn.classList.toggle('active', currentMode === 'start');
            newFinishBtn.classList.toggle('active', currentMode === 'finish');
        }
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
            } else {
                routeData.finish_point = {
                    lat: coords[0],
                    lng: coords[1],
                    address: address
                };
            }
            
            // Перестраиваем маршрут
            buildRoute();
            
            console.log(`📍 Точка ${pointType} обновлена:`, address);
        });
    }
    
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
     * Обрезает длинный адрес
     */
    function truncateAddress(address, maxLength) {
        return address.length > maxLength ? 
            address.substring(0, maxLength) + '...' : 
            address;
    }
    
    /**
     * Показывает уведомление
     */
    function showNotification(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // Можно добавить визуальные уведомления
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
        }
    }
    
    // ====================== ПУБЛИЧНЫЙ ИНТЕРФЕЙС ======================
    return {
        init: initRouteMap,
        initMap: initMap,
        isMapInitialized: isMapInitialized,
        setCurrentMode: setCurrentMode,
        getRouteData: getRouteData,
        clearRoute: clearRoute,
        buildRoute: buildRoute,
        searchAndSetPoint: searchAndSetPoint,
        setStartPoint: setStartPoint,
        setFinishPoint: setFinishPoint
        updateRouteInfo: updateRouteInfo
    };
})();

console.log('✅ Модуль YandexMapsModule загружен и готов к использованию');