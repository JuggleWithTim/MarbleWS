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
        this.goalParticles = []; // Active goal celebration particles
    }clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawBackground(imageUrl) {
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (imageUrl) {
            const cached = this.images.get(imageUrl);
            if (cached) {
                // Stretch background to full canvas
                this.ctx.drawImage(cached, 0, 0, this.canvas.width, this.canvas.height);
                return;
            }
            // Start async load, will be used next frame once loaded
            this.loadImage(imageUrl);
        }

        // Fallback gradient if no image or not yet loaded
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
    }async loadImage(url) {
        if (this.images.has(url)) {
            const cached = this.images.get(url);
            return Promise.resolve(cached);
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            // Removed crossOrigin to avoid blocking remote images without CORS
            // img.crossOrigin = 'anonymous';
            img.onload = () => {
                this.images.set(url, img);
                this.loadedImages.add(url);
                resolve(img);
            };
            img.onerror = () => {
                console.warn(`Failed to load image: ${url}`);
                this.images.set(url, null);
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

    drawUFO(x, y, color = '#4ecdc4', beamActive = false, appearance = null, game = null, scale = 1) {
        const screenPos = this.worldToScreen(x, y);
        const size = 30 * this.camera.zoom * scale;

        this.ctx.save();
        this.ctx.translate(screenPos.x, screenPos.y);

        // Check if player has custom appearance
        if (appearance && appearance.type === 'custom' && appearance.image) {
            // Try to draw custom UFO image
            const imageUrl = `img/ufo/${appearance.image}`;
            const img = this.images.get(imageUrl);

            if (img && img.complete) {
                // Draw custom image - center it properly like the default UFO
                // Use the same dimensions as the default UFO body (60x36) but scale to fit
                const ufoWidth = size * 2;  // 60 units wide (same as default)
                const ufoHeight = size * 1.2;  // 36 units tall (same as default)
                this.ctx.drawImage(img, -size, -size * 0.6, ufoWidth, ufoHeight);

                // Draw beam effect for custom UFOs too
                if (beamActive) {
                    this.drawBeamEffect(size);
                }
            } else {
                // Image not loaded yet or failed, fallback to default UFO
                this.drawDefaultUFO(size, color, beamActive);
                // Start loading the image if not already loading
                if (!img) {
                    this.loadImage(imageUrl);
                }
            }
        } else {
            // Use color from appearance or fallback to provided color
            const ufoColor = (appearance && appearance.color) ? appearance.color : color;
            this.drawDefaultUFO(size, ufoColor, beamActive);
        }

        // Draw passenger on top of UFO if one is selected
        if (appearance && appearance.passenger) {
            const passengerUrl = `img/passenger/${appearance.passenger}`;
            const passengerImg = this.images.get(passengerUrl);

            if (passengerImg && passengerImg.complete) {
                // Get custom dimensions from game data
                const passengerData = game && game.passengerData ? game.passengerData[appearance.passenger] : null;
                const passengerWidth = (passengerData && passengerData.width) ?
                    passengerData.width * this.camera.zoom * 0.8 * scale : size * 1.5;
                const passengerHeight = (passengerData && passengerData.height) ?
                    passengerData.height * this.camera.zoom * 0.8 * scale : size * 1.5;

                // Get configurable offsets from game data
                const passengerOffsetX = (passengerData && passengerData.offsetX !== undefined) ?
                    passengerData.offsetX * this.camera.zoom : 0;
                const passengerOffsetY = (passengerData && passengerData.offsetY !== undefined) ?
                    passengerData.offsetY * this.camera.zoom : 0;

                // Draw passenger image with configurable offsets
                // Position it slightly above the UFO center (bottom-aligned for consistency)
                this.ctx.drawImage(passengerImg,
                    -passengerWidth / 2 + passengerOffsetX, -passengerHeight - size * 0.05 + passengerOffsetY,
                    passengerWidth, passengerHeight);
            } else {
                // Start loading the passenger image if not already loading
                if (!passengerImg) {
                    this.loadImage(passengerUrl);
                }
            }
        }

        // Draw hat on top of passenger (or UFO if no passenger) if one is selected
        if (appearance && appearance.hat) {
            const hatUrl = `img/hat/${appearance.hat}`;
            const hatImg = this.images.get(hatUrl);

            if (hatImg && hatImg.complete) {
                // Get custom dimensions from game data
                const hatData = game && game.hatData ? game.hatData[appearance.hat] : null;
                const hatWidth = (hatData && hatData.width) ?
                    hatData.width * this.camera.zoom * 0.8 * scale : size * 1.2;
                const hatHeight = (hatData && hatData.height) ?
                    hatData.height * this.camera.zoom * 0.8 * scale : size * 1.2;

                // Get configurable offsets from game data
                const hatOffsetX = (hatData && hatData.offsetX !== undefined) ?
                    hatData.offsetX * this.camera.zoom : 0;
                const hatOffsetY = (hatData && hatData.offsetY !== undefined) ?
                    hatData.offsetY * this.camera.zoom : 0;

                // Position hat above passenger or UFO
                const baseY = (appearance.passenger) ? -size * 1.5 - size * 0.05 : -size * 0.6;

                // Draw hat image with configurable offsets
                this.ctx.drawImage(hatImg,
                    -hatWidth / 2 + hatOffsetX, baseY - hatHeight + (15 * this.camera.zoom * scale) + hatOffsetY,
                    hatWidth, hatHeight);
            } else {
                // Start loading the hat image if not already loading
                if (!hatImg) {
                    this.loadImage(hatUrl);
                }
            }
        }

        this.ctx.restore();
    }

    drawDefaultUFO(size, color, beamActive) {
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
            this.drawBeamEffect(size);
        }
    }

    drawBeamEffect(size) {
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

    drawMarble(x, y, angle = 0, color = '#ff6b6b', radiusOverride = 30) {
        const screenPos = this.worldToScreen(x, y);
        const radius = radiusOverride * this.camera.zoom;

        this.ctx.save();
        this.ctx.translate(screenPos.x, screenPos.y);

        // Parse the color to create a gradient based on the level's marble color
        const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (rgbMatch) {
            const r = parseInt(rgbMatch[1]);
            const g = parseInt(rgbMatch[2]);
            const b = parseInt(rgbMatch[3]);

            // Create a radial gradient based on the provided color - lighter at reflection point
            const gradient = this.ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 0, 0, 0, radius);
            const lighterColor = `rgba(${Math.min(255, r + 80)}, ${Math.min(255, g + 80)}, ${Math.min(255, b + 80)}, 1)`;
            const darkerColor = color;

            gradient.addColorStop(0, lighterColor);
            gradient.addColorStop(0.7, color);
            gradient.addColorStop(1, darkerColor);

            this.ctx.fillStyle = gradient;
        } else {
            // Fallback gradient if color parsing fails - create simple gradient
            const gradient = this.ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 0, 0, 0, radius);
            gradient.addColorStop(0, `rgba(255, 255, 255, 0.8)`);
            gradient.addColorStop(0.7, color);
            gradient.addColorStop(1, color);
            this.ctx.fillStyle = gradient;
        }

        this.ctx.beginPath();
        this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Marble highlight - always pure white for best contrast regardless of marble color
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.beginPath();
        this.ctx.arc(-radius * 0.3, -radius * 0.3, radius * 0.25, 0, Math.PI * 2);
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
        // Check if object has a background image
        if (obj.backgroundImage) {
            // Check if image is already loaded in cache
            const cachedImage = this.images.get(obj.backgroundImage);

            if (cachedImage instanceof HTMLImageElement && cachedImage.complete) {
                // Image is loaded, draw it synchronously
                if (obj.shape === 'rectangle') {
                    const screenPos = this.worldToScreen(obj.x, obj.y);

                    this.ctx.save();
                    this.ctx.translate(screenPos.x, screenPos.y);
                    this.ctx.rotate(obj.angle || 0);
                    this.ctx.drawImage(cachedImage,
                        -obj.width/2 * this.camera.zoom, -obj.height/2 * this.camera.zoom,
                        obj.width * this.camera.zoom, obj.height * this.camera.zoom);
                    this.ctx.restore();
                } else if (obj.shape === 'circle') {
                    // Create a circular clipping path
                    const screenPos = this.worldToScreen(obj.x, obj.y);

                    this.ctx.save();
                    this.ctx.translate(screenPos.x, screenPos.y);
                    if (obj.angle) this.ctx.rotate(obj.angle);

                    // Create clipping circle
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, obj.radius * this.camera.zoom, 0, Math.PI * 2);
                    this.ctx.clip();

                    // Draw the image
                    this.ctx.drawImage(cachedImage,
                        -obj.radius * this.camera.zoom, -obj.radius * this.camera.zoom,
                        obj.radius * 2 * this.camera.zoom, obj.radius * 2 * this.camera.zoom);

                    this.ctx.restore();
                }
            } else {
                // Image not loaded yet or failed, draw color fallback and start loading
                if (!cachedImage) {
                    this.loadImage(obj.backgroundImage); // Start loading if not already started
                }

                // Draw fallback
                if (obj.shape === 'rectangle') {
                    this.drawRectangle(obj.x, obj.y, obj.width, obj.height, obj.color, obj.angle);
                } else if (obj.shape === 'circle') {
                    this.drawCircle(obj.x, obj.y, obj.radius, obj.color, obj.angle);
                }
            }
        } else {
            // No background image, use regular drawing
            if (obj.shape === 'rectangle') {
                this.drawRectangle(obj.x, obj.y, obj.width, obj.height, obj.color, obj.angle);
            } else if (obj.shape === 'circle') {
                this.drawCircle(obj.x, obj.y, obj.radius, obj.color, obj.angle);
            }
        }

        // Draw special property indicators
        /*if (obj.properties) {
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
            }
        }*/
    }

    drawPlayerName(x, y, name, color = '#ffffff') {
        // const screenPos = this.worldToScreen(x, y - 50); //Renders name above UFO
        const screenPos = this.worldToScreen(x, y + 35); // Renders name below UFO

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

    // Trigger goal celebration particles
    triggerGoalParticles(x, y) {
        // Create 20 sparkling particles around the goal
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            const distance = 30 + Math.random() * 40; // Random distance from goal
            const speed = 50 + Math.random() * 100; // Random speed
            const lifetime = 1 + Math.random() * 2; // 1-3 seconds

            this.goalParticles.push({
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: lifetime,
                maxLife: lifetime,
                color: `hsl(${Math.random() * 60 + 30}, 100%, 70%)` // Yellow to orange hues
            });
        }
    }

    // Update and draw goal particles
    updateGoalParticles(deltaTime) {
        // Update particles
        this.goalParticles = this.goalParticles.filter(particle => {
            particle.x += particle.vx * deltaTime;
            particle.y += particle.vy * deltaTime;
            particle.vy += 200 * deltaTime; // Gravity
            particle.life -= deltaTime;

            return particle.life > 0;
        });

        // Draw particles
        this.goalParticles.forEach(particle => {
            const screenPos = this.worldToScreen(particle.x, particle.y);
            const alpha = particle.life / particle.maxLife;
            const size = (5 + particle.life * 10) * this.camera.zoom;

            this.ctx.save();
            this.ctx.globalAlpha = alpha;
            this.ctx.fillStyle = particle.color;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
            this.ctx.fill();

            // Add sparkle effect
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, size * 0.3, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.restore();
        });
    }

    drawStreamerClaw(clawPos) {
        const screenPos = this.worldToScreen(clawPos.x, clawPos.y);

        // Draw alien claw hand
        const clawSize = 40 * this.camera.zoom;

        this.ctx.save();
        this.ctx.translate(screenPos.x, screenPos.y);

        // Claw fingers (3 spread out fingers)
        this.ctx.strokeStyle = '#9b59b6';
        this.ctx.lineWidth = 3 * this.camera.zoom;
        this.ctx.lineCap = 'round';

        // Finger lines emanating from center
        for (let i = 0; i < 3; i++) {
            const angle = (i - 1) * 0.5; // Spread fingers: -0.5, 0, 0.5 radians
            const startX = 0;
            const startY = 0;
            const endX = Math.sin(angle) * clawSize;
            const endY = Math.cos(angle) * clawSize;

            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);
            this.ctx.lineTo(endX, endY);
            this.ctx.stroke();
        }

        // Claw palm/center (purple circle)
        this.ctx.beginPath();
        this.ctx.arc(0, 0, clawSize * 0.3, 0, Math.PI * 2);
        this.ctx.fillStyle = '#8e44ad';
        this.ctx.fill();

        // Add glow effect around the claw
        this.ctx.shadowColor = '#9b59b6';
        this.ctx.shadowBlur = 15;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, clawSize * 0.3, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        this.ctx.restore();
    }
}
