const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const FAVORITES_FILE = path.join(DATA_DIR, 'favorites.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory cache to prevent rate-limiting and accelerate response times
const cache = new Map();
function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.data;
}
function setCached(key, data, ttlSeconds) {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000
  });
}

// ================= TRACCIATORE FULMINI BLITZORTUNG (MQTT) =================
let mqtt = null;
try {
  mqtt = require('mqtt');
} catch (e) {
  console.warn('MQTT non disponibile:', e.message);
}

const lightningStrikes = []; // Buffer scariche dell'ultima ora
const MAX_LIGHTNING_AGE_MS = 60 * 60 * 1000; // 60 minuti

function initLightningTracker() {
  if (!mqtt) return;
  try {
    const client = mqtt.connect('mqtt://blitzortung.ha.sed.pl:1883', {
      reconnectPeriod: 10000,
      connectTimeout: 10000
    });

    client.on('connect', () => {
      console.log('⚡ Connesso al broker Blitzortung Live Lightning (MQTT)!');
      client.subscribe('blitzortung/1.1/#', { qos: 0 });
    });

    client.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.lat !== undefined && data.lon !== undefined) {
          const strikeTime = data.time ? Math.round(data.time / 1000000) : Date.now();
          lightningStrikes.push({
            lat: data.lat,
            lon: data.lon,
            time: strikeTime,
            region: data.region || 0
          });
        }
      } catch (err) {
        // Ignora pacchetti non validi
      }
    });

    client.on('error', (err) => {
      console.warn('⚡ Errore connessione Blitzortung MQTT:', err.message);
    });

    // Pulizia periodica ogni minuto per mantenere solo l'ultima ora
    setInterval(() => {
      const cutoff = Date.now() - MAX_LIGHTNING_AGE_MS;
      while (lightningStrikes.length > 0 && lightningStrikes[0].time < cutoff) {
        lightningStrikes.shift();
      }
    }, 60000);
  } catch (err) {
    console.warn('Impossibile avviare il tracciatore fulmini:', err.message);
  }
}
initLightningTracker();

// Assicura l'esistenza della cartella e del file data
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const defaultFavorites = {
  defaultId: 'roma',
  locations: [
    {
      id: 'roma',
      name: 'Roma',
      label: 'Roma',
      lat: 41.8919,
      lon: 12.5113,
      country: 'Italia',
      admin1: 'Lazio',
      isDefault: true
    },
    {
      id: 'milano',
      name: 'Milano',
      label: 'Milano',
      lat: 45.4642,
      lon: 9.19,
      country: 'Italia',
      admin1: 'Lombardia',
      isDefault: false
    },
    {
      id: 'napoli',
      name: 'Napoli',
      label: 'Napoli',
      lat: 40.8518,
      lon: 14.2681,
      country: 'Italia',
      admin1: 'Campania',
      isDefault: false
    }
  ]
};

const defaultSettings = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  telegramAlertsEnabled: false,
  telegramHailAlertsEnabled: true,
  telegramDailyDigest: true,
  telegramBriefingTime: '07:30',
  solarKwp: 4.0,
  windyWebcamApiKey: process.env.WINDY_API_KEY || '',
  cartoApiKey: process.env.CARTO_API_KEY || '',
  canvasEffectsEnabled: true
};

function readFavorites() {
  try {
    if (!fs.existsSync(FAVORITES_FILE)) {
      fs.writeFileSync(FAVORITES_FILE, JSON.stringify(defaultFavorites, null, 2), 'utf8');
      return defaultFavorites;
    }
    const raw = fs.readFileSync(FAVORITES_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Errore lettura favorites.json:', err);
    return defaultFavorites;
  }
}

function writeFavorites(data) {
  try {
    fs.writeFileSync(FAVORITES_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Errore scrittura favorites.json:', err);
    return false;
  }
}

function readSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2), 'utf8');
      return defaultSettings;
    }
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch (err) {
    console.error('Errore lettura settings.json:', err);
    return defaultSettings;
  }
}

function writeSettings(data) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Errore scrittura settings.json:', err);
    return false;
  }
}

// ================= API ENDPOINTS =================

// Health check per Docker
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Configurazione pubblica per il frontend (es. Basemaps API key)
app.get('/api/config', (req, res) => {
  const settings = readSettings();
  res.json({
    cartoApiKey: settings.cartoApiKey || process.env.CARTO_API_KEY || ''
  });
});

// Impostazioni generali & Telegram
app.get('/api/settings', (req, res) => {
  const settings = readSettings();
  res.json(settings);
});

app.post('/api/settings', (req, res) => {
  const current = readSettings();
  const updated = {
    ...current,
    ...req.body
  };
  if (req.body.solarKwp !== undefined) {
    updated.solarKwp = parseFloat(req.body.solarKwp) || 4.0;
  }
  writeSettings(updated);
  res.json(updated);
});

// Test invio notifica Telegram
app.post('/api/telegram/test', async (req, res) => {
  const { token, chatId } = req.body;
  const settings = readSettings();
  const botToken = token || settings.telegramBotToken;
  const targetChatId = chatId || settings.telegramChatId;

  if (!botToken || !targetChatId) {
    return res.status(400).json({ error: 'Token Bot e Chat ID Telegram sono obbligatori' });
  }

  try {
    const text = `🌤️ *WeatherDash Test Alert*\n\nConnessione Telegram completata con successo! Riceverai qui gli avvisi meteo e il nowcast pioggia sul tuo comune.`;
    const tgUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(tgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text,
        parse_mode: 'Markdown'
      })
    });

    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.description || 'Errore risposta Telegram');
    }

    res.json({ success: true, message: 'Messaggio inviato con successo!' });
  } catch (err) {
    console.error('Errore invio Telegram test:', err.message);
    res.status(500).json({ error: 'Errore invio Telegram: ' + err.message });
  }
});

// Invio manuale o di test del Morning Briefing completo
app.post('/api/telegram/briefing', async (req, res) => {
  const settings = readSettings();
  const botToken = req.body.token || settings.telegramBotToken;
  const targetChatId = req.body.chatId || settings.telegramChatId;

  if (!botToken || !targetChatId) {
    return res.status(400).json({ error: 'Token Bot e Chat ID Telegram sono obbligatori' });
  }

  try {
    const favs = readFavorites();
    const loc = (req.body.locationId && favs.locations.find(l => l.id === req.body.locationId)) 
      || favs.locations.find(l => l.id === favs.defaultId) 
      || favs.locations[0] 
      || { lat: 41.89, lon: 12.51, name: 'Roma', label: 'Roma' };

    const wRes = await fetch(`http://localhost:${PORT}/api/weather?lat=${loc.lat}&lon=${loc.lon}`);
    const weather = wRes.ok ? await wRes.json() : {};

    const aqRes = await fetch(`http://localhost:${PORT}/api/airquality?lat=${loc.lat}&lon=${loc.lon}`);
    const aq = aqRes.ok ? await aqRes.json() : {};

    let alerts = null;
    try {
      alerts = await getMeteoAlarmAlerts(loc.country, loc.admin1);
    } catch (e) {}

    const briefingText = generateMorningBriefing(loc, weather, aq, settings, alerts);

    const tgUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(tgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: briefingText,
        parse_mode: 'Markdown'
      })
    });

    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.description || 'Errore risposta Telegram');
    }

    res.json({ success: true, message: `Briefing per ${loc.label || loc.name} inviato con successo su Telegram!` });
  } catch (err) {
    console.error('Errore invio Telegram briefing:', err.message);
    res.status(500).json({ error: 'Errore invio Telegram briefing: ' + err.message });
  }
});

// Ottieni preferiti
app.get('/api/favorites', (req, res) => {
  const favs = readFavorites();
  res.json(favs);
});

// Aggiungi un preferito
app.post('/api/favorites', (req, res) => {
  const { name, label, lat, lon, country, admin1, isDefault } = req.body;
  if (!name || lat === undefined || lon === undefined) {
    return res.status(400).json({ error: 'Dati incompleti (name, lat, lon sono obbligatori)' });
  }

  const favs = readFavorites();
  const id = req.body.id || `loc_${Date.now()}`;
  const newLocation = {
    id,
    name,
    label: label || name,
    lat: parseFloat(lat),
    lon: parseFloat(lon),
    country: country || '',
    admin1: admin1 || '',
    isDefault: !!isDefault
  };

  if (newLocation.isDefault) {
    favs.locations.forEach(l => l.isDefault = false);
    favs.defaultId = id;
  }

  favs.locations = favs.locations.filter(l => l.id !== id && !(Math.abs(l.lat - newLocation.lat) < 0.005 && Math.abs(l.lon - newLocation.lon) < 0.005));
  favs.locations.push(newLocation);

  if (!favs.defaultId) {
    favs.defaultId = id;
    newLocation.isDefault = true;
  }

  writeFavorites(favs);
  res.status(201).json(newLocation);
});

// Modifica un preferito (etichetta o default)
app.put('/api/favorites/:id', (req, res) => {
  const { id } = req.params;
  const { label, isDefault } = req.body;
  const favs = readFavorites();
  const loc = favs.locations.find(l => l.id === id);

  if (!loc) {
    return res.status(404).json({ error: 'Posizione non trovata' });
  }

  if (label !== undefined) loc.label = label;
  if (isDefault !== undefined) {
    if (isDefault) {
      favs.locations.forEach(l => l.isDefault = false);
      loc.isDefault = true;
      favs.defaultId = id;
    } else if (loc.isDefault) {
      loc.isDefault = false;
      if (favs.defaultId === id) favs.defaultId = null;
    }
  }

  writeFavorites(favs);
  res.json(loc);
});

// Imposta una posizione come default
app.put('/api/favorites/:id/default', (req, res) => {
  const { id } = req.params;
  const favs = readFavorites();
  const loc = favs.locations.find(l => l.id === id);

  if (!loc) {
    return res.status(404).json({ error: 'Posizione non trovata' });
  }

  favs.locations.forEach(l => l.isDefault = (l.id === id));
  favs.defaultId = id;

  writeFavorites(favs);
  res.json({ message: 'Posizione predefinita impostata', defaultId: id });
});

// Elimina un preferito
app.delete('/api/favorites/:id', (req, res) => {
  const { id } = req.params;
  const favs = readFavorites();
  favs.locations = favs.locations.filter(l => l.id !== id);

  if (favs.defaultId === id) {
    favs.defaultId = favs.locations.length > 0 ? favs.locations[0].id : null;
    if (favs.defaultId) {
      const defLoc = favs.locations.find(l => l.id === favs.defaultId);
      if (defLoc) defLoc.isDefault = true;
    }
  }

  writeFavorites(favs);
  res.json({ message: 'Posizione rimossa', defaultId: favs.defaultId });
});

// Geocoding Proxy (Open-Meteo)
app.get('/api/geocoding', async (req, res) => {
  const q = req.query.q;
  if (!q || q.trim().length < 2) {
    return res.json({ results: [] });
  }

  const cacheKey = `geo_${q.toLowerCase().trim()}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&language=it&format=json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Geocoding HTTP ${response.status}`);
    const data = await response.json();
    setCached(cacheKey, data, 3600); // cache 1 ora
    res.json(data);
  } catch (err) {
    console.error('Errore geocoding:', err.message);
    res.status(500).json({ error: 'Impossibile completare la ricerca indirizzo' });
  }
});

// Reverse Geocoding Proxy (OpenStreetMap Nominatim)
app.get('/api/reverse-geocode', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'Coordinate mancanti' });

  const cacheKey = `rev_${parseFloat(lat).toFixed(3)}_${parseFloat(lon).toFixed(3)}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=it`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'WeatherDash/1.0' }
    });
    if (!response.ok) throw new Error(`Reverse geocode HTTP ${response.status}`);
    const data = await response.json();
    setCached(cacheKey, data, 86400); // cache 24h
    res.json(data);
  } catch (err) {
    console.error('Errore reverse geocoding:', err.message);
    res.json({ display_name: `Posizione (${parseFloat(lat).toFixed(2)}, ${parseFloat(lon).toFixed(2)})` });
  }
});

// Weather Proxy (Open-Meteo Forecast con Nowcast, Solare & Raggi)
app.get('/api/weather', async (req, res) => {
  const { lat, lon, timezone = 'auto' } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: 'Parametri lat e lon obbligatori' });
  }

  const cacheKey = `weather_${parseFloat(lat).toFixed(3)}_${parseFloat(lon).toFixed(3)}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const currentParams = [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'is_day',
      'precipitation',
      'rain',
      'showers',
      'snowfall',
      'weather_code',
      'cloud_cover',
      'surface_pressure',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m'
    ].join(',');

    const hourlyParams = [
      'temperature_2m',
      'relative_humidity_2m',
      'dew_point_2m',
      'apparent_temperature',
      'precipitation_probability',
      'precipitation',
      'rain',
      'showers',
      'snowfall',
      'weather_code',
      'surface_pressure',
      'cloud_cover',
      'cloud_cover_low',
      'cloud_cover_mid',
      'cloud_cover_high',
      'visibility',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
      'uv_index',
      'direct_radiation',
      'shortwave_radiation',
      'cape',
      'lifted_index'
    ].join(',');

    const dailyParams = [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'apparent_temperature_max',
      'apparent_temperature_min',
      'sunrise',
      'sunset',
      'daylight_duration',
      'uv_index_max',
      'precipitation_sum',
      'rain_sum',
      'showers_sum',
      'snowfall_sum',
      'precipitation_hours',
      'precipitation_probability_max',
      'wind_speed_10m_max',
      'wind_gusts_10m_max',
      'wind_direction_10m_dominant',
      'shortwave_radiation_sum'
    ].join(',');

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=${currentParams}&hourly=${hourlyParams}&daily=${dailyParams}&minutely_15=precipitation,rain,snowfall,weather_code&forecast_minutely_15=48&timezone=${encodeURIComponent(timezone)}&forecast_days=14`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Weather HTTP ${response.status}`);
    const data = await response.json();

    setCached(cacheKey, data, 300); // cache 5 minuti
    res.json(data);
  } catch (err) {
    console.error('Errore fetch meteo:', err.message);
    res.status(500).json({ error: 'Impossibile scaricare le previsioni meteo' });
  }
});

// Air Quality Proxy (con Pollini Allergeni Europei)
app.get('/api/airquality', async (req, res) => {
  const { lat, lon, timezone = 'auto' } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: 'Parametri lat e lon obbligatori' });
  }

  const cacheKey = `aq_${parseFloat(lat).toFixed(3)}_${parseFloat(lon).toFixed(3)}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const currentParams = [
      'european_aqi',
      'us_aqi',
      'pm10',
      'pm2_5',
      'carbon_monoxide',
      'nitrogen_dioxide',
      'sulphur_dioxide',
      'ozone',
      'dust',
      'uv_index',
      'alder_pollen',
      'birch_pollen',
      'grass_pollen',
      'mugwort_pollen',
      'olive_pollen',
      'ragweed_pollen'
    ].join(',');

    const hourlyParams = [
      'european_aqi',
      'us_aqi',
      'pm10',
      'pm2_5',
      'carbon_monoxide',
      'nitrogen_dioxide',
      'sulphur_dioxide',
      'ozone',
      'dust',
      'uv_index',
      'alder_pollen',
      'birch_pollen',
      'grass_pollen',
      'mugwort_pollen',
      'olive_pollen',
      'ragweed_pollen'
    ].join(',');

    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=${currentParams}&hourly=${hourlyParams}&timezone=${encodeURIComponent(timezone)}&forecast_days=3`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`AirQuality HTTP ${response.status}`);
    const data = await response.json();

    setCached(cacheKey, data, 600); // cache 10 minuti
    res.json(data);
  } catch (err) {
    console.error('Errore fetch qualità aria:', err.message);
    res.status(500).json({ error: "Impossibile scaricare i dati sulla qualità dell'aria" });
  }
});

// Radar Frames Proxy (RainViewer)
app.get('/api/radar-frames', async (req, res) => {
  const cacheKey = 'radar_frames';
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
    if (!response.ok) throw new Error(`RainViewer HTTP ${response.status}`);
    const data = await response.json();
    setCached(cacheKey, data, 120); // cache 2 minuti
    res.json(data);
  } catch (err) {
    console.error('Errore fetch radar frames:', err.message);
    res.status(500).json({ error: 'Impossibile scaricare i frame del radar' });
  }
});

// Confronto Storico Climatico (Open-Meteo Archive API)
app.get('/api/climate-compare', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'Coordinate obbligatorie' });

  const now = new Date();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const cacheKey = `climate_${parseFloat(lat).toFixed(2)}_${parseFloat(lon).toFixed(2)}_${month}_${day}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    // Media dello stesso giorno negli ultimi anni (es. 2020, 2021, 2022)
    const years = [2021, 2022, 2023];
    const promises = years.map(yr => {
      const dStr = `${yr}-${month}-${day}`;
      return fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${dStr}&end_date=${dStr}&daily=temperature_2m_mean`)
        .then(r => r.json())
        .then(d => d.daily?.temperature_2m_mean?.[0])
        .catch(() => null);
    });

    const pastTemps = (await Promise.all(promises)).filter(t => t !== null && t !== undefined);
    if (pastTemps.length === 0) {
      return res.json({ available: false });
    }

    const historicalMean = pastTemps.reduce((a, b) => a + b, 0) / pastTemps.length;
    const result = {
      available: true,
      historicalMean: Math.round(historicalMean * 10) / 10,
      yearsCompared: pastTemps.length
    };

    setCached(cacheKey, result, 86400); // cache 24h
    res.json(result);
  } catch (err) {
    console.error('Errore confronto climatico:', err.message);
    res.json({ available: false });
  }
});

// Funzione calcolo distanza geografica (Haversine formula in km)
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Funzione calcolo Indice di Rischio Grandine (0-100%)
function calculateHailRiskFromHourly(hourly) {
  if (!hourly || !hourly.time) {
    return { maxRisk: 0, level: 'Nullo', peakHour: '--:--', peakCape: 0, alertActive: false };
  }

  const now = new Date();
  const currentIso = now.toISOString().substring(0, 13);
  let startIdx = hourly.time.findIndex(t => t.startsWith(currentIso));
  if (startIdx === -1) startIdx = 0;

  const endIdx = Math.min(hourly.time.length, startIdx + 24);
  let maxRisk = 0;
  let peakHour = null;
  let peakCape = 0;

  for (let i = startIdx; i < endIdx; i++) {
    const cape = (hourly.cape && hourly.cape[i]) || 0;
    const li = (hourly.lifted_index && hourly.lifted_index[i] !== undefined) ? hourly.lifted_index[i] : 5;
    const wCode = (hourly.weather_code && hourly.weather_code[i]) || 0;
    const prob = (hourly.precipitation_probability && hourly.precipitation_probability[i]) || 0;
    const precip = (hourly.precipitation && hourly.precipitation[i]) || 0;

    let capeScore = 0;
    if (cape >= 2500) capeScore = 90 + Math.min(10, (cape - 2500) / 100);
    else if (cape >= 1200) capeScore = 60 + (cape - 1200) / 1300 * 30;
    else if (cape >= 500) capeScore = 30 + (cape - 500) / 700 * 30;
    else if (cape >= 100) capeScore = 10 + (cape - 100) / 400 * 20;

    let liBonus = 0;
    if (li <= -6) liBonus = 20;
    else if (li <= -3) liBonus = 12;
    else if (li <= 0) liBonus = 5;

    let baseRisk = capeScore + liBonus;
    if (wCode === 95) baseRisk += 20;

    const precipFactor = (prob < 15 && precip < 0.1) ? 0.15 : Math.min(1.0, prob / 50);
    let hourRisk = Math.round(baseRisk * precipFactor);

    if (wCode === 99) hourRisk = Math.max(92, hourRisk);
    else if (wCode === 96) hourRisk = Math.max(78, hourRisk);

    hourRisk = Math.max(0, Math.min(100, hourRisk));

    if (hourRisk > maxRisk) {
      maxRisk = hourRisk;
      peakHour = hourly.time[i];
      peakCape = Math.round(cape);
    }
  }

  let level = 'Nullo';
  if (maxRisk >= 75) level = 'Severo';
  else if (maxRisk >= 50) level = 'Elevato';
  else if (maxRisk >= 20) level = 'Moderato';
  else if (maxRisk >= 10) level = 'Basso';

  let peakTimeStr = '--:--';
  if (peakHour) {
    const d = new Date(peakHour);
    peakTimeStr = `${d.getHours().toString().padStart(2, '0')}:00`;
  }

  return {
    maxRisk,
    level,
    peakHour: peakTimeStr,
    peakCape,
    alertActive: maxRisk >= 50
  };
}

// Helper traduzione WMO per Briefing
function getWmoItalian(code) {
  const map = {
    0: 'Sereno ☀️',
    1: 'Prevalentemente sereno 🌤️',
    2: 'Parzialmente nuvoloso ⛅',
    3: 'Coperto ☁️',
    45: 'Nebbia 🌫️',
    48: 'Nebbia con brina 🌫️',
    51: 'Pioviggine leggera 🌦️',
    53: 'Pioviggine moderata 🌦️',
    55: 'Pioviggine densa 🌧️',
    61: 'Pioggia debole 🌧️',
    63: 'Pioggia moderata 🌧️',
    65: 'Pioggia battente 🌧️',
    71: 'Neve debole 🌨️',
    73: 'Neve moderata 🌨️',
    75: 'Neve intensa ❄️',
    80: 'Rovesci di pioggia 🌦️',
    81: 'Rovesci moderati 🌧️',
    82: 'Nubifragio / Rovesci violenti ⛈️',
    95: 'Temporale ⛈️',
    96: 'Temporale con grandine ⛈️🧊',
    99: 'Temporale con grandine forte ⛈️🧊'
  };
  return map[code] || 'Variabile ⛅';
}

function calculateLaundrySimple(currentTemp, daily) {
  const rainProb = (daily.precipitation_probability_max && daily.precipitation_probability_max[0]) || 0;
  const rainSum = (daily.precipitation_sum && daily.precipitation_sum[0]) || 0;
  if (rainProb > 40 || rainSum > 0.5) return 'Sconsigliato stendere all\'aperto (rischio pioggia) ❌';
  if (currentTemp > 20) return 'Ottimo! Asciugatura rapida in ~2-3 ore 🟢';
  if (currentTemp > 13) return 'Buono: asciugatura regolare in ~4 ore 🌤️';
  return 'Lento: fresco/umidità richiedono oltre 5 ore 🟡';
}

function calculateCarWashSimple(daily, aq) {
  const rainSum = (daily.precipitation_sum && daily.precipitation_sum.slice(0, 4)) || [];
  const willRain = rainSum.some(s => s > 0.5);
  const dust = aq?.current?.dust || 0;
  if (dust > 25) return 'Sconsigliato (presenza polveri sahariane in quota) 🟡';
  if (willRain) {
    const dayIdx = rainSum.findIndex(s => s > 0.5);
    return dayIdx === 0 ? 'Sconsigliato (pioggia prevista oggi) ❌' : 'Poco conveniente (piogge nei prossimi giorni) ⚠️';
  }
  return 'Consigliatissimo! Finestra asciutta di 4+ giorni garantita 🟢';
}

function calculateSportSimple(hourly) {
  if (!hourly || !hourly.time) return 'Tarda mattinata o primo pomeriggio';
  const now = new Date();
  const currentIso = now.toISOString().substring(0, 13);
  let startIdx = hourly.time.findIndex(t => t.startsWith(currentIso));
  if (startIdx === -1) startIdx = 0;

  let bestHour = 17;
  let bestScore = -999;
  let bestTemp = 18;

  for (let i = startIdx; i < Math.min(hourly.time.length, startIdx + 15); i++) {
    const d = new Date(hourly.time[i]);
    const h = d.getHours();
    if (h < 7 || h > 21) continue;
    const t = hourly.temperature_2m[i] || 15;
    const p = hourly.precipitation_probability ? hourly.precipitation_probability[i] : 0;
    const w = hourly.wind_speed_10m ? hourly.wind_speed_10m[i] : 0;
    let score = 100 - Math.abs(t - 19) * 3 - p * 1.5 - (w > 20 ? (w - 20) * 2 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestHour = h;
      bestTemp = Math.round(t);
    }
  }
  return `Dalle ${bestHour.toString().padStart(2, '0')}:00 alle ${(bestHour + 2).toString().padStart(2, '0')}:00 (~${bestTemp}°C, asciutto) 🏃`;
}

// Generatore del Morning Briefing Telegram completo
function generateMorningBriefing(loc, weather, aq, settings, alerts = null) {
  const current = weather.current || {};
  const daily = weather.daily || {};
  const hourly = weather.hourly || {};
  const kwp = settings.solarKwp || 4.0;

  const now = new Date();
  const dateStr = now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  const capitalizedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  const locName = loc.label || loc.name;

  // Temperature
  const tMin = (daily.temperature_2m_min && daily.temperature_2m_min[0] !== undefined) ? Math.round(daily.temperature_2m_min[0]) : '--';
  const tMax = (daily.temperature_2m_max && daily.temperature_2m_max[0] !== undefined) ? Math.round(daily.temperature_2m_max[0]) : '--';
  const currentTemp = current.temperature_2m !== undefined ? Math.round(current.temperature_2m) : '--';
  
  // WMO
  const wmo = getWmoItalian(current.weather_code !== undefined ? current.weather_code : (daily.weather_code && daily.weather_code[0]));

  // Precipitazioni & Ombrello
  const rainProb = (daily.precipitation_probability_max && daily.precipitation_probability_max[0]) || 0;
  const rainSum = (daily.precipitation_sum && daily.precipitation_sum[0]) || 0;
  let umbrellaAdvice = 'Nessun ombrello necessario 🕶️';
  if (rainProb >= 50 || rainSum >= 1.0) {
    umbrellaAdvice = `⚠️ Ombrello consigliato! (Probabilità ${rainProb}% • ${rainSum.toFixed(1)} mm)`;
  } else if (rainProb >= 25) {
    umbrellaAdvice = `Possibili piovaschi isolati (${rainProb}% prob.) 🌂`;
  }

  // Grandine
  const hail = calculateHailRiskFromHourly(hourly);
  let hailText = 'Nullo (0%) 🟢';
  if (hail.maxRisk >= 50) {
    hailText = `🚨 *ATTENZIONE ELEVATO (${hail.maxRisk}%)* verso le ore ${hail.peakHour} (CAPE ${hail.peakCape} J/kg)`;
  } else if (hail.maxRisk >= 25) {
    hailText = `Moderato (${hail.maxRisk}% - picco ore ${hail.peakHour}) 🟡`;
  }

  // Solare / Fotovoltaico
  const solarRad = (daily.shortwave_radiation_sum && daily.shortwave_radiation_sum[0]) || 0;
  const solarKwh = Math.round(solarRad * 0.2778 * kwp * 0.78 * 10) / 10;
  const solarSav = Math.round(solarKwh * 0.25 * 100) / 100;

  // Bucato, Auto, Sport
  const laundry = calculateLaundrySimple(currentTemp, daily);
  const car = calculateCarWashSimple(daily, aq);
  const sport = calculateSportSimple(hourly);

  // Qualità Aria & Pollini
  const aqi = aq?.current?.european_aqi;
  let aqiText = aqi ? (aqi <= 20 ? `Ottima (${aqi}) 🟢` : aqi <= 40 ? `Buona (${aqi}) 🟢` : aqi <= 60 ? `Moderata (${aqi}) 🟡` : `Scarsa (${aqi}) 🔴`) : 'Buona 🟢';

  // Outfit Advisor
  let outfit = 'Abbigliamento confortevole di mezza stagione';
  if (tMax < 11) outfit = 'Giaccone invernale o piumino caldo 🧥';
  else if (tMax < 16) outfit = 'Giacca di mezza stagione e maglione leggero 🧥';
  else if (tMin < 11 && tMax >= 18) outfit = `Vestiti a strati! Fresco al mattino (${tMin}°C) e mite di giorno (${tMax}°C) 👕🧥`;
  else if (tMax >= 24) outfit = 'T-shirt maniche corte e occhiali da sole 🕶️';

  // Allerta Ufficiale Protezione Civile (MeteoAlarm)
  let alertText = '';
  if (alerts && alerts.hasAlert && alerts.alerts && alerts.alerts.length > 0) {
    const topAlert = alerts.alerts[0];
    const icon = topAlert.level === 'red' ? '🔴' : topAlert.level === 'orange' ? '🟠' : '🟡';
    alertText = `\n${icon} *ALLERTA METEO*: *${topAlert.levelText}* per _${topAlert.eventIt}_!`;
  }

  return `☕ *BUONGIORNO DA WEATHERDASH!*
📅 *${capitalizedDate}*
📍 *${locName}*

🌤️ *Meteo di Oggi*: ${wmo}
🌡️ *Temperature*: Min *${tMin}°C* • Max *${tMax}°C* (Attuale: ${currentTemp}°C)
☂️ *Ombrello*: ${umbrellaAdvice}
🧊 *Rischio Grandine*: ${hailText}${alertText}
──────────────
💡 *INDICI DELLA GIORNATA*:
🧺 *Bucato*: ${laundry}
🚗 *Lavaggio Auto*: ${car}
🏃 *Miglior orario Sport*: ${sport}
⚡ *Fotovoltaico*: ~*${solarKwh} kWh* stimati (risparmio ~€${solarSav.toFixed(2)})
🍃 *Qualità Aria*: ${aqiText}

👕 *Outfit consigliato*: ${outfit}
──────────────
_Buona giornata da WeatherDash!_ ☀️`;
}

// Cache in memoria per webcams Open Data Hub (12 ore)
let odhWebcamsCache = null;
let odhCacheExpires = 0;

async function getOpenDataHubWebcams() {
  if (odhWebcamsCache && Date.now() < odhCacheExpires) {
    return odhWebcamsCache;
  }
  try {
    const res = await fetch('https://tourism.api.opendatahub.com/v1/WebcamInfo?pagenumber=1&pagesize=500');
    if (!res.ok) return odhWebcamsCache || [];
    const data = await res.json();
    odhWebcamsCache = (data.Items || []).filter(i => {
      const g = i.GpsInfo?.[0];
      return g && g.Latitude && g.Longitude && (i.ImageGallery?.[0]?.ImageUrl || i.Webcamurl);
    });
    odhCacheExpires = Date.now() + 12 * 3600 * 1000;
    return odhWebcamsCache;
  } catch (e) {
    console.warn('ODH fetch error:', e.message);
    return odhWebcamsCache || [];
  }
}

// Endpoint Webcam Live di Prossimità
app.get('/api/webcams', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'Coordinate lat e lon obbligatorie' });

  const numLat = parseFloat(lat);
  const numLon = parseFloat(lon);
  const cacheKey = `webcams_${numLat.toFixed(2)}_${numLon.toFixed(2)}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const settings = readSettings();
  const webcams = [];

  // 1. Prova Windy Webcams v3 se è configurata la chiave
  if (settings.windyWebcamApiKey) {
    try {
      const wUrl = `https://api.windy.com/webcams/api/v3/webcams?nearby=${numLat},${numLon},60&include=images,location,urls`;
      const wRes = await fetch(wUrl, {
        headers: { 'x-windy-api-key': settings.windyWebcamApiKey }
      });
      if (wRes.ok) {
        const wData = await wRes.json();
        if (wData.webcams && Array.isArray(wData.webcams)) {
          wData.webcams.forEach(item => {
            const camLat = item.location?.latitude;
            const camLon = item.location?.longitude;
            if (camLat && camLon) {
              const dist = getDistanceFromLatLonInKm(numLat, numLon, camLat, camLon);
              const preview = item.images?.current?.preview || item.images?.daylight?.preview;
              webcams.push({
                id: `windy_${item.id}`,
                title: item.title,
                lat: camLat,
                lon: camLon,
                distanceKm: Math.round(dist * 10) / 10,
                thumbnailUrl: preview,
                webcamUrl: item.urls?.detail || `https://www.windy.com/webcams/${item.id}`,
                source: 'windy'
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn('Errore fetch Windy Webcams:', e.message);
    }
  }

  // 2. Open Data Hub Webcams (Italia / Alpi)
  const odhList = await getOpenDataHubWebcams();
  odhList.forEach(item => {
    const gps = item.GpsInfo[0];
    const dist = getDistanceFromLatLonInKm(numLat, numLon, gps.Latitude, gps.Longitude);
    if (dist <= 160) {
      const rawImg = item.ImageGallery?.[0]?.ImageUrl || '';
      const safeImg = rawImg.replace(/^http:\/\//i, 'https://');
      webcams.push({
        id: `odh_${item.Id}`,
        title: item.Detail?.it?.Title || item.Shortname,
        lat: gps.Latitude,
        lon: gps.Longitude,
        distanceKm: Math.round(dist * 10) / 10,
        thumbnailUrl: safeImg,
        webcamUrl: item.Webcamurl,
        source: 'opendatahub'
      });
    }
  });

  // Ordina per distanza crescente
  webcams.sort((a, b) => a.distanceKm - b.distanceKm);

  const result = {
    webcams: webcams.slice(0, 16),
    totalFound: webcams.length,
    hasApiKey: !!settings.windyWebcamApiKey,
    windyMapUrl: `https://www.windy.com/-Webcams/webcams?${numLat.toFixed(3)},${numLon.toFixed(3)},11`
  };

  setCached(cacheKey, result, 600); // 10 min cache
  res.json(result);
});

// ================= ALLERTE UFFICIALI METEOALARM =================
async function getMeteoAlarmAlerts(countryCode, regionName) {
  const c = (countryCode || 'IT').toLowerCase();
  const countryFeedMap = {
    it: 'italy',
    italia: 'italy',
    es: 'spain',
    spagna: 'spain',
    fr: 'france',
    francia: 'france',
    de: 'germany',
    germania: 'germany',
    at: 'austria',
    ch: 'switzerland',
    svizzera: 'switzerland'
  };
  const feedCountry = countryFeedMap[c] || 'italy';
  const cacheKey = `meteoalarm_${feedCountry}`;
  let feedXml = getCached(cacheKey);

  if (!feedXml) {
    try {
      const url = `https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-${feedCountry}`;
      const response = await fetch(url, { headers: { 'User-Agent': 'WeatherDash/1.1' } });
      if (response.ok) {
        feedXml = await response.text();
        setCached(cacheKey, feedXml, 900); // Cache 15 minuti
      }
    } catch (err) {
      console.warn('Errore fetch MeteoAlarm:', err.message);
    }
  }

  if (!feedXml) return { hasAlert: false, alerts: [] };

  const entries = feedXml.split('<entry>').slice(1);
  const regionLower = (regionName || '').toLowerCase().trim();
  const matchedAlerts = [];

  for (const entry of entries) {
    const getTag = tag => {
      const m = entry.match(new RegExp('<(?:cap:)?' + tag + '[^>]*>([\\s\\S]*?)<\\/(?:cap:)?' + tag + '>'));
      return m ? m[1].trim() : '';
    };

    const area = getTag('areaDesc');
    const event = getTag('event');
    const severity = getTag('severity');
    const onset = getTag('onset');
    const expires = getTag('expires');

    const areaLower = area.toLowerCase();
    const isMatch = !regionLower || areaLower.includes(regionLower) || regionLower.includes(areaLower);

    if (isMatch && event) {
      let level = 'yellow';
      let levelText = 'Allerta Gialla';
      const eventLower = event.toLowerCase();
      if (eventLower.includes('red') || severity.toLowerCase() === 'extreme') {
        level = 'red';
        levelText = 'Allerta Rossa';
      } else if (eventLower.includes('orange') || severity.toLowerCase() === 'severe') {
        level = 'orange';
        levelText = 'Allerta Arancione';
      }

      let eventIt = event;
      if (eventLower.includes('thunderstorm')) eventIt = 'Temporali Forti e Grandine';
      else if (eventLower.includes('rain')) eventIt = 'Rischio Idrogeologico / Piogge Intense';
      else if (eventLower.includes('wind')) eventIt = 'Vento Forte e Raffiche di Burrasca';
      else if (eventLower.includes('snow') || eventLower.includes('ice')) eventIt = 'Neve e Ghiaccio';
      else if (eventLower.includes('high temperature')) eventIt = 'Ondata di Calore Estremo';
      else if (eventLower.includes('low temperature')) eventIt = 'Gelo Intenso';
      else if (eventLower.includes('fog')) eventIt = 'Nebbia Fitta';
      else if (eventLower.includes('coastal')) eventIt = 'Mareggiata';

      matchedAlerts.push({
        area,
        event,
        eventIt,
        level,
        levelText,
        severity,
        onset,
        expires
      });
    }
  }

  return {
    hasAlert: matchedAlerts.length > 0,
    region: regionName || 'Tutte',
    count: matchedAlerts.length,
    alerts: matchedAlerts
  };
}

// Endpoint Allerte Ufficiali MeteoAlarm / Protezione Civile
app.get('/api/alerts', async (req, res) => {
  const { lat, lon, country, admin1 } = req.query;
  try {
    let targetCountry = country;
    let targetRegion = admin1;

    if (!targetRegion && lat && lon) {
      const revUrl = `http://localhost:${PORT}/api/reverse?lat=${lat}&lon=${lon}`;
      const revRes = await fetch(revUrl);
      if (revRes.ok) {
        const revData = await revRes.json();
        targetCountry = targetCountry || revData.country || 'Italia';
        targetRegion = targetRegion || revData.admin1 || '';
      }
    }

    const result = await getMeteoAlarmAlerts(targetCountry, targetRegion);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Errore lettura allerte: ' + err.message });
  }
});

// Endpoint Scariche Elettriche / Fulmini Live (Blitzortung MQTT)
app.get('/api/lightning', (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const radius = parseFloat(req.query.radius) || 120; // km

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'Parametri lat e lon obbligatori' });
  }

  const now = Date.now();
  const nearby = [];
  let closestDist = Infinity;
  let count15m = 0;
  let count30m = 0;

  for (let i = lightningStrikes.length - 1; i >= 0; i--) {
    const s = lightningStrikes[i];
    const ageMs = now - s.time;
    if (ageMs > MAX_LIGHTNING_AGE_MS) continue;

    const dist = getDistanceFromLatLonInKm(lat, lon, s.lat, s.lon);
    if (dist <= radius) {
      const ageMinutes = Math.round(ageMs / 60000);
      if (dist < closestDist) closestDist = dist;
      if (ageMinutes <= 15) count15m++;
      if (ageMinutes <= 30) count30m++;

      nearby.push({
        lat: Math.round(s.lat * 10000) / 10000,
        lon: Math.round(s.lon * 10000) / 10000,
        time: s.time,
        ageMinutes,
        distanceKm: Math.round(dist * 10) / 10
      });

      if (nearby.length >= 200) break;
    }
  }

  res.json({
    totalInRadius: nearby.length,
    count15m,
    count30m,
    closestDistanceKm: closestDist < Infinity ? Math.round(closestDist * 10) / 10 : null,
    radiusKm: radius,
    strikes: nearby
  });
});

// Home Assistant REST Sensor API Endpoint
app.get('/api/ha/sensors', async (req, res) => {
  const favs = readFavorites();
  const settings = readSettings();
  const def = favs.locations.find(l => l.id === favs.defaultId) || favs.locations[0] || { lat: 41.89, lon: 12.51, name: 'Roma' };

  try {
    // Richiedi meteo per la posizione predefinita
    const wRes = await fetch(`http://localhost:${PORT}/api/weather?lat=${def.lat}&lon=${def.lon}`);
    const weather = wRes.ok ? await wRes.json() : {};

    const aqRes = await fetch(`http://localhost:${PORT}/api/airquality?lat=${def.lat}&lon=${def.lon}`);
    const aq = aqRes.ok ? await aqRes.json() : {};

    const current = weather.current || {};
    const daily = weather.daily || {};
    const hourly = weather.hourly || {};
    const solarRadiation = (daily.shortwave_radiation_sum && daily.shortwave_radiation_sum[0]) || 0;
    const solarKwh = Math.round(solarRadiation * 0.2778 * (settings.solarKwp || 4.0) * 0.78 * 10) / 10;

    // Calcolo Rischio Grandine
    const hail = calculateHailRiskFromHourly(hourly);

    // Calcolo rain expected soon
    let rainExpected = false;
    let rainMinutes = null;
    if (weather.minutely_15 && weather.minutely_15.precipitation) {
      for (let i = 0; i < 8; i++) {
        if (weather.minutely_15.precipitation[i] > 0.1) {
          rainExpected = true;
          rainMinutes = i * 15;
          break;
        }
      }
    }

    // Calcolo fulmini vicini (entro 50 km negli ultimi 30 min)
    let lightningNearby = 0;
    let closestLightningDist = null;
    const nowMs = Date.now();
    for (let i = lightningStrikes.length - 1; i >= 0; i--) {
      const s = lightningStrikes[i];
      if (nowMs - s.time > 30 * 60 * 1000) continue;
      const dist = getDistanceFromLatLonInKm(def.lat, def.lon, s.lat, s.lon);
      if (dist <= 50) {
        lightningNearby++;
        if (closestLightningDist === null || dist < closestLightningDist) {
          closestLightningDist = Math.round(dist * 10) / 10;
        }
      }
    }

    // Allerte Meteo Ufficiali Protezione Civile (MeteoAlarm)
    let weatherAlertActive = false;
    let weatherAlertEvent = null;
    let weatherAlertLevel = null;
    try {
      const alertData = await getMeteoAlarmAlerts(def.country, def.admin1);
      if (alertData && alertData.hasAlert && alertData.alerts.length > 0) {
        weatherAlertActive = true;
        weatherAlertEvent = alertData.alerts[0].eventIt;
        weatherAlertLevel = alertData.alerts[0].level;
      }
    } catch (e) {}

    res.json({
      location: def.label || def.name,
      latitude: def.lat,
      longitude: def.lon,
      temperature: current.temperature_2m,
      apparent_temperature: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      pressure: current.surface_pressure,
      wind_speed: current.wind_speed_10m,
      wind_gusts: current.wind_gusts_10m,
      wind_direction: current.wind_direction_10m,
      weather_code: current.weather_code,
      precipitation_now: current.precipitation || current.rain || 0,
      precipitation_today: (daily.precipitation_sum && daily.precipitation_sum[0]) || 0,
      precipitation_probability_today: (daily.precipitation_probability_max && daily.precipitation_probability_max[0]) || 0,
      rain_expected_next_2h: rainExpected,
      rain_expected_in_minutes: rainMinutes,
      hail_risk_level: hail.level,
      hail_risk_percent: hail.maxRisk,
      hail_alert_active: hail.alertActive,
      hail_peak_time: hail.peakHour,
      hail_peak_cape: hail.peakCape,
      lightning_count_nearby_30m: lightningNearby,
      lightning_closest_distance_km: closestLightningDist,
      weather_alert_active: weatherAlertActive,
      weather_alert_event: weatherAlertEvent,
      weather_alert_level: weatherAlertLevel,
      aqi_european: aq.current?.european_aqi || null,
      pm2_5: aq.current?.pm2_5 || null,
      pm10: aq.current?.pm10 || null,
      solar_estimated_kwh_today: solarKwh,
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Impossibile generare i sensori Home Assistant: ' + err.message });
  }
});

// Fallback to index.html for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Monitor Telegram in background (Allarmi pioggia e grandine per tutti i preferiti ogni 15 minuti)
setInterval(async () => {
  const settings = readSettings();
  if (!settings.telegramAlertsEnabled || !settings.telegramBotToken || !settings.telegramChatId) return;

  try {
    const favs = readFavorites();
    const locationsToMonitor = (favs.locations && favs.locations.length > 0) ? favs.locations : [];
    if (locationsToMonitor.length === 0) return;

    for (const loc of locationsToMonitor) {
      try {
        const wRes = await fetch(`http://localhost:${PORT}/api/weather?lat=${loc.lat}&lon=${loc.lon}`);
        if (!wRes.ok) continue;
        const weather = await wRes.json();
        const locLabel = loc.label || loc.name;
        const locKey = loc.id || `${loc.lat.toFixed(2)}_${loc.lon.toFixed(2)}`;

        // 1. Allarme Grandine (Rischio Elevato o Severo)
        if (settings.telegramHailAlertsEnabled) {
          const hail = calculateHailRiskFromHourly(weather.hourly);
          const hailCacheKey = `last_tg_hail_alert_${locKey}`;
          if (hail.alertActive && !cache.get(hailCacheKey)) {
            cache.set(hailCacheKey, { data: true, expiresAt: Date.now() + 4 * 3600 * 1000 }); // cooldown 4 ore per singola località
            const text = `🧊 *ALLERTA METEO: RISCHIO GRANDINE a ${locLabel}* ⚠️\n\nI modelli meteorologici ad alta risoluzione indicano forte instabilità convettiva:\n• Località: *${locLabel}*\n• Livello Rischio: *${hail.maxRisk}% (${hail.level})*\n• Fascia oraria di picco: *ore ${hail.peakHour}*\n• Indice di Instabilità CAPE: *${hail.peakCape} J/kg*\n\n🚗 *Consiglio urgente*: Ricovera l'automobile in garage o sotto una tettoia e proteggi colture o vasi sul balcone!`;
            await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: settings.telegramChatId, text, parse_mode: 'Markdown' })
            });
          }
        }

        // 2. Allarme Pioggia Imminente (prossimi 30 minuti)
        if (weather.minutely_15 && weather.minutely_15.precipitation) {
          const p1 = weather.minutely_15.precipitation[1] || 0;
          const p2 = weather.minutely_15.precipitation[2] || 0;
          const rainCacheKey = `last_tg_rain_alert_${locKey}`;
          if ((p1 > 0.2 || p2 > 0.2) && !cache.get(rainCacheKey)) {
            cache.set(rainCacheKey, { data: true, expiresAt: Date.now() + 3 * 3600 * 1000 }); // cooldown 3 ore per singola località
            const text = `🌧️ *Allerta Pioggia Imminente a ${locLabel}*\n\nLe previsioni radar indicano pioggia in arrivo nei prossimi 15-30 minuti (~${Math.max(p1, p2).toFixed(1)} mm).\nRicordati di chiudere le finestre o ritirare il bucato!`;
            await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: settings.telegramChatId, text, parse_mode: 'Markdown' })
            });
          }
        }
      } catch (locErr) {
        console.warn(`Errore monitoraggio meteo per ${loc.name}:`, locErr.message);
      }
    }
  } catch (e) {
    console.error('Errore background Telegram monitor:', e.message);
  }
}, 15 * 60 * 1000);

// Monitor automatico invio Daily Morning Briefing su Telegram (controllo ogni 60 secondi)
setInterval(async () => {
  const settings = readSettings();
  if (!settings.telegramDailyDigest || !settings.telegramBotToken || !settings.telegramChatId) return;

  const now = new Date();
  const currentHour = now.getHours().toString().padStart(2, '0');
  const currentMin = now.getMinutes().toString().padStart(2, '0');
  const currentTimeStr = `${currentHour}:${currentMin}`;

  const targetTime = settings.telegramBriefingTime || '07:30';
  const todayDateStr = now.toISOString().substring(0, 10);

  if (currentTimeStr === targetTime && cache.get('last_briefing_sent_date') !== todayDateStr) {
    cache.set('last_briefing_sent_date', todayDateStr); // Non inviare più volte nello stesso giorno
    try {
      const favs = readFavorites();
      const def = favs.locations.find(l => l.id === favs.defaultId) || favs.locations[0] || { lat: 41.89, lon: 12.51, name: 'Roma', label: 'Roma' };

      const wRes = await fetch(`http://localhost:${PORT}/api/weather?lat=${def.lat}&lon=${def.lon}`);
      const weather = wRes.ok ? await wRes.json() : {};

      const aqRes = await fetch(`http://localhost:${PORT}/api/airquality?lat=${def.lat}&lon=${def.lon}`);
      const aq = aqRes.ok ? await aqRes.json() : {};

      let alerts = null;
      try {
        alerts = await getMeteoAlarmAlerts(def.country, def.admin1);
      } catch (e) {}

      const briefingText = generateMorningBriefing(def, weather, aq, settings, alerts);
      await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: settings.telegramChatId,
          text: briefingText,
          parse_mode: 'Markdown'
        })
      });
      console.log(`☕ Morning Briefing inviato automaticamente a ${settings.telegramChatId} per ${def.name}`);
    } catch (e) {
      console.error('Errore invio automatico morning briefing:', e.message);
    }
  }
}, 60 * 1000);

// Avvio server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=========================================`);
  console.log(`🌤️ WeatherDash Server avviato con successo!`);
  console.log(`📍 URL locale: http://localhost:${PORT}`);
  console.log(`📁 Cartella dati: ${DATA_DIR}`);
  console.log(`=========================================`);
});
