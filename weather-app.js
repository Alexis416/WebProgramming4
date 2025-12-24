class WeatherApplication {
  constructor() {
    this.config = {
      geocodingUrl: 'https://geocoding-api.open-meteo.com/v1/search',
      reverseGeocodingUrl: 'https://geocoding-api.open-meteo.com/v1/reverse',
      forecastUrl: 'https://api.open-meteo.com/v1/forecast',
      forecastDuration: 3,
      maxSuggestions: 6,
      debounceDelay: 300,
      geoTimeout: 8000
    };

    this.weatherCodes = {
      0: 'Ясно', 1: 'Преимущественно ясно', 2: 'Переменная облачность',
      3: 'Пасмурно', 45: 'Туман', 48: 'Изморозь', 51: 'Морось',
      53: 'Умеренная морось', 55: 'Сильная морось', 61: 'Небольшой дождь',
      63: 'Дождь', 65: 'Сильный дождь', 71: 'Небольшой снег',
      73: 'Снег', 75: 'Сильный снег', 80: 'Ливень', 81: 'Сильный ливень',
      82: 'Очень сильный ливень', 95: 'Гроза', 96: 'Гроза с градом',
      99: 'Сильная гроза с градом'
    };

    this.cachedLocations = new Map();
    this.initializeApp();
  }

  initializeApp() {
    this.uiElements = {
      container: document.getElementById('weatherDisplay'),
      searchInput: document.getElementById('citySearch'),
      resultsList: document.getElementById('searchResults'),
      messageDisplay: document.getElementById('inputMessage'),
      updateButton: document.getElementById('updateData'),
      locationButton: document.getElementById('locateMe'),
      addButton: document.getElementById('confirmCity'),
      locationDisplay: document.getElementById('locationDisplay')
    };

    this.savedCities = this.loadFromStorage('weather_cities') || [];
    this.currentSelection = null;

    this.setupEventHandlers();
    this.initializeInterface();
  }

  loadFromStorage(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  saveToStorage(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn('Ошибка сохранения:', error);
    }
  }

  setupEventHandlers() {
    const { searchInput, resultsList, updateButton, locationButton, addButton } = this.uiElements;

    searchInput.addEventListener('input', this.debounce(this.handleInputChange.bind(this), this.config.debounceDelay));
    
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.processCityAddition();
      }
      if (event.key === 'Escape') {
        this.hideSuggestions();
      }
    });

    resultsList.addEventListener('click', (event) => {
      const item = event.target.closest('.result-item');
      if (item) {
        this.selectLocation({
          name: item.dataset.name,
          display: item.dataset.display,
          latitude: parseFloat(item.dataset.lat),
          longitude: parseFloat(item.dataset.lon)
        });
        searchInput.value = item.dataset.display;
        this.hideSuggestions();
      }
    });

    document.addEventListener('click', (event) => {
      if (!searchInput.contains(event.target) && !resultsList.contains(event.target)) {
        this.hideSuggestions();
      }
    });

    updateButton.addEventListener('click', () => this.refreshWeatherData());
    locationButton.addEventListener('click', () => this.handleGeolocationRequest());
    addButton.addEventListener('click', () => this.processCityAddition());
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  async handleInputChange() {
    const query = this.uiElements.searchInput.value.trim();
    this.currentSelection = null;
    this.clearMessage();

    if (!query) {
      this.hideSuggestions();
      return;
    }

    if (this.cachedLocations.has(query)) {
      this.displaySuggestions(this.cachedLocations.get(query));
      return;
    }

    try {
      const locations = await this.fetchLocations(query);
      this.cachedLocations.set(query, locations);
      this.displaySuggestions(locations);
    } catch {
      this.hideSuggestions();
    }
  }

  async fetchLocations(query) {
    const url = `${this.config.geocodingUrl}?name=${encodeURIComponent(query)}&count=${this.config.maxSuggestions}&language=ru`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Ошибка сети');
    const data = await response.json();
    return data.results || [];
  }

  displaySuggestions(locations) {
    const { resultsList } = this.uiElements;
    
    if (!locations || locations.length === 0) {
      this.hideSuggestions();
      return;
    }

    resultsList.innerHTML = locations.map(loc => `
      <div class="result-item" 
           data-lat="${loc.latitude}" 
           data-lon="${loc.longitude}"
           data-name="${this.escapeHTML(loc.name)}"
           data-display="${this.escapeHTML(this.formatLocationName(loc))}"
           role="option">
        ${this.escapeHTML(this.formatLocationName(loc))}
      </div>
    `).join('');

    resultsList.hidden = false;
  }

  formatLocationName(location) {
    return `${location.name}${location.admin1 ? ', ' + location.admin1 : ''}${location.country ? ', ' + location.country : ''}`;
  }

  hideSuggestions() {
    this.uiElements.resultsList.hidden = true;
    this.uiElements.resultsList.innerHTML = '';
  }

  selectLocation(location) {
    this.currentSelection = location;
  }

  async processCityAddition() {
    const input = this.uiElements.searchInput.value.trim();
    this.clearMessage();

    if (!input) {
      this.showMessage('Введите название города', 'error');
      return;
    }

    if (this.currentSelection && this.currentSelection.display === input) {
      this.addCity(this.currentSelection);
      return;
    }

    this.showMessage('Поиск города...', 'info');
    
    try {
      const locations = await this.fetchLocations(input);
      if (!locations || locations.length === 0) {
        this.showMessage('Город не найден', 'error');
        return;
      }

      const location = locations[0];
      const cityData = {
        name: location.name,
        display: this.formatLocationName(location),
        latitude: location.latitude,
        longitude: location.longitude,
        isCurrentLocation: false
      };

      this.addCity(cityData);
    } catch {
      this.showMessage('Ошибка соединения', 'error');
    }
  }

  addCity(city) {
    if (this.isDuplicateCity(city.latitude, city.longitude)) {
      this.showMessage('Этот город уже добавлен', 'error');
      return;
    }

    const cityId = this.generateId();
    const cityRecord = {
      id: cityId,
      ...city,
      addedAt: new Date().toISOString()
    };

    this.savedCities.push(cityRecord);
    this.saveToStorage('weather_cities', this.savedCities);
    
    this.uiElements.searchInput.value = '';
    this.currentSelection = null;
    this.clearMessage();
    this.renderWeatherCards();
  }

  isDuplicateCity(lat, lon) {
    return this.savedCities.some(city => 
      Math.abs(city.latitude - lat) < 0.001 && 
      Math.abs(city.longitude - lon) < 0.001
    );
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  showMessage(text, type = 'info') {
    const { messageDisplay } = this.uiElements;
    messageDisplay.textContent = text;
    messageDisplay.className = `input-message ${type}-message`;
  }

  clearMessage() {
    this.uiElements.messageDisplay.textContent = '';
    this.uiElements.messageDisplay.className = 'input-message';
  }

  async handleGeolocationRequest() {
    if (!navigator.geolocation) {
      this.showMessage('Геолокация не поддерживается', 'error');
      return;
    }

    try {
      const position = await this.getCurrentPosition();
      await this.processGeolocation(position.coords);
    } catch (error) {
      this.handleGeolocationError(error);
    }
  }

  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: this.config.geoTimeout,
        maximumAge: 600000
      });
    });
  }

  async processGeolocation(coords) {
    const locationName = await this.getLocationName(coords.latitude, coords.longitude);
    
    const existingIndex = this.savedCities.findIndex(city => city.isCurrentLocation);
    
    const locationData = {
      id: existingIndex >= 0 ? this.savedCities[existingIndex].id : this.generateId(),
      name: 'Текущее местоположение',
      display: locationName,
      latitude: coords.latitude,
      longitude: coords.longitude,
      isCurrentLocation: true,
      addedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      this.savedCities[existingIndex] = locationData;
    } else {
      this.savedCities.unshift(locationData);
    }

    this.saveToStorage('weather_cities', this.savedCities);
    this.renderWeatherCards();
    this.updateLocationDisplay();
    this.clearMessage();
  }

  async getLocationName(lat, lon) {
    try {
      const url = `${this.config.reverseGeocodingUrl}?latitude=${lat}&longitude=${lon}&language=ru`;
      const response = await fetch(url);
      if (!response.ok) return 'Текущее местоположение';
      
      const data = await response.json();
      if (data.results && data.results[0]) {
        const loc = data.results[0];
        return this.formatLocationName(loc);
      }
    } catch {
      // Продолжаем без изменения имени
    }
    return 'Текущее местоположение';
  }

  handleGeolocationError(error) {
    switch (error.code) {
      case 1:
        this.showMessage('Доступ к геолокации запрещен', 'error');
        break;
      case 2:
        this.showMessage('Не удалось определить местоположение', 'error');
        break;
      case 3:
        this.showMessage('Время ожидания истекло', 'error');
        break;
      default:
        this.showMessage('Ошибка определения местоположения', 'error');
    }
  }

  initializeInterface() {
    if (this.savedCities.length === 0 && navigator.geolocation) {
      this.handleGeolocationRequest().catch(() => {
        // Игнорируем ошибки при автоопределении
      });
    } else {
      this.renderWeatherCards();
    }
    this.updateLocationDisplay();
  }

  renderWeatherCards() {
    const { container } = this.uiElements;
    
    if (!this.savedCities || this.savedCities.length === 0) {
      container.innerHTML = `
        <div class="weather-item">
          <div class="loading-state">
            Нет добавленных городов. Разрешите геолокацию или добавьте город вручную.
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.savedCities.map(city => `
      <div class="weather-item" data-city-id="${city.id}">
        <div class="item-header">
          <div>
            <div class="city-name">${this.escapeHTML(city.display)}</div>
            <div class="location-type">${city.isCurrentLocation ? 'Текущее местоположение' : 'Сохранённый город'}</div>
          </div>
          <button class="remove-btn" aria-label="Удалить">✕ Удалить</button>
        </div>
        <div class="forecast-content" id="content-${city.id}">
          <div class="loading-state">Загрузка данных...</div>
        </div>
      </div>
    `).join('');

    // Добавляем обработчики удаления
    container.querySelectorAll('.remove-btn').forEach(button => {
      button.addEventListener('click', (event) => {
        const card = event.target.closest('.weather-item');
        const cityId = card.dataset.cityId;
        this.removeCity(cityId);
      });
    });

    // Загружаем прогноз для каждого города
    this.savedCities.forEach(city => {
      this.loadForecastForCity(city);
    });
  }

  async loadForecastForCity(city) {
    const contentElement = document.getElementById(`content-${city.id}`);
    if (!contentElement) return;

    try {
      let { latitude, longitude } = city;
      
      if ((!latitude || !longitude) && !city.isCurrentLocation) {
        const locations = await this.fetchLocations(city.name);
        if (locations && locations[0]) {
          latitude = locations[0].latitude;
          longitude = locations[0].longitude;
          city.latitude = latitude;
          city.longitude = longitude;
          this.saveToStorage('weather_cities', this.savedCities);
        }
      }

      const forecast = await this.fetchWeatherForecast(latitude, longitude);
      contentElement.innerHTML = this.createForecastHTML(forecast);
    } catch (error) {
      contentElement.innerHTML = `
        <div class="error-state">
          Ошибка загрузки: ${this.escapeHTML(error.message || 'Неизвестная ошибка')}
        </div>
      `;
    }
  }

  async fetchWeatherForecast(lat, lon) {
    const url = `${this.config.forecastUrl}?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&forecast_days=${this.config.forecastDuration}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Ошибка получения прогноза');
    return await response.json();
  }

  createForecastHTML(forecastData) {
    const days = ['Сегодня', 'Завтра', 'Послезавтра'];
    
    return forecastData.daily.time.slice(0, 3).map((date, index) => {
      const minTemp = Math.round(forecastData.daily.temperature_2m_min[index]);
      const maxTemp = Math.round(forecastData.daily.temperature_2m_max[index]);
      const weatherCode = forecastData.daily.weathercode[index];
      const description = this.weatherCodes[weatherCode] || 'Неизвестно';
      
      return `
        <div class="forecast-day">
          <div class="day-info">
            <div class="day-label">${days[index]}</div>
            <div class="date-display">${this.formatDate(date)}</div>
            <div class="weather-description">${description}</div>
          </div>
          <div class="temperature-range">
            ${minTemp}° / ${maxTemp}°
          </div>
        </div>
      `;
    }).join('');
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const months = [
      'янв', 'фев', 'мар', 'апр', 'мая', 'июн',
      'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'
    ];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  }

  removeCity(cityId) {
    this.savedCities = this.savedCities.filter(city => city.id !== cityId);
    this.saveToStorage('weather_cities', this.savedCities);
    this.renderWeatherCards();
    this.updateLocationDisplay();
  }

  async refreshWeatherData() {
    const refreshButton = this.uiElements.updateButton;
    const originalText = refreshButton.textContent;
    
    refreshButton.textContent = 'Обновление...';
    refreshButton.disabled = true;

    try {
      for (const city of this.savedCities) {
        await this.loadForecastForCity(city);
      }
    } finally {
      refreshButton.textContent = originalText;
      refreshButton.disabled = false;
    }
  }

  updateLocationDisplay() {
    const currentLocation = this.savedCities.find(city => city.isCurrentLocation);
    this.uiElements.locationDisplay.textContent = currentLocation 
      ? `📍 ${currentLocation.display}` 
      : '';
  }

  escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
  new WeatherApplication();
});
