/**
 * WeatherDash - Smart Life Indices & Solar Production Module
 */

function calculateLaundryIndex(current, daily) {
  const temp = current.temperature_2m;
  const humidity = current.relative_humidity_2m;
  const wind = current.wind_speed_10m;
  const rainProb = (daily && daily.precipitation_probability_max) ? daily.precipitation_probability_max[0] : 0;
  const rainSum = (daily && daily.precipitation_sum) ? daily.precipitation_sum[0] : 0;

  if (rainProb > 45 || rainSum > 0.5) {
    return {
      status: 'Sconsigliato',
      color: '#ef4444',
      badge: 'Rischio Pioggia',
      time: 'Non stendere',
      desc: `Elevata probabilità di pioggia (${rainProb}%) o pioggia in corso.`
    };
  }

  if (humidity > 85) {
    return {
      status: 'Lento',
      color: '#f59e0b',
      badge: 'Alta Umidità',
      time: '> 6 ore',
      desc: 'Umidità molto elevata: l\'asciugatura richiederà parecchie ore.'
    };
  }

  // Modello di evaporazione basato su temperatura, deficit igrometrico e ventilazione
  let hours = 3.5;
  if (temp > 24) hours -= 1.0;
  else if (temp < 12) hours += 2.0;

  if (humidity < 45) hours -= 1.0;
  else if (humidity > 70) hours += 1.0;

  if (wind > 15) hours -= 0.8;
  else if (wind < 5) hours += 0.5;

  hours = Math.max(1.2, Math.round(hours * 10) / 10);

  if (hours <= 2.2) {
    return {
      status: 'Ottimo',
      color: '#10b981',
      badge: 'Asciugatura Rapida',
      time: `~${hours} ore`,
      desc: `Condizioni ideali: buona ventilazione (${Math.round(wind)} km/h) e bassa umidità.`
    };
  } else {
    return {
      status: 'Discreto',
      color: '#38bdf8',
      badge: 'Asciugatura Regolare',
      time: `~${hours} ore`,
      desc: 'Asciugatura nella media della stagione.'
    };
  }
}

function calculateCarWashIndex(daily, airQuality) {
  if (!daily || !daily.precipitation_sum) {
    return { status: 'Valutazione in corso', color: '#94a3b8', desc: '--' };
  }

  // Controlla piogge nei prossimi 4 giorni
  const daysToCheck = Math.min(4, daily.precipitation_sum.length);
  let rainyDayIndex = -1;

  for (let i = 0; i < daysToCheck; i++) {
    if (daily.precipitation_sum[i] > 0.5 || (daily.precipitation_probability_max && daily.precipitation_probability_max[i] > 40)) {
      rainyDayIndex = i;
      break;
    }
  }

  // Controlla polveri sahariane (dust)
  const currentDust = airQuality?.current?.dust || 0;
  if (currentDust > 25) {
    return {
      status: 'Sconsigliato',
      color: '#f59e0b',
      badge: 'Polvere Desertica',
      desc: 'Presenza di polveri sahariane in quota: rischio di pioggia sabbiosa o rapido sporco.'
    };
  }

  if (rainyDayIndex === 0) {
    return {
      status: 'Sconsigliato',
      color: '#ef4444',
      badge: 'Pioggia Oggi',
      desc: 'Pioggia prevista nelle prossime ore: rimanda il lavaggio.'
    };
  } else if (rainyDayIndex === 1) {
    return {
      status: 'Non conviene',
      color: '#f59e0b',
      badge: 'Pioggia Domani',
      desc: 'Pioggia prevista già nella giornata di domani.'
    };
  } else if (rainyDayIndex === 2) {
    return {
      status: 'Discreto',
      color: '#38bdf8',
      badge: '2 Giorni Asciutti',
      desc: 'Almeno 48 ore di tempo asciutto garantite prima di possibili piogge.'
    };
  } else {
    return {
      status: 'Consigliatissimo',
      color: '#10b981',
      badge: 'Finestra 4+ Giorni',
      desc: 'Ottima finestra di bel tempo: nessun fenomeno piovoso nei prossimi 4 giorni.'
    };
  }
}

function calculateOutdoorSportHour(hourly) {
  if (!hourly || !hourly.time) return { label: '--', desc: 'Dati orari non disponibili' };

  const now = new Date();
  const currentIso = now.toISOString().substring(0, 13);
  let startIdx = hourly.time.findIndex(t => t.startsWith(currentIso));
  if (startIdx === -1) startIdx = 0;

  // Analizza le prossime 14 ore diurne
  const endIdx = Math.min(hourly.time.length, startIdx + 14);
  let bestScore = -999;
  let bestHour = null;
  let bestTemp = 0;

  for (let i = startIdx; i < endIdx; i++) {
    const t = new Date(hourly.time[i]);
    const hour = t.getHours();
    if (hour < 7 || hour > 21) continue; // solo ore diurne

    const temp = hourly.temperature_2m[i];
    const rainProb = hourly.precipitation_probability ? hourly.precipitation_probability[i] : 0;
    const wind = hourly.wind_speed_10m[i];

    // Score: 18°C è perfetto
    let score = 100 - Math.abs(temp - 19) * 4;
    score -= rainProb * 1.5;
    if (wind > 25) score -= (wind - 25) * 2;

    if (score > bestScore) {
      bestScore = score;
      bestHour = hour;
      bestTemp = temp;
    }
  }

  if (bestHour !== null) {
    const nextH = (bestHour + 2) % 24;
    const pad = (n) => n.toString().padStart(2, '0');
    return {
      label: `${pad(bestHour)}:00 - ${pad(nextH)}:00`,
      desc: `Temperatura ideale (~${Math.round(bestTemp)}°C), zero piogge e vento calmo.`
    };
  }

  return { label: 'Tarda mattinata', desc: 'Condizioni adeguate per attività sportiva all\'aperto.' };
}

function calculateAstronomySeeing(hourly, current) {
  const moon = typeof getMoonPhase === 'function' ? getMoonPhase(new Date()) : { name: 'Luna', illumination: '50%' };
  const nowHour = new Date().getHours();
  // Nubi stasera (ore 22:00)
  const clouds = current.cloud_cover !== undefined ? current.cloud_cover : 30;

  let score = 100 - clouds;
  if (moon.illumination && parseInt(moon.illumination) > 70) {
    score -= 20; // luna piena riduce visibilità stelle deboli
  }

  score = Math.max(5, Math.min(100, Math.round(score)));

  let rating = 'Ottima';
  let color = '#10b981';
  if (score < 30) {
    rating = 'Scarsa (Cielo Nuvoloso)';
    color = '#ef4444';
  } else if (score < 65) {
    rating = 'Discreta';
    color = '#f59e0b';
  }

  return {
    score: `${score}%`,
    rating,
    color,
    desc: `Copertura nuvolosa stimata: ${clouds}% • ${moon.name} (${moon.illumination}).`
  };
}

function calculateSolarProduction(daily, kwp = 4.0) {
  if (!daily || !daily.shortwave_radiation_sum) {
    return { todayKwh: '--', tomorrowKwh: '--', savingsToday: '--' };
  }

  const radToday = daily.shortwave_radiation_sum[0] || 0;
  const radTomorrow = daily.shortwave_radiation_sum[1] || 0;

  // 1 MJ/m² = 0.2778 kWh/m². Performance Ratio tipico = 0.78
  const todayKwh = Math.round(radToday * 0.2778 * kwp * 0.78 * 10) / 10;
  const tomorrowKwh = Math.round(radTomorrow * 0.2778 * kwp * 0.78 * 10) / 10;
  const savings = Math.round(todayKwh * 0.25 * 100) / 100; // stima 0.25€/kWh

  return {
    todayKwh: `${todayKwh} kWh`,
    tomorrowKwh: `${tomorrowKwh} kWh`,
    savingsToday: `~€${savings.toFixed(2)}`
  };
}

function renderLifeIndices(weatherData, airQualityData, solarKwp = 4.0) {
  const current = weatherData.current || {};
  const daily = weatherData.daily || {};
  const hourly = weatherData.hourly || {};

  // 1. Bucato
  const laundry = calculateLaundryIndex(current, daily);
  const lTimeEl = document.getElementById('laundryTime');
  const lBadgeEl = document.getElementById('laundryBadge');
  const lDescEl = document.getElementById('laundryDesc');
  if (lTimeEl) lTimeEl.textContent = laundry.time;
  if (lBadgeEl) {
    lBadgeEl.textContent = laundry.badge;
    lBadgeEl.style.color = laundry.color;
  }
  if (lDescEl) lDescEl.textContent = laundry.desc;

  // 2. Lavaggio Auto
  const car = calculateCarWashIndex(daily, airQualityData);
  const cBadgeEl = document.getElementById('carWashBadge');
  const cDescEl = document.getElementById('carWashDesc');
  if (cBadgeEl) {
    cBadgeEl.textContent = car.badge || car.status;
    cBadgeEl.style.color = car.color;
  }
  if (cDescEl) cDescEl.textContent = car.desc;

  // 3. Sport Outdoor
  const sport = calculateOutdoorSportHour(hourly);
  const sTimeEl = document.getElementById('sportTime');
  const sDescEl = document.getElementById('sportDesc');
  if (sTimeEl) sTimeEl.textContent = sport.label;
  if (sDescEl) sDescEl.textContent = sport.desc;

  // 4. Astronomia & Notte
  const astro = calculateAstronomySeeing(hourly, current);
  const aScoreEl = document.getElementById('astroScore');
  const aBadgeEl = document.getElementById('astroBadge');
  const aDescEl = document.getElementById('astroDesc');
  if (aScoreEl) aScoreEl.textContent = astro.score;
  if (aBadgeEl) {
    aBadgeEl.textContent = astro.rating;
    aBadgeEl.style.color = astro.color;
  }
  if (aDescEl) aDescEl.textContent = astro.desc;

  // 5. Fotovoltaico
  const solar = calculateSolarProduction(daily, solarKwp);
  const solTodayEl = document.getElementById('solarKwhToday');
  const solTomEl = document.getElementById('solarKwhTomorrow');
  const solSavEl = document.getElementById('solarSavings');
  if (solTodayEl) solTodayEl.textContent = solar.todayKwh;
  if (solTomEl) solTomEl.textContent = `Previsti domani: ${solar.tomorrowKwh}`;
  if (solSavEl) solSavEl.textContent = `Risparmio stimato: ${solar.savingsToday}`;
}
