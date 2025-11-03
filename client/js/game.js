class Game {
    constructor() {
        this.networking = new Networking();
        this.renderer = null;
        this.controls = new Controls();
        this.canvas = null;
        
        this.currentPlayer = null;
        this.gameState = null;
        this.lastUpdateTime = 0;
        this.isLoggedIn = false;
        
        // Player movement
        this.playerSpeed = 150; // pixels per second (reduced from 200)
        this.lastPlayerPosition = { x: 960, y: 540 }; // Center of 1920x1080 canvas
        this.beamActive = false;
        this.lastMovementUpdate = 0; // For throttling movement updates
        
        // Interpolation system for smooth movement
        this.interpolatedObjects = new Map(); // Store interpolation data
        this.lastServerUpdate = 0;
        
        // UI elements
        this.loginScreen = null;
        this.gameScreen = null;
        this.levelSelectModal = null;

        // Track if a level has been loaded to prevent double-loading
        this.levelLoaded = false;
    }

    // Linear interpolation function
    lerp(start, end, progress) {
        return start + (end - start) * progress;
    }

    // Smooth interpolation with easing
    smoothstep(progress) {
        return progress * progress * (3 - 2 * progress);
    }

    // Update interpolation data for an object
    updateInterpolationData(objectId, newX, newY, newAngle = 0) {
        const currentTime = performance.now();
        
        if (!this.interpolatedObjects.has(objectId)) {
            // First time seeing this object
            this.interpolatedObjects.set(objectId, {
                previousPosition: { x: newX, y: newY, angle: newAngle },
                targetPosition: { x: newX, y: newY, angle: newAngle },
                lastUpdateTime: currentTime
            });
        } else {
            const obj = this.interpolatedObjects.get(objectId);
            // Store current target as previous, set new target
            obj.previousPosition = { ...obj.targetPosition };
            obj.targetPosition = { x: newX, y: newY, angle: newAngle };
            obj.lastUpdateTime = currentTime;
        }
    }

    // Get interpolated position for an object
    getInterpolatedPosition(objectId) {
        if (!this.interpolatedObjects.has(objectId)) {
            return null;
        }

        const obj = this.interpolatedObjects.get(objectId);
        const currentTime = performance.now();
        const timeSinceUpdate = currentTime - obj.lastUpdateTime;
        
        // Assume server updates every 100ms, clamp progress to prevent overshooting
        const progress = Math.min(timeSinceUpdate / 100, 1);
        const smoothProgress = this.smoothstep(progress);

        return {
            x: this.lerp(obj.previousPosition.x, obj.targetPosition.x, smoothProgress),
            y: this.lerp(obj.previousPosition.y, obj.targetPosition.y, smoothProgress),
            angle: this.lerp(obj.previousPosition.angle, obj.targetPosition.angle, smoothProgress)
        };
    }

    async init() {
        // Load client configuration first
        await this.networking.loadConfig();

        this.setupUI();
        await this.setupNetworking();
        await this.checkDevMode();
        this.checkAutoLogin();

        // Start game loop
        this.gameLoop();
    }

    setupUI() {
        this.loginScreen = document.getElementById('loginScreen');
        this.gameScreen = document.getElementById('gameScreen');
        this.levelSelectModal = document.getElementById('levelSelectModal');
        this.canvas = document.getElementById('gameCanvas');
        
        if (this.canvas) {
            this.renderer = new Renderer(this.canvas);
            this.controls.setupCanvasControls(this.canvas, this);
        }
        
        this.controls.setupUIControls(this, this.networking.BASE_PATH);

        // Setup wardrobe and store controls
        this.setupWardrobeControls();

        // Setup beam controls
        this.controls.on('beamActivate', () => {
            this.activateBeam(true);
        });

        this.controls.on('beamDeactivate', () => {
            this.activateBeam(false);
        });
    }

    async setupNetworking() {
        await this.networking.connect();

        this.networking.on('connected', () => {
            console.log('Connected to game server');
        });
        
        this.networking.on('loginSuccess', (player) => {
            this.currentPlayer = player;
            this.isLoggedIn = true;
            this.showGameScreen();
            this.updatePlayerInfo();
        });
        
        this.networking.on('gameState', (gameState) => {
            this.gameState = gameState;
            this.updateInterpolationFromGameState(gameState);
        });
        
        this.networking.on('gameStateUpdate', (gameState) => {
            this.gameState = gameState;
            this.updateInterpolationFromGameState(gameState);

            // Update current player data if we're logged in
            if (this.currentPlayer && gameState.players) {
                const updatedPlayer = gameState.players.find(p => p.id === this.currentPlayer.id);
                if (updatedPlayer) {
                    this.currentPlayer = updatedPlayer;
                }
            }
        });
        
        this.networking.on('chatMessage', (data) => {
            this.addChatMessage(data);
        });
        
        this.networking.on('levelLoaded', (data) => {
            console.log('Level loaded:', data.levelName);
        });
        
        this.networking.on('error', (error) => {
            this.showError(error.message);
        });

        this.networking.on('playerLeveledUp', (data) => {
            this.showLevelUpSplash(data);
        });

        // Add unlock result handler
        this.networking.socket.on('unlockResult', (result) => {
            this.handleUnlockResult(result);
        });
    }

    async checkDevMode() {
        try {
            const response = await fetch(`${this.networking.BASE_PATH}/api/client-config`);
            const config = await response.json();

            // Show top bar and player info for all users (not just dev mode)
            const topBar = document.getElementById('topBar');
            if (topBar) {
                topBar.style.display = '';
            }
            const playerInfo = document.getElementById('playerInfo');
            if (playerInfo) {
                playerInfo.style.display = '';
            }

            if (config.devMode) {
                // Show dev login option
                const devLogin = document.getElementById('devLogin');
                if (devLogin) {
                    devLogin.style.display = 'block';

                    // Setup dev login button
                    const devLoginBtn = document.getElementById('devLoginBtn');
                    const devUsername = document.getElementById('devUsername');

                    if (devLoginBtn && devUsername) {
                        devLoginBtn.addEventListener('click', () => {
                            this.handleDevLogin();
                        });

                        devUsername.addEventListener('keypress', (e) => {
                            if (e.key === 'Enter') {
                                this.handleDevLogin();
                            }
                        });
                    }
                }

                // Show dev-only UI elements
                const devOnlyIds = [
                    'topBarActions',
                    'onlinePlayers',
                    'chat',
                    'gameUI'
                ];
                devOnlyIds.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        // Use '' to revert to CSS default, or 'block' for block elements
                        if (id === 'chat') {
                            el.style.display = '';
                        } else {
                            el.style.display = '';
                        }
                    }
                });
            } else {
                // Auto-load level1.json if not in dev mode
                if (!this.levelLoaded) {
                    this.loadLevel('level1');
                    this.levelLoaded = true;
                }
            }
        } catch (error) {
            console.log('Could not check dev mode:', error);
        }
    }

    async handleDevLogin() {
        const devUsername = document.getElementById('devUsername');
        const username = devUsername.value.trim();

        if (!username) {
            this.showError('Please enter a username');
            return;
        }

        try {
            const response = await fetch(`${this.networking.BASE_PATH}/api/dev-login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username }),
            });

            if (response.ok) {
                const userData = await response.json();

                // Ensure Socket.IO connection is ready before login
                if (!this.networking.isConnected()) {
                    await this.networking.connect();
                }

                // Now login with dev credentials
                this.networking.login(userData.username, userData.userId);
            } else {
                const error = await response.json();
                this.showError(error.error || 'Dev login failed');
            }
        } catch (error) {
            this.showError('Dev login failed: ' + error.message);
        }
    }

    checkAutoLogin() {
        // Check URL parameters for Twitch login callback
        const urlParams = new URLSearchParams(window.location.search);
        const username = urlParams.get('username');
        const userId = urlParams.get('userId');
        const error = urlParams.get('error');

        if (error) {
            this.showError('Login failed. Please try again.');
            return;
        }

        if (username && userId) {
            // Auto-login with Twitch credentials
            const performLogin = () => {
                this.networking.login(username, userId);
                // Clean up URL after login
                window.history.replaceState({}, document.title, window.location.pathname);
            };

            if (this.networking.isConnected()) {
                performLogin();
            } else {
                this.networking.on('connected', performLogin);
            }
        }
    }

    showGameScreen() {
        this.loginScreen.style.display = 'none';
        this.gameScreen.style.display = 'block';
    }

    showError(message) {
        const errorElement = document.getElementById('loginError');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    showLevelUpSplash(data) {
        const splash = document.getElementById('levelUpSplash');
        const levelElement = document.getElementById('levelUpLevel');
        const coinsElement = document.getElementById('levelUpCoins');

        if (!splash || !levelElement || !coinsElement) return;

        // Update the content
        levelElement.textContent = `Level ${data.newLevel}`;
        coinsElement.textContent = `+${data.coinReward} Coins`;

        // Show the splash screen
        splash.style.display = 'flex';

        // Hide after 3 seconds
        setTimeout(() => {
            splash.style.display = 'none';
        }, 5000);
    }

    updatePlayerInfo() {
        if (!this.currentPlayer) return;

        const playerName = document.getElementById('playerName');
        const playerLevel = document.getElementById('playerLevel');
        const playerCoins = document.getElementById('playerCoins');
        const xpFill = document.getElementById('xpFill');

        if (playerName) {
            playerName.textContent = this.currentPlayer.username;
        }

        if (playerLevel) {
            playerLevel.textContent = `Level ${this.currentPlayer.level}`;
        }

        if (playerCoins) {
            playerCoins.textContent = `Coins: ${this.currentPlayer.coins}`;
        }

        if (xpFill) {
            const xpPercent = (this.currentPlayer.xp / (this.currentPlayer.level * 1000)) * 100;
            xpFill.style.width = `${xpPercent}%`;
        }
    }

    updatePlayersList() {
        const playersList = document.getElementById('playersList');
        if (!playersList || !this.gameState) return;
        
        playersList.innerHTML = '';
        this.gameState.players.forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item';
            playerItem.textContent = `${player.username} (Lv.${player.level})`;
            playersList.appendChild(playerItem);
        });
    }

    gameLoop() {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = currentTime;
        
        this.update(deltaTime);
        this.render();
        
        requestAnimationFrame(() => this.gameLoop());
    }

    update(deltaTime) {
        if (!this.isLoggedIn || !this.currentPlayer) return;
        
        // Update player movement
        this.updatePlayerMovement(deltaTime);
        
        // Update UI
        this.updatePlayerInfo();
        this.updatePlayersList();
    }

    updatePlayerMovement(deltaTime) {
        if (this.controls.isDisabled()) return;
        
        const movement = this.controls.getMovementVector();
        const currentTime = performance.now();
        
        // Send input state directly to server (like the reference game)
        const input = {
            up: movement.y < 0,
            down: movement.y > 0,
            left: movement.x < 0,
            right: movement.x > 0
        };
        
        // Send input updates at 60 FPS for responsive controls
        this.networking.sendPlayerInput(input);
        
        // Update local position for camera following (approximate)
        if (movement.x !== 0 || movement.y !== 0) {
            const newX = this.lastPlayerPosition.x + movement.x * this.playerSpeed * deltaTime;
            const newY = this.lastPlayerPosition.y + movement.y * this.playerSpeed * deltaTime;
            
            // Clamp to canvas bounds (with some padding)
            const padding = 50;
            const clampedX = Math.max(padding, Math.min(this.canvas.width - padding, newX));
            const clampedY = Math.max(padding, Math.min(this.canvas.height - padding, newY));
            
            this.lastPlayerPosition.x = clampedX;
            this.lastPlayerPosition.y = clampedY;
        }
    }

    activateBeam(active) {
        if (this.beamActive !== active) {
            this.beamActive = active;
            this.networking.sendBeamToggle(active);
        }
    }

    handleBeamTarget(canvasX, canvasY) {
        if (!this.renderer) return;
        
        const worldPos = this.renderer.screenToWorld(canvasX, canvasY);
        this.networking.sendBeamInteraction(worldPos.x, worldPos.y);
    }

    render() {if (!this.renderer || !this.gameState) return;
        
        // Draw level background if provided, else gradient fallback
        this.renderer.drawBackground(this.gameState.backgroundImage);
        
        // Fixed camera view - no following, show entire 1920x1080 game area
        this.renderer.setCamera(960, 540, 1); // Center of 1920x1080 canvas
        
        // Sort level objects by zIndex (if present) before rendering
        const sortedObjects = [...this.gameState.levelObjects].sort((a, b) => {
            return (a.zIndex || 0) - (b.zIndex || 0);
        });
        
        // Render level objects with smooth interpolation (including active objects)
        sortedObjects.forEach(obj => {
            const interpolated = this.getInterpolatedPosition(`levelobj_${obj.id}`);
            if (interpolated) {
                // Use interpolated position/angle for smooth movement
                const objCopy = { ...obj, x: interpolated.x, y: interpolated.y, angle: interpolated.angle };
                this.renderer.drawLevelObject(objCopy);
            } else {
                // Fallback to server position if no interpolation data
                this.renderer.drawLevelObject(obj);
            }
        });
        
        // Render marbles with smooth interpolation
        this.gameState.marbles.forEach(marble => {
            const interpolated = this.getInterpolatedPosition(`marble_${marble.id}`);
            if (interpolated) {
                // Get current level marble properties
                const marbleColor = (this.gameState.marbleProperties && this.gameState.marbleProperties.color) ?
                    this.gameState.marbleProperties.color : '#ff6b6b';
                const marbleRadius = (this.gameState.marbleProperties && this.gameState.marbleProperties.radius) ?
                    this.gameState.marbleProperties.radius : 30;
                this.renderer.drawMarble(interpolated.x, interpolated.y, interpolated.angle, marbleColor, marbleRadius);
            } else {
                // Fallback to server position if no interpolation data - same properties logic
                const marbleColor = (this.gameState.marbleProperties && this.gameState.marbleProperties.color) ?
                    this.gameState.marbleProperties.color : '#ff6b6b';
                const marbleRadius = (this.gameState.marbleProperties && this.gameState.marbleProperties.radius) ?
                    this.gameState.marbleProperties.radius : 30;
                this.renderer.drawMarble(marble.x, marble.y, marble.angle, marbleColor, marbleRadius);
            }
        });
        
        // Render emotes with smooth interpolation
        this.gameState.emotes.forEach(emote => {
            const interpolated = this.getInterpolatedPosition(`emote_${emote.id}`);
            if (interpolated) {
                this.renderer.drawEmote(interpolated.x, interpolated.y, emote.url, interpolated.angle);
            } else {
                // Fallback to server position if no interpolation data
                this.renderer.drawEmote(emote.x, emote.y, emote.url, emote.angle);
            }
        });
        
        // Render players with smooth interpolation
        this.gameState.players.forEach(player => {
            const color = player.color || '#4ecdc4'; // Fallback to teal if no color provided

            // Use interpolated position for smooth movement
            const interpolated = this.getInterpolatedPosition(`player_${player.id}`);
            if (interpolated) {
                this.renderer.drawUFO(interpolated.x, interpolated.y, color, player.beamActive, player.ufoAppearance);
                this.renderer.drawPlayerName(interpolated.x, interpolated.y, player.username, color);
            } else {
                // Fallback to server position if no interpolation data
                this.renderer.drawUFO(player.x, player.y, color, player.beamActive, player.ufoAppearance);
                this.renderer.drawPlayerName(player.x, player.y, player.username, color);
            }
        });
        
        // Debug info (optional)
        // this.renderer.drawDebugInfo(this.gameState);
    }

    async showLevelSelect() {
        const levels = await this.networking.fetchLevels();
        const levelsList = document.getElementById('levelsList');
        
        if (!levelsList) return;
        
        levelsList.innerHTML = '';
        
        if (levels.length === 0) {
            levelsList.innerHTML = '<p>No levels found. Create some levels in the editor!</p>';
        } else {
            levels.forEach(levelName => {
                const levelItem = document.createElement('div');
                levelItem.className = 'level-item';
                levelItem.innerHTML = `
                    <div class="level-name">${levelName}</div>
                    <div class="level-description">Click to load this level</div>
                `;
                
                levelItem.addEventListener('click', () => {
                    this.loadLevel(levelName);
                    this.levelSelectModal.style.display = 'none';
                });
                
                levelsList.appendChild(levelItem);
            });
        }
        
        this.levelSelectModal.style.display = 'flex';
    }

    loadLevel(levelName) {
        this.networking.loadLevel(levelName);
    }

    sendChatMessage(message) {
        this.networking.sendChatMessage(message);
    }

    addChatMessage(data) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';
        messageElement.innerHTML = `
            <span class="chat-username">${data.username}:</span>
            <span class="chat-text">${data.message}</span>
        `;
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Remove old messages to prevent memory issues
        while (chatMessages.children.length > 50) {
            chatMessages.removeChild(chatMessages.firstChild);
        }
    }

    spawnTestEmote() {
        const emotes = ['Kappa', 'PogChamp', 'LUL', 'MonkaS', 'OMEGALUL'];
        const randomEmote = emotes[Math.floor(Math.random() * emotes.length)];
        this.networking.spawnTestEmote(randomEmote);
    }

    // Update interpolation data from received game state
    updateInterpolationFromGameState(gameState) {
        this.lastServerUpdate = performance.now();
        
        // Update interpolation data for all players
        if (gameState.players) {
            gameState.players.forEach(player => {
                this.updateInterpolationData(`player_${player.id}`, player.x, player.y, 0);
            });
        }
        
        // Update interpolation data for marbles
        if (gameState.marbles) {
            gameState.marbles.forEach(marble => {
                this.updateInterpolationData(`marble_${marble.id}`, marble.x, marble.y, marble.angle);
            });
        }
        
        // Update interpolation data for emotes
        if (gameState.emotes) {
            gameState.emotes.forEach(emote => {
                this.updateInterpolationData(`emote_${emote.id}`, emote.x, emote.y, emote.angle);
            });
        }

        // Update interpolation data for all level objects (including active ones)
        if (gameState.levelObjects) {
            gameState.levelObjects.forEach(obj => {
                this.updateInterpolationData(`levelobj_${obj.id}`, obj.x, obj.y, obj.angle || 0);
            });
        }
        
        // Clean up interpolation data for objects that no longer exist
        this.cleanupInterpolationData(gameState);
    }

    // Remove interpolation data for objects that no longer exist
    cleanupInterpolationData(gameState) {
        const existingIds = new Set();

        // Collect all existing object IDs
        if (gameState.players) {
            gameState.players.forEach(player => existingIds.add(`player_${player.id}`));
        }
        if (gameState.marbles) {
            gameState.marbles.forEach(marble => existingIds.add(`marble_${marble.id}`));
        }
        if (gameState.emotes) {
            gameState.emotes.forEach(emote => existingIds.add(`emote_${emote.id}`));
        }
        if (gameState.levelObjects) {
            gameState.levelObjects.forEach(obj => {
                existingIds.add(`levelobj_${obj.id}`);
            });
        }

        // Remove interpolation data for objects that no longer exist
        for (const [objectId] of this.interpolatedObjects) {
            if (!existingIds.has(objectId)) {
                this.interpolatedObjects.delete(objectId);
            }
        }
    }

    setupWardrobeControls() {
        // Setup Store controls
        const storeBtn = document.getElementById('storeBtn');
        const storeModal = document.getElementById('storeModal');
        const storeCloseBtn = storeModal.querySelector('.close');

        if (storeBtn && storeModal && storeCloseBtn) {
            // Show store modal
            storeBtn.addEventListener('click', () => {
                this.showStoreModal();
            });

            // Close store modal
            storeCloseBtn.addEventListener('click', () => {
                storeModal.style.display = 'none';
            });

            // Close store modal when clicking outside
            window.addEventListener('click', (event) => {
                if (event.target === storeModal) {
                    storeModal.style.display = 'none';
                }
            });
        }

        // Setup Wardrobe controls
        const wardrobeBtn = document.getElementById('wardrobeBtn');
        const wardrobeModal = document.getElementById('wardrobeModal');
        const closeBtn = wardrobeModal.querySelector('.close');
        const applyBtn = document.getElementById('applyWardrobeBtn');
        const colorPicker = document.getElementById('ufoColorPicker');
        const designsList = document.getElementById('ufoDesignsList');

        if (!wardrobeBtn || !wardrobeModal || !closeBtn || !applyBtn || !colorPicker || !designsList) {
            console.warn('Wardrobe controls not found');
            return;
        }

        // Show wardrobe modal
        wardrobeBtn.addEventListener('click', () => {
            this.showWardrobeModal();
        });

        // Close modal
        closeBtn.addEventListener('click', () => {
            wardrobeModal.style.display = 'none';
        });

        // Close modal when clicking outside
        window.addEventListener('click', (event) => {
            if (event.target === wardrobeModal) {
                wardrobeModal.style.display = 'none';
            }
        });

        // Apply changes
        applyBtn.addEventListener('click', () => {
            this.applyWardrobeChanges();
            wardrobeModal.style.display = 'none';
        });

        // Note: Individual click handlers are now added to each UFO item in showWardrobeModal
    }

    async showStoreModal() {
        const storeModal = document.getElementById('storeModal');
        const ufoStoreItemsList = document.getElementById('ufoStoreItemsList');
        const passengerStoreItemsList = document.getElementById('passengerStoreItemsList');

        if (!this.currentPlayer || !ufoStoreItemsList || !passengerStoreItemsList) return;

        // Clear existing items
        ufoStoreItemsList.innerHTML = '';
        passengerStoreItemsList.innerHTML = '';

        // UFO costs and data
        const ufoData = {
            'CustomUFO1.png': { cost: 50, name: 'TestUFO 1' },
            'Fez.png': { cost: 100, name: 'Fez' }
        };

        // Passenger costs and data
        const passengerData = {
            'luminoCoffee.png': { cost: 75, name: 'Lumino Coffee' },
            'Derp.png': { cost: 75, name: 'Derp' }
        };

        // Get player's unlocked UFOs and passengers
        const unlockedUFOs = this.currentPlayer.unlockedUFOs || [];
        const unlockedPassengers = this.currentPlayer.unlockedPassengers || [];

        // Add UFO store items
        Object.entries(ufoData).forEach(([imageName, data]) => {
            const isUnlocked = unlockedUFOs.includes(imageName);

            const storeItem = document.createElement('div');
            storeItem.className = 'store-item' + (isUnlocked ? ' unlocked' : '');

            let itemHTML = `
                <div class="store-preview" style="background-image: url('img/ufo/${imageName}')"></div>
                <div class="store-item-name">${data.name}</div>
                <div class="store-price">${data.cost} coins</div>
            `;

            if (isUnlocked) {
                itemHTML += `<div class="store-owned">OWNED</div>`;
            } else {
                const canAfford = this.currentPlayer.coins >= data.cost;
                itemHTML += `
                    <button class="store-buy-btn ${canAfford ? '' : 'disabled'}" data-ufo="${imageName}" ${canAfford ? '' : 'disabled'}>
                        ${canAfford ? 'Buy' : 'Not enough coins'}
                    </button>
                `;
            }

            storeItem.innerHTML = itemHTML;

            // Add click handler for purchase button
            if (!isUnlocked) {
                const buyBtn = storeItem.querySelector('.store-buy-btn');
                if (buyBtn && !buyBtn.disabled) {
                    buyBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.purchaseUFO(imageName, data.cost);
                    });
                }
            }

            ufoStoreItemsList.appendChild(storeItem);
        });

        // Add passenger store items
        Object.entries(passengerData).forEach(([imageName, data]) => {
            const isUnlocked = unlockedPassengers.includes(imageName);

            const storeItem = document.createElement('div');
            storeItem.className = 'store-item passenger-item' + (isUnlocked ? ' unlocked' : '');

            let itemHTML = `
                <div class="store-preview" style="background-image: url('img/passenger/${imageName}')"></div>
                <div class="store-item-name">${data.name}</div>
                <div class="store-price">${data.cost} coins</div>
            `;

            if (isUnlocked) {
                itemHTML += `<div class="store-owned">OWNED</div>`;
            } else {
                const canAfford = this.currentPlayer.coins >= data.cost;
                itemHTML += `
                    <button class="store-buy-btn ${canAfford ? '' : 'disabled'}" data-passenger="${imageName}" ${canAfford ? '' : 'disabled'}>
                        ${canAfford ? 'Buy' : 'Not enough coins'}
                    </button>
                `;
            }

            storeItem.innerHTML = itemHTML;

            // Add click handler for purchase button
            if (!isUnlocked) {
                const buyBtn = storeItem.querySelector('.store-buy-btn');
                if (buyBtn && !buyBtn.disabled) {
                    buyBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.purchasePassenger(imageName, data.cost);
                    });
                }
            }

            passengerStoreItemsList.appendChild(storeItem);
        });

        storeModal.style.display = 'flex';
    }

    async showWardrobeModal() {
        const wardrobeModal = document.getElementById('wardrobeModal');
        const colorPicker = document.getElementById('ufoColorPicker');
        const designsList = document.getElementById('ufoDesignsList');
        const passengerDesignsList = document.getElementById('passengerDesignsList');

        if (!this.currentPlayer) return;

        // Set current color
        const currentAppearance = this.currentPlayer.ufoAppearance || { type: 'default', color: this.currentPlayer.color };
        colorPicker.value = currentAppearance.color || '#4ecdc4';

        // Clear existing designs
        designsList.innerHTML = '';
        passengerDesignsList.innerHTML = '';

        // Get player's unlocked UFOs and passengers (initialize as empty array if not present)
        const unlockedUFOs = this.currentPlayer.unlockedUFOs || [];
        const unlockedPassengers = this.currentPlayer.unlockedPassengers || [];

        // Add default UFO option (always available)
        const defaultItem = document.createElement('div');
        defaultItem.className = 'ufo-design-item' + (currentAppearance.type === 'default' ? ' selected' : '');
        defaultItem.setAttribute('data-type', 'default');
        defaultItem.innerHTML = `
            <div class="ufo-preview default-ufo"></div>
            <span>Default UFO</span>
        `;
        defaultItem.addEventListener('click', () => this.selectUFODesign(defaultItem));
        designsList.appendChild(defaultItem);

        // Add only unlocked custom UFO images
        const customImages = ['CustomUFO1.png', 'Fez.png'];

        customImages.forEach(imageName => {
            const isUnlocked = unlockedUFOs.includes(imageName);
            const isSelected = currentAppearance.type === 'custom' && currentAppearance.image === imageName;

            if (isUnlocked) {
                const customItem = document.createElement('div');
                customItem.className = 'ufo-design-item' + (isSelected ? ' selected' : '');
                customItem.setAttribute('data-type', 'custom');
                customItem.setAttribute('data-image', imageName);

                customItem.innerHTML = `
                    <div class="ufo-preview" style="background-image: url('img/ufo/${imageName}')"></div>
                    <span>${imageName.replace('.png', '')}</span>
                `;

                // Add click event for unlocked items
                customItem.addEventListener('click', () => this.selectUFODesign(customItem));
                designsList.appendChild(customItem);
            }
        });

        // Add no passenger option (always available)
        const noPassengerItem = document.createElement('div');
        noPassengerItem.className = 'passenger-design-item' + (!currentAppearance.passenger ? ' selected' : '');
        noPassengerItem.setAttribute('data-passenger', 'none');
        noPassengerItem.innerHTML = `
            <div class="passenger-preview no-passenger"></div>
            <span>No Passenger</span>
        `;
        noPassengerItem.addEventListener('click', () => this.selectPassengerDesign(noPassengerItem));
        passengerDesignsList.appendChild(noPassengerItem);

        // Add only unlocked passenger images
        const passengerImages = ['luminoCoffee.png', 'Derp.png'];

        passengerImages.forEach(imageName => {
            const isUnlocked = unlockedPassengers.includes(imageName);
            const isSelected = currentAppearance.passenger === imageName;

            if (isUnlocked) {
                const passengerItem = document.createElement('div');
                passengerItem.className = 'passenger-design-item' + (isSelected ? ' selected' : '');
                passengerItem.setAttribute('data-passenger', imageName);

                passengerItem.innerHTML = `
                    <div class="passenger-preview" style="background-image: url('img/passenger/${imageName}')"></div>
                    <span>${imageName.replace('.png', '')}</span>
                `;

                // Add click event for unlocked items
                passengerItem.addEventListener('click', () => this.selectPassengerDesign(passengerItem));
                passengerDesignsList.appendChild(passengerItem);
            }
        });

        wardrobeModal.style.display = 'flex';
    }

    selectUFODesign(designItem) {
        // Remove selected class from all items
        const designsList = document.getElementById('ufoDesignsList');
        designsList.querySelectorAll('.ufo-design-item').forEach(item => {
            item.classList.remove('selected');
        });
        // Add selected class to clicked item
        designItem.classList.add('selected');
    }

    selectPassengerDesign(passengerItem) {
        // Remove selected class from all items
        const passengerDesignsList = document.getElementById('passengerDesignsList');
        passengerDesignsList.querySelectorAll('.passenger-design-item').forEach(item => {
            item.classList.remove('selected');
        });
        // Add selected class to clicked item
        passengerItem.classList.add('selected');
    }

    purchaseUFO(ufoImage, cost) {
        if (!this.currentPlayer) return;

        // Check if player has enough coins
        if (this.currentPlayer.coins < cost) {
            this.showError('Not enough coins to purchase this UFO!');
            return;
        }

        // Send unlock request to server
        this.networking.unlockUFO(ufoImage);
    }

    purchasePassenger(passengerImage, cost) {
        if (!this.currentPlayer) return;

        // Check if player has enough coins
        if (this.currentPlayer.coins < cost) {
            this.showError('Not enough coins to purchase this passenger!');
            return;
        }

        // Send unlock request to server
        this.networking.unlockPassenger(passengerImage);
    }

    handleUnlockResult(result) {
        if (result.success) {
            // Update local player data
            if (this.currentPlayer) {
                this.currentPlayer.coins = result.remainingCoins;
                if (result.unlockedUFOs) {
                    this.currentPlayer.unlockedUFOs = result.unlockedUFOs;
                }
                if (result.unlockedPassengers) {
                    this.currentPlayer.unlockedPassengers = result.unlockedPassengers;
                }
                this.updatePlayerInfo();
            }

            // Update networking currentPlayer as well
            if (this.networking.currentPlayer) {
                this.networking.currentPlayer.coins = result.remainingCoins;
                if (result.unlockedUFOs) {
                    this.networking.currentPlayer.unlockedUFOs = result.unlockedUFOs;
                }
                if (result.unlockedPassengers) {
                    this.networking.currentPlayer.unlockedPassengers = result.unlockedPassengers;
                }
            }

            // Refresh both store and wardrobe modals to show updated state
            const storeModal = document.getElementById('storeModal');
            const wardrobeModal = document.getElementById('wardrobeModal');

            if (storeModal.style.display === 'flex') {
                this.showStoreModal();
            }
            if (wardrobeModal.style.display === 'flex') {
                this.showWardrobeModal();
            }

            // Show success message
            const itemName = result.passengerImage ?
                result.passengerImage.replace('.png', '') :
                result.ufoImage.replace('.png', '');
            const itemType = result.passengerImage ? 'passenger' : 'UFO';
            this.showError(`Successfully unlocked ${itemName} ${itemType} for ${result.cost} coins!`);
        } else {
            // Show error message
            this.showError(result.message || 'Failed to unlock item');
        }
    }

    applyWardrobeChanges() {
        const colorPicker = document.getElementById('ufoColorPicker');
        const selectedDesign = document.querySelector('#ufoDesignsList .ufo-design-item.selected');
        const selectedPassenger = document.querySelector('#passengerDesignsList .passenger-design-item.selected');

        if (!selectedDesign) return;

        const designType = selectedDesign.getAttribute('data-type');
        const appearance = {
            type: designType,
            color: colorPicker.value
        };

        if (designType === 'custom') {
            appearance.image = selectedDesign.getAttribute('data-image');
        }

        // Add passenger selection if one is selected (not "none")
        if (selectedPassenger) {
            const passengerValue = selectedPassenger.getAttribute('data-passenger');
            if (passengerValue && passengerValue !== 'none') {
                appearance.passenger = passengerValue;
            }
        }

        // Send appearance update to server
        this.networking.updatePlayerAppearance(appearance);

        // Update local player appearance for immediate feedback
        if (this.currentPlayer) {
            this.currentPlayer.ufoAppearance = appearance;
            // Always update the color property for username display
            this.currentPlayer.color = appearance.color;
        }
    }
}
