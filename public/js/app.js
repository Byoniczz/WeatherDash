/**
 * WeatherDash - Main Application Controller
 */

class WeatherApp {
  constructor() {
    this.activeLocation = null;
    this.favorites = [];
    this.defaultId = null;
    this.weatherData = null;
    this.airQualityData = null;
    
    // Preferences & Settings
    this.isFahrenheit = localStorage.getItem('wd_temp_unit') === 'F';
    this.isMph = localStorage.getItem('wd_speed_unit') === 'mph';
    this.theme = localStorage.getItem('wd_theme') || 'dark';
    this.settings = {
      solarKwp: 4.0,
      telegramBotToken: '',
      telegramChatId: '',
      telegramAlertsEnabled: false,
      telegramHailAlertsEnabled: true,
      telegramDailyDigest: true,
      telegramBriefingTime: '07:30',
      windyWebcamApiKey: ''
    };

    // Submodules
    this.radar = new WeatherRadar('radarMap');
    this.charts = new WeatherCharts('hourlyChartCanvas');
    this.canvasEffects = new WeatherCanvasEffects('weatherCanvas');

    // Auto-refresh timer
    this.autoRefreshTimer = null;
    this.refreshIntervalMinutes = 15;
  }

  async init() {
    // Applica tema salvato
    this.applyTheme(this.theme);

    // Inizializza grafici
    this.charts.init();

    // Carica impostazioni generali (Telegram, Fotovoltaico)
    await this.loadSettings();

    // Setup listener UI
    this.bindEvents();

    // Carica preferiti e posizione predefinita
    await this.loadFavorites();

    // Seleziona posizione iniziale
    let initialLoc = this.getInitialLocation();
    await this.selectLocation(initialLoc);

    // Avvia timer auto-refresh
    this.startAutoRefresh();
  }

  applyTheme(theme) {
    this.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wd_theme', theme);

    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.innerHTML = theme === 'light' 
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
    }

    if (this.radar && this.radar.map) {
      this.radar.setBaseLayer(theme === 'light' ? 'light' : 'dark');
    }
    if (this.charts) {
      this.charts.updateChart();
    }
  }

  toggleTheme() {
    this.applyTheme(this.theme === 'dark' ? 'light' : 'dark');
  }

  toggleUnit() {
    this.isFahrenheit = !this.isFahrenheit;
    localStorage.setItem('wd_temp_unit', this.isFahrenheit ? 'F' : 'C');
    
    const unitBtn = document.getElementById('unitToggleBtn');
    if (unitBtn) {
      unitBtn.textContent = this.isFahrenheit ? '°F' : '°C';
    }

    if (this.weatherData && this.activeLocation) {
      renderWeatherData(this.weatherData, this.activeLocation, this.isFahrenheit, this.isMph);
      this.charts.setData(this.weatherData.hourly, this.isFahrenheit);
    }
  }

  async loadFavorites() {
    try {
      const res = await fetch('/api/favorites');
      if (res.ok) {
        const data = await res.json();
        this.favorites = data.locations || [];
        this.defaultId = data.defaultId || (this.favorites[0] ? this.favorites[0].id : null);
      }
    } catch (err) {
      console.warn('Backend favorites non raggiungibile, uso localStorage:', err);
      const local = localStorage.getItem('wd_favorites');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          this.favorites = parsed.locations || [];
          this.defaultId = parsed.defaultId;
        } catch (e) {}
      }
    }

    if (this.favorites.length === 0) {
      // Fallback Roma
      this.favorites = [{
        id: 'roma',
        name: 'Roma',
        label: 'Roma',
        lat: 41.8919,
        lon: 12.5113,
        country: 'Italia',
        admin1: 'Lazio',
        isDefault: true
      }];
      this.defaultId = 'roma';
    }

    this.renderFavoritesChips();
  }

  getInitialLocation() {
    // 1. Controlla eventuale parametro url hash o query
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const match = this.favorites.find(f => f.id === hash || f.name.toLowerCase() === hash.toLowerCase());
      if (match) return match;
    }

    // 2. Posizione predefinita salvata
    const def = this.favorites.find(f => f.id === this.defaultId || f.isDefault);
    if (def) return def;

    return this.favorites[0];
  }

  renderFavoritesChips() {
    const container = document.getElementById('savedLocationsChips');
    if (!container) return;

    container.innerHTML = '';
    this.favorites.forEach(loc => {
      const chip = document.createElement('button');
      chip.className = `location-chip ${this.activeLocation && this.activeLocation.id === loc.id ? 'active' : ''}`;
      chip.innerHTML = `
        ${loc.isDefault ? '<span class="star-badge">★</span>' : ''}
        <span>${loc.label || loc.name}</span>
      `;
      chip.onclick = () => this.selectLocation(loc);
      container.appendChild(chip);
    });

    this.updateBookmarkButtonState();
  }

  updateBookmarkButtonState() {
    const starBtn = document.getElementById('favToggleHeroBtn');
    if (!starBtn || !this.activeLocation) return;

    const isFav = this.favorites.some(f => 
      f.id === this.activeLocation.id || 
      (Math.abs(f.lat - this.activeLocation.lat) < 0.005 && Math.abs(f.lon - this.activeLocation.lon) < 0.005)
    );

    if (isFav) {
      starBtn.classList.add('is-fav');
      starBtn.innerHTML = '★';
      starBtn.title = 'Indirizzo salvato nei preferiti';
    } else {
      starBtn.classList.remove('is-fav');
      starBtn.innerHTML = '☆';
      starBtn.title = 'Salva questo indirizzo nei preferiti';
    }
  }

  async selectLocation(location) {
    if (!location) return;
    this.activeLocation = location;
    window.location.hash = location.id || encodeURIComponent(location.name);

    this.renderFavoritesChips();

    // Mostra indicatore caricamento
    this.setLoading(true);

    try {
      // Fetch contemporaneo meteo e qualità aria
      const [weather, aq] = await Promise.all([
        this.fetchWeather(location.lat, location.lon),
        this.fetchAirQuality(location.lat, location.lon)
      ]);

      this.weatherData = weather;
      this.airQualityData = aq;

      // Aggiorna vista meteo
      renderWeatherData(weather, location, this.isFahrenheit, this.isMph);

      // Aggiorna qualità aria
      renderAirQualityData(aq);

      // Aggiorna Pollini & Allergeni
      if (typeof renderPollenData === 'function') {
        renderPollenData(aq);
      }

      // Aggiorna Previsione Grandine & Temporali Severi
      if (typeof renderHailData === 'function') {
        renderHailData(weather);
      }

      // Aggiorna Indici di Vita Quotidiana & Stima Fotovoltaico
      if (typeof renderLifeIndices === 'function') {
        renderLifeIndices(weather, aq, this.settings.solarKwp || 4.0);
      }

      // Aggiorna Effetti Atmosferici Canvas (pioggia, neve, stelle, ecc.)
      if (this.canvasEffects && weather.current) {
        this.canvasEffects.setCondition(weather.current.weather_code, weather.current.is_day);
      }

      // Confronto Storico Climatico (vs media ultimi 10 anni)
      if (weather.current && weather.current.temperature_2m !== undefined) {
        this.fetchClimateAnomaly(location.lat, location.lon, weather.current.temperature_2m);
      }

      // Aggiorna Grafici Orari
      this.charts.setData(weather.hourly, this.isFahrenheit);

      // Inizializza / Aggiorna Mappa Radar
      if (!this.radar.map) {
        this.radar.init(location.lat, location.lon, 6, location.label || location.name);
      } else {
        this.radar.updateUserMarker(location.lat, location.lon, location.label || location.name);
      }

      // Aggiorna timestamp
      this.updateLastRefreshBadge();

    } catch (err) {
      console.error('Errore caricamento dati meteo per posizione:', err);
      alert('Impossibile caricare i dati meteo. Verifica la connessione di rete.');
    } finally {
      this.setLoading(false);
    }
  }

  // Seleziona posizione al click o trascinamento puntatore su mappa
  async selectLocationFromCoordinates(lat, lon) {
    this.setLoading(true);
    let name = `Posizione (${lat.toFixed(2)}, ${lon.toFixed(2)})`;
    let admin1 = '';
    let country = '';

    try {
      const res = await fetch(`/api/reverse-geocode?lat=${lat}&lon=${lon}`);
      if (res.ok) {
        const data = await res.json();
        if (data.address) {
          name = data.address.city || data.address.town || data.address.village || data.address.municipality || data.address.hamlet || data.address.suburb || data.address.county || name;
          admin1 = data.address.state || data.address.region || '';
          country = data.address.country || '';
        } else if (data.display_name) {
          name = data.display_name.split(',')[0] || name;
        }
      }
    } catch (e) {
      console.warn('Reverse geocode fallback a coordinate:', e);
    }

    const clickedLoc = {
      id: `coord_${lat.toFixed(3)}_${lon.toFixed(3)}`,
      name: name,
      label: name,
      lat: lat,
      lon: lon,
      country: country,
      admin1: admin1,
      isDefault: false
    };

    await this.selectLocation(clickedLoc);
  }

  async fetchWeather(lat, lon) {
    try {
      const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Proxy meteo backend non disponibile, tentativo diretto a Open-Meteo:', e);
    }

    // Chiamata diretta di fallback a Open-Meteo
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation_probability,precipitation,rain,showers,snowfall,weather_code,surface_pressure,cloud_cover,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,daylight_duration,uv_index_max,precipitation_sum,rain_sum,showers_sum,snowfall_sum,precipitation_hours,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant&minutely_15=precipitation,rain,snowfall,weather_code&forecast_minutely_15=48&timezone=auto&forecast_days=14`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Meteo HTTP ' + res.status);
    return await res.json();
  }

  async fetchAirQuality(lat, lon) {
    try {
      const res = await fetch(`/api/airquality?lat=${lat}&lon=${lon}`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Proxy qualità aria non disponibile, tentativo diretto a Open-Meteo:', e);
    }

    // Chiamata diretta di fallback a Open-Meteo Air Quality
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,dust,uv_index&hourly=european_aqi,pm10,pm2_5,nitrogen_dioxide,ozone&timezone=auto&forecast_days=3`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Qualità Aria HTTP ' + res.status);
    return await res.json();
  }

  setLoading(isLoading) {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      if (isLoading) refreshBtn.classList.add('loading');
      else refreshBtn.classList.remove('loading');
    }
  }

  updateLastRefreshBadge() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const badge = document.getElementById('lastUpdateBadge');
    if (badge) badge.textContent = `Aggiornato alle ${timeStr}`;
  }

  startAutoRefresh() {
    if (this.autoRefreshTimer) clearInterval(this.autoRefreshTimer);
    this.autoRefreshTimer = setInterval(() => {
      if (this.activeLocation) {
        console.log('Auto-refresh meteo in corso...');
        this.selectLocation(this.activeLocation);
      }
    }, this.refreshIntervalMinutes * 60 * 1000);
  }

  // Toggle preferito per la posizione corrente
  async toggleCurrentLocationFavorite() {
    if (!this.activeLocation) return;

    const existingIdx = this.favorites.findIndex(f => 
      f.id === this.activeLocation.id || 
      (Math.abs(f.lat - this.activeLocation.lat) < 0.005 && Math.abs(f.lon - this.activeLocation.lon) < 0.005)
    );

    if (existingIdx >= 0) {
      // Rimuovi dai preferiti
      const toRemove = this.favorites[existingIdx];
      await this.removeFavorite(toRemove.id);
    } else {
      // Chiedi etichetta o salva col nome
      const label = prompt('Assegna un nome a questo indirizzo:', this.activeLocation.name || 'La mia posizione');
      if (label === null) return; // annullato

      const newFav = {
        ...this.activeLocation,
        id: 'loc_' + Date.now(),
        label: label.trim() || this.activeLocation.name,
        isDefault: this.favorites.length === 0
      };

      await this.addFavorite(newFav);
    }
  }

  async addFavorite(loc) {
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loc)
      });
      if (res.ok) {
        await this.loadFavorites();
        this.activeLocation = loc;
        this.renderFavoritesChips();
        return;
      }
    } catch (e) {
      console.warn('Fallback salvataggio locale');
    }

    this.favorites.push(loc);
    localStorage.setItem('wd_favorites', JSON.stringify({ defaultId: this.defaultId, locations: this.favorites }));
    this.renderFavoritesChips();
  }

  async removeFavorite(id) {
    try {
      const res = await fetch(`/api/favorites/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await this.loadFavorites();
        this.renderFavoritesChips();
        return;
      }
    } catch (e) {}

    this.favorites = this.favorites.filter(f => f.id !== id);
    localStorage.setItem('wd_favorites', JSON.stringify({ defaultId: this.defaultId, locations: this.favorites }));
    this.renderFavoritesChips();
  }

  async setDefaultFavorite(id) {
    try {
      const res = await fetch(`/api/favorites/${id}/default`, { method: 'PUT' });
      if (res.ok) {
        await this.loadFavorites();
        this.renderFavoritesChips();
        return;
      }
    } catch (e) {}

    this.favorites.forEach(f => f.isDefault = (f.id === id));
    this.defaultId = id;
    localStorage.setItem('wd_favorites', JSON.stringify({ defaultId: this.defaultId, locations: this.favorites }));
    this.renderFavoritesChips();
  }

  // Geocoding Autocomplete
  setupAutocomplete() {
    const input = document.getElementById('addressSearchInput');
    const dropdown = document.getElementById('searchResultsDropdown');
    const clearBtn = document.getElementById('searchClearBtn');

    if (!input || !dropdown) return;

    let debounceTimer = null;

    input.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (clearBtn) clearBtn.style.display = val.length > 0 ? 'flex' : 'none';

      clearTimeout(debounceTimer);
      if (val.length < 2) {
        dropdown.style.display = 'none';
        return;
      }

      debounceTimer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/geocoding?q=${encodeURIComponent(val)}`);
          if (!res.ok) return;
          const data = await res.json();
          this.renderSearchResults(data.results || [], dropdown);
        } catch (err) {
          console.error('Errore ricerca indirizzo:', err);
        }
      }, 250);
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.style.display = 'none';
        dropdown.style.display = 'none';
        input.focus();
      });
    }

    // Chiudi dropdown se si clicca fuori
    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
  }

  renderSearchResults(results, dropdown) {
    dropdown.innerHTML = '';
    if (results.length === 0) {
      dropdown.innerHTML = `<div style="padding: 0.85rem; font-size: 0.85rem; color: var(--text-muted); text-align: center;">Nessun risultato trovato</div>`;
      dropdown.style.display = 'block';
      return;
    }

    results.forEach(item => {
      const div = document.createElement('div');
      div.className = 'search-result-item';

      const details = [item.admin1, item.country].filter(Boolean).join(', ');
      div.innerHTML = `
        <div>
          <div class="search-result-name">${item.name}</div>
          <div class="search-result-sub">${details}</div>
        </div>
        <div style="font-size: 0.75rem; color: var(--accent);">Seleziona →</div>
      `;

      div.onclick = () => {
        dropdown.style.display = 'none';
        const input = document.getElementById('addressSearchInput');
        if (input) input.value = item.name;

        const newLoc = {
          id: `loc_${item.id || Date.now()}`,
          name: item.name,
          label: item.name,
          lat: item.latitude,
          lon: item.longitude,
          country: item.country || '',
          admin1: item.admin1 || '',
          isDefault: false
        };

        this.selectLocation(newLoc);
      };

      dropdown.appendChild(div);
    });

    dropdown.style.display = 'block';
  }

  // Geolocation del browser
  useCurrentLocation() {
    if (!navigator.geolocation) {
      alert('La geolocalizzazione non è supportata dal tuo browser.');
      return;
    }

    this.setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        const myLoc = {
          id: 'gps_current',
          name: 'La mia posizione',
          label: '📍 Posizione Attuale',
          lat: lat,
          lon: lon,
          country: '',
          admin1: '',
          isDefault: false
        };

        await this.selectLocation(myLoc);
      },
      (err) => {
        this.setLoading(false);
        console.error('Errore geolocalizzazione:', err);
        alert('Impossibile rilevare la posizione attuale: ' + err.message);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  // Modal Gestione Preferiti
  openFavoritesModal() {
    const modal = document.getElementById('favoritesModal');
    const list = document.getElementById('savedLocationsModalList');
    if (!modal || !list) return;

    list.innerHTML = '';
    if (this.favorites.length === 0) {
      list.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem; text-align: center;">Nessun indirizzo salvato.</p>`;
    } else {
      this.favorites.forEach(loc => {
        const row = document.createElement('div');
        row.className = 'saved-item-row';
        row.innerHTML = `
          <div>
            <div style="font-weight: 600; font-size: 0.95rem; display: flex; align-items: center; gap: 0.4rem;">
              ${loc.isDefault ? '<span style="color: #fbbf24;" title="Predefinito">★</span>' : ''}
              <span>${loc.label || loc.name}</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${loc.name} (${loc.admin1 || loc.country || `${loc.lat.toFixed(2)}, ${loc.lon.toFixed(2)}`})</div>
          </div>
          <div class="saved-item-actions">
            ${!loc.isDefault ? `<button class="pill-btn set-default-btn" title="Imposta come predefinito" data-id="${loc.id}">Predefinito</button>` : '<span style="font-size: 0.75rem; color: #10b981; font-weight: 600;">Principale</span>'}
            <button class="action-btn delete-btn" title="Elimina" data-id="${loc.id}" style="color: #ef4444;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        `;

        const defBtn = row.querySelector('.set-default-btn');
        if (defBtn) {
          defBtn.onclick = async () => {
            await this.setDefaultFavorite(loc.id);
            this.openFavoritesModal();
          };
        }

        const delBtn = row.querySelector('.delete-btn');
        if (delBtn) {
          delBtn.onclick = async () => {
            if (confirm(`Sei sicuro di voler rimuovere "${loc.label || loc.name}"?`)) {
              await this.removeFavorite(loc.id);
              this.openFavoritesModal();
            }
          };
        }

        list.appendChild(row);
      });
    }

    modal.classList.add('active');
  }

  closeFavoritesModal() {
    const modal = document.getElementById('favoritesModal');
    if (modal) modal.classList.remove('active');
  }

  // Confronto Climatico Storico (Open-Meteo Archive)
  async fetchClimateAnomaly(lat, lon, currentTemp) {
    const badge = document.getElementById('climateAnomalyBadge');
    if (!badge) return;

    badge.style.display = 'inline-flex';
    badge.innerHTML = '📊 Calcolo anomalia climatica...';

    try {
      const res = await fetch(`/api/climate-compare?lat=${lat}&lon=${lon}`);
      if (!res.ok) throw new Error('API non disponibile');
      const data = await res.json();

      if (data.available && data.historicalMean !== undefined) {
        const diff = Math.round((currentTemp - data.historicalMean) * 10) / 10;
        const sign = diff > 0 ? '+' : '';
        const isWarmer = diff >= 0;
        const icon = isWarmer ? '🔥' : '❄️';
        const color = isWarmer ? '#f87171' : '#38bdf8';
        const bg = isWarmer ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)';
        const border = isWarmer ? 'rgba(239, 68, 68, 0.3)' : 'rgba(56, 189, 248, 0.3)';

        badge.style.background = bg;
        badge.style.borderColor = border;
        badge.style.color = color;
        badge.innerHTML = `${icon} <strong>${sign}${diff.toFixed(1)}°C</strong> vs media storica (${data.historicalMean.toFixed(1)}°C)`;
        badge.title = `Temperatura attuale: ${currentTemp}°C • Media storica del giorno (ultimi anni): ${data.historicalMean}°C`;
      } else {
        badge.style.display = 'none';
      }
    } catch (err) {
      badge.style.display = 'none';
    }
  }

  // Gestione Impostazioni (Telegram, Fotovoltaico, Home Assistant)
  async loadSettings() {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        this.settings = { ...this.settings, ...data };
      }
    } catch (err) {
      console.warn('Impossibile caricare le impostazioni dal server:', err);
    }

    // Aggiorna URL per Home Assistant
    const haUrlEl = document.getElementById('haEndpointUrl');
    if (haUrlEl) {
      haUrlEl.textContent = `${window.location.origin}/api/ha/sensors`;
    }
  }

  openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;

    const tokenInput = document.getElementById('settingTgToken');
    const chatIdInput = document.getElementById('settingTgChatId');
    const alertsCheck = document.getElementById('settingTgAlerts');
    const hailAlertsCheck = document.getElementById('settingTgHailAlerts');
    const briefingCheck = document.getElementById('settingTgBriefing');
    const briefingTimeInput = document.getElementById('settingTgBriefingTime');
    const solarInput = document.getElementById('settingSolarKwp');
    const windyKeyInput = document.getElementById('settingWindyKey');
    const feedback = document.getElementById('tgTestFeedback');
    const briefingFeedback = document.getElementById('tgBriefingFeedback');

    if (tokenInput) tokenInput.value = this.settings.telegramBotToken || '';
    if (chatIdInput) chatIdInput.value = this.settings.telegramChatId || '';
    if (alertsCheck) alertsCheck.checked = !!this.settings.telegramAlertsEnabled;
    if (hailAlertsCheck) hailAlertsCheck.checked = this.settings.telegramHailAlertsEnabled !== false;
    if (briefingCheck) briefingCheck.checked = this.settings.telegramDailyDigest !== false;
    if (briefingTimeInput) briefingTimeInput.value = this.settings.telegramBriefingTime || '07:30';
    if (solarInput) solarInput.value = this.settings.solarKwp || 4.0;
    if (windyKeyInput) windyKeyInput.value = this.settings.windyWebcamApiKey || '';
    if (feedback) {
      feedback.style.display = 'none';
      feedback.textContent = '';
    }
    if (briefingFeedback) {
      briefingFeedback.style.display = 'none';
      briefingFeedback.textContent = '';
    }

    const haUrlEl = document.getElementById('haEndpointUrl');
    if (haUrlEl) haUrlEl.textContent = `${window.location.origin}/api/ha/sensors`;

    modal.classList.add('active');
  }

  closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.remove('active');
  }

  async saveSettings() {
    const tokenInput = document.getElementById('settingTgToken');
    const chatIdInput = document.getElementById('settingTgChatId');
    const alertsCheck = document.getElementById('settingTgAlerts');
    const hailAlertsCheck = document.getElementById('settingTgHailAlerts');
    const briefingCheck = document.getElementById('settingTgBriefing');
    const briefingTimeInput = document.getElementById('settingTgBriefingTime');
    const solarInput = document.getElementById('settingSolarKwp');
    const windyKeyInput = document.getElementById('settingWindyKey');
    const saveBtn = document.getElementById('saveSettingsBtn');

    const updated = {
      telegramBotToken: tokenInput ? tokenInput.value.trim() : '',
      telegramChatId: chatIdInput ? chatIdInput.value.trim() : '',
      telegramAlertsEnabled: alertsCheck ? alertsCheck.checked : false,
      telegramHailAlertsEnabled: hailAlertsCheck ? hailAlertsCheck.checked : true,
      telegramDailyDigest: briefingCheck ? briefingCheck.checked : true,
      telegramBriefingTime: briefingTimeInput ? briefingTimeInput.value : '07:30',
      solarKwp: solarInput ? parseFloat(solarInput.value) || 4.0 : 4.0,
      windyWebcamApiKey: windyKeyInput ? windyKeyInput.value.trim() : ''
    };

    if (saveBtn) {
      saveBtn.textContent = 'Salvataggio...';
      saveBtn.disabled = true;
    }

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });

      if (res.ok) {
        this.settings = await res.json();
        if (saveBtn) saveBtn.textContent = '✓ Salvato!';

        // Aggiorna subito i calcoli fotovoltaici nella UI
        if (this.weatherData && typeof renderLifeIndices === 'function') {
          renderLifeIndices(this.weatherData, this.airQualityData, this.settings.solarKwp);
        }

        // Se le webcam sono attive, ricarica con la nuova chiave
        if (this.radar && this.radar.layerType === 'webcams' && this.activeLocation) {
          this.radar.loadWebcams(this.activeLocation.lat, this.activeLocation.lon);
        }

        setTimeout(() => {
          if (saveBtn) {
            saveBtn.textContent = 'Salva Modifiche';
            saveBtn.disabled = false;
          }
          this.closeSettingsModal();
        }, 700);
        return;
      }
    } catch (err) {
      console.error('Errore salvataggio impostazioni:', err);
      alert('Errore durante il salvataggio delle impostazioni.');
    }

    if (saveBtn) {
      saveBtn.textContent = 'Salva Modifiche';
      saveBtn.disabled = false;
    }
  }

  async sendTelegramTest() {
    const tokenInput = document.getElementById('settingTgToken');
    const chatIdInput = document.getElementById('settingTgChatId');
    const feedback = document.getElementById('tgTestFeedback');
    const sendBtn = document.getElementById('sendTgTestBtn');

    const token = tokenInput ? tokenInput.value.trim() : (this.settings.telegramBotToken || '');
    const chatId = chatIdInput ? chatIdInput.value.trim() : (this.settings.telegramChatId || '');

    if (!token || !chatId) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.color = '#ef4444';
        feedback.textContent = '⚠️ Inserisci prima sia il Token Bot che il Chat ID.';
      }
      return;
    }

    if (sendBtn) {
      sendBtn.textContent = 'Invio...';
      sendBtn.disabled = true;
    }
    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.color = '#38bdf8';
      feedback.textContent = 'Invio messaggio di prova a Telegram...';
    }

    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, chatId })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (feedback) {
          feedback.style.color = '#10b981';
          feedback.textContent = '✓ Messaggio inviato! Controlla la tua chat su Telegram.';
        }
      } else {
        if (feedback) {
          feedback.style.color = '#ef4444';
          feedback.textContent = '❌ Errore Telegram: ' + (data.error || 'Verifica token e chat ID');
        }
      }
    } catch (err) {
      if (feedback) {
        feedback.style.color = '#ef4444';
        feedback.textContent = '❌ Errore di rete durante la connessione con Telegram.';
      }
    } finally {
      if (sendBtn) {
        sendBtn.textContent = 'Invia Test';
        sendBtn.disabled = false;
      }
    }
  }

  async sendTelegramBriefing() {
    const tokenInput = document.getElementById('settingTgToken');
    const chatIdInput = document.getElementById('settingTgChatId');
    const feedback = document.getElementById('tgBriefingFeedback');
    const sendBtn = document.getElementById('sendTgBriefingBtn');

    const token = tokenInput ? tokenInput.value.trim() : (this.settings.telegramBotToken || '');
    const chatId = chatIdInput ? chatIdInput.value.trim() : (this.settings.telegramChatId || '');

    if (!token || !chatId) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.color = '#ef4444';
        feedback.textContent = '⚠️ Inserisci prima sia il Token Bot che il Chat ID.';
      }
      return;
    }

    if (sendBtn) {
      sendBtn.textContent = 'Invio...';
      sendBtn.disabled = true;
    }
    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.color = '#38bdf8';
      feedback.textContent = 'Generazione e invio Morning Briefing a Telegram...';
    }

    try {
      const res = await fetch('/api/telegram/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          chatId,
          locationId: this.activeLocation?.id
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (feedback) {
          feedback.style.color = '#10b981';
          feedback.textContent = '✓ ' + (data.message || 'Briefing inviato! Controlla la chat Telegram.');
        }
      } else {
        if (feedback) {
          feedback.style.color = '#ef4444';
          feedback.textContent = '❌ Errore Telegram: ' + (data.error || 'Verifica token e chat ID');
        }
      }
    } catch (err) {
      if (feedback) {
        feedback.style.color = '#ef4444';
        feedback.textContent = '❌ Errore di rete durante la connessione con Telegram.';
      }
    } finally {
      if (sendBtn) {
        sendBtn.textContent = '☕ Invia Briefing Adesso';
        sendBtn.disabled = false;
      }
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn('Errore fullscreen:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  bindEvents() {
    // Ricerca Autocomplete
    this.setupAutocomplete();

    // Bottone Geolocation
    const geoBtn = document.getElementById('geoLocBtn');
    if (geoBtn) geoBtn.onclick = () => this.useCurrentLocation();

    // Toggle Tema
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) themeBtn.onclick = () => this.toggleTheme();

    // Toggle Unità (°C / °F)
    const unitBtn = document.getElementById('unitToggleBtn');
    if (unitBtn) {
      unitBtn.textContent = this.isFahrenheit ? '°F' : '°C';
      unitBtn.onclick = () => this.toggleUnit();
    }

    // Toggle Fullscreen / TV Mode
    const fullBtn = document.getElementById('fullscreenBtn');
    if (fullBtn) fullBtn.onclick = () => this.toggleFullscreen();

    // Refresh Manuale
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.onclick = () => {
        if (this.activeLocation) this.selectLocation(this.activeLocation);
      };
    }

    // Stella Salva / Rimuovi Preferito Hero
    const starBtn = document.getElementById('favToggleHeroBtn');
    if (starBtn) {
      starBtn.onclick = () => this.toggleCurrentLocationFavorite();
    }

    // Gestione Preferiti Modal
    const manageFavsBtn = document.getElementById('manageFavoritesBtn');
    if (manageFavsBtn) manageFavsBtn.onclick = () => this.openFavoritesModal();

    const closeModalBtn = document.getElementById('closeFavoritesModalBtn');
    if (closeModalBtn) closeModalBtn.onclick = () => this.closeFavoritesModal();

    const modalOverlay = document.getElementById('favoritesModal');
    if (modalOverlay) {
      modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) this.closeFavoritesModal();
      };
    }

    // Toggle Effetti Atmosferici Canvas
    const effectsBtn = document.getElementById('canvasEffectsToggleBtn');
    if (effectsBtn) {
      effectsBtn.classList.toggle('active', this.canvasEffects.enabled);
      effectsBtn.onclick = () => {
        const isEnabled = this.canvasEffects.toggle();
        effectsBtn.classList.toggle('active', isEnabled);
      };
    }

    // Gestione Impostazioni (Telegram, Fotovoltaico, Home Assistant)
    const openSettingsBtn = document.getElementById('openSettingsBtn');
    if (openSettingsBtn) openSettingsBtn.onclick = () => this.openSettingsModal();

    const openSolarSettingsBtn = document.getElementById('openSolarSettingsBtn');
    if (openSolarSettingsBtn) openSolarSettingsBtn.onclick = () => this.openSettingsModal();

    const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
    if (closeSettingsModalBtn) closeSettingsModalBtn.onclick = () => this.closeSettingsModal();

    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) saveSettingsBtn.onclick = () => this.saveSettings();

    const sendTgTestBtn = document.getElementById('sendTgTestBtn');
    if (sendTgTestBtn) sendTgTestBtn.onclick = () => this.sendTelegramTest();

    const sendTgBriefingBtn = document.getElementById('sendTgBriefingBtn');
    if (sendTgBriefingBtn) sendTgBriefingBtn.onclick = () => this.sendTelegramBriefing();

    const settingsOverlay = document.getElementById('settingsModal');
    if (settingsOverlay) {
      settingsOverlay.onclick = (e) => {
        if (e.target === settingsOverlay) this.closeSettingsModal();
      };
    }
  }
}

// Inizializzazione al caricamento del DOM
document.addEventListener('DOMContentLoaded', () => {
  const app = new WeatherApp();
  app.init();
  window.weatherApp = app;
});
