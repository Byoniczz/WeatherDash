/**
 * WeatherDash - Dynamic Atmospheric Canvas Effects Engine
 */

class WeatherCanvasEffects {
  constructor(canvasId = 'weatherCanvas') {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.particles = [];
    this.animId = null;
    this.weatherType = 'none'; // 'rain', 'snow', 'thunder', 'stars', 'sun', 'fog', 'none'
    this.enabled = localStorage.getItem('wd_canvas_effects') !== 'false';
    this.width = 0;
    this.height = 0;
    this.lastFlash = 0;
    this.flashOpacity = 0;

    if (this.canvas) {
      this.resize();
      window.addEventListener('resize', () => this.resize());
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.stop();
        else if (this.enabled) this.start();
      });
    }
  }

  resize() {
    if (!this.canvas) return;
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
    this.initParticles();
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('wd_canvas_effects', this.enabled ? 'true' : 'false');
    const btn = document.getElementById('canvasEffectsToggleBtn');
    if (btn) {
      btn.classList.toggle('active', this.enabled);
    }
    if (this.enabled) {
      this.start();
    } else {
      this.stop();
      if (this.ctx) this.ctx.clearRect(0, 0, this.width, this.height);
    }
    return this.enabled;
  }

  setCondition(wmoCode, isDay = 1) {
    let type = 'none';

    // Temporale
    if (wmoCode >= 95) {
      type = 'thunder';
    }
    // Neve
    else if ((wmoCode >= 71 && wmoCode <= 77) || wmoCode === 85 || wmoCode === 86) {
      type = 'snow';
    }
    // Pioggia / Rovesci / Pioggerella
    else if ((wmoCode >= 51 && wmoCode <= 67) || (wmoCode >= 80 && wmoCode <= 82)) {
      type = 'rain';
    }
    // Nebbia
    else if (wmoCode === 45 || wmoCode === 48) {
      type = 'fog';
    }
    // Sereno o poco nuvoloso
    else if (wmoCode <= 2) {
      type = isDay ? 'sun' : 'stars';
    }

    if (this.weatherType !== type) {
      this.weatherType = type;
      this.initParticles();
      if (this.enabled) this.start();
    }
  }

  initParticles() {
    this.particles = [];
    if (!this.width || !this.height) return;

    if (this.weatherType === 'rain' || this.weatherType === 'thunder') {
      const count = this.weatherType === 'thunder' ? 120 : 80;
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          len: 12 + Math.random() * 16,
          speed: 12 + Math.random() * 8,
          opacity: 0.15 + Math.random() * 0.35,
          width: 1 + Math.random() * 1.2
        });
      }
    } else if (this.weatherType === 'snow') {
      for (let i = 0; i < 70; i++) {
        this.particles.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          radius: 1.5 + Math.random() * 2.5,
          speedY: 0.8 + Math.random() * 1.5,
          speedX: (Math.random() - 0.5) * 0.8,
          opacity: 0.2 + Math.random() * 0.6
        });
      }
    } else if (this.weatherType === 'stars') {
      for (let i = 0; i < 60; i++) {
        this.particles.push({
          x: Math.random() * this.width,
          y: Math.random() * (this.height * 0.7),
          radius: 0.8 + Math.random() * 1.5,
          alpha: 0.2 + Math.random() * 0.7,
          twinkleSpeed: 0.01 + Math.random() * 0.02
        });
      }
    } else if (this.weatherType === 'sun') {
      for (let i = 0; i < 25; i++) {
        this.particles.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          radius: 2 + Math.random() * 4,
          speedY: -0.2 - Math.random() * 0.4,
          speedX: (Math.random() - 0.5) * 0.3,
          alpha: 0.05 + Math.random() * 0.15
        });
      }
    }
  }

  start() {
    if (!this.animId && this.ctx && this.enabled) {
      const loop = () => {
        this.render();
        this.animId = requestAnimationFrame(loop);
      };
      this.animId = requestAnimationFrame(loop);
    }
  }

  stop() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  render() {
    if (!this.ctx || !this.enabled) return;
    this.ctx.clearRect(0, 0, this.width, this.height);

    const now = Date.now();

    if (this.weatherType === 'rain' || this.weatherType === 'thunder') {
      // Temporale: lampi periodici
      if (this.weatherType === 'thunder') {
        if (now - this.lastFlash > 7000 && Math.random() < 0.015) {
          this.lastFlash = now;
          this.flashOpacity = 0.35 + Math.random() * 0.25;
        }
        if (this.flashOpacity > 0) {
          this.ctx.fillStyle = `rgba(255, 255, 255, ${this.flashOpacity})`;
          this.ctx.fillRect(0, 0, this.width, this.height);
          this.flashOpacity -= 0.03;
        }
      }

      this.ctx.strokeStyle = 'rgba(186, 230, 253, 0.4)';
      this.ctx.lineCap = 'round';

      for (const p of this.particles) {
        this.ctx.lineWidth = p.width;
        this.ctx.beginPath();
        this.ctx.moveTo(p.x, p.y);
        this.ctx.lineTo(p.x - 2, p.y + p.len);
        this.ctx.stroke();

        p.y += p.speed;
        p.x -= 1;

        if (p.y > this.height) {
          p.y = -p.len;
          p.x = Math.random() * this.width;
        }
      }
    } else if (this.weatherType === 'snow') {
      this.ctx.fillStyle = '#ffffff';

      for (const p of this.particles) {
        this.ctx.globalAlpha = p.opacity;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        this.ctx.fill();

        p.y += p.speedY;
        p.x += Math.sin(p.y * 0.02) * 0.5 + p.speedX;

        if (p.y > this.height) {
          p.y = -p.radius;
          p.x = Math.random() * this.width;
        }
      }
      this.ctx.globalAlpha = 1;
    } else if (this.weatherType === 'stars') {
      for (const p of this.particles) {
        p.alpha += p.twinkleSpeed;
        if (p.alpha > 0.9 || p.alpha < 0.2) p.twinkleSpeed = -p.twinkleSpeed;

        this.ctx.fillStyle = `rgba(248, 250, 252, ${Math.max(0.1, Math.min(1, p.alpha))})`;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        this.ctx.fill();
      }
    } else if (this.weatherType === 'sun') {
      // Glow caldo solare in alto a destra
      const grad = this.ctx.createRadialGradient(this.width * 0.85, 80, 20, this.width * 0.85, 80, 320);
      grad.addColorStop(0, 'rgba(251, 191, 36, 0.08)');
      grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, this.width, this.height);

      // Particelle dorate fluttuanti
      for (const p of this.particles) {
        this.ctx.fillStyle = `rgba(251, 191, 36, ${p.alpha})`;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        this.ctx.fill();

        p.y += p.speedY;
        p.x += p.speedX;

        if (p.y < -p.radius) {
          p.y = this.height + p.radius;
          p.x = Math.random() * this.width;
        }
      }
    }
  }
}
