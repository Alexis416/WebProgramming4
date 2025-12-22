const API_KEY = 'YOUR_API_KEY_HERE';

const weatherList = document.getElementById('weatherList');
const loading = document.getElementById('loading');
const formError = document.getElementById('formError');

let locations = JSON.parse(localStorage.getItem('locations')) || [];

const showLoading = state => {
  loading.style.display = state ? 'block' : 'none';
};

const saveLocations = () => {
  localStorage.setItem('locations', JSON.stringify(locations));
};

async function fetchWeather(lat, lon, locationId) {
  try {
    const res = await fetch(
      https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&units=metric&lang=ru&appid=${API_KEY}
    );
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    alert('Ошибка загрузки погоды');
  }
}

function createHourly(hourly) {
  const container = document.createElement('div');
  container.className = 'hourly';

  hourly.slice(0, 6).forEach(h => {
    const hour = document.createElement('div');
    hour.className = 'hour';
    hour.innerHTML = 
      <div>${new Date(h.dt * 1000).getHours()}:00</div>
      <img class="icon" src="https://openweathermap.org/img/wn/${h.weather[0].icon}.png">
      <div>${Math.round(h.temp)}°</div>
    ;
    container.appendChild(hour);
  });

  return container;
}

function renderWeather(location, data) {
  const card = document.createElement('div');
  card.className = 'weather-card';

  card.innerHTML = 
    <button class="remove-btn" title="Удалить">✖</button>
    <h3>${location.name}</h3>
  ;

  card.querySelector('.remove-btn').onclick = () => {
    locations = locations.filter(l => l.id !== location.id);
    saveLocations();
    loadAll();
  };

  data.daily.slice(0, 3).forEach(day => {
    const row = document.createElement('div');
    row.className = 'day';
    row.innerHTML = 
      <span>${new Date(day.dt * 1000).toLocaleDateString('ru-RU')}</span>
      <span>
        <img class="icon" src="https://openweathermap.org/img/wn/${day.weather[0].icon}.png">
        ${Math.round(day.temp.day)}°C
      </span>
    ;
    card.appendChild(row);
  });

  card.appendChild(createHourly(data.hourly));
  weatherList.appendChild(card);
}

async function loadAll() {
  weatherList.innerHTML = '';
  showLoading(true);

  for (const loc of locations) {
    const data = await fetchWeather(loc.lat, loc.lon, loc.id);
    if (data) renderWeather(loc, data);
  }

  showLoading(false);
}

async function addCity(name) {
  formError.textContent = '';
  showLoading(true);

  try {
    const res = await fetch(
      https://api.openweathermap.org/geo/1.0/direct?q=${name}&limit=1&appid=${API_KEY}
    );
    const data = await res.json();

    if (!data.length) {
      formError.textContent = 'Город не найден';
      return;
    }

    const city = data[0];
    locations.push({
      id: Date.now(),
      name: city.name,
      lat: city.lat,
      lon: city.lon
    });

    saveLocations();
    loadAll();
  } finally {
    showLoading(false);
  }
}

function initGeolocation() {
  if (!navigator.geolocation || locations.length) return;

  navigator.geolocation.getCurrentPosition(pos => {
    locations.unshift({
      id: Date.now(),
      name: 'Текущее местоположение',
      lat: pos.coords.latitude,
      lon: pos.coords.longitude
    });
    saveLocations();
    saveLocations();
    loadAll();
  }
