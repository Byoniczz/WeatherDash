# 🌤️ WeatherDash

<div align="center">

![WeatherDash Banner](https://img.shields.io/badge/WeatherDash-v1.0.0-38bdf8?style=for-the-badge&logo=cloud&logoColor=white)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Portainer Ready](https://img.shields.io/badge/Portainer-Stack-13BEF9?style=for-the-badge&logo=portainer&logoColor=white)](https://www.portainer.io/)
[![Node.js](https://img.shields.io/badge/Node.js-20_Alpine-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Telegram Bot](https://img.shields.io/badge/Telegram-Notifications-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://telegram.org/)
[![Home Assistant](https://img.shields.io/badge/Home_Assistant-REST_Sensors-41BDF5?style=for-the-badge&logo=home-assistant&logoColor=white)](https://www.home-assistant.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**La stazione meteo e dashboard intelligente definitiva per la tua casa, server domestico o NAS.**  
Previsioni orarie e a 14 giorni, radar pioggia in tempo reale, rischio grandine con indici CAPE, webcams live, monitoraggio pollini, qualità dell'aria, briefing mattutino su Telegram e sensori pronti per Home Assistant.

[Funzionalità](#-funzionalità-principali) • [Deploy con Portainer](#-deploy-su-portainer) • [Docker Compose](#-avvio-con-docker-compose) • [Telegram Bot](#-configurazione-telegram-bot) • [Home Assistant](#-integrazione-home-assistant)

</div>

---

## ✨ Funzionalità Principali

### 📍 Località & Ricerca Intelligente
- **Ricerca globale con autocompletamento rapido**: trova qualsiasi comune, città o frazione nel mondo (con supporto CAP e nomi in italiano).
- **Geolocalizzazione GPS in 1 clic**: rileva istantaneamente la tua posizione attuale dal browser.
- **Gestione Località Preferite**: salva le tue località con etichette personalizzate (*"Casa"*, *"Lavoro"*, *"Montagna"*).
- **Località Predefinita Persistente**: memorizzata sul volume Docker (`/app/data/favorites.json`) e condivisa tra tutti i tuoi dispositivi.

### 🌧️ Radar Precipitazioni & Nubi (RainViewer v2 + Leaflet)
- **Mappa radar animata ad alta definizione**: traccia pioggia, rovesci temporaleschi e nevicate con aggiornamento ogni 10 minuti.
- **Controlli di riproduzione temporale**: Play/Pausa, navigazione frame per frame e slider che copre le ultime 2 ore fino al nowcast immediato.
- **Layer selezionabili**: Radar precipitazioni e Mappa Satellitare Infrarossi (copertura nuvolosa).
- **Stili mappa base**: Mappa Scura (Dark Matter), OpenStreetMap standard, Satellite HD e Mappa Chiara.

### 📹 Webcams Live ad Alta Definizione
- **Integrazione Open Data Hub**: centinaia di webcam panoramiche montane e urbane (Alpi, Dolomiti, Nord Italia ed Europa).
- **Supporto Windy Webcams v3**: visualizza le webcam mondiali semplicemente inserendo la tua chiave gratuita nelle impostazioni.
- **Mappa interattiva & Galleria**: marker dedicati sulla mappa radar con anteprima dell'ultimo scatto e galleria a scorrimento rapido in basso con zoom al clic.

### 🧊 Previsione Rischio Grandine & Temporali Severi
- **Analisi termodinamica avanzata**: calcolo automatico su parametri fisici della colonna d'aria (**CAPE** - *Convective Available Potential Energy* e **Lifted Index**).
- **Classificazione del rischio a 4 livelli**: Basso, Moderato, Elevato, Estremo.
- **Dettagli orari**: picco orario stimato del temporale e indice di severità.
- **Notifica automatica su Telegram**: invio di un allarme istantaneo per tutte le tue località salvate prima dell'inizio del fenomeno.

### ☕ Morning Briefing & Notifiche Telegram
- **Briefing Mattutino Quotidiano**: messaggio riassuntivo completo inviato automaticamente ogni mattina al tuo orario preferito (es. 07:30):
  - 🌤️ Previsioni della giornata e temperature (Min/Max/Attuale).
  - ☂️ Allerta pioggia e rischio grandine.
  - 🧺 Indici pratici: bucato all'aperto, lavaggio auto, miglior orario per lo sport.
  - ⚡ Stima produzione fotovoltaica in kWh e risparmio stimato in Euro.
  - 🍃 Qualità dell'aria e pollini prevalenti.
  - 👕 Consiglio sull'outfit del giorno in base al profilo termico.
- **Allerte Pioggia Imminenti**: avviso automatico sullo smartphone 15-30 minuti prima dell'arrivo della pioggia.
- **Pulsante di test integrato**: verifica istantanea del bot Telegram direttamente dal pannello impostazioni.

### 🍃 Qualità dell'Aria & Monitoraggio Pollini
- **European AQI (Indice Europeo Qualità dell'Aria)** con indicatore circolare colorato e consigli sanitari.
- **Inquinanti dettagliati**: PM2.5, PM10, Biossido di azoto (NO₂), Ozono (O₃), Biossido di zolfo (SO₂), Monossido di carbonio (CO) e Polveri sahariane (Dust).
- **Monitoraggio 6 Pollini Allergenici Europei**: Graminacee, Betulla, Olivo, Ambrosia, Ontano, Artemisia con concentrazione in grani/m³ e livello di allerta.

### 💡 Indici Pratici & Fotovoltaico
- **🧺 Asciugatura Bucato**: stima delle ore necessarie per asciugare i panni all'aperto basata su vento, umidità, radiazione e deficit igrometrico.
- **🚗 Lavaggio Auto**: analizza la finestra meteo dei successivi 4 giorni e la presenza di sabbia sahariana nell'aria.
- **🏃 Miglior Orario Sport**: calcola la finestra oraria con temperatura ideale, vento debole e assenza di precipitazioni.
- **⚡ Stima Fotovoltaico**: calcola la produzione giornaliera stimata (kWh) e il risparmio economico in base alla potenza (kWp) configurabile del tuo impianto solare.

### 🏠 Integrazione Nativia Home Assistant
- **Endpoint REST dedicato**: `GET http://<IP_SERVER>:3000/api/ha/sensors`.
- Esporta in formato JSON tutti i valori della località predefinita per creare sensori e automazioni in Home Assistant.

### ✨ Grafica Avanzata & Effetti Atmosferici
- **Effetti particellari Canvas**: pioggia, fiocchi di neve, fulmini temporaleschi sincronizzati, cielo stellato notturno o bagliore solare (attivabili/disattivabili a piacere).
- **Confronto Storico Climatico**: rileva l'anomalia termica rispetto alla media storica degli ultimi decenni (es. *+2.1°C vs media storica*).
- **Modalità Kiosk / Fullscreen**: perfetta per tablet a parete o vecchi schermi dedicati alla domotica.

---

## 🚀 Deploy su Portainer

Puoi distribuire WeatherDash sul tuo Portainer in due modalità:

### Opzione A: Tramite Git Repository (Consigliato)
1. Apri **Portainer** $\rightarrow$ **Stacks** $\rightarrow$ **Add stack**.
2. Nome stack: `weatherdash`.
3. In **Build method**, seleziona **Repository**.
4. Inserisci l'URL del tuo repository Git.
5. Compose path: `docker-compose.yml`.
6. Clicca su **Deploy the stack**. Portainer scaricherà il repo, compilerà l'immagine e avvierà il servizio.

### Opzione B: Tramite Web Editor
1. Compila l'immagine sul tuo host/server:
   ```bash
   docker build -t weatherdash:latest .
   ```
2. Apri **Portainer** $\rightarrow$ **Stacks** $\rightarrow$ **Add stack**.
3. Seleziona **Web editor** e incolla la configurazione:

```yaml
version: '3.8'

services:
  weatherdash:
    image: weatherdash:latest
    container_name: weatherdash
    restart: unless-stopped
    ports:
      - "${HOST_PORT:-3005}:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    volumes:
      # Cartella fisica sul server host per consultare/salvare direttamente i file di configurazione
      - /docker/weatherdash:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```
4. Clicca su **Deploy the stack**.

---

## 🐳 Avvio con Docker Compose

Se preferisci usare direttamente il terminale con Docker Compose:

```bash
# Avvio in background
docker compose up -d

# Visualizza i log in tempo reale
docker compose logs -f

# Arresta il container
docker compose down
```

L'applicazione sarà accessibile su:
👉 **`http://localhost:3000`** (oppure `http://IP-DEL-TUO-SERVER:3000`).

---

## 💻 Esecuzione Standalone (Node.js)

Se desideri eseguire WeatherDash direttamente senza Docker (richiede Node.js 18+):

```bash
# 1. Installa le dipendenze
npm install

# 2. Avvia il server
npm start
```

---

## 🤖 Configurazione Telegram Bot

Ricevere le allerte meteo e il briefing mattutino richiede meno di 1 minuto:

1. **Crea il tuo Bot**:
   - Apri Telegram e cerca [@BotFather](https://t.me/BotFather).
   - Invia `/newbot` e segui le istruzioni.
   - Copia il **Token HTTP API** (es. `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`).
2. **Ottieni il tuo Chat ID**:
   - Cerca [@userinfobot](https://t.me/userinfobot) su Telegram e premi `/start`.
   - Copia il tuo **Id** numerico (es. `123456789`).
3. **Avvia la conversazione con il tuo bot**:
   - Cerca il nome del bot che hai appena creato e premi **/start**.
4. **Salva su WeatherDash**:
   - Apri la dashboard nel browser, clicca sull'icona delle **Impostazioni** (in alto a destra).
   - Incolla Token e Chat ID, attiva le spunte desiderate e clicca su **Invia Briefing di Prova**.

---

## 🏠 Integrazione Home Assistant

WeatherDash espone un endpoint nativo `http://<IP_WEATHERDASH>:3000/api/ha/sensors` con tutti i dati meteo, qualità dell'aria, rischio grandine e fotovoltaico.

Aggiungi semplicemente al tuo `configuration.yaml` in Home Assistant:

```yaml
sensor:
  - platform: rest
    name: WeatherDash
    resource: http://192.168.1.100:3000/api/ha/sensors # Sostituisci con l'IP del tuo server
    scan_interval: 300 # Aggiornamento ogni 5 minuti
    json_attributes:
      - location
      - apparent_temperature
      - humidity
      - pressure
      - wind_speed
      - wind_gusts
      - precipitation_now
      - precipitation_today
      - rain_expected_next_2h
      - rain_expected_in_minutes
      - hail_risk_level
      - hail_risk_percent
      - hail_alert_active
      - aqi_european
      - pm2_5
      - pm10
      - solar_estimated_kwh_today
    value_template: "{{ value_json.temperature }}"
    unit_of_measurement: "°C"

template:
  - sensor:
      - name: "WeatherDash Rischio Grandine"
        state: "{{ state_attr('sensor.weatherdash', 'hail_risk_level') }}"
        icon: "mdi:weather-hail"

      - name: "WeatherDash Produzione Solare Prevista"
        state: "{{ state_attr('sensor.weatherdash', 'solar_estimated_kwh_today') }}"
        unit_of_measurement: "kWh"
        icon: "mdi:solar-power"

      - name: "WeatherDash AQI Europeo"
        state: "{{ state_attr('sensor.weatherdash', 'aqi_european') }}"
        icon: "mdi:air-filter"
```

---

## 🔒 Sicurezza & Gestione Dati

- **Nessuna API Key Obbligatoria**: tutti i dati meteorologici, radar e satellitari provengono da provider aperti e gratuiti (Open-Meteo, RainViewer, Open Data Hub).
- **Zero Credenziali su Git**: la cartella `data/` contenente `settings.json` (token Telegram, impostazioni) e `favorites.json` è rigorosamente inserita in `.gitignore`.
- **Utente non-root nel Dockerfile**: il container viene eseguito sotto l'utente di sicurezza `node` per garantire la massima protezione del sistema host.

---

## 📡 API Reference

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/api/health` | `GET` | Healthcheck Docker (stato e uptime) |
| `/api/weather?lat=...&lon=...` | `GET` | Meteo orario, giornaliero (14 gg), nowcast minutely |
| `/api/airquality?lat=...&lon=...` | `GET` | AQI europeo e concentrazione inquinanti |
| `/api/pollen?lat=...&lon=...` | `GET` | Livelli 6 specie di pollini europei |
| `/api/webcams?lat=...&lon=...` | `GET` | Webcams live nel raggio di 80 km |
| `/api/ha/sensors` | `GET` | Sensori aggregati per Home Assistant |
| `/api/favorites` | `GET / POST` | Gestione elenco località preferite |
| `/api/settings` | `GET / POST` | Gestione impostazioni e credenziali bot |
| `/api/telegram/test` | `POST` | Invio messaggio di notifica test Telegram |
| `/api/telegram/briefing` | `POST` | Invio istantaneo del morning briefing |

---

## 🛠️ Stack Tecnologico

- **Runtime**: [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/)
- **Frontend**: Vanilla ES6+, CSS Moderno (Glassmorphism & Dark Mode), HTML5 Canvas FX
- **Mappe & Radar**: [Leaflet](https://leafletjs.com/) + [RainViewer API](https://www.rainviewer.com/api.html)
- **Grafici**: [Chart.js](https://www.chartjs.org/)
- **Dati Meteo & Clima**: [Open-Meteo API](https://open-meteo.com/)
- **Webcams**: [Open Data Hub](https://opendatahub.com/) & [Windy Webcams](https://api.windy.com/)

---

## 📄 Licenza

Distribuito sotto licenza **MIT**. Sentiti libero di usarlo, modificarlo e distribuirlo nel tuo ambiente personale o commerciale.
