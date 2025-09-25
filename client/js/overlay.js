class TransparentRenderer extends Renderer {
    clear() {
        // Only clear the canvas, do not fill with any color or gradient
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawBackground(imageUrl) {
        // Keep overlay transparent unless a background image is provided
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (imageUrl) {
            const cached = this.images.get(imageUrl);
            if (cached) {
                // Draw image stretched to canvas; PNG alpha is preserved by drawImage
                this.ctx.drawImage(cached, 0, 0, this.canvas.width, this.canvas.height);
                return;
            }
            // Start async load; remain transparent until it's loaded
            this.loadImage(imageUrl);
        }
        // No gradient fallback for overlay; stays transparent
    }
}

(function() {
    const canvas = document.getElementById('overlayCanvas');
    const renderer = new TransparentRenderer(canvas);
    const networking = new Networking();

    // Interpolation system
    const interpolatedObjects = new Map();

    function lerp(start, end, progress) {
        return start + (end - start) * progress;
    }

    function smoothstep(progress) {
        return progress * progress * (3 - 2 * progress);
    }

    function updateInterpolationData(objectId, newX, newY, newAngle = 0) {
        const currentTime = performance.now();

        if (!interpolatedObjects.has(objectId)) {
            interpolatedObjects.set(objectId, {
                previousPosition: { x: newX, y: newY, angle: newAngle },
                targetPosition: { x: newX, y: newY, angle: newAngle },
                lastUpdateTime: currentTime
            });
        } else {
            const obj = interpolatedObjects.get(objectId);
            obj.previousPosition = { ...obj.targetPosition };
            obj.targetPosition = { x: newX, y: newY, angle: newAngle };
            obj.lastUpdateTime = currentTime;
        }
    }

    function getInterpolatedPosition(objectId) {
        if (!interpolatedObjects.has(objectId)) {
            return null;
        }

        const obj = interpolatedObjects.get(objectId);
        const currentTime = performance.now();
        const timeSinceUpdate = currentTime - obj.lastUpdateTime;

        // Assume server updates every 100ms, clamp progress to prevent overshooting
        const progress = Math.min(timeSinceUpdate / 100, 1);
        const smoothProgress = smoothstep(progress);

        return {
            x: lerp(obj.previousPosition.x, obj.targetPosition.x, smoothProgress),
            y: lerp(obj.previousPosition.y, obj.targetPosition.y, smoothProgress),
            angle: lerp(obj.previousPosition.angle, obj.targetPosition.angle, smoothProgress)
        };
    }

    function updateInterpolationFromGameState(gameState) {
        const existingIds = new Set();

        // Players
        if (gameState.players) {
            gameState.players.forEach(player => {
                const id = `player_${player.id || player.username}`;
                updateInterpolationData(id, player.x, player.y, 0);
                existingIds.add(id);
            });
        }

        // Marbles
        if (gameState.marbles) {
            gameState.marbles.forEach(marble => {
                const id = `marble_${marble.id || marble.username || marble.playerId || marble.x + '_' + marble.y}`;
                updateInterpolationData(id, marble.x, marble.y, marble.angle);
                existingIds.add(id);
            });
        }

        // Emotes
        if (gameState.emotes) {
            gameState.emotes.forEach(emote => {
                const id = `emote_${emote.id || emote.url || emote.x + '_' + emote.y}`;
                updateInterpolationData(id, emote.x, emote.y, emote.angle);
                existingIds.add(id);
            });
        }

        // Movable level objects
        if (gameState.levelObjects) {
            gameState.levelObjects.forEach(obj => {
                if (obj.isStatic === false) {
                    const id = `levelobj_${obj.id}`;
                    updateInterpolationData(id, obj.x, obj.y, obj.angle || 0);
                    existingIds.add(id);
                }
            });
        }

        // Cleanup
        for (const [objectId] of interpolatedObjects) {
            if (!existingIds.has(objectId)) {
                interpolatedObjects.delete(objectId);
            }
        }
    }

    // Set camera to show the full board (centered, 1920x1080)
    function renderGameState(gameState) {// Draw level background (remove to keep transparent overlay)
        renderer.drawBackground(gameState.backgroundImage);
        renderer.setCamera(960, 540, 1);

        // Draw level objects (interpolated for movable, static as before)
        if (gameState.levelObjects) {
            const sortedObjects = [...gameState.levelObjects].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
            sortedObjects.forEach(obj => {
                if (obj.isStatic === false) {
                    const interpolated = getInterpolatedPosition(`levelobj_${obj.id}`);
                    if (interpolated) {
                        const objCopy = { ...obj, x: interpolated.x, y: interpolated.y, angle: interpolated.angle };
                        renderer.drawLevelObject(objCopy);
                    } else {
                        renderer.drawLevelObject(obj);
                    }
                } else {
                    renderer.drawLevelObject(obj);
                }
            });
        }

        // Draw marbles with interpolation
        if (gameState.marbles) {
            gameState.marbles.forEach(marble => {
                const id = `marble_${marble.id || marble.username || marble.playerId || marble.x + '_' + marble.y}`;
                const interpolated = getInterpolatedPosition(id);
                if (interpolated) {
                    renderer.drawMarble(interpolated.x, interpolated.y, interpolated.angle);
                } else {
                    renderer.drawMarble(marble.x, marble.y, marble.angle);
                }
            });
        }

        // Draw emotes with interpolation
        if (gameState.emotes) {
            gameState.emotes.forEach(emote => {
                const id = `emote_${emote.id || emote.url || emote.x + '_' + emote.y}`;
                const interpolated = getInterpolatedPosition(id);
                if (interpolated) {
                    renderer.drawEmote(interpolated.x, interpolated.y, emote.url, interpolated.angle);
                } else {
                    renderer.drawEmote(emote.x, emote.y, emote.url, emote.angle);
                }
            });
        }

        // Draw players (UFOs and names) with interpolation
        if (gameState.players) {
            gameState.players.forEach(player => {
                const id = `player_${player.id || player.username}`;
                const interpolated = getInterpolatedPosition(id);
                if (interpolated) {
                    renderer.drawUFO(interpolated.x, interpolated.y, '#ff6b6b', player.beamActive);
                    renderer.drawPlayerName(interpolated.x, interpolated.y, player.username, '#ff6b6b');
                } else {
                    renderer.drawUFO(player.x, player.y, '#ff6b6b', player.beamActive);
                    renderer.drawPlayerName(player.x, player.y, player.username, '#ff6b6b');
                }
            });
        }
    }

    // Initialize overlay
    async function init() {
        await networking.loadConfig();
        await networking.connect();

        networking.on('gameState', (gameState) => {
            updateInterpolationFromGameState(gameState);
            renderGameState(gameState);
        });
        networking.on('gameStateUpdate', (gameState) => {
            updateInterpolationFromGameState(gameState);
            renderGameState(gameState);
        });
    }

    init();

    // Animation loop to keep canvas updated (in case of async image loads)
    function animationLoop() {
        const gameState = networking.getGameState();
        if (gameState) {
            renderGameState(gameState);
        }
        requestAnimationFrame(animationLoop);
    }
    animationLoop();
})();
