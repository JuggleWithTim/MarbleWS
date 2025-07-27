class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.camera = {
            x: 0,
            y: 0,
            zoom: 1
        };
        this.images = new Map();
        this.loadedImages = new Set();
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    setCamera(x, y, zoom = 1) {
        this.camera.x = x;
        this.camera.y = y;
        this.camera.zoom = zoom;
    }

    worldToScreen(worldX, worldY) {
        return {
            x: (worldX - this.camera.x) * this.camera.zoom + this.canvas.width / 2,
            y: (worldY - this.camera.y) * this.camera.zoom + this.canvas.height / 2
        };
    }

    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.canvas.width / 2) / this.camera.zoom + this.camera.x,
            y: (screenY - this.canvas.height / 2) / this.camera.zoom + this.camera.y
        };
    }

    async loadImage(url) {
        if (this.images.has(url)) {
            return this.images.get(url);
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                this.images.set(url, img);
                this.loadedImages.add(url);
                resolve(img);
            };
            img.onerror = () => {
                console.warn(`Failed to load image: ${url}`);
                resolve(null);
            };
            img.src = url;
        });
    }

    drawRectangle(x, y, width, height, color, angle = 0) {
        const screenPos = this.worldToScreen(x, y);
        
        this.ctx.save();
        this.ctx.translate(screenPos.x, screenPos.y);
        this.ctx.rotate(angle);
        this.ctx.fillStyle = color;
        this.ctx.fillRect(-width/2 * this.camera.zoom, -height/2 * this.camera.zoom, 
                         width * this.camera.zoom, height * this.camera.zoom);
        this.ctx.restore();
    }

    drawCircle(x, y, radius, color, angle = 0) {
        const screenPos = this.worldToScreen(x, y);
        
        this.ctx.save();
        this.ctx.translate(screenPos.x, screenPos.y);
        this.ctx.rotate(angle);
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, radius * this.camera.zoom, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }

    async drawImage(imageUrl, x, y, width, height, angle = 0) {
        const img = await this.loadImage(imageUrl);
        if (!img) return;

        const screenPos = this.worldToScreen(x, y);
        
        this.ctx.save();
        this.ctx.translate(screenPos.x, screenPos.y);
        this.ctx.rotate(angle);
        this.ctx.drawImage(img, 
            -width/2 * this.camera.zoom, -height/2 * this.camera.zoom,
            width * this.camera.zoom, height * this.camera.zoom);
        this.ctx.restore();
    }

    drawUFO(x, y, color = '#4ecdc4', beamActive = false) {
        const screenPos = this.worldToScreen(x, y);
        const size = 30 * this.camera.zoom;
        
        this.ctx.save();
        this.ctx.translate(screenPos.x, screenPos.y);
        
        // UFO body
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, size, size * 0.6, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // UFO dome
        this.ctx.fillStyle = '#ffffff';
        this.ctx.globalAlpha = 0.7;
        this.ctx.beginPath();
        this.ctx.ellipse(0, -size * 0.2, size * 0.6, size * 0.4, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1;
        
        // UFO lights
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const lightX = Math.cos(angle) * size * 0.8;
            const lightY = Math.sin(angle) * size * 0.5;
            
            this.ctx.fillStyle = '#ffff00';
            this.ctx.beginPath();
            this.ctx.arc(lightX, lightY, size * 0.1, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Beam effect
        if (beamActive) {
            this.ctx.fillStyle = 'rgba(76, 205, 196, 0.3)';
            this.ctx.beginPath();
            this.ctx.moveTo(-size * 0.5, size * 0.6);
            this.ctx.lineTo(size * 0.5, size * 0.6);
            this.ctx.lineTo(size * 1.5, size * 3);
            this.ctx.lineTo(-size * 1.5, size * 3);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Beam particles
            for (let i = 0; i < 10; i++) {
                const particleX = (Math.random() - 0.5) * size * 2;
                const particleY = size * 0.6 + Math.random() * size * 2.4;
                
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                this.ctx.beginPath();
                this.ctx.arc(particleX, particleY, size * 0.05, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        
        this.ctx.restore();
    }

    drawMarble(x, y, angle = 0) {
        const screenPos = this.worldToScreen(x, y);
        const radius = 30 * this.camera.zoom;
        
        this.ctx.save();
        this.ctx.translate(screenPos.x, screenPos.y);
        
        // Marble gradient
        const gradient = this.ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 0, 0, 0, radius);
        gradient.addColorStop(0, '#ff9999');
        gradient.addColorStop(1, '#ff6b6b');
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Marble highlight
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.beginPath();
        this.ctx.arc(-radius * 0.3, -radius * 0.3, radius * 0.3, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }

    async drawEmote(x, y, imageUrl, angle = 0) {
        const img = await this.loadImage(imageUrl);
        if (!img) {
            // Fallback to colored circle if image fails to load
            this.drawCircle(x, y, 20, '#ffff00', angle);
            return;
        }

        const screenPos = this.worldToScreen(x, y);
        const size = 64;
        
        this.ctx.save();
        this.ctx.translate(screenPos.x, screenPos.y);
        this.ctx.rotate(angle);
        this.ctx.drawImage(img, -size/2, -size/2, size, size);
        this.ctx.restore();
    }

    drawLevelObject(obj) {
        if (obj.shape === 'rectangle') {
            this.drawRectangle(obj.x, obj.y, obj.width, obj.height, obj.color, obj.angle);
        } else if (obj.shape === 'circle') {
            this.drawCircle(obj.x, obj.y, obj.radius, obj.color, obj.angle);
        }

        // Draw special property indicators
        if (obj.properties) {
            const screenPos = this.worldToScreen(obj.x, obj.y);
            
            if (obj.properties.includes('spawnpoint')) {
                this.ctx.fillStyle = '#00ff00';
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('SPAWN', screenPos.x, screenPos.y - 20);
            }
            
            if (obj.properties.includes('goal')) {
                this.ctx.fillStyle = '#ffff00';
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('GOAL', screenPos.x, screenPos.y - 20);
                
                // Goal glow effect
                this.ctx.save();
                this.ctx.globalAlpha = 0.3;
                this.ctx.shadowColor = '#ffff00';
                this.ctx.shadowBlur = 20;
                if (obj.shape === 'rectangle') {
                    this.drawRectangle(obj.x, obj.y, obj.width + 10, obj.height + 10, '#ffff00', obj.angle);
                } else if (obj.shape === 'circle') {
                    this.drawCircle(obj.x, obj.y, obj.radius + 5, '#ffff00', obj.angle);
                }
                this.ctx.restore();
            }
        }
    }

    drawPlayerName(x, y, name, color = '#ffffff') {
        const screenPos = this.worldToScreen(x, y - 50);
        
        this.ctx.fillStyle = color;
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 3;
        this.ctx.strokeText(name, screenPos.x, screenPos.y);
        this.ctx.fillText(name, screenPos.x, screenPos.y);
    }

    drawDebugInfo(gameState) {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'left';
        
        let y = 20;
        const lineHeight = 15;
        
        this.ctx.fillText(`Players: ${gameState.players.length}`, 10, y);
        y += lineHeight;
        this.ctx.fillText(`Marbles: ${gameState.marbles.length}`, 10, y);
        y += lineHeight;
        this.ctx.fillText(`Emotes: ${gameState.emotes.length}`, 10, y);
        y += lineHeight;
        this.ctx.fillText(`Objects: ${gameState.levelObjects.length}`, 10, y);
        y += lineHeight;
        this.ctx.fillText(`Camera: ${Math.round(this.camera.x)}, ${Math.round(this.camera.y)}`, 10, y);
    }
}
