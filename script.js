// Конфигурация приложения
const CONFIG = {
    API_KEY: '37e026f6d87a287b169733da043c932c',
    BASE_URL: 'https://api.openweathermap.org/data/2.5',
    GEOCODING_URL: 'https://api.openweathermap.org/geo/1.0/direct',
    ICON_URL: 'https://openweathermap.org/img/wn/',
    MAX_CITIES: 3, // Максимальное количество городов (включая текущее местоположение)
    DEFAULT_CITIES: ['Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань', 'Нижний Новгород']
};

// Состояние приложения
const state = {
    currentLocation: null,
    addedCities: [],
    isLoading: true,
    hasLocationAccess: null
};

// DOM элементы
const elements = {
    loading: document.getElementById('loading'),
    errorMessage: document.getElementById('errorMessage'),
    weatherContainer: document.getElementById('weatherContainer'),
    currentLocationSection: document.getElementById('currentLocationSection'),
    currentWeather: document.getElementById('currentWeather'),
    locationDenied: document.getElementById('locationDenied'),
    addedCitiesSection: document.getElementById('addedCitiesSection'),
    addedCities: document.getElementById('addedCities'),
    refreshBtn: document.getElementById('refreshBtn'),
    addCityBtn: document.getElementById('addCityBtn'),
    addCityFormBtn: document.getElementById('addCityFormBtn'),
    addCityModal: document.getElementById('addCityModal'),
    closeModal: document.getElementById('closeModal'),
    addCityForm: document.getElementById('addCityForm'),
    cityInput: document.getElementById('cityInput'),
    suggestions: document.getElementById('suggestions'),
    cityError: document.getElementById('cityError')
};

// Инициализация приложения
function init() {
    loadStateFromStorage();
    setupEventListeners();
    
    // Проверяем доступ к геолокации
    if (state.currentLocation === null) {
        requestLocation();
    } else {
        // Загружаем погоду для сохраненных локаций
        loadAllWeatherData();
    }
}

// Загрузка состояния из localStorage
function loadStateFromStorage() {
    const savedState = localStorage.getItem('weatherAppState');
    if (savedState) {
        const parsedState = JSON.parse(savedState);
        state.currentLocation = parsedState.currentLocation;
        state.addedCities = parsedState.addedCities || [];
        state.hasLocationAccess = parsedState.hasLocationAccess;
    }
}

// Сохранение состояния в localStorage
function saveStateToStorage() {
    const stateToSave = {
        currentLocation: state.currentLocation,
        addedCities: state.addedCities,
        hasLocationAccess: state.hasLocationAccess
    };
    localStorage.setItem('weatherAppState', JSON.stringify(stateToSave));
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Кнопка обновления
    elements.refreshBtn.addEventListener('click', () => {
        if (state.currentLocation || state.addedCities.length > 0) {
            loadAllWeatherData();
        } else {
            requestLocation();
        }
    });

    // Кнопки добавления города
    elements.addCityBtn.addEventListener('click', showAddCityModal);
    elements.addCityFormBtn.addEventListener('click', showAddCityModal);

    // Закрытие модального окна
    elements.closeModal.addEventListener('click', hideAddCityModal);
    elements.addCityModal.addEventListener('click', (e) => {
        if (e.target === elements.addCityModal) {
            hideAddCityModal();
        }
    });

    // Форма добавления города
    elements.addCityForm.addEventListener('submit', handleAddCity);

    // Ввод в поле города
    elements.cityInput.addEventListener('input', handleCityInput);

    // Выбор подсказки
    elements.suggestions.addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion-item')) {
            const cityName = e.target.dataset.city;
            elements.cityInput.value = cityName;
            elements.suggestions.classList.add('hidden');
            // Автоматически отправляем форму
            setTimeout(() => {
                handleAddCity(new Event('submit', { cancelable: true }));
            }, 100);
        }
    });
}

// Запрос геолокации
function requestLocation() {
    showLoading();
    
    if (!navigator.geolocation) {
        showLocationDenied();
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        // Успех
        async (position) => {
            state.hasLocationAccess = true;
            const { latitude, longitude } = position.coords;
            
            // Получаем название города по координатам
            try {
                const locationName = await getLocationName(latitude, longitude);
                state.currentLocation = {
                    name: 'Текущее местоположение',
                    lat: latitude,
                    lon: longitude,
                    cityName: locationName
                };
                saveStateToStorage();
                loadAllWeatherData();
            } catch (error) {
                console.error('Ошибка при получении названия местоположения:', error);
                state.currentLocation = {
                    name: 'Текущее местоположение',
                    lat: latitude,
                    lon: longitude,
                    cityName: 'Ваше местоположение'
                };
                saveStateToStorage();
                loadAllWeatherData();
            }
        },
        // Ошибка
        (error) => {
            console.error('Ошибка геолокации:', error);
            state.hasLocationAccess = false;
            saveStateToStorage();
            showLocationDenied();
        }
    );
}

// Получение названия местоположения по координатам
async function getLocationName(lat, lon) {
    const url = `${CONFIG.GEOCODING_URL}?lat=${lat}&lon=${lon}&limit=1&appid=${CONFIG.API_KEY}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Ошибка при получении названия местоположения');
    
    const data = await response.json();
    if (data.length > 0) {
        return `${data[0].name}, ${data[0].country}`;
    }
    
    return 'Неизвестное местоположение';
}

// Загрузка всех данных о погоде
async function loadAllWeatherData() {
    showLoading();
    elements.errorMessage.classList.add('hidden');
    
    try {
        const promises = [];
        
        // Загружаем погоду для текущего местоположения
        if (state.currentLocation) {
            promises.push(getWeatherData(state.currentLocation.lat, state.currentLocation.lon, true));
        }
        
        // Загружаем погоду для добавленных городов
        state.addedCities.forEach(city => {
            promises.push(getWeatherData(city.lat, city.lon, false, city.name));
        });
        
        const results = await Promise.allSettled(promises);
        
        // Обрабатываем результаты
        let hasErrors = false;
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                hasErrors = true;
                console.error(`Ошибка при загрузке погоды для локации ${index}:`, result.reason);
            }
        });
        
        if (hasErrors && results.every(r => r.status === 'rejected')) {
            // Все запросы завершились ошибкой
            throw new Error('Не удалось загрузить данные о погоде');
        }
        
        // Отображаем данные
        displayWeatherData();
        
    } catch (error) {
        console.error('Ошибка при загрузке данных о погоде:', error);
        showError();
    }
}

// Получение данных о погоде
async function getWeatherData(lat, lon, isCurrent = false, cityName = null) {
    // Получаем текущую погоду
    const currentWeatherUrl = `${CONFIG.BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${CONFIG.API_KEY}&units=metric&lang=ru`;
    
    // Получаем прогноз на 5 дней
    const forecastUrl = `${CONFIG.BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${CONFIG.API_KEY}&units=metric&lang=ru`;
    
    const [currentResponse, forecastResponse] = await Promise.all([
        fetch(currentWeatherUrl),
        fetch(forecastUrl)
    ]);
    
    if (!currentResponse.ok || !forecastResponse.ok) {
        throw new Error('Ошибка при получении данных о погоде');
    }
    
    const currentData = await currentResponse.json();
    const forecastData = await forecastResponse.json();
    
    // Обрабатываем прогноз - группируем по дням
    const dailyForecast = processForecastData(forecastData);
    
    return {
        isCurrent,
        cityName: cityName || currentData.name,
        current: {
            temp: Math.round(currentData.main.temp),
            feelsLike: Math.round(currentData.main.feels_like),
            humidity: currentData.main.humidity,
            pressure: currentData.main.pressure,
            windSpeed: currentData.wind.speed,
            description: currentData.weather[0].description,
            icon: currentData.weather[0].icon
        },
        forecast: dailyForecast.slice(0, 3) // Берем только 3 дня (сегодня + 2 следующих)
    };
}

// Обработка данных прогноза
function processForecastData(forecastData) {
    const dailyData = {};
    
    forecastData.list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const day = date.toLocaleDateString('ru-RU', { weekday: 'long' });
        const dateKey = date.toISOString().split('T')[0]; // Формат YYYY-MM-DD
        
        if (!dailyData[dateKey]) {
            dailyData[dateKey] = {
                day: day.charAt(0).toUpperCase() + day.slice(1),
                date: dateKey,
                temps: [],
                descriptions: [],
                icons: []
            };
        }
        
        dailyData[dateKey].temps.push(item.main.temp);
        dailyData[dateKey].descriptions.push(item.weather[0].description);
        dailyData[dateKey].icons.push(item.weather[0].icon);
    });
    
    // Преобразуем в массив и рассчитываем средние значения
    return Object.values(dailyData).map(day => {
        const avgTemp = Math.round(day.temps.reduce((a, b) => a + b, 0) / day.temps.length);
        // Берем наиболее часто встречающееся описание
        const description = mode(day.descriptions);
        // Берем иконку для наиболее часто встречающегося описания
        const iconIndex = day.descriptions.indexOf(description);
        const icon = day.icons[iconIndex];
        
        return {
            day: day.day,
            temp: avgTemp,
            description: description,
            icon: icon
        };
    });
}

// Функция для нахождения моды (наиболее часто встречающегося значения)
function mode(arr) {
    const frequency = {};
    let maxFreq = 0;
    let modeValue = arr[0];
    
    arr.forEach(value => {
        frequency[value] = (frequency[value] || 0) + 1;
        if (frequency[value] > maxFreq) {
            maxFreq = frequency[value];
            modeValue = value;
        }
    });
    
    return modeValue;
}

// Отображение данных о погоде
function displayWeatherData() {
    hideLoading();
    
    // Проверяем, есть ли данные для отображения
    if (!state.currentLocation && state.addedCities.length === 0) {
        elements.weatherContainer.classList.add('hidden');
        elements.locationDenied.classList.remove('hidden');
        return;
    }
    
    elements.locationDenied.classList.add('hidden');
    elements.weatherContainer.classList.remove('hidden');
    
    // Очищаем контейнеры
    elements.currentWeather.innerHTML = '';
    elements.addedCities.innerHTML = '';
    
    // Отображаем текущее местоположение, если есть
    if (state.currentLocation) {
        displayCurrentLocationWeather();
    } else {
        elements.currentLocationSection.classList.add('hidden');
    }
    
    // Отображаем добавленные города, если есть
    if (state.addedCities.length > 0) {
        elements.addedCitiesSection.classList.remove('hidden');
        displayAddedCitiesWeather();
    } else {
        elements.addedCitiesSection.classList.add('hidden');
    }
}

// Отображение погоды для текущего местоположения
function displayCurrentLocationWeather() {
    elements.currentLocationSection.classList.remove('hidden');
    
    // В реальном приложении здесь был бы рендеринг данных из state
    // Для демонстрации создаем заглушку
    const currentWeatherHTML = `
        <div class="weather-today">
            <div class="temp">--°C</div>
            <div class="description">Загрузка...</div>
            <div class="weather-details">
                <div class="weather-detail">
                    <i class="fas fa-thermometer-half"></i>
                    <span>Ощущается как: --°C</span>
                </div>
                <div class="weather-detail">
                    <i class="fas fa-tint"></i>
                    <span>Влажность: --%</span>
                </div>
                <div class="weather-detail">
                    <i class="fas fa-tachometer-alt"></i>
                    <span>Давление: -- hPa</span>
                </div>
                <div class="weather-detail">
                    <i class="fas fa-wind"></i>
                    <span>Ветер: -- м/с</span>
                </div>
            </div>
        </div>
        <div class="forecast">
            <div class="forecast-day">
                <div class="day">Сегодня</div>
                <img src="${CONFIG.ICON_URL}01d@2x.png" alt="Ясно" width="60" height="60">
                <div class="forecast-temp">--°C</div>
                <div class="forecast-desc">Загрузка...</div>
            </div>
            <div class="forecast-day">
                <div class="day">Завтра</div>
                <img src="${CONFIG.ICON_URL}01d@2x.png" alt="Ясно" width="60" height="60">
                <div class="forecast-temp">--°C</div>
                <div class="forecast-desc">Загрузка...</div>
            </div>
            <div class="forecast-day">
                <div class="day">Послезавтра</div>
                <img src="${CONFIG.ICON_URL}01d@2x.png" alt="Ясно" width="60" height="60">
                <div class="forecast-temp">--°C</div>
                <div class="forecast-desc">Загрузка...</div>
            </div>
        </div>
    `;
    
    elements.currentWeather.innerHTML = currentWeatherHTML;
}

// Отображение погоды для добавленных городов
function displayAddedCitiesWeather() {
    // В реальном приложении здесь был бы рендеринг данных из state
    // Для демонстрации создаем заглушку
    state.addedCities.forEach((city, index) => {
        const cityCard = document.createElement('div');
        cityCard.className = 'city-card';
        cityCard.innerHTML = `
            <div class="city-header">
                <h3 class="city-name">${city.name}</h3>
                <button class="delete-city" data-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="city-weather">
                <div class="city-temp">--°C</div>
                <img src="${CONFIG.ICON_URL}01d@2x.png" alt="Ясно" width="50" height="50">
            </div>
            <div class="city-desc">Загрузка данных...</div>
            <div class="forecast">
                <div class="forecast-day">
                    <div class="day">Сег.</div>
                    <div class="forecast-temp">--°</div>
                </div>
                <div class="forecast-day">
                    <div class="day">Зав.</div>
                    <div class="forecast-temp">--°</div>
                </div>
                <div class="forecast-day">
                    <div class="day">После.</div>
                    <div class="forecast-temp">--°</div>
                </div>
            </div>
        `;
        
        // Добавляем обработчик удаления города
        const deleteBtn = cityCard.querySelector('.delete-city');
        deleteBtn.addEventListener('click', () => deleteCity(index));
        
        elements.addedCities.appendChild(cityCard);
    });
}

// Удаление города
function deleteCity(index) {
    state.addedCities.splice(index, 1);
    saveStateToStorage();
    displayWeatherData();
}

// Показать модальное окно добавления города
function showAddCityModal() {
    elements.addCityModal.classList.remove('hidden');
    elements.cityInput.focus();
}

// Скрыть модальное окно добавления города
function hideAddCityModal() {
    elements.addCityModal.classList.add('hidden');
    elements.cityInput.value = '';
    elements.suggestions.classList.add('hidden');
    elements.cityError.classList.add('hidden');
}

// Обработка ввода города
function handleCityInput() {
    const query = elements.cityInput.value.trim();
    
    if (query.length < 2) {
        elements.suggestions.classList.add('hidden');
        return;
    }
    
    // Фильтруем предопределенные города
    const filteredCities = CONFIG.DEFAULT_CITIES.filter(city => 
        city.toLowerCase().includes(query.toLowerCase())
    );
    
    if (filteredCities.length === 0) {
        elements.suggestions.classList.add('hidden');
        return;
    }
    
    // Отображаем подсказки
    elements.suggestions.innerHTML = filteredCities
        .map(city => `<div class="suggestion-item" data-city="${city}">${city}</div>`)
        .join('');
    
    elements.suggestions.classList.remove('hidden');
}

// Обработка добавления города
async function handleAddCity(e) {
    e.preventDefault();
    
    const cityName = elements.cityInput.value.trim();
    
    // Валидация
    if (!cityName) {
        showCityError('Пожалуйста, введите название города');
        return;
    }
    
    // Проверяем, не добавлен ли уже этот город
    if (state.addedCities.some(city => city.name.toLowerCase() === cityName.toLowerCase())) {
        showCityError('Этот город уже добавлен');
        return;
    }
    
    // Проверяем максимальное количество городов
    const totalCities = (state.currentLocation ? 1 : 0) + state.addedCities.length;
    if (totalCities >= CONFIG.MAX_CITIES) {
        showCityError(`Максимальное количество городов: ${CONFIG.MAX_CITIES}`);
        return;
    }
    
    // Пытаемся получить координаты города
    try {
        const coordinates = await getCityCoordinates(cityName);
        
        if (!coordinates) {
            showCityError('Город не найден. Пожалуйста, проверьте название');
            return;
        }
        
        // Добавляем город в состояние
        state.addedCities.push({
            name: cityName,
            lat: coordinates.lat,
            lon: coordinates.lon
        });
        
        saveStateToStorage();
        hideAddCityModal();
        loadAllWeatherData();
        
    } catch (error) {
        console.error('Ошибка при получении координат города:', error);
        showCityError('Ошибка при поиске города. Пожалуйста, попробуйте еще раз');
    }
}

// Получение координат города
async function getCityCoordinates(cityName) {
    const url = `${CONFIG.GEOCODING_URL}?q=${encodeURIComponent(cityName)}&limit=1&appid=${CONFIG.API_KEY}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Ошибка при поиске города');
    
    const data = await response.json();
    if (data.length === 0) return null;
    
    return {
        lat: data[0].lat,
        lon: data[0].lon
    };
}

// Показать ошибку для поля города
function showCityError(message) {
    elements.cityError.textContent = message;
    elements.cityError.classList.remove('hidden');
}

// Показать состояние загрузки
function showLoading() {
    state.isLoading = true;
    elements.loading.classList.remove('hidden');
    elements.weatherContainer.classList.add('hidden');
    elements.errorMessage.classList.add('hidden');
    elements.locationDenied.classList.add('hidden');
}

// Скрыть состояние загрузки
function hideLoading() {
    state.isLoading = false;
    elements.loading.classList.add('hidden');
}

// Показать ошибку
function showError() {
    hideLoading();
    elements.errorMessage.classList.remove('hidden');
    elements.weatherContainer.classList.add('hidden');
}

// Показать сообщение об отказе в геолокации
function showLocationDenied() {
    hideLoading();
    elements.locationDenied.classList.remove('hidden');
    elements.weatherContainer.classList.add('hidden');
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', init);
