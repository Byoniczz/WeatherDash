# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

# Cartella di lavoro all'interno del container
WORKDIR /app

# Installazione curl per healthcheck
RUN apk add --no-cache curl

# Copia file delle dipendenze
COPY package*.json ./

# Installazione dipendenze di produzione
RUN npm ci --omit=dev || npm install --omit=dev

# Copia codice sorgente e file statici
COPY server.js ./
COPY public/ ./public/

# Crea cartella dati persistente per volumi Docker
RUN mkdir -p /app/data && chown -R node:node /app

# Switch a utente non-root per sicurezza
USER node

# Porta esposta
EXPOSE 3000

# Healthcheck automatico per Docker
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Comando di avvio
CMD ["node", "server.js"]
