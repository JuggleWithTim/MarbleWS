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
        this.lastPlayerPosition = { x: 400, y: 300 };
        this.beamActive = false;
        this.lastMovementUpdate = 0; // For throttling movement updates
        
        // UI elements
        this.loginScreen = null;
        this.gameScreen = null;
        this.levelSelectModal = null;
    }

    init() {
        this.setupUI();
        this.setupNetworking();
        this.checkDevMode();
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
        
        this.controls.setupUIControls(this);
        
        // Setup beam controls
        this.controls.on('beamActivate', () => {
            this.activateBeam(true);
        });
        
        this.controls.on('beamDeactivate', () => {
            this.activateBeam(false);
        });
    }

    setupNetworking() {
        this.networking.connect();
        
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
        });
        
        this.networking.on('gameStateUpdate', (gameState) => {
            this.gameState = gameState;
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
    }

    async checkDevMode() {
        try {
            const response = await fetch('/api/config');
            const config = await response.json();
            
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
            const response = await fetch('/api/dev-login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username }),
            });
            
            if (response.ok) {
                const userData = await response.json();
                
                // Login with dev credentials
                this.networking.on('connected', () => {
                    this.networking.login(userData.username, userData.userId);
                });
                
                // If already connected, login immediately
                if (this.networking.isConnected()) {
                    this.networking.login(userData.username, userData.userId);
                }
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
            this.networking.on('connected', () => {
                this.networking.login(username, userId);
            });
            
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
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

    updatePlayerInfo() {
        if (!this.currentPlayer) return;
        
        const playerName = document.getElementById('playerName');
        const playerLevel = document.getElementById('playerLevel');
        const xpFill = document.getElementById('xpFill');
        
        if (playerName) {
            playerName.textContent = this.currentPlayer.username;
        }
        
        if (playerLevel) {
            playerLevel.textContent = `Level ${this.currentPlayer.level}`;
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
        
        if (movement.x !== 0 || movement.y !== 0) {
            // Calculate new position
            const newX = this.lastPlayerPosition.x + movement.x * this.playerSpeed * deltaTime;
            const newY = this.lastPlayerPosition.y + movement.y * this.playerSpeed * deltaTime;
            
            // Clamp to canvas bounds (with some padding)
            const padding = 50;
            const clampedX = Math.max(padding, Math.min(this.canvas.width - padding, newX));
            const clampedY = Math.max(padding, Math.min(this.canvas.height - padding, newY));
            
            this.lastPlayerPosition.x = clampedX;
            this.lastPlayerPosition.y = clampedY;
            
            // Throttle movement updates to 20 FPS (50ms intervals)
            if (currentTime - this.lastMovementUpdate >= 50) {
                this.networking.sendPlayerMove(clampedX, clampedY);
                this.lastMovementUpdate = currentTime;
            }
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

    render() {
        if (!this.renderer || !this.gameState) return;
        
        this.renderer.clear();
        
        // Update camera to follow current player
        if (this.currentPlayer) {
            this.renderer.setCamera(
                this.lastPlayerPosition.x,
                this.lastPlayerPosition.y,
                1
            );
        }
        
        // Render level objects
        this.gameState.levelObjects.forEach(obj => {
            this.renderer.drawLevelObject(obj);
        });
        
        // Render marbles
        this.gameState.marbles.forEach(marble => {
            this.renderer.drawMarble(marble.x, marble.y, marble.angle);
        });
        
        // Render emotes
        this.gameState.emotes.forEach(emote => {
            this.renderer.drawEmote(emote.x, emote.y, emote.url, emote.angle);
        });
        
        // Render players
        this.gameState.players.forEach(player => {
            const isCurrentPlayer = player.id === this.currentPlayer?.id;
            const color = isCurrentPlayer ? '#4ecdc4' : '#ff6b6b';
            
            this.renderer.drawUFO(player.x, player.y, color, player.beamActive);
            this.renderer.drawPlayerName(player.x, player.y, player.username, color);
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
}
