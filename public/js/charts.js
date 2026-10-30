/**
 * WeatherDash - Interactive Hourly Weather Charts (Chart.js)
 */

class WeatherCharts {
  constructor(canvasId = 'hourlyChartCanvas') {
    this.canvasId = canvasId;
    this.chart = null;
    this.currentHourlyData = null;
    this.currentMode = 'temp'; // 'temp', 'precip', 'wind', 'uv'
    this.isFahrenheit = false;
  }

  init() {
    const btns = document.querySelectorAll('.chart-tab-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentMode = btn.dataset.mode;
        this.updateChart();
      });
    });
  }

  setData(hourlyData, isFahrenheit = false) {
    this.currentHourlyData = hourlyData;
    this.isFahrenheit = isFahrenheit;
    this.updateChart();
  }

  updateChart() {
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js non ancora pronto o non disponibile');
      return;
    }
    if (!this.currentHourlyData || !this.currentHourlyData.time) return;

    const ctx = document.getElementById(this.canvasId);
    if (!ctx) return;

    const hourly = this.currentHourlyData;
    const now = new Date();
    const currentIsoHour = now.toISOString().substring(0, 13);

    let startIdx = hourly.time.findIndex(t => t.startsWith(currentIsoHour));
    if (startIdx === -1) startIdx = 0;
    const endIdx = Math.min(hourly.time.length, startIdx + 24); // prossime 24 ore

    const labels = [];
    for (let i = startIdx; i < endIdx; i++) {
      const d = new Date(hourly.time[i]);
      labels.push(d.getHours().toString().padStart(2, '0') + ':00');
    }

    if (this.chart) {
      this.chart.destroy();
    }

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)';
    const textColor = isLight ? '#475569' : '#94a3b8';

    let config = {};

    if (this.currentMode === 'temp') {
      // Temperatura & Percepita
      const temps = [];
      const feels = [];
      for (let i = startIdx; i < endIdx; i++) {
        let t = hourly.temperature_2m[i];
        let f = hourly.apparent_temperature[i];
        if (this.isFahrenheit) {
          t = (t * 9 / 5) + 32;
          f = (f * 9 / 5) + 32;
        }
        temps.push(Math.round(t * 10) / 10);
        feels.push(Math.round(f * 10) / 10);
      }

      config = {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: `Temperatura (${this.isFahrenheit ? '°F' : '°C'})`,
              data: temps,
              borderColor: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              fill: true,
              tension: 0.35,
              borderWidth: 3,
              pointRadius: 3,
              pointHoverRadius: 6
            },
            {
              label: `Percepita (${this.isFahrenheit ? '°F' : '°C'})`,
              data: feels,
              borderColor: '#f59e0b',
              borderDash: [5, 5],
              tension: 0.35,
              borderWidth: 2,
              pointRadius: 2,
              pointHoverRadius: 5
            }
          ]
        }
      };

    } else if (this.currentMode === 'precip') {
      // Precipitazioni mm e % Probabilità
      const probs = [];
      const mms = [];
      for (let i = startIdx; i < endIdx; i++) {
        probs.push(hourly.precipitation_probability ? hourly.precipitation_probability[i] : 0);
        mms.push(hourly.precipitation ? hourly.precipitation[i] : 0);
      }

      config = {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              type: 'bar',
              label: 'Accumulo (mm)',
              data: mms,
              backgroundColor: 'rgba(56, 189, 248, 0.65)',
              borderRadius: 4,
              yAxisID: 'yMm'
            },
            {
              type: 'line',
              label: 'Probabilità (%)',
              data: probs,
              borderColor: '#6366f1',
              borderWidth: 2,
              pointRadius: 3,
              tension: 0.3,
              yAxisID: 'yProb'
            }
          ]
        },
        options: {
          scales: {
            yMm: {
              type: 'linear',
              position: 'left',
              title: { display: true, text: 'mm pioggia', color: textColor },
              grid: { color: gridColor },
              ticks: { color: textColor }
            },
            yProb: {
              type: 'linear',
              position: 'right',
              min: 0,
              max: 100,
              title: { display: true, text: '% prob.', color: textColor },
              grid: { drawOnChartArea: false },
              ticks: { color: textColor }
            }
          }
        }
      };

    } else if (this.currentMode === 'wind') {
      // Vento e Raffiche
      const winds = [];
      const gusts = [];
      for (let i = startIdx; i < endIdx; i++) {
        winds.push(hourly.wind_speed_10m[i]);
        gusts.push(hourly.wind_gusts_10m[i]);
      }

      config = {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Vento (km/h)',
              data: winds,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              fill: true,
              tension: 0.35,
              borderWidth: 2.5
            },
            {
              label: 'Raffiche (km/h)',
              data: gusts,
              borderColor: '#ef4444',
              borderDash: [4, 4],
              tension: 0.35,
              borderWidth: 2
            }
          ]
        }
      };

    } else if (this.currentMode === 'uv') {
      // Indice UV
      const uvs = [];
      for (let i = startIdx; i < endIdx; i++) {
        uvs.push(hourly.uv_index ? hourly.uv_index[i] : 0);
      }

      config = {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Indice UV',
              data: uvs,
              borderColor: '#f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.2)',
              fill: true,
              tension: 0.35,
              borderWidth: 2.5,
              pointRadius: 3
            }
          ]
        },
        options: {
          scales: {
            y: {
              min: 0,
              max: Math.max(10, Math.ceil(Math.max(...uvs, 5)))
            }
          }
        }
      };
    }

    // Default global options
    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: textColor,
            font: { size: 12, family: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto' }
          }
        },
        tooltip: {
          backgroundColor: isLight ? '#ffffff' : '#1e293b',
          titleColor: isLight ? '#0f172a' : '#f8fafc',
          bodyColor: isLight ? '#334155' : '#cbd5e1',
          borderColor: gridColor,
          borderWidth: 1,
          padding: 10,
          boxPadding: 4
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor }
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor }
        }
      }
    };

    config.options = Object.assign(defaultOptions, config.options || {});
    this.chart = new Chart(ctx, config);
  }
}
