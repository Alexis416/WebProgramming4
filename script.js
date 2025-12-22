// Конфигурация приложения
const CONFIG = {
    API_KEY: '37e026f6d87a287b169733da043c932c', // Замените на ваш API ключ OpenWeatherMap
    BASE_URL: 'https://api.openweathermap.org/data/2.5',
    GEOCODING_URL: 'https://api.openweathermap.org/geo/1.0/direct',
    ICON_URL: 'https://openweathermap.org/img/wn/',
    MAX_CITIES: 3,
    DEFAULT_CITIES: ['Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань', 'Нижний Новгород', 'Самара', 'Омск', 'Челябинск', 'Ростов-на-Дону']
};

// Состояние приложения
const state = {
    currentLocation: null,
    addedCities: [],
    isLoading: true,
    hasLocationAccess: null,
    weatherData: {
        current: null,
        added: []
    }
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
    
    // Проверяем, есть ли сохраненные данные
    if (state.currentLocation || state.addedCities.length > 0) {
        loadAllWeatherData();
    } else {
        requestLocation();
    }
}

// Загрузка состояния из localStorage
function loadStateFromStorage() {
    try {
        const savedState = localStorage.getItem('weatherAppState');
        if (savedState) {
            const parsedState = JSON.parse(savedState);
            state.currentLocation = parsedState.currentLocation;
            state.addedCities = parsedState.addedCities || [];
            state.hasLocationAccess = parsedState.hasLocationAccess;
            state.weatherData = parsedState.weatherData || { current: null, added: [] };
        }
    } catch (e) {
        console.error('Ошибка при загрузке состояния:', e);
        // Сбрасываем состояние при ошибке
        state.currentLocation = null;
        state.addedCities = [];
        state.weatherData = { current: null, added: [] };
    }
}

// Сохранение состояния в localStorage
function saveStateToStorage() {
    try {
        const stateToSave = {
            currentLocation: state.currentLocation,
            addedCities: state.addedCities,
            hasLocationAccess: state.hasLocationAccess,
            weatherData: state.weatherData
        };
        localStorage.setItem('weatherAppState', JSON.stringify(stateToSave));
    } catch (e) {
        console.error('Ошибка при сохранении состояния:', e);
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Кнопка обновления
    elements.refreshBtn.addEventListener('click', () => {
        loadAllWeatherData();
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
    elements.cityInput.addEventListener('focus', handleCityInput);

    // Выбор подсказки
    elements.suggestions.addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion-item')) {
            const cityName = e.target.dataset.city;
            elements.cityInput.value = cityName;
            elements.suggestions.classList.add('hidden');
        }
    });
}

// Запрос геолокации
async function requestLocation() {
    showLoading();
    
    if (!navigator.geolocation) {
        console.error('Геолокация не поддерживается браузером');
        showLocationDenied();
        return;
    }
    
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });
        
        const { latitude, longitude } = position.coords;
        
        // Получаем название города по координатам
        try {
            const locationData = await getLocationName(latitude, longitude);
            state.currentLocation = {
                name: 'Текущее местоположение',
                lat: latitude,
                lon: longitude,
                cityName: locationData.name
            };
            state.hasLocationAccess = true;
            saveStateToStorage();
            loadAllWeatherData();
        } catch (error) {
            console.error('Ошибка при получении названия местоположения:', error);
            // Используем координаты даже если не удалось получить название
            state.currentLocation = {
                name: 'Текущее местоположение',
                lat: latitude,
                lon: longitude,
                cityName: 'Ваше местоположение'
            };
            state.hasLocationAccess = true;
            saveStateToStorage();
            loadAllWeatherData();
        }
    } catch (error) {
        console.error('Ошибка геолокации:', error);
        state.hasLocationAccess = false;
        saveStateToStorage();
        showLocationDenied();
    }
}

// Получение названия местоположения по координатам
async function getLocationName(lat, lon) {
    const url = `${CONFIG.GEOCODING_URL}?lat=${lat}&lon=${lon}&limit=1&appid=${CONFIG.API_KEY}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.length > 0) {
        return {
            name: `${data[0].name}, ${data[0].country}`,
            lat: data[0].lat,
            lon: data[0].lon
        };
    }
    
    throw new Error('Местоположение не найдено');
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
        const weatherResults = [];
        let hasErrors = false;
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                weatherResults.push(result.value);
            } else {
                console.error(`Ошибка при загрузке погоды для локации ${index}:`, result.reason);
                hasErrors = true;
                // Добавляем null для сохранения порядка
                weatherResults.push(null);
            }
        });
        
        // Сохраняем данные о погоде
        if (state.currentLocation) {
            state.weatherData.current = weatherResults[0];
            state.weatherData.added = weatherResults.slice(1);
        } else {
            state.weatherData.current = null;
            state.weatherData.added = weatherResults;
        }
        
        saveStateToStorage();
        
        // Отображаем данные
        displayWeatherData();
        
        if (hasErrors && results.every(r => r.status === 'rejected')) {
            throw new Error('Не удалось загрузить данные о погоде');
        }
        
    } catch (error) {
        console.error('Ошибка при загрузке данных о погоде:', error);
        // Показываем данные из кэша, если есть
        if (state.weatherData.current || state.weatherData.added.length > 0) {
            displayWeatherData();
        } else {
            showError();
        }
    }
}

// Получение данных о погоде
async function getWeatherData(lat, lon, isCurrent = false, cityName = null) {
    // Используем один запрос для получения прогноза на 5 дней
    const forecastUrl = `${CONFIG.BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${CONFIG.API_KEY}&units=metric&lang=ru`;
    
    const response = await fetch(forecastUrl);
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const forecastData = await response.json();
    
    // Текущая погода - первый элемент списка
    const currentWeather = forecastData.list[0];
    
    // Обрабатываем прогноз - группируем по дням
    const dailyForecast = processForecastData(forecastData);
    
    return {
        isCurrent,
        cityName: cityName || forecastData.city.name,
        current: {
            temp: Math.round(currentWeather.main.temp),
            feelsLike: Math.round(currentWeather.main.feels_like),
            humidity: currentWeather.main.humidity,
            pressure: currentWeather.main.pressure,
            windSpeed: currentWeather.wind.speed,
            description: currentWeather.weather[0].description,
            icon: currentWeather.weather[0].icon
        },
        forecast: dailyForecast.slice(0, 3) // Берем только 3 дня (сегодня + 2 следующих)
    };
}

// Обработка данных прогноза
function processForecastData(forecastData) {
    const dailyData = {};
    
    forecastData.list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const dateKey = date.toISOString().split('T')[0]; // Формат YYYY-MM-DD
        
        if (!dailyData[dateKey]) {
            const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
            const dayName = dayNames[date.getDay()];
            
            dailyData[dateKey] = {
                day: dayName,
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
    if ((!state.weatherData.current || !state.currentLocation) && state.weatherData.added.length === 0) {
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
    if (state.weatherData.current && state.currentLocation) {
        displayCurrentLocationWeather();
    } else {
        elements.currentLocationSection.classList.add('hidden');
    }
    
    // Отображаем добавленные города, если есть
    if (state.weatherData.added.length > 0 && state.weatherData.added[0] !== null) {
        elements.addedCitiesSection.classList.remove('hidden');
        displayAddedCitiesWeather();
    } else {
        elements.addedCitiesSection.classList.add('hidden');
    }
}

// Отображение погоды для текущего местоположения
function displayCurrentLocationWeather() {
    elements.currentLocationSection.classList.remove('hidden');
    
    const weather = state.weatherData.current;
    if (!weather) return;
    
    const currentWeatherHTML = `
        <div class="weather-today">
            <div class="temp">${weather.current.temp}°C</div>
            <div class="description">${weather.current.description}</div>
            <div class="weather-details">
                <div class="weather-detail">
                    <i class="fas fa-thermometer-half"></i>
                    <span>Ощущается как: ${weather.current.feelsLike}°C</span>
                </div>
                <div class="weather-detail">
                    <i class="fas fa-tint"></i>
                    <span>Влажность: ${weather.current.humidity}%</span>
                </div>
                <div class="weather-detail">
                    <i class="fas fa-tachometer-alt"></i>
                    <span>Давление: ${weather.current.pressure} hPa</span>
                </div>
                <div class="weather-detail">
                    <i class="fas fa-wind"></i>
                    <span>Ветер: ${weather.current.windSpeed} м/с</span>
                </div>
            </div>
        </div>
        <div class="forecast">
            ${weather.forecast.map((day, index) => `
                <div class="forecast-day">
                    <div class="day">${index === 0 ? 'Сегодня' : index === 1 ? 'Завтра' : day.day}</div>
                    <img src="${CONFIG.ICON_URL}${day.icon}@2x.png" alt="${day.description}" width="60" height="60">
                    <div class="forecast-temp">${day.temp}°C</div>
                    <div class="forecast-desc">${day.description}</div>
                </div>
            `).join('')}
        </div>
    `;
    
    elements.currentWeather.innerHTML = currentWeatherHTML;
}

// Отображение погоды для добавленных городов
function displayAddedCitiesWeather() {
    state.weatherData.added.forEach((weather, index) => {
        if (!weather) return;
        
        const cityCard = document.createElement('div');
        cityCard.className = 'city-card';
        cityCard.innerHTML = `
            <div class="city-header">
                <h3 class="city-name">${weather.cityName}</h3>
                <button class="delete-city" data-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="city-weather">
                <div class="city-temp">${weather.current.temp}°C</div>
                <img src="${CONFIG.ICON_URL}${weather.current.icon}@2x.png" alt="${weather.current.description}" width="50" height="50">
            </div>
            <div class="city-desc">${weather.current.description}</div>
            <div class="forecast">
                ${weather.forecast.map((day, idx) => `
                    <div class="forecast-day">
                        <div class="day">${idx === 0 ? 'Сег.' : idx === 1 ? 'Зав.' : 'После.'}</div>
                        <div class="forecast-temp">${day.temp}°</div>
                    </div>
                `).join('')}
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
    state.weatherData.added.splice(index, 1);
    saveStateToStorage();
    displayWeatherData();
}

// Показать модальное окно добавления города
function showAddCityModal() {
    elements.addCityModal.classList.remove('hidden');
    elements.cityInput.focus();
    handleCityInput(); // Показать подсказки сразу
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
    
    if (query.length < 1) {
        // Показываем все города по умолчанию при пустом поле
        showAllSuggestions();
        return;
    }
    
    // Фильтруем предопределенные города
    const filteredCities = CONFIG.DEFAULT_CITIES.filter(city => 
        city.toLowerCase().includes(query.toLowerCase())
    );
    
    if (filteredCities.length === 0) {
        elements.suggestions.innerHTML = '<div class="suggestion-item">Город не найден</div>';
        elements.suggestions.classList.remove('hidden');
        return;
    }
    
    // Отображаем подсказки
    elements.suggestions.innerHTML = filteredCities
        .map(city => `<div class="suggestion-item" data-city="${city}">${city}</div>`)
        .join('');
    
    elements.suggestions.classList.remove('hidden');
}

// Показать все подсказки
function showAllSuggestions() {
    elements.suggestions.innerHTML = CONFIG.DEFAULT_CITIES
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
    
    // Показываем состояние загрузки
    const submitBtn = elements.addCityForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Поиск...';
    submitBtn.disabled = true;
    
    // Пытаемся получить координаты города
    try {
        const coordinates = await getCityCoordinates(cityName);
        
        if (!coordinates) {
            showCityError('Город не найден. Пожалуйста, проверьте название');
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            return;
        }
        
        // Добавляем город в состояние
        const newCity = {
            name: cityName,
            lat: coordinates.lat,
            lon: coordinates.lon
        };
        
        state.addedCities.push(newCity);
        saveStateToStorage();
        hideAddCityModal();
        
        // Загружаем погоду для нового города
        loadAllWeatherData();
        
    } catch (error) {
        console.error('Ошибка при получении координат города:', error);
        showCityError('Ошибка при поиске города. Пожалуйста, попробуйте еще раз');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Получение координат города
async function getCityCoordinates(cityName) {
    // Сначала проверяем в предопределенных городах
    const defaultCity = CONFIG.DEFAULT_CITIES.find(city => 
        city.toLowerCase() === cityName.toLowerCase()
    );
    
    if (defaultCity) {
        // Для демонстрации возвращаем координаты Москвы для всех городов
        // В реальном приложении нужно иметь координаты для каждого города
        return {
            lat: 55.7558, // Широта Москвы
            lon: 37.6173  // Долгота Москвы
        };
    }
    
    // Если город не в списке, пытаемся получить через API
    const url = `${CONFIG.GEOCODING_URL}?q=${encodeURIComponent(cityName)}&limit=1&appid=${CONFIG.API_KEY}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.length === 0) return null;
        
        return {
            lat: data[0].lat,
            lon: data[0].lon
        };
    } catch (error) {
        console.error('Ошибка при поиске города через API:', error);
        return null;
    }
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
    elements.errorMessage.classList.add('hidden');
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', init);
