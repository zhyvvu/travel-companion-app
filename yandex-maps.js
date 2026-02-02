// ====================== yandex-maps.js (ПОЛНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ) ======================
let map = null;
let startPlacemark = null;
let finishPlacemark = null;
let route = null;
let currentMode = 'start'; 

let routeData = {
    start_point: null,
    finish_point: null,
    distance: null,
    duration: null,
    polyline: null
};

function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function initYandexMap() {
    if (map !== null) return Promise.resolve(map);

    return new Promise((resolve, reject) => {
        ymaps.ready(() => {
            try {
                map = new ymaps.Map('yandex-map', {
                    center: [45.035474, 38.975313],
                    zoom: 12,
                    controls: ['zoomControl', 'geolocationControl', 'fullscreenControl']
                });

                initMapEvents();
                initMapControls();
                
                // Исправленные ID для привязки подсказок к элементам из index.html
                const inputs = [
                    {i: 'find-from', s: 'find-from-suggestions'},
                    {i: 'find-to', s: 'find-to-suggestions'},
                    {i: 'map-search-input', s: 'map-search-input-suggestions'}
                ];
                inputs.forEach(pair => bindCustomSuggest(pair.i, pair.s));

                resolve(map);
            } catch (error) {
                console.error("Ошибка инициализации карты:", error);
                reject(error);
            }
        });
    });
}

function bindCustomSuggest(inputId, suggestionsId) {
    const input = document.getElementById(inputId);
    const container = document.getElementById(suggestionsId);
    let timeout = null;

    if (!input || !container) return;

    input.addEventListener('input', () => {
        clearTimeout(timeout);
        const query = input.value.trim();
        if (query.length < 2) {
            container.style.display = 'none';
            return;
        }

        timeout = setTimeout(() => {
            ymaps.geocode(query, { results: 5 }).then(res => {
                container.innerHTML = '';
                res.geoObjects.each(obj => {
                    const address = obj.getAddressLine();
                    const coords = obj.geometry.getCoordinates();
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    div.innerHTML = `<i class="fas fa-map-marker-alt"></i> <span>${address}</span>`;
                    div.onclick = () => {
                        input.value = address;
                        input.dataset.coords = coords.join(',');
                        container.style.display = 'none';
                        
                        if (inputId === 'map-search-input') {
                            if (currentMode === 'start') setStartPoint(coords, address);
                            else setFinishPoint(coords, address);
                            map.setCenter(coords, 14);
                        }
                    };
                    container.appendChild(div);
                });
                container.style.display = 'block';
            });
        }, 400);
    });
}

function initMapEvents() {
    map.events.add('click', (e) => {
        const coords = e.get('coords');
        ymaps.geocode(coords).then(res => {
            const address = res.geoObjects.get(0).getAddressLine();
            if (currentMode === 'start') setStartPoint(coords, address);
            else setFinishPoint(coords, address);
        });
    });
}

function setStartPoint(coords, address) {
    if (startPlacemark) map.geoObjects.remove(startPlacemark);
    startPlacemark = new ymaps.Placemark(coords, { balloonContent: address }, { preset: 'islands#greenDotIconWithCaption', iconColor: '#4CAF50' });
    map.geoObjects.add(startPlacemark);
    routeData.start_point = { lat: coords[0], lng: coords[1], address: address };
    
    safeSetText('start-address-val', address);
    
    if (finishPlacemark) buildRoute();
}

function setFinishPoint(coords, address) {
    if (finishPlacemark) map.geoObjects.remove(finishPlacemark);
    finishPlacemark = new ymaps.Placemark(coords, { balloonContent: address }, { preset: 'islands#redDotIconWithCaption', iconColor: '#F44336' });
    map.geoObjects.add(finishPlacemark);
    routeData.finish_point = { lat: coords[0], lng: coords[1], address: address };
    
    safeSetText('finish-address-val', address);
    
    if (startPlacemark) buildRoute();
}

function buildRoute() {
    if (!startPlacemark || !finishPlacemark) return;
    if (route) map.geoObjects.remove(route);
    
    route = new ymaps.multiRouter.MultiRoute({
        referencePoints: [startPlacemark.geometry.getCoordinates(), finishPlacemark.geometry.getCoordinates()]
    }, { boundsAutoApply: true, routeActiveStrokeColor: '#2196F3' });

    map.geoObjects.add(route);
    route.model.events.add('requestsuccess', () => {
        const activeRoute = route.getActiveRoute();
        if (activeRoute) {
            routeData.distance = parseFloat((activeRoute.properties.get('distance').value / 1000).toFixed(1));
            routeData.duration = Math.round(activeRoute.properties.get('duration').value / 60);
            
            safeSetText('route-distance', routeData.distance);
            safeSetText('route-duration', routeData.duration);
            
            const infoBox = document.getElementById('route-info');
            if (infoBox) infoBox.style.display = 'block';
        }
    });
}

function initMapControls() {
    // Используем делегирование или проверку существования
    document.getElementById('btn-set-start')?.addEventListener('click', () => { currentMode = 'start'; updateModeBtns(); });
    document.getElementById('btn-set-finish')?.addEventListener('click', () => { currentMode = 'finish'; updateModeBtns(); });
    document.getElementById('btn-clear-route')?.addEventListener('click', clearRoute);
}

function updateModeBtns() {
    const btnS = document.getElementById('btn-set-start');
    const btnF = document.getElementById('btn-set-finish');
    
    if (btnS) btnS.classList.toggle('active', currentMode === 'start');
    if (btnF) btnF.classList.toggle('active', currentMode === 'finish');
}

function clearRoute() {
    if (map) {
        map.geoObjects.removeAll();
        startPlacemark = null; finishPlacemark = null; route = null;
        routeData = { start_point: null, finish_point: null, distance: null, duration: null };
        safeSetText('start-address-val', 'Не выбрано');
        safeSetText('finish-address-val', 'Не выбрано');
        const infoBox = document.getElementById('route-info');
        if (infoBox) infoBox.style.display = 'none';
    }
}

window.YandexMapsModule = {
    initMap: initYandexMap,
    getRouteData: () => routeData,
    clearRoute: clearRoute,
    setCurrentMode: (mode) => { 
        currentMode = mode; 
        updateModeBtns(); 
    },
    isMapInitialized: () => map !== null
};
