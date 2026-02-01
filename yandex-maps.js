// ====================== yandex-maps.js ======================
let map = null;
let startPlacemark = null;
let finishPlacemark = null;
let route = null;
let currentMode = 'start'; 
let suggestView = null; // Добавили переменную для саджеста

let routeData = {
    start_point: null,
    finish_point: null,
    distance: null,
    duration: null,
    polyline: null
};

function showNotification(message, type = 'info') {
    if (window.showNotification) {
        window.showNotification(message, type);
    } else {
        console.log(`${type.toUpperCase()}: ${message}`);
    }
}

// ====================== ИНИЦИАЛИЗАЦИЯ КАРТЫ ======================

function initYandexMap() {
    if (map !== null) {
        console.log('🗺️ Карта уже инициализирована');
        clearRoute(); 
        return Promise.resolve(map);
    }

    return new Promise((resolve, reject) => {
        if (typeof ymaps === 'undefined') {
            console.error('❌ API не загружен');
            return reject(new Error('Yandex Maps API not loaded'));
        }

        ymaps.ready(() => {
            try {
                const mapContainer = document.getElementById('yandex-map');
                if (!mapContainer) return reject(new Error('Map container not found'));

                map = new ymaps.Map('yandex-map', {
                    center: [45.035474, 38.975313], // Краснодар
                    zoom: 12,
                    controls: ['zoomControl', 'geolocationControl', 'fullscreenControl']
                });

                // Инициализируем компоненты
                initSearchControl(); // <--- ТЕПЕРЬ РАБОТАЕТ
                initMapEvents();
                initMapControls();
                resetRouteData();

                resolve(map);
            } catch (error) {
                console.error('❌ Ошибка:', error);
                reject(error);
            }
        });
    });
}

/**
 * Инициализирует ПОДСКАЗКИ (Suggest) для поиска
 */
function initSearchControl() {
    const searchInput = document.getElementById('map-search-input');
    if (!searchInput) return;

    console.log('🔍 Подключение саджеста к полю поиска...');

    // Создаем экземпляр подсказок
    suggestView = new ymaps.SuggestView('map-search-input', {
        results: 5
    });

    // Обработка выбора из списка
    suggestView.events.add('select', (e) => {
        const selectedValue = e.get('item').value;
        performSearch(selectedValue); // Выполняем поиск при выборе
    });
}

function initMapEvents() {
    map.events.add('click', function(e) {
        const coords = e.get('coords');
        geocodeCoordinates(coords).then(address => {
            if (currentMode === 'start') setStartPoint(coords, address);
            else setFinishPoint(coords, address);
        });
    });
}

// ====================== УПРАВЛЕНИЕ ТОЧКАМИ ======================

function setStartPoint(coords, address = '') {
    if (startPlacemark) map.geoObjects.remove(startPlacemark);
    
    startPlacemark = new ymaps.Placemark(coords, {
        balloonContent: `<strong>Откуда:</strong> ${address}`
    }, {
        preset: 'islands#greenDotIconWithCaption',
        iconColor: '#4CAF50',
        draggable: true
    });
    
    map.geoObjects.add(startPlacemark);
    routeData.start_point = { lat: coords[0], lng: coords[1], address: address };
    updateAddressDisplay('start-address', address || 'Точка на карте');
    
    if (finishPlacemark) buildRoute();
}

function setFinishPoint(coords, address = '') {
    if (finishPlacemark) map.geoObjects.remove(finishPlacemark);
    
    finishPlacemark = new ymaps.Placemark(coords, {
        balloonContent: `<strong>Куда:</strong> ${address}`
    }, {
        preset: 'islands#redDotIconWithCaption',
        iconColor: '#F44336',
        draggable: true
    });
    
    map.geoObjects.add(finishPlacemark);
    routeData.finish_point = { lat: coords[0], lng: coords[1], address: address };
    updateAddressDisplay('finish-address', address || 'Точка на карте');
    
    if (startPlacemark) buildRoute();
}

function geocodeCoordinates(coords) {
    return ymaps.geocode(coords).then(res => res.geoObjects.get(0).getAddressLine());
}

// ====================== ПОИСК И МАРШРУТ ======================

function performSearch(query) {
    if (!query) return;
    
    ymaps.geocode(query).then(res => {
        const firstGeoObject = res.geoObjects.get(0);
        if (firstGeoObject) {
            const coords = firstGeoObject.geometry.getCoordinates();
            const address = firstGeoObject.getAddressLine();
            
            if (currentMode === 'start') setStartPoint(coords, address);
            else setFinishPoint(coords, address);
            
            map.setCenter(coords, 14);
        }
    });
}

function buildRoute() {
    if (!startPlacemark || !finishPlacemark) return;
    
    if (route) map.geoObjects.remove(route);
    
    route = new ymaps.multiRouter.MultiRoute({
        referencePoints: [
            startPlacemark.geometry.getCoordinates(),
            finishPlacemark.geometry.getCoordinates()
        ]
    }, {
        boundsAutoApply: true,
        routeActiveStrokeWidth: 6,
        routeActiveStrokeColor: '#2196F3'
    });
    
    map.geoObjects.add(route);
    
    route.model.events.add('requestsuccess', () => {
        const activeRoute = route.getActiveRoute();
        if (activeRoute) {
            routeData.distance = parseFloat((activeRoute.properties.get('distance').value / 1000).toFixed(1));
            routeData.duration = Math.round(activeRoute.properties.get('duration').value / 60);
            
            document.getElementById('route-distance').textContent = routeData.distance;
            document.getElementById('route-duration').textContent = routeData.duration;
            document.getElementById('route-info').style.display = 'block';
        }
    });
}

// ====================== КНОПКИ И API ======================

function initMapControls() {
    document.getElementById('btn-set-start')?.addEventListener('click', () => setCurrentMode('start'));
    document.getElementById('btn-set-finish')?.addEventListener('click', () => setCurrentMode('finish'));
    document.getElementById('btn-clear-route')?.addEventListener('click', clearRoute);
    
    const searchInput = document.getElementById('map-search-input');
    searchInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch(searchInput.value);
    });
    
    document.getElementById('map-search-btn')?.addEventListener('click', () => {
        performSearch(searchInput?.value);
    });
}

function setCurrentMode(mode) {
    currentMode = mode;
    const btnS = document.getElementById('btn-set-start');
    const btnF = document.getElementById('btn-set-finish');
    
    if (mode === 'start') {
        btnS?.classList.add('active'); btnF?.classList.remove('active');
    } else {
        btnS?.classList.remove('active'); btnF?.classList.add('active');
    }
}

function clearRoute() {
    if (map) {
        map.geoObjects.removeAll();
        startPlacemark = null; finishPlacemark = null; route = null;
        resetRouteData();
        document.getElementById('route-info').style.display = 'none';
        updateAddressDisplay('start-address', 'Не выбрано');
        updateAddressDisplay('finish-address', 'Не выбрано');
    }
}

function resetRouteData() {
    routeData = { start_point: null, finish_point: null, distance: null, duration: null, polyline: null };
}

function updateAddressDisplay(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text.length > 35 ? text.substring(0, 35) + '...' : text;
}

window.YandexMapsModule = {
    initMap: initYandexMap,
    getRouteData: () => routeData,
    clearRoute: clearRoute,
    setCurrentMode: (mode) => currentMode = mode
    isMapInitialized: () => {
        return map !== null;
    }
};

