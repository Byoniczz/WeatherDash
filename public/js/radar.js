/**
 * WeatherDash - Interactive Precipitation Radar & Map Module (Leaflet + RainViewer)
 */

class WeatherRadar {
  constructor(containerId = 'radarMap') {
    this.containerId = containerId;
    this.map = null;
    this.userMarker = null;
    this.radarLayers = [];
    this.frames = [];
    this.currentFrameIndex = -1;
    this.isPlaying = false;
    this.animationTimer = null;
    this.animationSpeed = 600; // ms per frame
    this.host = 'https://tilecache.rainviewer.com';
    this.colorScheme = 2; // 2: Universal Blue/Green/Yellow/Red
    this.smooth = 1;
    this.snow = 1;
    this.layerType = 'radar'; // 'radar', 'satellite', o 'future'
    this.currentLat = 41.8919;
    this.currentLon = 12.5113;
    this.cartoApiKey = 'cb1_4q2e_1_a29519003be17de1cdc0c026';

    // Base maps
    this.baseLayers = {};
    this.currentBaseLayer = null;

    // Webcams layer group
    this.webcamLayerGroup = null;

    // Fulmini / Scariche elettriche in tempo reale
    this.lightningLayerGroup = null;
    this.lightningEnabled = localStorage.getItem('wd_lightning_enabled') !== 'false';
    this.lightningTimer = null;

    // Carica eventuale chiave configurata dal server
    this.fetchConfig();
  }

  async fetchConfig() {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const cfg = await res.json();
        if (cfg.cartoApiKey) this.cartoApiKey = cfg.cartoApiKey;
      }
    } catch (e) {}
  }

  init(lat = 41.8919, lon = 12.5113, zoom = 6, label = '') {
    if (typeof L === 'undefined') {
      console.warn('Leaflet non ancora pronto o non disponibile');
      return;
    }
    if (this.map) {
      this.map.remove();
    }

    this.map = L.map(this.containerId, {
      center: [lat, lon],
      zoom: zoom,
      minZoom: 3,
      maxZoom: 18,
      zoomControl: true,
      attributionControl: true
    });

    const cartoAttr = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

    // Layer CartoDB Dark (con API Key autorizzata senza watermark)
    this.baseLayers.dark = L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${this.cartoApiKey}`, {
      maxZoom: 18,
      subdomains: 'abcd',
      attribution: cartoAttr,
      zIndex: 1
    });

    // Layer CartoDB Light (Positron)
    this.baseLayers.light = L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=${this.cartoApiKey}`, {
      maxZoom: 18,
      subdomains: 'abcd',
      attribution: cartoAttr,
      zIndex: 1
    });

    // Layer CartoDB Voyager (Colorata)
    this.baseLayers.voyager = L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${this.cartoApiKey}`, {
      maxZoom: 18,
      subdomains: 'abcd',
      attribution: cartoAttr,
      zIndex: 1
    });

    // Layer OpenStreetMap Standard
    this.baseLayers.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      zIndex: 1
    });

    // Layer Satellite Esri
    this.baseLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      zIndex: 1
    });

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    this.currentBaseLayer = isLight ? this.baseLayers.light : this.baseLayers.dark;
    this.currentBaseLayer.addTo(this.map);

    // Marker con animazione pulse e puntatore ben visibile
    this.updateUserMarker(lat, lon, label);

    // Click sulla mappa per spostare il puntatore e aggiornare meteo
    this.map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      if (window.weatherApp) {
        window.weatherApp.selectLocationFromCoordinates(lat, lng);
      }
    });

    // Assicura il corretto ridimensionamento della mappa
    setTimeout(() => {
      if (this.map) this.map.invalidateSize();
    }, 250);

    window.addEventListener('resize', () => {
      if (this.map) this.map.invalidateSize();
    });

    // Carica dati radar
    this.loadRadarFrames();

    // Setup event listeners controlli
    this.bindControls();
  }

  setBaseLayer(type) {
    if (!this.baseLayers[type] || !this.map) return;
    if (this.currentBaseLayer) {
      this.map.removeLayer(this.currentBaseLayer);
    }
    this.currentBaseLayer = this.baseLayers[type];
    this.currentBaseLayer.addTo(this.map);

    // Mantiene sempre il puntatore in primo piano assoluto su qualsiasi mappa
    if (this.userMarker) {
      this.userMarker.setZIndexOffset(9999);
    }
  }

  updateUserMarker(lat, lon, label = '') {
    this.currentLat = lat;
    this.currentLon = lon;
    this.currentLabel = label;

    // Aggiorna badge flottante in alto a sinistra della mappa
    const badgeName = document.getElementById('mapBadgeLocationName');
    const badgeCoords = document.getElementById('mapBadgeCoords');
    if (badgeName) badgeName.textContent = label || 'Posizione Selezionata';
    if (badgeCoords) badgeCoords.textContent = `(${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`;

    // Se siamo in modalità esterna (proiezione futura o satellite), aggiorna iframe con marker
    if (this.layerType === 'future' || this.layerType === 'satellite') {
      const futureFrame = document.getElementById('futureRadarFrame');
      if (futureFrame) {
        let overlay = (this.layerType === 'satellite') ? 'satellite' : 'rain';
        let product = (this.layerType === 'satellite') ? 'satellite' : 'ecmwf';
        let zoom = 6;
        futureFrame.src = `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=%C2%B0C&metricWind=km%2Fh&zoom=${zoom}&overlay=${overlay}&product=${product}&level=surface&lat=${lat}&lon=${lon}&marker=true`;
      }
    } else if (this.layerType === 'webcams') {
      this.loadWebcams(lat, lon);
    }

    // Carica scariche elettriche fulmini
    if (this.lightningEnabled) {
      this.loadLightning(lat, lon);
    }
    if (!this.lightningTimer) {
      this.lightningTimer = setInterval(() => {
        if (this.lightningEnabled && !document.hidden && this.map) {
          this.loadLightning(this.currentLat, this.currentLon);
        }
      }, 30000);
    }

    if (!this.map) return;

    if (this.userMarker) {
      this.map.removeLayer(this.userMarker);
    }

    const displayLabel = label || 'Posizione Selezionata';

    // SVG Pin nitido e ben visibile sopra a qualsiasi layer radar o satellite
    const pinHtml = `
      <div class="map-pointer-wrapper" title="${displayLabel}">
        <div class="map-pointer-label">📍 ${displayLabel}</div>
        <div style="position: relative; display: flex; justify-content: center;">
          <svg class="map-pointer-pin" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="pinGradRed" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ef4444"/>
                <stop offset="100%" stop-color="#b91c1c"/>
              </linearGradient>
            </defs>
            <path d="M18 0C8.06 0 0 8.06 0 18C0 31.5 18 48 18 48C18 48 36 31.5 36 18C36 8.06 27.94 0 18 0Z" fill="url(#pinGradRed)"/>
            <circle cx="18" cy="18" r="7.5" fill="#ffffff"/>
            <circle cx="18" cy="18" r="4" fill="#b91c1c"/>
          </svg>
          <div class="map-pointer-radar-ripple"></div>
        </div>
      </div>
    `;

    const pointerIcon = L.divIcon({
      className: 'leaflet-custom-pointer',
      html: pinHtml,
      iconSize: [180, 75],
      iconAnchor: [90, 73]
    });

    this.userMarker = L.marker([lat, lon], {
      icon: pointerIcon,
      draggable: true,
      zIndexOffset: 9999
    }).addTo(this.map);

    this.userMarker.bindPopup(`
      <div style="text-align: center; font-size: 0.85rem; padding: 4px;">
        <strong style="font-size: 0.95rem; color: #0f172a;">📍 ${displayLabel}</strong><br>
        <span style="color: #64748b; font-size: 0.75rem;">Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}</span><br>
        <div style="margin-top: 6px; font-size: 0.75rem; color: #0284c7;">
          💡 <em>Trascina o clicca sulla mappa per spostare il puntatore</em>
        </div>
      </div>
    `);

    // Evento rilascio trascinamento puntatore
    this.userMarker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      if (window.weatherApp) {
        window.weatherApp.selectLocationFromCoordinates(pos.lat, pos.lng);
      }
    });

    this.map.setView([lat, lon], this.map.getZoom() ? Math.min(this.map.getZoom(), 7) : 6);
  }

  async loadRadarFrames() {
    try {
      let data = null;
      try {
        const res = await fetch('/api/radar-frames');
        if (res.ok) data = await res.json();
      } catch (e) {
        console.warn('Fallback a chiamata diretta RainViewer API:', e);
      }

      if (!data) {
        const directRes = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        data = await directRes.json();
      }

      this.host = data.host || 'https://tilecache.rainviewer.com';

      // Raccogli frame passati e nowcast (previsione futura immediata)
      const pastFrames = data.radar?.past || [];
      const nowcastFrames = data.radar?.nowcast || [];
      this.satelliteFrames = data.satellite?.infrared || [];

      if (this.layerType === 'satellite') {
        this.frames = this.satelliteFrames;
      } else {
        this.frames = [...pastFrames, ...nowcastFrames];
      }

      if (!this.frames || this.frames.length === 0) {
        console.warn('Nessun frame radar disponibile');
        return;
      }

      // Prepara i layer Leaflet
      this.clearRadarLayers();

      this.radarLayers = this.frames.map((frame, index) => {
        let tileUrl = '';
        if (this.layerType === 'satellite') {
          tileUrl = `${this.host}${frame.path}/256/{z}/{x}/{y}/0/0_0.png`;
        } else {
          tileUrl = `${this.host}${frame.path}/256/{z}/{x}/{y}/${this.colorScheme}/${this.smooth}_${this.snow}.png`;
        }

        return L.tileLayer(tileUrl, {
          tileSize: 256,
          opacity: 0.001,
          zIndex: 100 + index,
          maxNativeZoom: 7, // RainViewer limita le tile gratuite allo zoom 7
          maxZoom: 18       // Leaflet effettua l'upscaling pulito senza mai mostrare "zoom level not supported"
        });
      });

      // Aggiungi tutti i layer alla mappa (con opacità minima per caching fluido del browser)
      this.radarLayers.forEach(layer => layer.addTo(this.map));

      // Imposta slider range
      const slider = document.getElementById('radarSlider');
      if (slider) {
        slider.min = 0;
        slider.max = this.frames.length - 1;
        slider.value = this.frames.length - 1;
      }

      // Mostra l'ultimo frame disponibile
      this.showFrame(this.frames.length - 1);

    } catch (err) {
      console.error('Errore caricamento radar RainViewer:', err);
    }
  }

  clearRadarLayers() {
    if (this.radarLayers && this.map) {
      this.radarLayers.forEach(l => this.map.removeLayer(l));
      this.radarLayers = [];
    }
  }

  showFrame(index) {
    if (!this.radarLayers || this.radarLayers.length === 0) return;
    if (index < 0 || index >= this.radarLayers.length) return;

    // Nascondi frame precedente
    if (this.currentFrameIndex >= 0 && this.radarLayers[this.currentFrameIndex]) {
      this.radarLayers[this.currentFrameIndex].setOpacity(0);
    }

    // Mostra nuovo frame
    this.currentFrameIndex = index;
    this.radarLayers[index].setOpacity(0.75);

    // Aggiorna slider
    const slider = document.getElementById('radarSlider');
    if (slider && parseInt(slider.value) !== index) {
      slider.value = index;
    }

    // Aggiorna etichetta temporale
    const frame = this.frames[index];
    if (frame && frame.time) {
      const frameDate = new Date(frame.time * 1000);
      const hours = frameDate.getHours().toString().padStart(2, '0');
      const mins = frameDate.getMinutes().toString().padStart(2, '0');
      const timeEl = document.getElementById('radarTimeText');
      if (timeEl) {
        timeEl.textContent = `${hours}:${mins}`;
      }

      // Badge passato / attuale / previsione
      const badgeEl = document.getElementById('radarBadge');
      if (badgeEl) {
        const diffMinutes = Math.round((frame.time * 1000 - Date.now()) / 60000);
        if (diffMinutes > 5) {
          badgeEl.className = 'radar-badge future';
          badgeEl.textContent = `Previsione +${diffMinutes}m`;
        } else if (diffMinutes >= -8) {
          badgeEl.className = 'radar-badge now';
          badgeEl.textContent = 'Attuale';
        } else {
          badgeEl.className = 'radar-badge past';
          badgeEl.textContent = `${Math.abs(diffMinutes)}m fa`;
        }
      }
    }
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    const playIcon = document.getElementById('radarPlayIcon');
    if (playIcon) {
      // Pause icon
      playIcon.innerHTML = `<rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/>`;
    }

    const next = () => {
      let nextIdx = this.currentFrameIndex + 1;
      if (nextIdx >= this.frames.length) {
        nextIdx = 0; // ricomincia loop
      }
      this.showFrame(nextIdx);
      if (this.isPlaying) {
        // Pausa leggermente più lunga sull'ultimo frame per chiarezza
        const delay = (nextIdx === this.frames.length - 1) ? this.animationSpeed * 2.5 : this.animationSpeed;
        this.animationTimer = setTimeout(next, delay);
      }
    };

    next();
  }

  pause() {
    this.isPlaying = false;
    if (this.animationTimer) {
      clearTimeout(this.animationTimer);
      this.animationTimer = null;
    }
    const playIcon = document.getElementById('radarPlayIcon');
    if (playIcon) {
      // Play icon
      playIcon.innerHTML = `<polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>`;
    }
  }

  togglePlay() {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  prevFrame() {
    this.pause();
    let idx = this.currentFrameIndex - 1;
    if (idx < 0) idx = this.frames.length - 1;
    this.showFrame(idx);
  }

  nextFrame() {
    this.pause();
    let idx = this.currentFrameIndex + 1;
    if (idx >= this.frames.length) idx = 0;
    this.showFrame(idx);
  }

  bindControls() {
    const playBtn = document.getElementById('radarPlayBtn');
    if (playBtn) playBtn.onclick = () => this.togglePlay();

    const prevBtn = document.getElementById('radarPrevBtn');
    if (prevBtn) prevBtn.onclick = () => this.prevFrame();

    const nextBtn = document.getElementById('radarNextBtn');
    if (nextBtn) nextBtn.onclick = () => this.nextFrame();

    const slider = document.getElementById('radarSlider');
    if (slider) {
      slider.oninput = (e) => {
        this.pause();
        this.showFrame(parseInt(e.target.value));
      };
    }

    // Toggle layer Radar vs Satellite vs Proiezione Futura
    const typeSelect = document.getElementById('radarTypeSelect');
    if (typeSelect) {
      typeSelect.onchange = (e) => {
        this.setLayerType(e.target.value);
      };
    }

    // Toggle scariche fulmini
    const lightningBtn = document.getElementById('lightningToggleBtn');
    if (lightningBtn) {
      lightningBtn.classList.toggle('active', this.lightningEnabled);
      lightningBtn.onclick = () => {
        this.lightningEnabled = !this.lightningEnabled;
        localStorage.setItem('wd_lightning_enabled', this.lightningEnabled ? 'true' : 'false');
        lightningBtn.classList.toggle('active', this.lightningEnabled);
        if (this.lightningLayerGroup && this.map) {
          if (this.lightningEnabled) {
            this.map.addLayer(this.lightningLayerGroup);
            this.loadLightning(this.currentLat, this.currentLon);
          } else {
            this.map.removeLayer(this.lightningLayerGroup);
          }
        }
      };
    }

    // Basemap selector
    const basemapSelect = document.getElementById('basemapSelect');
    if (basemapSelect) {
      basemapSelect.onchange = (e) => {
        this.setBaseLayer(e.target.value);
      };
    }
  }

  setLayerType(type) {
    this.layerType = type;
    const radarMapEl = document.getElementById('radarMap');
    const futureFrame = document.getElementById('futureRadarFrame');
    const controlsPanel = document.getElementById('radarControlsPanel');
    const legendEl = document.getElementById('radarLegend');
    const basemapSelect = document.getElementById('basemapSelect');
    const webcamGallery = document.getElementById('webcamGalleryContainer');

    const lat = this.currentLat || 41.89;
    const lon = this.currentLon || 12.51;

    // Se si esce da webcams, pulisci layer webcam e nascondi galleria
    if (type !== 'webcams') {
      if (this.webcamLayerGroup) this.webcamLayerGroup.clearLayers();
      if (webcamGallery) webcamGallery.style.display = 'none';
    }

    if (type === 'future' || type === 'satellite') {
      this.pause();
      if (radarMapEl) radarMapEl.style.display = 'none';
      if (controlsPanel) controlsPanel.style.display = 'none';
      if (legendEl) legendEl.style.display = 'none';
      if (basemapSelect) basemapSelect.style.display = 'none';
      if (webcamGallery) webcamGallery.style.display = 'none';

      if (futureFrame) {
        let overlay = (type === 'satellite') ? 'satellite' : 'rain';
        let product = (type === 'satellite') ? 'satellite' : 'ecmwf';
        let zoom = 6;
        futureFrame.src = `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=%C2%B0C&metricWind=km%2Fh&zoom=${zoom}&overlay=${overlay}&product=${product}&level=surface&lat=${lat}&lon=${lon}&marker=true`;
        futureFrame.style.display = 'block';
      }
    } else if (type === 'webcams') {
      this.pause();
      if (futureFrame) futureFrame.style.display = 'none';
      if (radarMapEl) {
        radarMapEl.style.display = 'block';
        if (this.map) setTimeout(() => this.map.invalidateSize(), 50);
      }
      if (controlsPanel) controlsPanel.style.display = 'none';
      if (legendEl) legendEl.style.display = 'none';
      if (basemapSelect) basemapSelect.style.display = 'block';
      if (webcamGallery) webcamGallery.style.display = 'block';

      this.clearRadarLayers();
      this.loadWebcams(lat, lon);
    } else {
      // Radar precipitazioni in tempo reale (RainViewer)
      if (futureFrame) futureFrame.style.display = 'none';
      if (webcamGallery) webcamGallery.style.display = 'none';
      if (radarMapEl) {
        radarMapEl.style.display = 'block';
        if (this.map) {
          setTimeout(() => this.map.invalidateSize(), 50);
        }
      }
      if (controlsPanel) controlsPanel.style.display = 'flex';
      if (legendEl) legendEl.style.display = 'block';
      if (basemapSelect) basemapSelect.style.display = 'block';

      if (this.userMarker) {
        this.userMarker.setZIndexOffset(9999);
      }
      this.loadRadarFrames();
    }
  }

  async loadWebcams(lat, lon) {
    if (!this.map) return;
    if (!this.webcamLayerGroup) {
      this.webcamLayerGroup = L.layerGroup().addTo(this.map);
    }
    this.webcamLayerGroup.clearLayers();

    const countBadge = document.getElementById('webcamCountBadge');
    const scrollContainer = document.getElementById('webcamCardsScroll');
    const linkEl = document.getElementById('windyWebcamsLink');
    const noticeEl = document.getElementById('webcamApiKeyNotice');

    if (countBadge) countBadge.textContent = 'Ricerca in corso...';
    if (scrollContainer) scrollContainer.innerHTML = '<div style="padding: 1rem; font-size: 0.8rem; color: var(--text-muted);">Caricamento webcam della zona in corso...</div>';

    try {
      const res = await fetch(`/api/webcams?lat=${lat}&lon=${lon}`);
      if (!res.ok) throw new Error('Webcams HTTP ' + res.status);
      const data = await res.json();

      if (linkEl && data.windyMapUrl) {
        linkEl.href = data.windyMapUrl;
      }
      if (noticeEl) {
        noticeEl.style.display = data.hasApiKey ? 'none' : 'flex';
      }

      const list = data.webcams || [];
      if (countBadge) countBadge.textContent = `${list.length} trovate`;

      if (scrollContainer) scrollContainer.innerHTML = '';

      if (list.length === 0) {
        if (scrollContainer) {
          scrollContainer.innerHTML = `
            <div style="padding: 1rem; font-size: 0.85rem; color: var(--text-secondary); text-align: center; width: 100%;">
              Nessuna webcam registrata entro 150 km da questo punto.<br>
              <a href="${data.windyMapUrl || 'https://www.windy.com/-Webcams/webcams'}" target="_blank" style="color: var(--accent); font-weight: 600; display: inline-block; margin-top: 0.4rem;">
                Apri la mappa interattiva Windy per esplorare tutte le webcam della regione →
              </a>
            </div>
          `;
        }
        return;
      }

      list.forEach((cam) => {
        // 1. Aggiungi marker su mappa Leaflet
        const camPinIcon = L.divIcon({
          className: 'leaflet-webcam-div-icon',
          html: `<div class="webcam-map-pin" title="${cam.title}">📷</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const marker = L.marker([cam.lat, cam.lon], { icon: camPinIcon });
        const popupHtml = `
          <div style="max-width: 260px; font-family: sans-serif; color: #0f172a;">
            <strong style="display:block; font-size: 0.85rem; margin-bottom: 3px;">📷 ${cam.title}</strong>
            <div style="font-size: 0.72rem; color: #64748b; margin-bottom: 6px;">Distanza: ${cam.distanceKm} km</div>
            ${cam.thumbnailUrl ? `<a href="${cam.webcamUrl || cam.thumbnailUrl}" target="_blank"><img src="${cam.thumbnailUrl}" style="width: 100%; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: block;" alt="${cam.title}"></a>` : ''}
            <div style="margin-top: 6px; text-align: right;">
              <a href="${cam.webcamUrl || `https://www.windy.com/-Webcams/webcams?${cam.lat},${cam.lon},12`}" target="_blank" style="font-size: 0.75rem; color: #0284c7; text-decoration: none; font-weight: 600;">Apri Webcam Live →</a>
            </div>
          </div>
        `;
        marker.bindPopup(popupHtml);
        marker.addTo(this.webcamLayerGroup);

        // 2. Crea Card nella galleria sotto la mappa
        if (scrollContainer) {
          const card = document.createElement('div');
          card.className = 'webcam-card-item';
          card.innerHTML = `
            ${cam.thumbnailUrl ? `<img class="webcam-card-thumb" src="${cam.thumbnailUrl}" alt="${cam.title}" loading="lazy">` : `<div class="webcam-card-thumb" style="display:flex;align-items:center;justify-content:center;color:#64748b;font-size:1.5rem;">📷</div>`}
            <div class="webcam-card-info">
              <div class="webcam-card-title" title="${cam.title}">${cam.title}</div>
              <div class="webcam-card-meta">
                <span>📍 ${cam.distanceKm} km</span>
                <span style="color: var(--accent); font-weight: 600;">Vedi →</span>
              </div>
            </div>
          `;
          card.onclick = () => {
            this.map.setView([cam.lat, cam.lon], Math.max(this.map.getZoom(), 11));
            marker.openPopup();
          };
          scrollContainer.appendChild(card);
        }
      });

    } catch (err) {
      console.error('Errore caricamento webcam:', err);
      if (scrollContainer) {
        scrollContainer.innerHTML = `<div style="padding: 1rem; font-size: 0.8rem; color: var(--text-muted);">Impossibile recuperare le webcam al momento. Puoi comunque visualizzarle direttamente su <a href="https://www.windy.com/-Webcams/webcams" target="_blank" style="color: var(--accent);">Windy Webcams</a>.</div>`;
      }
    }
  }

  async loadLightning(lat, lon) {
    if (!this.map || !this.lightningEnabled) return;
    if (!this.lightningLayerGroup) {
      this.lightningLayerGroup = L.layerGroup().addTo(this.map);
    }
    this.lightningLayerGroup.clearLayers();

    const countBadge = document.getElementById('lightningCountBadge');
    if (countBadge) countBadge.textContent = '...';

    try {
      const res = await fetch(`/api/lightning?lat=${lat}&lon=${lon}&radius=200`);
      if (!res.ok) return;
      const data = await res.json();

      const list = data.strikes || [];
      if (countBadge) {
        countBadge.textContent = `${data.totalInRadius}`;
        countBadge.title = `${data.totalInRadius} scariche rilevate negli ultimi 60 min nel raggio di 200 km`;
        if (data.totalInRadius > 0) {
          countBadge.style.background = 'rgba(234, 179, 8, 0.35)';
          countBadge.style.color = '#fff';
        } else {
          countBadge.style.background = 'rgba(250, 204, 21, 0.15)';
          countBadge.style.color = '#facc15';
        }
      }

      list.forEach((s) => {
        let color = '#fef08a';
        let pulseClass = 'strike-pulse-recent';
        if (s.ageMinutes > 30) {
          color = '#a855f7';
          pulseClass = 'strike-pulse-old';
        } else if (s.ageMinutes > 15) {
          color = '#f97316';
          pulseClass = 'strike-pulse-mid';
        } else if (s.ageMinutes > 5) {
          color = '#facc15';
          pulseClass = 'strike-pulse-fresh';
        }

        const strikeIcon = L.divIcon({
          className: 'leaflet-strike-div-icon',
          html: `<div class="strike-marker ${pulseClass}" style="background-color: ${color};" title="⚡ Scarica ${s.ageMinutes} min fa">⚡</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        const marker = L.marker([s.lat, s.lon], { icon: strikeIcon, zIndexOffset: 5000 });
        const timeStr = new Date(s.time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        marker.bindPopup(`
          <div style="font-family: sans-serif; color: #0f172a; padding: 4px; min-width: 170px;">
            <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 4px; color: #b45309; display: flex; align-items: center; gap: 4px;">
              ⚡ Scarica Elettrica
            </div>
            <div style="font-size: 0.8rem; margin-bottom: 3px;">
              <strong>Orario:</strong> ${timeStr} (<strong>${s.ageMinutes} min fa</strong>)
            </div>
            <div style="font-size: 0.78rem; color: #475569;">
              <strong>Distanza da qui:</strong> ${s.distanceKm} km
            </div>
          </div>
        `);

        marker.addTo(this.lightningLayerGroup);
      });
    } catch (err) {
      console.warn('Errore recupero fulmini:', err);
    }
  }
}
