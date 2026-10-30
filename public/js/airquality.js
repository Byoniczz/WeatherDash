/**
 * WeatherDash - Air Quality Index & Pollutants Module
 */

const AQI_LEVELS = [
  { max: 20, label: 'Eccellente', color: '#10b981', advice: 'Qualità dell\'aria ideale per attività all\'aperto e ventilazione degli ambienti.' },
  { max: 40, label: 'Buona', color: '#34d399', advice: 'Aria pulita. Nessun rischio per la salute della popolazione.' },
  { max: 60, label: 'Moderata', color: '#fbbf24', advice: 'Soggetti particolarmente sensibili potrebbero accusare lievi fastidi respiratori.' },
  { max: 80, label: 'Scarsa', color: '#f97316', advice: 'Gruppi vulnerabili (bambini, anziani, asmatici) dovrebbero ridurre sforzi prolungati all\'aperto.' },
  { max: 100, label: 'Molto Scarsa', color: '#ef4444', advice: 'Chiunque può risentire degli effetti sulla salute. Evitare attività intense all\'esterno.' },
  { max: 999, label: 'Estremamente Scarsa', color: '#8b5cf6', advice: 'Allarme salute pubblica: limitare le uscite e tenere chiuse le finestre.' }
];

function getEuropeanAQIInfo(val) {
  if (val === null || val === undefined) {
    return { val: '--', label: 'Dato non disp.', color: '#94a3b8', advice: 'Nessuna informazione disponibile.' };
  }
  for (const level of AQI_LEVELS) {
    if (val <= level.max) {
      return { val: Math.round(val), ...level };
    }
  }
  return { val: Math.round(val), ...AQI_LEVELS[AQI_LEVELS.length - 1] };
}

// Percentuale barra inquinanti rispetto a soglie di riferimento OMS (WHO)
const WHO_THRESHOLDS = {
  pm2_5: 25,     // µg/m³
  pm10: 50,      // µg/m³
  nitrogen_dioxide: 40, // µg/m³
  ozone: 100,    // µg/m³
  sulphur_dioxide: 40, // µg/m³
  carbon_monoxide: 1000, // µg/m³
  dust: 50       // µg/m³
};

function renderAirQualityData(aqData) {
  if (!aqData || !aqData.current) return;
  const current = aqData.current;

  // Indice Principale (European AQI preferito, con fallback a US AQI)
  const euaqi = current.european_aqi !== undefined ? current.european_aqi : current.us_aqi;
  const aqiInfo = getEuropeanAQIInfo(euaqi);

  const circle = document.getElementById('aqiCircle');
  const valEl = document.getElementById('aqiScoreVal');
  const levelEl = document.getElementById('aqiLevelText');
  const adviceEl = document.getElementById('aqiAdviceText');

  if (circle) {
    circle.style.borderColor = aqiInfo.color;
    circle.style.background = `${aqiInfo.color}15`; // 15% opacity hex
    circle.style.color = aqiInfo.color;
  }
  if (valEl) valEl.textContent = aqiInfo.val;
  if (levelEl) {
    levelEl.textContent = aqiInfo.label;
    levelEl.style.color = aqiInfo.color;
  }
  if (adviceEl) adviceEl.textContent = aqiInfo.advice;

  // Pollutants rendering
  renderPollutantItem('polPM25', current.pm2_5, 'µg/m³', WHO_THRESHOLDS.pm2_5);
  renderPollutantItem('polPM10', current.pm10, 'µg/m³', WHO_THRESHOLDS.pm10);
  renderPollutantItem('polNO2', current.nitrogen_dioxide, 'µg/m³', WHO_THRESHOLDS.nitrogen_dioxide);
  renderPollutantItem('polO3', current.ozone, 'µg/m³', WHO_THRESHOLDS.ozone);
  renderPollutantItem('polSO2', current.sulphur_dioxide, 'µg/m³', WHO_THRESHOLDS.sulphur_dioxide);
  renderPollutantItem('polCO', current.carbon_monoxide, 'µg/m³', WHO_THRESHOLDS.carbon_monoxide);
  renderPollutantItem('polDust', current.dust, 'µg/m³', WHO_THRESHOLDS.dust);
}

function renderPollutantItem(idPrefix, val, unit, threshold) {
  const valEl = document.getElementById(`${idPrefix}Val`);
  const barEl = document.getElementById(`${idPrefix}Bar`);
  if (!valEl) return;

  if (val === undefined || val === null) {
    valEl.textContent = '--';
    if (barEl) barEl.style.width = '0%';
    return;
  }

  valEl.textContent = `${Math.round(val * 10) / 10} ${unit}`;

  if (barEl && threshold) {
    const percent = Math.min(100, Math.round((val / threshold) * 100));
    barEl.style.width = `${percent}%`;

    if (percent < 50) {
      barEl.style.backgroundColor = '#10b981';
    } else if (percent < 100) {
      barEl.style.backgroundColor = '#fbbf24';
    } else if (percent < 150) {
      barEl.style.backgroundColor = '#f97316';
    } else {
      barEl.style.backgroundColor = '#ef4444';
    }
  }
}
