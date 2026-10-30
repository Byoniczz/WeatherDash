/**
 * WeatherDash - Hail Risk & Severe Weather Monitoring Module
 */

function calculateHailForecast(hourly, current = {}) {
  if (!hourly || !hourly.time) {
    return {
      currentRisk: 0,
      maxRisk: 0,
      level: 'Nullo',
      color: '#10b981',
      badge: 'Nessun Rischio',
      peakTime: '--:--',
      peakCape: 0,
      advice: 'Condizioni atmosferiche stabili: nessun pericolo per auto o coltivazioni.',
      hourlyTimeline: []
    };
  }

  const now = new Date();
  const currentIso = now.toISOString().substring(0, 13);
  let startIdx = hourly.time.findIndex(t => t.startsWith(currentIso));
  if (startIdx === -1) startIdx = 0;

  const count = Math.min(24, hourly.time.length - startIdx);
  const hourlyTimeline = [];
  let maxRisk = 0;
  let peakHour = null;
  let peakCape = 0;

  for (let i = 0; i < count; i++) {
    const idx = startIdx + i;
    const timeStr = hourly.time[idx];
    const dateObj = new Date(timeStr);
    const hourLabel = `${dateObj.getHours().toString().padStart(2, '0')}:00`;

    const cape = (hourly.cape && hourly.cape[idx]) || 0;
    const li = (hourly.lifted_index && hourly.lifted_index[idx] !== undefined) ? hourly.lifted_index[idx] : 5;
    const wCode = (hourly.weather_code && hourly.weather_code[idx]) || 0;
    const prob = (hourly.precipitation_probability && hourly.precipitation_probability[idx]) || 0;
    const precip = (hourly.precipitation && hourly.precipitation[idx]) || 0;
    const gusts = (hourly.wind_gusts_10m && hourly.wind_gusts_10m[idx]) || 0;

    // 1. Calcolo punteggio CAPE (energia convettiva disponibile)
    let capeScore = 0;
    if (cape >= 2500) capeScore = 85 + Math.min(15, (cape - 2500) / 100);
    else if (cape >= 1200) capeScore = 55 + (cape - 1200) / 1300 * 30;
    else if (cape >= 500) capeScore = 25 + (cape - 500) / 700 * 30;
    else if (cape >= 100) capeScore = 10 + (cape - 100) / 400 * 15;

    // 2. Bonus instabilità Lifted Index
    let liBonus = 0;
    if (li <= -6) liBonus = 20;
    else if (li <= -3) liBonus = 12;
    else if (li <= 0) liBonus = 5;

    // 3. Temporale in atto / previsto
    let stormBonus = (wCode === 95) ? 20 : 0;

    let rawRisk = capeScore + liBonus + stormBonus;

    // 4. Fattore precipitazioni (se non piove, non precipita grandine al suolo)
    const precipFactor = (prob < 15 && precip < 0.1) ? 0.12 : Math.min(1.0, Math.max(0.2, prob / 50));
    let risk = Math.round(rawRisk * precipFactor);

    // 5. Override codici WMO grandinigeni espliciti
    if (wCode === 99) risk = Math.max(92, risk); // temporale con grandine violenta
    else if (wCode === 96) risk = Math.max(78, risk); // temporale con grandine lieve

    risk = Math.max(0, Math.min(100, risk));

    let hourColor = '#10b981';
    let hourLevel = 'Nullo';
    if (risk >= 75) {
      hourColor = '#dc2626';
      hourLevel = 'Severo';
    } else if (risk >= 50) {
      hourColor = '#ef4444';
      hourLevel = 'Elevato';
    } else if (risk >= 25) {
      hourColor = '#f59e0b';
      hourLevel = 'Moderato';
    } else if (risk >= 10) {
      hourColor = '#84cc16';
      hourLevel = 'Basso';
    }

    hourlyTimeline.push({
      time: timeStr,
      hourLabel,
      risk,
      cape: Math.round(cape),
      li: Math.round(li * 10) / 10,
      prob,
      gusts: Math.round(gusts),
      color: hourColor,
      level: hourLevel
    });

    if (risk > maxRisk) {
      maxRisk = risk;
      peakHour = hourLabel;
      peakCape = Math.round(cape);
    }
  }

  // Categoria massima nelle 24h
  let level = 'Nullo / Minimo';
  let color = '#10b981';
  let badge = 'Rischio Nullo';
  let advice = 'Nessun pericolo di grandine previsto nelle prossime 24 ore. Condizioni stabili.';

  if (maxRisk >= 75) {
    level = 'Severo / Pericolo Elevato';
    color = '#dc2626';
    badge = '🚨 ALLERTA GRANDINE';
    advice = '⚠️ ALTISSIMO RISCHIO GRANDINE: correnti ascensionali violente (CAPE molto alto). Ricovera subito i veicoli in garage o sotto tettoia e proteggi colture e tende!';
  } else if (maxRisk >= 50) {
    level = 'Elevato (Probabile Grandine)';
    color = '#ef4444';
    badge = '⚠️ Rischio Elevato';
    advice = 'Rischio concreto di grandinate durante i temporali: è vivamente consigliato non lasciare l\'auto esposta all\'aperto nella fascia oraria di picco.';
  } else if (maxRisk >= 25) {
    level = 'Moderato (Possibile Instabilità)';
    color = '#f59e0b';
    badge = 'Instabilità Moderata';
    advice = 'Possibili chicchi di piccole dimensioni o grandine frammista a pioggia durante i rovesci. Monitora l\'evoluzione radar.';
  } else if (maxRisk >= 10) {
    level = 'Basso';
    color = '#84cc16';
    badge = 'Rischio Basso';
    advice = 'Debole instabilità termica: fenomeni grandinigeni improbabili o del tutto marginali.';
  }

  return {
    currentRisk: hourlyTimeline[0] ? hourlyTimeline[0].risk : 0,
    maxRisk,
    level,
    color,
    badge,
    peakTime: peakHour || (hourlyTimeline[0] ? hourlyTimeline[0].hourLabel : '--:--'),
    peakCape,
    advice,
    hourlyTimeline
  };
}

function renderHailData(weatherData) {
  const hourly = weatherData?.hourly || {};
  const current = weatherData?.current || {};

  const hail = calculateHailForecast(hourly, current);

  // Aggiorna Badge e Valori Card Principale
  const badgeEl = document.getElementById('hailRiskBadge');
  const scoreEl = document.getElementById('hailRiskVal');
  const levelEl = document.getElementById('hailRiskLevel');
  const peakTimeEl = document.getElementById('hailPeakTime');
  const capeEl = document.getElementById('hailCapeVal');
  const adviceEl = document.getElementById('hailAdviceText');
  const timelineTrack = document.getElementById('hailTimelineTrack');

  if (badgeEl) {
    badgeEl.textContent = hail.badge;
    badgeEl.style.color = hail.color;
    badgeEl.style.borderColor = hail.color;
  }
  if (scoreEl) {
    scoreEl.textContent = `${hail.maxRisk}%`;
    scoreEl.style.color = hail.color;
  }
  if (levelEl) {
    levelEl.textContent = hail.level;
  }
  if (peakTimeEl) {
    peakTimeEl.textContent = `Picco previsto: ${hail.peakTime}`;
  }
  if (capeEl) {
    capeEl.textContent = `CAPE max: ${hail.peakCape} J/kg`;
  }
  if (adviceEl) {
    adviceEl.textContent = hail.advice;
  }

  // Render barre orarie a scorrimento
  if (timelineTrack && hail.hourlyTimeline.length > 0) {
    timelineTrack.innerHTML = '';
    hail.hourlyTimeline.forEach(item => {
      const col = document.createElement('div');
      col.className = 'hail-hour-col';
      col.title = `Ore ${item.hourLabel}: Rischio Grandine ${item.risk}% (${item.level}) • CAPE: ${item.cape} J/kg • Prob. Pioggia: ${item.prob}%`;
      
      const heightPercent = Math.max(6, item.risk);
      col.innerHTML = `
        <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 500;">${item.hourLabel.substring(0, 2)}h</div>
        <div class="hail-bar-wrap">
          <div class="hail-bar-fill" style="height: ${heightPercent}%; background-color: ${item.color};"></div>
        </div>
        <div style="font-size: 0.68rem; font-weight: 700; color: ${item.color};">${item.risk}%</div>
      `;
      timelineTrack.appendChild(col);
    });
  }

  // Notifica in alert banner se rischio elevato (>= 50%)
  const alertBanner = document.getElementById('alertBanner');
  const alertText = document.getElementById('alertText');
  if (alertBanner && alertText && hail.maxRisk >= 50) {
    alertBanner.style.display = 'flex';
    alertBanner.className = 'weather-alert danger';
    alertText.innerHTML = `<strong>⚠️ Allerta Grandine (${hail.maxRisk}% - ${hail.level}):</strong> Picco atteso intorno alle ${hail.peakTime} (CAPE ${hail.peakCape} J/kg). Proteggi veicoli e colture!`;
  }
}
