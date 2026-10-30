/**
 * WeatherDash - European Pollen & Allergens Monitoring Module
 */

const POLLEN_SPECIES = [
  { key: 'grass_pollen', name: 'Graminacee', icon: '🌿', period: 'Primavera - Estate' },
  { key: 'birch_pollen', name: 'Betulla', icon: '🌳', period: 'Marzo - Maggio' },
  { key: 'olive_pollen', name: 'Olivo', icon: '🫒', period: 'Maggio - Giugno' },
  { key: 'ragweed_pollen', name: 'Ambrosia', icon: '🌾', period: 'Fine Estate - Autunno' },
  { key: 'alder_pollen', name: 'Ontano', icon: '🌲', period: 'Gennaio - Aprile' },
  { key: 'mugwort_pollen', name: 'Artemisia', icon: '🍂', period: 'Luglio - Settembre' }
];

function getPollenLevel(grainsM3) {
  if (grainsM3 === undefined || grainsM3 === null || grainsM3 <= 0.1) {
    return { label: 'Assente', color: '#10b981', percent: 5 };
  } else if (grainsM3 <= 10) {
    return { label: 'Basso', color: '#34d399', percent: 25 };
  } else if (grainsM3 <= 50) {
    return { label: 'Moderato', color: '#fbbf24', percent: 60 };
  } else if (grainsM3 <= 120) {
    return { label: 'Elevato', color: '#f97316', percent: 85 };
  } else {
    return { label: 'Molto Alto', color: '#ef4444', percent: 100 };
  }
}

function renderPollenData(airQualityData) {
  const container = document.getElementById('pollenGrid');
  const summaryBadge = document.getElementById('pollenSummaryBadge');
  if (!container) return;

  container.innerHTML = '';
  const current = airQualityData?.current || {};

  let maxPollenLevel = 'Assente';
  let activePollenCount = 0;

  POLLEN_SPECIES.forEach(spec => {
    const val = current[spec.key] || 0;
    const lvl = getPollenLevel(val);

    if (lvl.label === 'Elevato' || lvl.label === 'Molto Alto') {
      maxPollenLevel = 'Elevato';
    } else if (lvl.label === 'Moderato' && maxPollenLevel !== 'Elevato') {
      maxPollenLevel = 'Moderato';
    }

    if (val > 0.5) activePollenCount++;

    const card = document.createElement('div');
    card.className = 'pollutant-card';
    card.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 0.3rem;">
          <span>${spec.icon}</span> ${spec.name}
        </span>
        <span style="font-size: 0.7rem; font-weight: 700; color: ${lvl.color};">${lvl.label}</span>
      </div>
      <div style="font-size: 1.1rem; font-weight: 700; margin: 0.3rem 0; color: var(--text-primary);">
        ${Math.round(val)} <span style="font-size: 0.7rem; font-weight: 400; color: var(--text-muted);">grani/m³</span>
      </div>
      <div class="pollutant-bar">
        <div class="pollutant-bar-fill" style="width: ${lvl.percent}%; background-color: ${lvl.color};"></div>
      </div>
      <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 3px;">Periodo: ${spec.period}</div>
    `;
    container.appendChild(card);
  });

  if (summaryBadge) {
    if (maxPollenLevel === 'Elevato') {
      summaryBadge.className = 'radar-badge past';
      summaryBadge.style.background = 'rgba(239, 68, 68, 0.2)';
      summaryBadge.style.color = '#ef4444';
      summaryBadge.textContent = 'Allerta Pollini Elevata';
    } else if (maxPollenLevel === 'Moderato') {
      summaryBadge.className = 'radar-badge future';
      summaryBadge.style.background = 'rgba(245, 158, 11, 0.2)';
      summaryBadge.style.color = '#fbbf24';
      summaryBadge.textContent = 'Presenza Moderata';
    } else {
      summaryBadge.className = 'radar-badge now';
      summaryBadge.style.background = 'rgba(16, 185, 129, 0.2)';
      summaryBadge.style.color = '#34d399';
      summaryBadge.textContent = 'Rischio Allergie Minimo';
    }
  }
}
