/**
 * Weather Effects - Particle System & Animations
 * Creates immersive weather-reactive backgrounds
 */

class WeatherParticleSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.weatherType = 'clear';
        this.isRunning = false;
        this.animationFrame = null;

        // Bind methods
        this.animate = this.animate.bind(this);
        this.resize = this.resize.bind(this);

        // Set up resize handler
        window.addEventListener('resize', this.resize);
        this.resize();
    }

    resize() {
        if (!this.canvas) return;
        const parent = this.canvas.parentElement;
        if (!parent) return;

        this.canvas.width = parent.offsetWidth;
        this.canvas.height = parent.offsetHeight;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
    }

    setWeatherType(type) {
        this.weatherType = type;
        this.particles = [];

        // Generate particles based on weather type
        switch (type) {
            case 'rainy':
                this.createRainParticles();
                break;
            case 'stormy':
                this.createRainParticles(true);
                this.scheduleLightning();
                break;
            case 'snowy':
                this.createSnowParticles();
                break;
            case 'sunny':
                this.createSunParticles();
                break;
            case 'cloudy':
                this.createCloudParticles();
                break;
            default:
                // Clear - no particles
                break;
        }

        if (!this.isRunning && this.particles.length > 0) {
            this.start();
        }
    }

    createRainParticles(heavy = false) {
        const count = heavy ? 200 : 100;
        for (let i = 0; i < count; i++) {
            this.particles.push({
                type: 'rain',
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                length: Math.random() * 15 + 10,
                speed: Math.random() * 10 + 15,
                opacity: Math.random() * 0.3 + 0.2,
                wind: heavy ? Math.random() * 3 - 1.5 : 0
            });
        }
    }

    createSnowParticles() {
        const count = 80;
        for (let i = 0; i < count; i++) {
            this.particles.push({
                type: 'snow',
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                radius: Math.random() * 3 + 1,
                speed: Math.random() * 1 + 0.5,
                opacity: Math.random() * 0.5 + 0.3,
                wobble: Math.random() * Math.PI * 2,
                wobbleSpeed: Math.random() * 0.02 + 0.01
            });
        }
    }

    createSunParticles() {
        const count = 20;
        for (let i = 0; i < count; i++) {
            this.particles.push({
                type: 'sunray',
                x: Math.random() * this.width * 0.3,
                y: Math.random() * this.height * 0.3,
                length: Math.random() * 100 + 50,
                angle: Math.random() * Math.PI * 0.5 + Math.PI * 0.25,
                opacity: Math.random() * 0.1 + 0.02,
                pulseSpeed: Math.random() * 0.01 + 0.005,
                pulsePhase: Math.random() * Math.PI * 2
            });
        }

        // Add floating dust particles
        for (let i = 0; i < 30; i++) {
            this.particles.push({
                type: 'dust',
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                radius: Math.random() * 2 + 0.5,
                speedX: Math.random() * 0.5 - 0.25,
                speedY: Math.random() * 0.3 - 0.15,
                opacity: Math.random() * 0.3 + 0.1
            });
        }
    }

    createCloudParticles() {
        // Subtle floating particles for overcast
        const count = 15;
        for (let i = 0; i < count; i++) {
            this.particles.push({
                type: 'mist',
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                radius: Math.random() * 60 + 40,
                speedX: Math.random() * 0.3 - 0.15,
                opacity: Math.random() * 0.03 + 0.01
            });
        }
    }

    scheduleLightning() {
        if (this.weatherType !== 'stormy') return;

        // Random lightning flash
        const delay = Math.random() * 8000 + 4000;
        setTimeout(() => {
            this.triggerLightning();
            this.scheduleLightning();
        }, delay);
    }

    triggerLightning() {
        // Create flash element if it doesn't exist
        let flash = document.querySelector('.lightning-flash');
        if (!flash) {
            flash = document.createElement('div');
            flash.className = 'lightning-flash';
            document.getElementById('view-weather')?.appendChild(flash);
        }

        flash.classList.remove('active');
        void flash.offsetWidth; // Trigger reflow
        flash.classList.add('active');

        // Add a lightning bolt particle temporarily
        this.particles.push({
            type: 'lightning',
            x: Math.random() * this.width * 0.6 + this.width * 0.2,
            y: 0,
            branches: this.generateLightningPath(),
            opacity: 1,
            life: 10
        });
    }

    generateLightningPath() {
        const branches = [];
        let x = 0;
        let y = 0;
        const segments = Math.floor(Math.random() * 5) + 8;

        for (let i = 0; i < segments; i++) {
            const newX = x + (Math.random() * 60 - 30);
            const newY = y + (Math.random() * 40 + 20);
            branches.push({ x: newX, y: newY });

            // Random sub-branch
            if (Math.random() > 0.7) {
                const branchLength = Math.random() * 3 + 2;
                for (let j = 0; j < branchLength; j++) {
                    branches.push({
                        x: newX + (Math.random() * 40 - 20) * (j + 1) * 0.5,
                        y: newY + (Math.random() * 20 + 10) * (j + 1) * 0.3,
                        isBranch: true
                    });
                }
            }

            x = newX;
            y = newY;
        }

        return branches;
    }

    start() {
        this.isRunning = true;
        this.animate();
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }

    animate() {
        if (!this.isRunning || !this.ctx) return;

        this.ctx.clearRect(0, 0, this.width, this.height);

        // Update and draw particles
        this.particles = this.particles.filter(p => {
            this.updateParticle(p);
            this.drawParticle(p);
            return !p.dead;
        });

        this.animationFrame = requestAnimationFrame(this.animate);
    }

    updateParticle(p) {
        switch (p.type) {
            case 'rain':
                p.y += p.speed;
                p.x += p.wind;
                if (p.y > this.height) {
                    p.y = -p.length;
                    p.x = Math.random() * this.width;
                }
                break;

            case 'snow':
                p.y += p.speed;
                p.wobble += p.wobbleSpeed;
                p.x += Math.sin(p.wobble) * 0.5;
                if (p.y > this.height) {
                    p.y = -p.radius;
                    p.x = Math.random() * this.width;
                }
                break;

            case 'sunray':
                p.pulsePhase += p.pulseSpeed;
                p.currentOpacity = p.opacity * (0.5 + Math.sin(p.pulsePhase) * 0.5);
                break;

            case 'dust':
                p.x += p.speedX;
                p.y += p.speedY;
                if (p.x < 0) p.x = this.width;
                if (p.x > this.width) p.x = 0;
                if (p.y < 0) p.y = this.height;
                if (p.y > this.height) p.y = 0;
                break;

            case 'mist':
                p.x += p.speedX;
                if (p.x < -p.radius) p.x = this.width + p.radius;
                if (p.x > this.width + p.radius) p.x = -p.radius;
                break;

            case 'lightning':
                p.life--;
                p.opacity = p.life / 10;
                if (p.life <= 0) p.dead = true;
                break;
        }
    }

    drawParticle(p) {
        this.ctx.save();

        switch (p.type) {
            case 'rain':
                this.ctx.strokeStyle = `rgba(100, 150, 255, ${p.opacity})`;
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(p.x, p.y);
                this.ctx.lineTo(p.x + p.wind, p.y + p.length);
                this.ctx.stroke();
                break;

            case 'snow':
                this.ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                this.ctx.fill();
                break;

            case 'sunray':
                const gradient = this.ctx.createLinearGradient(
                    p.x, p.y,
                    p.x + Math.cos(p.angle) * p.length,
                    p.y + Math.sin(p.angle) * p.length
                );
                gradient.addColorStop(0, `rgba(251, 191, 36, ${p.currentOpacity || p.opacity})`);
                gradient.addColorStop(1, 'rgba(251, 191, 36, 0)');
                this.ctx.strokeStyle = gradient;
                this.ctx.lineWidth = 20;
                this.ctx.beginPath();
                this.ctx.moveTo(p.x, p.y);
                this.ctx.lineTo(
                    p.x + Math.cos(p.angle) * p.length,
                    p.y + Math.sin(p.angle) * p.length
                );
                this.ctx.stroke();
                break;

            case 'dust':
                this.ctx.fillStyle = `rgba(251, 191, 36, ${p.opacity})`;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                this.ctx.fill();
                break;

            case 'mist':
                const mistGradient = this.ctx.createRadialGradient(
                    p.x, p.y, 0,
                    p.x, p.y, p.radius
                );
                mistGradient.addColorStop(0, `rgba(148, 163, 184, ${p.opacity})`);
                mistGradient.addColorStop(1, 'rgba(148, 163, 184, 0)');
                this.ctx.fillStyle = mistGradient;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                this.ctx.fill();
                break;

            case 'lightning':
                if (p.branches && p.branches.length > 0) {
                    this.ctx.strokeStyle = `rgba(255, 255, 255, ${p.opacity})`;
                    this.ctx.lineWidth = 2;
                    this.ctx.shadowColor = 'rgba(168, 85, 247, 0.8)';
                    this.ctx.shadowBlur = 10;
                    this.ctx.beginPath();
                    this.ctx.moveTo(p.x, p.y);
                    let lastMain = { x: p.x, y: p.y };
                    p.branches.forEach(b => {
                        if (!b.isBranch) {
                            this.ctx.lineTo(p.x + b.x, b.y);
                            lastMain = { x: p.x + b.x, y: b.y };
                        }
                    });
                    this.ctx.stroke();

                    // Draw branches
                    this.ctx.lineWidth = 1;
                    p.branches.filter(b => b.isBranch).forEach(b => {
                        this.ctx.beginPath();
                        this.ctx.moveTo(lastMain.x, lastMain.y);
                        this.ctx.lineTo(p.x + b.x, b.y);
                        this.ctx.stroke();
                    });
                }
                break;
        }

        this.ctx.restore();
    }

    destroy() {
        this.stop();
        window.removeEventListener('resize', this.resize);
        this.particles = [];
    }
}

// Initialize when weather view loads
let weatherEffects = null;

document.addEventListener('viewLoaded', (e) => {
    if (e.detail?.view === 'weather') {
        if (!weatherEffects) {
            weatherEffects = new WeatherParticleSystem('weatherParticles');
        }
        weatherEffects.resize();
    }
});

// Clean up when leaving view
document.addEventListener('viewUnloaded', (e) => {
    if (e.detail?.view === 'weather' && weatherEffects) {
        weatherEffects.stop();
    }
});

// Export for global access
window.WeatherEffects = {
    setWeatherType: (type) => {
        if (weatherEffects) {
            weatherEffects.setWeatherType(type);
        }
    },
    stop: () => {
        if (weatherEffects) {
            weatherEffects.stop();
        }
    }
};
