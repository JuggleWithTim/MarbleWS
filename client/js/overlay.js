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

(async function() {
    const canvas = document.getElementById('overlayCanvas');
    const renderer = new TransparentRenderer(canvas);
    const networking = new Networking();

    // Create game-like wrapper for ColorRushRenderer
    const gameWrapper = {
        gameState: null,
        getInterpolatedPosition: getInterpolatedPosition
    };

    // Color Rush renderer
    const colorRushRenderer = new window.ColorRushRenderer(renderer, gameWrapper);

    // Load shared game configuration via API
    let gameData;
    try {
        // Use relative path like networking.js does - nginx will proxy based on current location
        const response = await fetch('api/game-config');
        gameData = await response.json();
        console.log('Overlay configuration loaded successfully');
    } catch (error) {
        console.error('Failed to load overlay configuration:', error);
        gameData = { ufoData: {}, passengerData: {}, hatData: {} };
    }

    // Interpolation system
    const interpolatedObjects = new Map();

    // Delta time tracking for particle animations
    let lastUpdateTime = performance.now();

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

        // All level objects (including active ones)
        if (gameState.levelObjects) {
            gameState.levelObjects.forEach(obj => {
                const id = `levelobj_${obj.id}`;
                updateInterpolationData(id, obj.x, obj.y, obj.angle || 0);
                existingIds.add(id);
            });
        }

        // Cleanup
        for (const [objectId] of interpolatedObjects) {
            if (!existingIds.has(objectId)) {
                interpolatedObjects.delete(objectId);
            }
        }
    }

    // Calculate dynamic camera for dungeon mode that fits all players
    function calculateDynamicDungeonCamera(players, renderer) {
        // Use interpolated positions for smooth camera movement
        const playerPositions = players.map(player => {
            const id = `player_${player.id || player.username}`;
            const interpolated = getInterpolatedPosition(id);
            return interpolated ? { x: interpolated.x, y: interpolated.y } : { x: player.x, y: player.y };
        });

        if (playerPositions.length === 0) {
            // Fallback to default view if no players
            renderer.setCamera(960, 540, 1);
            return;
        }

        // Calculate bounding box
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        playerPositions.forEach(pos => {
            minX = Math.min(minX, pos.x);
            maxX = Math.max(maxX, pos.x);
            minY = Math.min(minY, pos.y);
            maxY = Math.max(maxY, pos.y);
        });

        // Calculate center point
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // Calculate dimensions of bounding box
        const width = maxX - minX;
        const height = maxY - minY;

        // Canvas dimensions (1920x1080)
        const canvasWidth = 1920;
        const canvasHeight = 1080;

        // Add padding around players (200px minimum margin, like dungeon mode margin)
        const paddingX = Math.max(200, width * 0.1);
        const paddingY = Math.max(150, height * 0.1);

        // Calculate required zoom to fit the bounding box plus padding
        const requiredWidth = width + paddingX * 2;
        const requiredHeight = height + paddingY * 2;

        // Calculate zoom levels needed for each dimension
        const zoomX = canvasWidth / requiredWidth;
        const zoomY = canvasHeight / requiredHeight;

        // Use the smaller zoom to ensure everything fits
        let zoom = Math.min(zoomX, zoomY);

        // Clamp zoom between reasonable limits
        zoom = Math.max(0.3, Math.min(5.0, zoom));

        // Special handling for single player - don't zoom in too much
        if (players.length === 1) {
            zoom = Math.min(2.0, zoom); // Cap at 2x for single player
        }

        renderer.setCamera(centerX, centerY, zoom);
    }

    // Set camera to show the full board (centered, 1920x1080)
    function renderGameState(gameState, deltaTime = 0) {
        // Draw level background (remove to keep transparent overlay)
        renderer.drawBackground(gameState.backgroundImage);

        // Apply camera based on game mode
        const gameModeData = gameState.gameMode;
        if (gameModeData && gameModeData.dungeonViewEnabled && gameState.players && gameState.players.length > 0) {
            // Dungeon mode: Check if spectating a specific player
            if (gameModeData.followTarget) {
                const targetPlayer = gameState.players.find(p =>
                    (p.username || '').toLowerCase() === gameModeData.followTarget.toLowerCase()
                );
                if (targetPlayer) {
                    // Spectate mode: Use interpolated position for smooth following
                    const id = `player_${targetPlayer.id || targetPlayer.username}`;
                    const interpolated = getInterpolatedPosition(id);
                    const targetPos = interpolated ? { x: interpolated.x, y: interpolated.y } : { x: targetPlayer.x, y: targetPlayer.y };
                    renderer.setCamera(targetPos.x, targetPos.y, 1.5);
                } else {
                    // Target not found, fallback to dynamic camera
                    calculateDynamicDungeonCamera(gameState.players, renderer);
                }
            } else {
                // Default dungeon view: Dynamic camera that fits all players
                calculateDynamicDungeonCamera(gameState.players, renderer);
            }
        } else {
            // Default: Fixed camera view - show entire 1920x1080 game area
            renderer.setCamera(960, 540, 1);
        }

        // Create combined array of all renderable objects with z-index
        const allRenderables = [];

        // Add level objects (already have zIndex)
        if (gameState.levelObjects) {
            gameState.levelObjects.forEach(obj => {
                const interpolated = getInterpolatedPosition(`levelobj_${obj.id}`);
                const renderObj = interpolated ?
                    { ...obj, x: interpolated.x, y: interpolated.y, angle: interpolated.angle } :
                    obj;

                allRenderables.push({
                    type: 'levelObject',
                    data: renderObj,
                    zIndex: renderObj.zIndex || 0
                });
            });
        }

        // Add marbles (z-index 50)
        if (gameState.marbles) {
            gameState.marbles.forEach(marble => {
                const id = `marble_${marble.id || marble.username || marble.playerId || marble.x + '_' + marble.y}`;
                const interpolated = getInterpolatedPosition(id);
                const renderMarble = interpolated ?
                    { ...marble, x: interpolated.x, y: interpolated.y, angle: interpolated.angle } :
                    marble;

                // Get current level marble properties
                const marbleColor = (gameState.marbleProperties && gameState.marbleProperties.color) ?
                    gameState.marbleProperties.color : '#ff6b6b';
                const marbleRadius = (gameState.marbleProperties && gameState.marbleProperties.radius) ?
                    gameState.marbleProperties.radius : 30;

                allRenderables.push({
                    type: 'marble',
                    data: { ...renderMarble, color: marbleColor, radius: marbleRadius },
                    zIndex: 50
                });
            });
        }

        // Add emotes (z-index 50)
        if (gameState.emotes) {
            gameState.emotes.forEach(emote => {
                const id = `emote_${emote.id || emote.url || emote.x + '_' + emote.y}`;
                const interpolated = getInterpolatedPosition(id);
                const renderEmote = interpolated ?
                    { ...emote, x: interpolated.x, y: interpolated.y, angle: interpolated.angle } :
                    emote;

                allRenderables.push({
                    type: 'emote',
                    data: renderEmote,
                    zIndex: 50
                });
            });
        }

        // Add players (z-index 50)
        if (gameState.players) {
            gameState.players.forEach(player => {
                const id = `player_${player.id || player.username}`;
                const interpolated = getInterpolatedPosition(id);
                const renderPlayer = interpolated ?
                    { ...player, x: interpolated.x, y: interpolated.y } :
                    player;

                allRenderables.push({
                    type: 'player',
                    data: renderPlayer,
                    zIndex: 50
                });
            });
        }

        // Sort all renderables by z-index
        allRenderables.sort((a, b) => a.zIndex - b.zIndex);

        // Render all objects in z-index order
        allRenderables.forEach(renderable => {
            switch (renderable.type) {
                case 'levelObject':
                    renderer.drawLevelObject(renderable.data);
                    break;
                case 'marble':
                    renderer.drawMarble(
                        renderable.data.x,
                        renderable.data.y,
                        renderable.data.angle,
                        renderable.data.color,
                        renderable.data.radius
                    );
                    break;
                case 'emote':
                    renderer.drawEmote(
                        renderable.data.x,
                        renderable.data.y,
                        renderable.data.url,
                        renderable.data.angle
                    );
                    break;
                case 'player':
                    const color = renderable.data.color || '#4ecdc4';
                    renderer.drawUFO(
                        renderable.data.x,
                        renderable.data.y,
                        color,
                        renderable.data.beamActive,
                        renderable.data.ufoAppearance,
                        gameData
                    );
                    break;
            }
        });

        // Draw player names on top of everything (always visible)
        if (gameState.players) {
            gameState.players.forEach(player => {
                const id = `player_${player.id || player.username}`;
                const color = player.color || '#4ecdc4';
                const interpolated = getInterpolatedPosition(id);
                if (interpolated) {
                    renderer.drawPlayerName(interpolated.x, interpolated.y, player.username, color);
                } else {
                    renderer.drawPlayerName(player.x, player.y, player.username, color);
                }
            });
        }

        // Update and draw goal particles
        renderer.updateGoalParticles(deltaTime);

        // Render game mode specific elements
        gameWrapper.gameState = gameState;
        if (colorRushRenderer) {
            colorRushRenderer.render();
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

        // Listen for emote goal events to trigger particle effects
        networking.on('emoteInGoal', (data) => {
            renderer.triggerGoalParticles(data.goalX, data.goalY);
        });

        // Add Color Rush event handlers
        networking.socket.on('colorRushRoundStart', (data) => {
            if (colorRushRenderer) {
                colorRushRenderer.handleRoundStart(data);
            }
        });

        networking.socket.on('colorRushRoundEnd', (data) => {
            if (colorRushRenderer) {
                colorRushRenderer.handleRoundEnd(data);
            }
        });

        networking.socket.on('colorRushNextRound', (data) => {
            if (colorRushRenderer) {
                colorRushRenderer.handleNextRound(data);
            }
        });

        networking.socket.on('colorRushSafeSectionChange', (data) => {
            if (colorRushRenderer) {
                colorRushRenderer.handleSafeSectionChange(data);
            }
        });

        networking.socket.on('colorRushPlayerDeath', (data) => {
            if (colorRushRenderer) {
                colorRushRenderer.handlePlayerDeath(data);
            }
        });

        // Send keepalive every 10 minutes to prevent idle timeout
        setInterval(() => {
            if (networking.isConnected()) {
                networking.socket.emit('keepalive');
            }
        }, 10 * 60 * 1000); // 10 minutes
    }

    init();

    // Animation loop to keep canvas updated (in case of async image loads)
    function animationLoop() {
        const currentTime = performance.now();
        const deltaTime = (currentTime - lastUpdateTime) / 1000;
        lastUpdateTime = currentTime;

        const gameState = networking.getGameState();
        if (gameState) {
            renderGameState(gameState, deltaTime);
        }
        requestAnimationFrame(animationLoop);
    }
    animationLoop();
})();
