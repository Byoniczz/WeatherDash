/**
 * WeatherDash - Weather Calculations & Rendering Module
 */

// WMO Weather Interpretation Codes (WW)
const WMO_CODES = {
  0: { day: 'Sereno', night: 'Sereno', icon: 'sun', iconNight: 'moon' },
  1: { day: 'Prevalentemente sereno', night: 'Prevalentemente sereno', icon: 'sun-cloud', iconNight: 'moon-cloud' },
  2: { day: 'Parzialmente nuvoloso', night: 'Parzialmente nuvoloso', icon: 'cloud-sun', iconNight: 'cloud-moon' },
  3: { day: 'Coperto', night: 'Coperto', icon: 'cloud', iconNight: 'cloud' },
  45: { day: 'Nebbia', night: 'Nebbia', icon: 'fog', iconNight: 'fog' },
  48: { day: 'Nebbia con brina', night: 'Nebbia con brina', icon: 'fog', iconNight: 'fog' },
  51: { day: 'Pioviggine leggera', night: 'Pioviggine leggera', icon: 'drizzle', iconNight: 'drizzle' },
  53: { day: 'Pioviggine moderata', night: 'Pioviggine moderata', icon: 'drizzle', iconNight: 'drizzle' },
  55: { day: 'Pioviggine densa', night: 'Pioviggine densa', icon: 'drizzle-heavy', iconNight: 'drizzle-heavy' },
  56: { day: 'Pioviggine gelata leggera', night: 'Pioviggine gelata', icon: 'sleet', iconNight: 'sleet' },
  57: { day: 'Pioviggine gelata intensa', night: 'Pioviggine gelata', icon: 'sleet', iconNight: 'sleet' },
  61: { day: 'Pioggia debole', night: 'Pioggia debole', icon: 'rain-light', iconNight: 'rain-light' },
  63: { day: 'Pioggia moderata', night: 'Pioggia moderata', icon: 'rain', iconNight: 'rain' },
  65: { day: 'Pioggia forte', night: 'Pioggia forte', icon: 'rain-heavy', iconNight: 'rain-heavy' },
  66: { day: 'Pioggia congelantesi', night: 'Pioggia congelantesi', icon: 'sleet', iconNight: 'sleet' },
  67: { day: 'Pioggia congelantesi forte', night: 'Pioggia congelantesi forte', icon: 'sleet', iconNight: 'sleet' },
  71: { day: 'Neve debole', night: 'Neve debole', icon: 'snow-light', iconNight: 'snow-light' },
  73: { day: 'Neve moderata', night: 'Neve moderata', icon: 'snow', iconNight: 'snow' },
  75: { day: 'Neve forte', night: 'Neve forte', icon: 'snow-heavy', iconNight: 'snow-heavy' },
  77: { day: 'Granuli di neve', night: 'Granuli di neve', icon: 'snow-light', iconNight: 'snow-light' },
  80: { day: 'Rovesci deboli', night: 'Rovesci deboli', icon: 'showers', iconNight: 'showers' },
  81: { day: 'Rovesci moderati', night: 'Rovesci moderati', icon: 'showers', iconNight: 'showers' },
  82: { day: 'Rovesci violenti', night: 'Rovesci violenti', icon: 'showers-heavy', iconNight: 'showers-heavy' },
  85: { day: 'Rovesci di neve lievi', night: 'Rovesci di neve lievi', icon: 'snow', iconNight: 'snow' },
  86: { day: 'Rovesci di neve forti', night: 'Rovesci di neve forti', icon: 'snow-heavy', iconNight: 'snow-heavy' },
  95: { day: 'Temporale', night: 'Temporale', icon: 'thunder', iconNight: 'thunder' },
  96: { day: 'Temporale con grandine lieve', night: 'Temporale con grandine', icon: 'thunder-hail', iconNight: 'thunder-hail' },
  99: { day: 'Temporale con grandine forte', night: 'Temporale con grandine', icon: 'thunder-hail', iconNight: 'thunder-hail' }
};

// Generatore icone SVG pulite e vettoriali
function getWeatherIconSvg(iconType, size = 32) {
  const icons = {
    'sun': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
    'moon': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
    'sun-cloud': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/><path d="M17.5 19H9a5 5 0 0 1 0-10 4.5 4.5 0 0 1 8.5 2 3.5 3.5 0 0 1 0 8z" stroke="#94a3b8"/></svg>`,
    'moon-cloud': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" stroke="#38bdf8"/><path d="M17.5 19H9a5 5 0 0 1 0-10 4.5 4.5 0 0 1 8.5 2 3.5 3.5 0 0 1 0 8z"/></svg>`,
    'cloud': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`,
    'cloud-sun': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="8" r="3" stroke="#f59e0b"/><path d="M17 19H7a5 5 0 0 1 0-10 4 4 0 0 1 7.5 1.5A3.5 3.5 0 0 1 17 19Z"/></svg>`,
    'cloud-moon': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5a4 4 0 0 0 5 5 5 5 0 0 1-5-5Z" stroke="#38bdf8"/><path d="M17 19H7a5 5 0 0 1 0-10 4 4 0 0 1 7.5 1.5A3.5 3.5 0 0 1 17 19Z"/></svg>`,
    'fog': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h16"/><path d="M4 18h16"/><path d="M4 10h16"/><path d="M4 6h16"/></svg>`,
    'drizzle': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 14H9a5 5 0 1 1 4.9-6H15a4 4 0 0 1 2.5 8Z" stroke="#94a3b8"/><path d="M8 19v1"/><path d="M12 19v1"/><path d="M16 19v1"/></svg>`,
    'drizzle-heavy': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 14H9a5 5 0 1 1 4.9-6H15a4 4 0 0 1 2.5 8Z" stroke="#94a3b8"/><path d="M8 17v3"/><path d="M12 17v3"/><path d="M16 17v3"/></svg>`,
    'rain-light': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 15H9a5 5 0 1 1 4.9-6H15a4 4 0 0 1 2.5 8Z" stroke="#94a3b8"/><path d="m8 17-2 4"/><path d="m12 17-2 4"/><path d="m16 17-2 4"/></svg>`,
    'rain': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 15H9a5 5 0 1 1 4.9-6H15a4 4 0 0 1 2.5 8Z" stroke="#94a3b8"/><path d="m9 17-2 5"/><path d="m14 17-2 5"/><path d="m19 17-2 5"/></svg>`,
    'rain-heavy': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 15H9a5 5 0 1 1 4.9-6H15a4 4 0 0 1 2.5 8Z" stroke="#64748b"/><path d="m8 17-3 6"/><path d="m13 17-3 6"/><path d="m18 17-3 6"/></svg>`,
    'showers': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 15H9a5 5 0 1 1 4.9-6H15a4 4 0 0 1 2.5 8Z" stroke="#94a3b8"/><circle cx="12" cy="18" r="1" fill="#0ea5e9"/><circle cx="8" cy="20" r="1" fill="#0ea5e9"/><circle cx="16" cy="19" r="1" fill="#0ea5e9"/></svg>`,
    'showers-heavy': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#0369a1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 14H9a5 5 0 1 1 4.9-6H15a4 4 0 0 1 2.5 8Z" stroke="#475569"/><path d="m7 17-2 5"/><path d="m12 17-2 5"/><path d="m17 17-2 5"/></svg>`,
    'snow-light': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#e0f2fe" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 15H9a5 5 0 1 1 4.9-6H15a4 4 0 0 1 2.5 8Z" stroke="#94a3b8"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/><path d="M10 21h.01"/><path d="M14 21h.01"/></svg>`,
    'snow': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#bae6fd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 15H9a5 5 0 1 1 4.9-6H15a4 4 0 0 1 2.5 8Z" stroke="#94a3b8"/><path d="M8 18v2"/><path d="M12 18v2"/><path d="M16 18v2"/><path d="M7 19l2-2"/><path d="M13 19l2-2"/></svg>`,
    'snow-heavy': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 15H9a5 5 0 1 1 4.9-6H15a4 4 0 0 1 2.5 8Z" stroke="#64748b"/><circle cx="8" cy="18" r="1.5" fill="#fff"/><circle cx="12" cy="19" r="1.5" fill="#fff"/><circle cx="16" cy="18" r="1.5" fill="#fff"/><circle cx="10" cy="22" r="1.5" fill="#fff"/><circle cx="14" cy="22" r="1.5" fill="#fff"/></svg>`,
    'sleet': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#7dd3fc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 15H9a5 5 0 1 1 4.9-6H15a4 4 0 0 1 2.5 8Z" stroke="#94a3b8"/><path d="m8 17-2 4"/><circle cx="14" cy="19" r="1" fill="#7dd3fc"/></svg>`,
    'thunder': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 14H9a5 5 0 1 1 4.9-6H15a4 4 0 0 1 2.5 8Z" stroke="#475569"/><polygon points="13 13 9 19 13 19 11 23 17 16 13 16 13 13" fill="#fbbf24"/></svg>`,
    'thunder-hail': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 14H9a5 5 0 1 1 4.9-6H15a4 4 0 0 1 2.5 8Z" stroke="#334155"/><polygon points="12 13 9 18 12 18 10 22 15 16 12 16 12 13" fill="#f59e0b"/><circle cx="16" cy="20" r="1" fill="#fff"/></svg>`
  };

  return icons[iconType] || icons['cloud'];
}

function getWMOInfo(code, isDay = 1) {
  const item = WMO_CODES[code] || { day: 'Variabile', night: 'Variabile', icon: 'cloud', iconNight: 'cloud' };
  const text = isDay ? item.day : item.night;
  const iconKey = isDay ? item.icon : item.iconNight;
  return {
    code,
    text,
    iconKey,
    svg: (size = 32) => getWeatherIconSvg(iconKey, size)
  };
}

// Calcolo punto di rugiada (formula di Magnus-Tetens)
function calculateDewPoint(tempC, humidity) {
  const a = 17.27;
  const b = 237.7;
  const alpha = ((a * tempC) / (b + tempC)) + Math.log(humidity / 100.0);
  const dewPoint = (b * alpha) / (a - alpha);
  return Math.round(dewPoint * 10) / 10;
}

// Calcolo fase lunare astronomica semplificata
function getMoonPhase(date = new Date()) {
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  const day = date.getDate();

  let c = 0;
  let e = 0;
  let jd = 0;
  let b = 0;

  if (month < 3) {
    year--;
    month += 12;
  }
  month++;
  c = 365.25 * year;
  e = 30.6 * month;
  jd = c + e + day - 694039.09; // giorni dal 1900
  jd /= 29.5305882; // ciclo sinodico lunare
  b = parseInt(jd);
  jd -= b; // frazione di ciclo (0.0 a 1.0)
  const phase = Math.round(jd * 8);

  const phases = [
    { name: 'Luna Nuova', icon: '🌑', illumination: '0%' },
    { name: 'Luna Crescente', icon: '🌒', illumination: '25%' },
    { name: 'Primo Quarto', icon: '🌓', illumination: '50%' },
    { name: 'Gibbosa Crescente', icon: '🌔', illumination: '75%' },
    { name: 'Luna Piena', icon: '🌕', illumination: '100%' },
    { name: 'Gibbosa Calante', icon: '🌖', illumination: '75%' },
    { name: 'Ultimo Quarto', icon: '🌗', illumination: '50%' },
    { name: 'Luna Calante', icon: '🌘', illumination: '25%' }
  ];

  return phases[phase % 8] || phases[0];
}

// Convertitore unità
function tempUnit(valC, isFahrenheit) {
  if (valC === null || valC === undefined) return '--';
  if (isFahrenheit) {
    return Math.round((valC * 9 / 5) + 32) + '°F';
  }
  return Math.round(valC) + '°C';
}

function speedUnit(valKmh, isMph) {
  if (valKmh === null || valKmh === undefined) return '--';
  if (isMph) {
    return Math.round(valKmh * 0.621371) + ' mph';
  }
  return Math.round(valKmh) + ' km/h';
}

// Tendenza barometrica
function getPressureTrend(hourlyPressure, currentIndex) {
  if (!hourlyPressure || hourlyPressure.length < 4 || currentIndex < 3) {
    return { text: 'Stabile', icon: '→' };
  }
  const diff = hourlyPressure[currentIndex] - hourlyPressure[currentIndex - 3];
  if (diff > 1.5) return { text: 'In rapido aumento', icon: '↗↗' };
  if (diff > 0.5) return { text: 'In aumento', icon: '↗' };
  if (diff < -1.5) return { text: 'In rapido calo (peggioramento)', icon: '↘↘' };
  if (diff < -0.5) return { text: 'In calo', icon: '↘' };
  return { text: 'Stabile', icon: '→' };
}

// Indice UV categoria
function getUVCategory(uv) {
  if (uv < 3) return { label: 'Basso', color: '#10b981', advice: 'Nessuna protezione richiesta' };
  if (uv < 6) return { label: 'Moderato', color: '#f59e0b', advice: 'Usa occhiali e protezione' };
  if (uv < 8) return { label: 'Alto', color: '#f97316', advice: 'Cerca ombra nelle ore centrali' };
  if (uv < 11) return { label: 'Molto alto', color: '#ef4444', advice: 'Evita l\'esposizione diretta' };
  return { label: 'Estremo', color: '#8b5cf6', advice: 'Rimani in ambienti coperti' };
}

// Calcolo progress del sole tra alba e tramonto
function calculateSunProgress(sunriseIso, sunsetIso) {
  if (!sunriseIso || !sunsetIso) return { percent: 0, isDaytime: true, label: '' };
  const now = Date.now();
  const rise = new Date(sunriseIso).getTime();
  const set = new Date(sunsetIso).getTime();

  if (now < rise) {
    return { percent: 0, isDaytime: false, label: 'Prima dell\'alba' };
  } else if (now > set) {
    return { percent: 100, isDaytime: false, label: 'Dopo il tramonto' };
  } else {
    const total = set - rise;
    const current = now - rise;
    const percent = Math.min(100, Math.max(0, Math.round((current / total) * 100)));
    return { percent, isDaytime: true, label: `${percent}% del giorno solare` };
  }
}

// Analizzatore allerte meteo intelligenti
function generateWeatherAlerts(data) {
  const alerts = [];
  const current = data.current || {};
  const daily = data.daily || {};

  // Vento forte o raffiche
  if (current.wind_gusts_10m >= 65 || (daily.wind_gusts_10m_max && daily.wind_gusts_10m_max[0] >= 65)) {
    alerts.push({
      type: 'wind',
      level: 'warning',
      title: 'Attenzione Vento e Raffiche',
      message: `Previste raffiche di vento fino a ${Math.round(daily.wind_gusts_10m_max ? daily.wind_gusts_10m_max[0] : current.wind_gusts_10m)} km/h nelle prossime ore.`
    });
  }

  // Precipitazioni eccezionali
  if (daily.precipitation_sum && daily.precipitation_sum[0] >= 30) {
    alerts.push({
      type: 'rain',
      level: 'danger',
      title: 'Allerta Forti Precipitazioni',
      message: `Accumulo atteso per oggi di circa ${daily.precipitation_sum[0].toFixed(1)} mm di pioggia.`
    });
  }

  // Caldo estremo o gelate
  if (current.temperature_2m >= 36) {
    alerts.push({
      type: 'temp',
      level: 'warning',
      title: 'Ondata di Calore',
      message: 'Temperature elevate: mantieniti idratato ed evita attività intense sotto il sole.'
    });
  } else if (current.temperature_2m <= 0) {
    alerts.push({
      type: 'temp',
      level: 'info',
      title: 'Rischio Ghiaccio e Gelate',
      message: 'Temperatura sotto zero: possibile formazione di ghiaccio sul manto stradale.'
    });
  }

  // Indice UV Estremo
  if (daily.uv_index_max && daily.uv_index_max[0] >= 9) {
    alerts.push({
      type: 'uv',
      level: 'warning',
      title: 'Raggi UV Molto Elevati',
      message: `Indice UV massimo previsto oggi pari a ${daily.uv_index_max[0]}. Proteggi occhi e pelle.`
    });
  }

  return alerts;
}

// Render dei dati meteo nell'interfaccia
function renderWeatherData(data, location, isFahrenheit = false, isMph = false) {
  const current = data.current;
  const hourly = data.hourly;
  const daily = data.daily;

  // Informazioni WMO e icone
  const wmo = getWMOInfo(current.weather_code, current.is_day);

  // 1. Hero Card
  document.getElementById('locTitle').textContent = location.label || location.name;
  document.getElementById('locSub').textContent = [location.admin1, location.country].filter(Boolean).join(', ') || 'Coordinate: ' + location.lat.toFixed(2) + ', ' + location.lon.toFixed(2);
  
  document.getElementById('currentTemp').textContent = tempUnit(current.temperature_2m, isFahrenheit);
  document.getElementById('feelsLikeTemp').textContent = 'Percepita ' + tempUnit(current.apparent_temperature, isFahrenheit);
  document.getElementById('conditionText').textContent = wmo.text;
  document.getElementById('currentWeatherIcon').innerHTML = wmo.svg(84);

  // Min / Max del giorno
  if (daily && daily.temperature_2m_min && daily.temperature_2m_max) {
    document.getElementById('todayMin').textContent = 'Min: ' + tempUnit(daily.temperature_2m_min[0], isFahrenheit);
    document.getElementById('todayMax').textContent = 'Max: ' + tempUnit(daily.temperature_2m_max[0], isFahrenheit);
  }

  // Progresso del sole (alba / tramonto)
  if (daily && daily.sunrise && daily.sunset) {
    const sunProgress = calculateSunProgress(daily.sunrise[0], daily.sunset[0]);
    const fillEl = document.getElementById('sunProgressFill');
    if (fillEl) fillEl.style.width = `${sunProgress.percent}%`;
    const labelEl = document.getElementById('sunProgressLabel');
    if (labelEl) {
      const riseTime = daily.sunrise[0].split('T')[1].substring(0, 5);
      const setTime = daily.sunset[0].split('T')[1].substring(0, 5);
      labelEl.textContent = `Alba: ${riseTime} • Tramonto: ${setTime}`;
    }
  }

  // 2. Metriche Correnti Dettagliate
  // Vento
  document.getElementById('metricWind').textContent = speedUnit(current.wind_speed_10m, isMph);
  document.getElementById('metricGusts').textContent = `Raffiche: ${speedUnit(current.wind_gusts_10m, isMph)}`;
  const arrowEl = document.getElementById('windArrow');
  if (arrowEl) {
    arrowEl.style.transform = `rotate(${current.wind_direction_10m}deg)`;
  }
  document.getElementById('windDirText').textContent = `${current.wind_direction_10m}°`;

  // Umidità & Dew Point
  document.getElementById('metricHumidity').textContent = `${current.relative_humidity_2m}%`;
  const dewPoint = calculateDewPoint(current.temperature_2m, current.relative_humidity_2m);
  document.getElementById('metricDewPoint').textContent = `Punto rugiada: ${tempUnit(dewPoint, isFahrenheit)}`;

  // Precipitazioni
  const rainNow = current.precipitation !== undefined ? current.precipitation : current.rain;
  document.getElementById('metricPrecip').textContent = `${(rainNow || 0).toFixed(1)} mm`;
  const rainToday = (daily && daily.precipitation_sum) ? daily.precipitation_sum[0] : 0;
  const rainProb = (daily && daily.precipitation_probability_max) ? daily.precipitation_probability_max[0] : 0;
  document.getElementById('metricPrecipSub').textContent = `Oggi: ${rainToday.toFixed(1)} mm (${rainProb}% prob.)`;

  // Pressione Barometrica
  document.getElementById('metricPressure').textContent = `${Math.round(current.surface_pressure)} hPa`;
  // Tendenza
  const currentHourIdx = new Date().getHours();
  const trend = getPressureTrend(hourly.surface_pressure, currentHourIdx);
  document.getElementById('metricPressureTrend').textContent = `${trend.icon} ${trend.text}`;

  // UV Index
  const currentUV = hourly.uv_index ? hourly.uv_index[currentHourIdx] : (daily.uv_index_max ? daily.uv_index_max[0] : 0);
  const uvCat = getUVCategory(currentUV);
  document.getElementById('metricUV').textContent = (currentUV || 0).toFixed(1);
  const uvBadge = document.getElementById('uvBadge');
  if (uvBadge) {
    uvBadge.textContent = uvCat.label;
    uvBadge.style.color = uvCat.color;
  }
  document.getElementById('uvAdvice').textContent = uvCat.advice;

  // Visibilità
  const visKm = hourly.visibility ? (hourly.visibility[currentHourIdx] / 1000).toFixed(1) : '--';
  document.getElementById('metricVisibility').textContent = `${visKm} km`;
  document.getElementById('metricVisQuality').textContent = visKm > 10 ? 'Ottima visibilità' : (visKm > 4 ? 'Discreta' : 'Visibilità ridotta');

  // Sole, Tramonto e Fase Lunare
  const moon = getMoonPhase(new Date());
  document.getElementById('metricMoon').textContent = `${moon.icon} ${moon.name}`;
  document.getElementById('metricMoonSub').textContent = `Illuminazione: ${moon.illumination}`;

  // 3. Allerte Meteo
  const alerts = generateWeatherAlerts(data);
  const alertContainer = document.getElementById('alertBanner');
  if (alertContainer) {
    if (alerts.length > 0) {
      alertContainer.style.display = 'flex';
      const firstAlert = alerts[0];
      document.getElementById('alertText').innerHTML = `<strong>${firstAlert.title}:</strong> ${firstAlert.message}`;
    } else {
      alertContainer.style.display = 'none';
    }
  }

  // 4. Render Previsioni Orarie a Scorrimento
  renderHourlySlider(hourly, isFahrenheit, isMph);

  // 5. Render Previsioni Giornaliere
  renderDailyList(daily, isFahrenheit);

  // 6. Render Proiezione Nowcast Precipitazioni (minutely_15)
  renderNowcastTimeline(data.minutely_15);
}

// Render lista oraria orizzontale
function renderHourlySlider(hourly, isFahrenheit, isMph) {
  const container = document.getElementById('hourlyCardsContainer');
  if (!container || !hourly || !hourly.time) return;

  container.innerHTML = '';
  const now = new Date();
  const currentIsoHour = now.toISOString().substring(0, 13);

  // Trova indice ora corrente
  let startIndex = hourly.time.findIndex(t => t.startsWith(currentIsoHour));
  if (startIndex === -1) startIndex = 0;

  // Mostra le prossime 36 ore
  const endIndex = Math.min(hourly.time.length, startIndex + 36);

  for (let i = startIndex; i < endIndex; i++) {
    const timeStr = hourly.time[i];
    const hourDate = new Date(timeStr);
    const hourLabel = i === startIndex ? 'Ora' : hourDate.getHours().toString().padStart(2, '0') + ':00';
    
    // Day/Night check for icon
    const isDay = (hourDate.getHours() >= 6 && hourDate.getHours() < 20) ? 1 : 0;
    const wmo = getWMOInfo(hourly.weather_code[i], isDay);
    const temp = tempUnit(hourly.temperature_2m[i], isFahrenheit);
    const rainProb = hourly.precipitation_probability ? hourly.precipitation_probability[i] : 0;
    const rainMm = hourly.precipitation ? hourly.precipitation[i] : 0;
    const wind = speedUnit(hourly.wind_speed_10m[i], isMph);

    const card = document.createElement('div');
    card.className = 'hourly-card';
    card.innerHTML = `
      <div class="hourly-time">${hourLabel}</div>
      <div class="hourly-icon">${wmo.svg(30)}</div>
      <div class="hourly-temp">${temp}</div>
      <div class="hourly-rain" title="Probabilità pioggia: ${rainProb}% / ${rainMm} mm">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
        ${rainProb}%
      </div>
      <div class="hourly-wind">${wind}</div>
    `;
    container.appendChild(card);
  }
}

// Render lista giornaliera (7-14 giorni)
function renderDailyList(daily, isFahrenheit) {
  const container = document.getElementById('dailyForecastList');
  if (!container || !daily || !daily.time) return;

  container.innerHTML = '';
  
  // Calcolo min e max globale per la scala della barra termica
  const allMins = daily.temperature_2m_min;
  const allMaxs = daily.temperature_2m_max;
  const globalMin = Math.min(...allMins);
  const globalMax = Math.max(...allMaxs);
  const range = (globalMax - globalMin) || 1;

  const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

  for (let i = 0; i < daily.time.length; i++) {
    const d = new Date(daily.time[i] + 'T12:00:00');
    const isToday = i === 0;
    const dayLabel = isToday ? 'Oggi' : dayNames[d.getDay()];
    const dateLabel = `${d.getDate()} ${monthNames[d.getMonth()]}`;

    const wmo = getWMOInfo(daily.weather_code[i], 1);
    const minT = daily.temperature_2m_min[i];
    const maxT = daily.temperature_2m_max[i];
    const rainProb = daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : 0;
    const rainSum = daily.precipitation_sum ? daily.precipitation_sum[i] : 0;

    // Calcolo posizione e larghezza barra colorata
    const leftPercent = Math.max(0, Math.min(100, ((minT - globalMin) / range) * 100));
    const widthPercent = Math.max(10, Math.min(100 - leftPercent, ((maxT - minT) / range) * 100));

    const row = document.createElement('div');
    row.className = 'daily-row-container';
    row.innerHTML = `
      <div class="daily-row" style="cursor: pointer;" title="Clicca per espandere i dettagli">
        <div class="daily-day-info">
          <span class="daily-day-name">${dayLabel}</span>
          <span class="daily-day-date">${dateLabel}</span>
        </div>
        <div class="daily-weather-icon">
          ${wmo.svg(28)}
        </div>
        <div class="daily-desc" title="${wmo.text}">${wmo.text}</div>
        <div class="daily-temp-bar-wrap">
          <span style="color: #38bdf8;">${tempUnit(minT, isFahrenheit)}</span>
          <div class="daily-temp-bar">
            <div class="daily-temp-bar-fill" style="left: ${leftPercent}%; width: ${widthPercent}%;"></div>
          </div>
          <span style="color: #f87171;">${tempUnit(maxT, isFahrenheit)}</span>
        </div>
        <div class="daily-rain-chance" title="Accumulo stimato: ${rainSum.toFixed(1)} mm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
          ${rainProb}%
        </div>
      </div>
      <div class="daily-detail-drawer" style="display: none; padding: 0.65rem 0.85rem; background: rgba(0,0,0,0.18); border: 1px solid var(--card-border); border-top: none; border-radius: 0 0 var(--radius-md) var(--radius-md); font-size: 0.8rem; color: var(--text-secondary); margin-top: -3px; margin-bottom: 0.35rem;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.5rem;">
          <div>💨 Vento max: <strong>${Math.round(daily.wind_speed_10m_max ? daily.wind_speed_10m_max[i] : 0)} km/h</strong></div>
          <div>🌪️ Raffiche: <strong>${Math.round(daily.wind_gusts_10m_max ? daily.wind_gusts_10m_max[i] : 0)} km/h</strong></div>
          <div>🌧️ Accumulo: <strong>${rainSum.toFixed(1)} mm</strong> (${daily.precipitation_hours ? daily.precipitation_hours[i] : 0} ore)</div>
          <div>☀️ Indice UV max: <strong>${daily.uv_index_max ? daily.uv_index_max[i] : '--'}</strong></div>
          <div>🌅 Alba: <strong>${daily.sunrise && daily.sunrise[i] ? daily.sunrise[i].split('T')[1].substring(0,5) : '--'}</strong></div>
          <div>🌇 Tramonto: <strong>${daily.sunset && daily.sunset[i] ? daily.sunset[i].split('T')[1].substring(0,5) : '--'}</strong></div>
        </div>
      </div>
    `;

    const rowClickable = row.querySelector('.daily-row');
    const drawer = row.querySelector('.daily-detail-drawer');
    rowClickable.onclick = () => {
      const isOpen = drawer.style.display !== 'none';
      drawer.style.display = isOpen ? 'none' : 'block';
      rowClickable.style.borderRadius = isOpen ? 'var(--radius-md)' : 'var(--radius-md) var(--radius-md) 0 0';
    };

    container.appendChild(row);
  }
}

// Render proiezione precipitazioni quarto d'ora per quarto d'ora (Nowcast 6 ore)
function renderNowcastTimeline(minutely) {
  const container = document.getElementById('nowcastTimeline');
  const badge = document.getElementById('nowcastSummaryBadge');
  if (!container) return;

  container.innerHTML = '';
  if (!minutely || !minutely.time || minutely.time.length === 0) {
    if (badge) badge.textContent = 'Dati nowcast non disponibili';
    return;
  }

  const now = new Date();
  
  // Trova indice corrispondente all'orario attuale o immediatamente successivo
  let startIdx = 0;
  for (let i = 0; i < minutely.time.length; i++) {
    const t = new Date(minutely.time[i]);
    if (t.getTime() >= now.getTime() - 10 * 60 * 1000) {
      startIdx = i;
      break;
    }
  }

  // Prendi fino a 24 step da 15 minuti ciascuno (6 ore di proiezione)
  const steps = Math.min(minutely.time.length, startIdx + 24);
  let firstRainTime = null;
  let firstRainMm = 0;
  let maxPrecip = 0;

  for (let i = startIdx; i < steps; i++) {
    const p = minutely.precipitation ? minutely.precipitation[i] : 0;
    if (p > maxPrecip) maxPrecip = p;
    if (p >= 0.1 && !firstRainTime) {
      firstRainTime = minutely.time[i].split('T')[1].substring(0, 5);
      firstRainMm = p;
    }
  }

  // Aggiorna Badge di sintesi
  if (badge) {
    const currentRain = minutely.precipitation ? (minutely.precipitation[startIdx] || 0) : 0;
    if (currentRain >= 0.1) {
      badge.className = 'radar-badge past';
      badge.style.background = 'rgba(239, 68, 68, 0.25)';
      badge.style.color = '#ef4444';
      badge.textContent = `🌧️ Pioggia in corso (${currentRain.toFixed(1)} mm)`;
    } else if (firstRainTime) {
      badge.className = 'radar-badge future';
      badge.style.background = 'rgba(245, 158, 11, 0.25)';
      badge.style.color = '#fbbf24';
      badge.textContent = `🌧️ Inizio pioggia alle ${firstRainTime} (~${firstRainMm.toFixed(1)} mm)`;
    } else {
      badge.className = 'radar-badge now';
      badge.style.background = 'rgba(16, 185, 129, 0.2)';
      badge.style.color = '#34d399';
      badge.textContent = `☀️ Nessuna pioggia prevista nelle prossime 6 ore`;
    }
  }

  const barScale = Math.max(maxPrecip, 1.2); // Scala proporzionale altezza

  for (let i = startIdx; i < steps; i++) {
    const timeStr = minutely.time[i].split('T')[1].substring(0, 5);
    const p = minutely.precipitation ? (minutely.precipitation[i] || 0) : 0;
    const heightPercent = Math.min(100, Math.max(8, Math.round((p / barScale) * 100)));

    let barColor = 'rgba(255, 255, 255, 0.08)';
    let textColor = 'transparent';
    let label = 'Asciutto';

    if (p >= 2.0) {
      barColor = '#ef4444'; // forte
      textColor = '#fca5a5';
      label = 'Forte';
    } else if (p >= 0.5) {
      barColor = '#3b82f6'; // moderata
      textColor = '#93c5fd';
      label = 'Moderata';
    } else if (p >= 0.05) {
      barColor = '#38bdf8'; // debole
      textColor = '#7dd3fc';
      label = 'Debole';
    }

    const item = document.createElement('div');
    item.className = 'nowcast-step';
    item.title = `Ore ${timeStr}: ${p.toFixed(2)} mm (${label})`;
    item.style.cssText = 'flex: 1; min-width: 28px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 75px; gap: 4px;';

    item.innerHTML = `
      <div style="font-size: 0.65rem; color: ${textColor}; font-weight: 700; height: 12px; line-height: 1;">${p >= 0.1 ? p.toFixed(1) : ''}</div>
      <div style="width: 100%; max-width: 14px; height: ${heightPercent}%; background: ${barColor}; border-radius: 3px; transition: height 0.3s ease;"></div>
      <div style="font-size: 0.65rem; color: var(--text-muted);">${timeStr}</div>
    `;
    container.appendChild(item);
  }
}
