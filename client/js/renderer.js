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
        this.scaledBackgrounds = new Map(); // url|canvasSize -> pre-scaled bitmap/canvas
        this.scaledObjectImages = new Map(); // url|shape|objectSize -> pre-scaled bitmap/canvas
        this.backgroundCacheCanvasSize = {
            width: canvas.width,
            height: canvas.height
        };
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

        this.invalidateBackgroundCacheIfCanvasChanged();

        if (imageUrl) {
            const cached = this.images.get(imageUrl);
            if (cached instanceof HTMLImageElement && cached.complete) {
                const scaledBackground = this.getOrCreateScaledBackground(imageUrl, cached);
                if (scaledBackground) {
                    // Draw pre-scaled background to avoid re-scaling giant sources every frame
                    this.ctx.drawImage(scaledBackground, 0, 0, this.canvas.width, this.canvas.height);
                    return;
                }

                // Fallback if pre-scaling fails for any reason
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
    }

    invalidateBackgroundCacheIfCanvasChanged() {
        if (
            this.backgroundCacheCanvasSize.width !== this.canvas.width ||
            this.backgroundCacheCanvasSize.height !== this.canvas.height
        ) {
            this.backgroundCacheCanvasSize.width = this.canvas.width;
            this.backgroundCacheCanvasSize.height = this.canvas.height;
            this.scaledBackgrounds.clear();
        }
    }

    createScaledBitmap(source, targetWidth, targetHeight) {
        const width = Math.max(1, Math.round(targetWidth));
        const height = Math.max(1, Math.round(targetHeight));

        if (!Number.isFinite(width) || !Number.isFinite(height)) {
            return null;
        }

        let buffer;
        if (typeof OffscreenCanvas !== 'undefined') {
            buffer = new OffscreenCanvas(width, height);
        } else {
            buffer = document.createElement('canvas');
            buffer.width = width;
            buffer.height = height;
        }

        const bufferCtx = buffer.getContext('2d');
        if (!bufferCtx) return null;

        bufferCtx.imageSmoothingEnabled = true;
        bufferCtx.drawImage(source, 0, 0, width, height);
        return buffer;
    }

    getOrCreateScaledBackground(imageUrl, sourceImage) {
        const key = `${imageUrl}|${this.canvas.width}x${this.canvas.height}`;
        if (this.scaledBackgrounds.has(key)) {
            return this.scaledBackgrounds.get(key);
        }

        const scaled = this.createScaledBitmap(sourceImage, this.canvas.width, this.canvas.height);
        if (scaled) {
            this.scaledBackgrounds.set(key, scaled);
        }
        return scaled;
    }

    getOrCreateScaledObjectImage(imageUrl, sourceImage, shape, width, height) {
        const normalizedWidth = Math.max(1, Math.round(width));
        const normalizedHeight = Math.max(1, Math.round(height));
        const key = `${imageUrl}|${shape}|${normalizedWidth}x${normalizedHeight}`;

        if (this.scaledObjectImages.has(key)) {
            return this.scaledObjectImages.get(key);
        }

        const scaled = this.createScaledBitmap(sourceImage, normalizedWidth, normalizedHeight);
        if (scaled) {
            this.scaledObjectImages.set(key, scaled);
        }
        return scaled;
    }

    async loadImage(url) {
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

    drawTriangle(x, y, vertices, color, angle = 0) {
        const screenPos = this.worldToScreen(x, y);

        this.ctx.save();
        this.ctx.translate(screenPos.x, screenPos.y);
        this.ctx.rotate(angle);
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(vertices[0].x * this.camera.zoom, vertices[0].y * this.camera.zoom);
        this.ctx.lineTo(vertices[1].x * this.camera.zoom, vertices[1].y * this.camera.zoom);
        this.ctx.lineTo(vertices[2].x * this.camera.zoom, vertices[2].y * this.camera.zoom);
        this.ctx.closePath();
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

    drawUFO(x, y, color = '#4ecdc4', beamActive = false, appearance = null, game = null, scale = 1, isGhost = false) {
        const screenPos = this.worldToScreen(x, y);
        const size = 30 * this.camera.zoom * scale;

        this.ctx.save();
        this.ctx.translate(screenPos.x, screenPos.y);

        if (isGhost) {
            this.ctx.globalAlpha = 0.45;
        }

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
        const resolvedVisual = this.resolveObjectVisualState(obj);
        const renderObj = {
            ...obj,
            color: resolvedVisual.color,
            backgroundImage: resolvedVisual.backgroundImage
        };

        // Check if object has a background image
        if (renderObj.backgroundImage) {
            // Check if image is already loaded in cache
            const cachedImage = this.images.get(renderObj.backgroundImage);

            if (cachedImage instanceof HTMLImageElement && cachedImage.complete) {
                // Image is loaded, draw it synchronously
                if (obj.shape === 'rectangle') {
                    const scaledImage = this.getOrCreateScaledObjectImage(
                        renderObj.backgroundImage,
                        cachedImage,
                        'rectangle',
                        renderObj.width,
                        renderObj.height
                    ) || cachedImage;
                    const screenPos = this.worldToScreen(renderObj.x, renderObj.y);

                    this.ctx.save();
                    this.ctx.translate(screenPos.x, screenPos.y);
                    this.ctx.rotate(renderObj.angle || 0);
                    this.ctx.drawImage(scaledImage,
                        -renderObj.width/2 * this.camera.zoom, -renderObj.height/2 * this.camera.zoom,
                        renderObj.width * this.camera.zoom, renderObj.height * this.camera.zoom);
                    this.ctx.restore();
                } else if (obj.shape === 'circle') {
                    const diameter = renderObj.radius * 2;
                    const scaledImage = this.getOrCreateScaledObjectImage(
                        renderObj.backgroundImage,
                        cachedImage,
                        'circle',
                        diameter,
                        diameter
                    ) || cachedImage;
                    // Create a circular clipping path
                    const screenPos = this.worldToScreen(renderObj.x, renderObj.y);

                    this.ctx.save();
                    this.ctx.translate(screenPos.x, screenPos.y);
                    if (renderObj.angle) this.ctx.rotate(renderObj.angle);

                    // Create clipping circle
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, renderObj.radius * this.camera.zoom, 0, Math.PI * 2);
                    this.ctx.clip();

                    // Draw the image
                    this.ctx.drawImage(scaledImage,
                        -renderObj.radius * this.camera.zoom, -renderObj.radius * this.camera.zoom,
                        renderObj.radius * 2 * this.camera.zoom, renderObj.radius * 2 * this.camera.zoom);

                    this.ctx.restore();
                } else if (obj.shape === 'triangle') {
                    const screenPos = this.worldToScreen(renderObj.x, renderObj.y);
                    const vertices = renderObj.vertices || [];
                    if (vertices.length === 3) {
                        this.ctx.save();
                        this.ctx.translate(screenPos.x, screenPos.y);
                        this.ctx.rotate(renderObj.angle || 0);
                        this.ctx.beginPath();
                        this.ctx.moveTo(vertices[0].x * this.camera.zoom, vertices[0].y * this.camera.zoom);
                        this.ctx.lineTo(vertices[1].x * this.camera.zoom, vertices[1].y * this.camera.zoom);
                        this.ctx.lineTo(vertices[2].x * this.camera.zoom, vertices[2].y * this.camera.zoom);
                        this.ctx.closePath();
                        this.ctx.clip();

                        const xs = vertices.map(vertex => vertex.x);
                        const ys = vertices.map(vertex => vertex.y);
                        const minX = Math.min(...xs);
                        const maxX = Math.max(...xs);
                        const minY = Math.min(...ys);
                        const maxY = Math.max(...ys);
                        const boundsWidth = maxX - minX;
                        const boundsHeight = maxY - minY;

                        const scaledImage = this.getOrCreateScaledObjectImage(
                            renderObj.backgroundImage,
                            cachedImage,
                            'triangle',
                            boundsWidth,
                            boundsHeight
                        ) || cachedImage;

                        this.ctx.drawImage(
                            scaledImage,
                            minX * this.camera.zoom,
                            minY * this.camera.zoom,
                            boundsWidth * this.camera.zoom,
                            boundsHeight * this.camera.zoom
                        );
                        this.ctx.restore();
                    }
                }
            } else {
                // Image not loaded yet or failed, draw color fallback and start loading
                if (!cachedImage) {
                    this.loadImage(renderObj.backgroundImage); // Start loading if not already started
                }

                // Draw fallback
                if (obj.shape === 'rectangle') {
                    this.drawRectangle(renderObj.x, renderObj.y, renderObj.width, renderObj.height, renderObj.color, renderObj.angle);
                } else if (obj.shape === 'circle') {
                    this.drawCircle(renderObj.x, renderObj.y, renderObj.radius, renderObj.color, renderObj.angle);
                } else if (obj.shape === 'triangle') {
                    if (renderObj.vertices && renderObj.vertices.length === 3) {
                        this.drawTriangle(renderObj.x, renderObj.y, renderObj.vertices, renderObj.color, renderObj.angle);
                    }
                }
            }
        } else {
            // No background image, use regular drawing
            if (obj.shape === 'rectangle') {
                this.drawRectangle(renderObj.x, renderObj.y, renderObj.width, renderObj.height, renderObj.color, renderObj.angle);
            } else if (obj.shape === 'circle') {
                this.drawCircle(renderObj.x, renderObj.y, renderObj.radius, renderObj.color, renderObj.angle);
            } else if (obj.shape === 'triangle') {
                if (renderObj.vertices && renderObj.vertices.length === 3) {
                    this.drawTriangle(renderObj.x, renderObj.y, renderObj.vertices, renderObj.color, renderObj.angle);
                }
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

    resolveObjectVisualState(obj) {
        const visual = {
            color: obj.color,
            backgroundImage: obj.backgroundImage
        };

        if (obj.properties?.includes('door')) {
            const open = !!obj.doorOpen;
            visual.color = open ? (obj.doorOpenColor || obj.color) : (obj.doorClosedColor || obj.color);
            visual.backgroundImage = open ? (obj.doorOpenImage || obj.backgroundImage) : (obj.doorClosedImage || obj.backgroundImage);
            return visual;
        }

        if (obj.properties?.includes('button')) {
            const active = !!obj.buttonActive;
            visual.color = active ? (obj.buttonActiveColor || obj.color) : (obj.buttonInactiveColor || obj.color);
            visual.backgroundImage = active ? (obj.buttonActiveImage || obj.backgroundImage) : (obj.buttonInactiveImage || obj.backgroundImage);
        }

        return visual;
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

    drawSpeechBubble(x, y, text, emotes = []) {
        const screenPos = this.worldToScreen(x, y - 60);
        const paddingX = 10;
        const paddingY = 6;
        const maxWidth = 220;
        const lineHeight = 16;
        const radius = 8;
        const emoteSize = 18;

        this.ctx.save();
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';

        const tokens = this.buildSpeechTokens(text || '', emotes || []);
        const lines = [];
        let currentLine = [];
        let currentWidth = 0;

        const flushLine = () => {
            if (currentLine.length) {
                lines.push({ tokens: currentLine, width: currentWidth });
                currentLine = [];
                currentWidth = 0;
            }
        };

        tokens.forEach(token => {
            const tokenWidth = token.type === 'emote'
                ? emoteSize
                : this.ctx.measureText(token.text).width;

            if (token.type === 'space') {
                if (currentLine.length === 0) {
                    return;
                }

                if (currentWidth + tokenWidth > maxWidth) {
                    flushLine();
                    return;
                }

                currentLine.push(token);
                currentWidth += tokenWidth;
                return;
            }

            if (currentWidth + tokenWidth > maxWidth && currentLine.length > 0) {
                flushLine();
            }

            currentLine.push(token);
            currentWidth += tokenWidth;
        });

        flushLine();

        if (lines.length === 0) {
            lines.push({ tokens: [{ type: 'text', text: '' }], width: 0 });
        }

        const textWidth = Math.min(
            maxWidth,
            Math.max(...lines.map(line => line.width), 0)
        );
        const bubbleWidth = textWidth + paddingX * 2;
        const bubbleHeight = lines.length * lineHeight + paddingY * 2;
        const bubbleX = screenPos.x - bubbleWidth / 2;
        const bubbleY = screenPos.y - bubbleHeight;

        // Bubble background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.lineWidth = 2;

        this.ctx.beginPath();
        this.ctx.moveTo(bubbleX + radius, bubbleY);
        this.ctx.lineTo(bubbleX + bubbleWidth - radius, bubbleY);
        this.ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY, bubbleX + bubbleWidth, bubbleY + radius);
        this.ctx.lineTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight - radius);
        this.ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight, bubbleX + bubbleWidth - radius, bubbleY + bubbleHeight);
        this.ctx.lineTo(bubbleX + bubbleWidth / 2 + 8, bubbleY + bubbleHeight);
        this.ctx.lineTo(bubbleX + bubbleWidth / 2, bubbleY + bubbleHeight + 10);
        this.ctx.lineTo(bubbleX + bubbleWidth / 2 - 8, bubbleY + bubbleHeight);
        this.ctx.lineTo(bubbleX + radius, bubbleY + bubbleHeight);
        this.ctx.quadraticCurveTo(bubbleX, bubbleY + bubbleHeight, bubbleX, bubbleY + bubbleHeight - radius);
        this.ctx.lineTo(bubbleX, bubbleY + radius);
        this.ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + radius, bubbleY);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        // Text
        this.ctx.fillStyle = '#ffffff';
        lines.forEach((line, index) => {
            const lineY = bubbleY + paddingY + lineHeight / 2 + index * lineHeight;
            let cursorX = screenPos.x - line.width / 2;

            line.tokens.forEach(token => {
                if (token.type === 'space') {
                    cursorX += this.ctx.measureText(token.text).width;
                    return;
                }

                if (token.type === 'emote') {
                    const img = this.images.get(token.url);
                    if (img && img.complete) {
                        this.ctx.drawImage(img, cursorX, lineY - emoteSize / 2, emoteSize, emoteSize);
                    } else {
                        if (!img) {
                            this.loadImage(token.url);
                        }
                        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                        this.ctx.fillRect(cursorX, lineY - emoteSize / 2, emoteSize, emoteSize);
                        this.ctx.fillStyle = '#ffffff';
                    }
                    cursorX += emoteSize;
                    return;
                }

                this.ctx.fillText(token.text, cursorX, lineY);
                cursorX += this.ctx.measureText(token.text).width;
            });
        });

        this.ctx.restore();
    }

    buildSpeechTokens(text, emotes) {
        if (!emotes || emotes.length === 0) {
            return text.split(/(\s+)/).filter(part => part.length).map(part => {
                if (/^\s+$/.test(part)) {
                    return { type: 'space', text: part };
                }
                return { type: 'text', text: part };
            });
        }

        const sortedEmotes = [...emotes].sort((a, b) => a.start - b.start);
        const tokens = [];
        let index = 0;

        sortedEmotes.forEach(emote => {
            if (emote.start > index) {
                const segment = text.slice(index, emote.start);
                segment.split(/(\s+)/).filter(part => part.length).forEach(part => {
                    if (/^\s+$/.test(part)) {
                        tokens.push({ type: 'space', text: part });
                    } else {
                        tokens.push({ type: 'text', text: part });
                    }
                });
            }

            tokens.push({ type: 'emote', url: emote.url, name: emote.name });
            index = emote.end + 1;
        });

        if (index < text.length) {
            const segment = text.slice(index);
            segment.split(/(\s+)/).filter(part => part.length).forEach(part => {
                if (/^\s+$/.test(part)) {
                    tokens.push({ type: 'space', text: part });
                } else {
                    tokens.push({ type: 'text', text: part });
                }
            });
        }

        return tokens;
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
}
