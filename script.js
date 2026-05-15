// ===== WMO WEATHER CODE MAPS =====
const WMO_DESC = {
  0:'Clear Sky',1:'Mainly Clear',2:'Partly Cloudy',3:'Overcast',
  45:'Foggy',48:'Icy Fog',51:'Light Drizzle',53:'Drizzle',55:'Heavy Drizzle',
  61:'Light Rain',63:'Moderate Rain',65:'Heavy Rain',71:'Light Snow',73:'Snow',75:'Heavy Snow',
  77:'Snow Grains',80:'Rain Showers',81:'Rain Showers',82:'Heavy Showers',
  85:'Snow Showers',86:'Heavy Snow Showers',95:'Thunderstorm',96:'Thunderstorm',99:'Thunderstorm'
};
const WMO_ICON = {
  0:'☀️',1:'🌤',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',
  51:'🌦',53:'🌦',55:'🌧',61:'🌧',63:'🌧',65:'🌧',
  71:'❄️',73:'❄️',75:'❄️',77:'🌨',80:'🌦',81:'🌦',82:'⛈',
  95:'⛈',96:'⛈',99:'⛈'
};
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ===== HELPERS =====
function show(id) { document.getElementById(id).style.display = 'block'; }
function hide(id) { document.getElementById(id).style.display = 'none'; }
function setErr(msg) { document.getElementById('errMsg').textContent = msg; }
function fmtTime(iso) { return new Date(iso).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }); }

// ===== EVENT LISTENERS =====
document.getElementById('searchBtn').addEventListener('click', searchWeather);
document.getElementById('locBtn').addEventListener('click', getLocation);
document.getElementById('cityInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') searchWeather();
});

// ===== SEARCH =====
async function searchWeather() {
  const q = document.getElementById('cityInput').value.trim();
  if (!q) { setErr('Please enter a city name.'); return; }
  setErr('');
  show('loader'); hide('mainWeather'); hide('welcomeBox');

  try {
    const res  = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`);
    const data = await res.json();

    if (!data.results || !data.results.length) {
      setErr('City not found. Try a different name.');
      hide('loader'); show('welcomeBox'); return;
    }

    const loc = data.results[0];
    await fetchWeather(loc.latitude, loc.longitude, loc.name, loc.country || '');
  } catch {
    setErr('Network error. Check your connection.');
    hide('loader'); show('welcomeBox');
  }
}

// ===== GEOLOCATION =====
function getLocation() {
  if (!navigator.geolocation) { setErr('Geolocation not supported.'); return; }
  setErr('');
  show('loader'); hide('mainWeather'); hide('welcomeBox');

  navigator.geolocation.getCurrentPosition(async pos => {
    try {
      const rev  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);
      const rd   = await rev.json();
      const city = rd.address.city || rd.address.town || rd.address.village || 'Your Location';
      await fetchWeather(pos.coords.latitude, pos.coords.longitude, city, rd.address.country || '');
    } catch {
      await fetchWeather(pos.coords.latitude, pos.coords.longitude, 'Your Location', '');
    }
  }, () => {
    setErr('Location access denied.');
    hide('loader'); show('welcomeBox');
  });
}

// ===== FETCH WEATHER (Open-Meteo — free, no API key) =====
async function fetchWeather(lat, lon, city, country) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
      + `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index,visibility`
      + `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max`
      + `&timezone=auto&forecast_days=7`;

    const res  = await fetch(url);
    const data = await res.json();
    hide('loader');
    renderWeather(data, city, country);
  } catch {
    setErr('Weather data unavailable. Try again.');
    hide('loader'); show('welcomeBox');
  }
}

// ===== RENDER =====
function renderWeather(data, city, country) {
  const c  = data.current;
  const dl = data.daily;

  // Location & Time
  document.getElementById('cityName').textContent    = city;
  document.getElementById('countryName').textContent = country ? `· ${country}` : '';
  const now = new Date();
  document.getElementById('dateTime').textContent =
    now.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })
    + ' · ' + now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

  // Main temp
  document.getElementById('tempVal').textContent   = Math.round(c.temperature_2m);
  document.getElementById('feelsLike').textContent = Math.round(c.apparent_temperature);
  document.getElementById('weatherIcon').textContent = WMO_ICON[c.weather_code] || '🌡️';
  document.getElementById('weatherDesc').textContent = WMO_DESC[c.weather_code] || '—';

  // Details
  document.getElementById('humidity').textContent  = c.relative_humidity_2m + '%';
  document.getElementById('windSpeed').textContent = Math.round(c.wind_speed_10m) + ' km/h';
  document.getElementById('visibility').textContent= c.visibility != null ? Math.round(c.visibility / 1000) + ' km' : '—';
  document.getElementById('uvIndex').textContent   = c.uv_index != null ? c.uv_index.toFixed(1) : '—';
  document.getElementById('sunrise').textContent   = dl.sunrise ? fmtTime(dl.sunrise[0]) : '—';
  document.getElementById('sunset').textContent    = dl.sunset  ? fmtTime(dl.sunset[0])  : '—';

  // Precipitation
  const precip = dl.precipitation_probability_max[0] || 0;
  document.getElementById('precipVal').textContent = precip + '%';
  setTimeout(() => { document.getElementById('precipBar').style.width = precip + '%'; }, 100);

  // 7-Day Forecast
  const fcRow = document.getElementById('forecastRow');
  fcRow.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const day     = new Date(dl.time[i]);
    const isToday = i === 0;
    const item    = document.createElement('div');
    item.className = 'fc-item';
    item.innerHTML = `
      <div class="fc-day">${isToday ? 'Today' : DAYS[day.getDay()]}</div>
      <div class="fc-icon">${WMO_ICON[dl.weather_code[i]] || '🌡️'}</div>
      <div class="fc-hi">${Math.round(dl.temperature_2m_max[i])}°</div>
      <div class="fc-lo">${Math.round(dl.temperature_2m_min[i])}°</div>
    `;
    fcRow.appendChild(item);
  }

  // Show
  document.getElementById('mainWeather').style.display = 'block';
}
