class Networking {
    constructor() {
        this.BASE_PATH = ''; // Will be set dynamically
        this.socket = null;
        this.connected = false;
        this.currentPlayer = null;
        this.gameState = {
            players: [],
            marbles: [],
            emotes: [],
            levelObjects: []
        };
        this.callbacks = {};
        this.configLoaded = false;
    }

    async loadConfig() {
        // Try server path first (/marblews/api/client-config)
        try {
            const response = await fetch('/marblews/api/client-config');
            if (response.ok) {
                const config = await response.json();
                this.BASE_PATH = config.basePath || '/marblews';
                this.configLoaded = true;
                console.log('Client config loaded from server path:', config);
                return;
            }
        } catch (error) {
            console.log('Server path failed, trying local path...');
        }

        // Fall back to local path (/api/client-config)
        try {
            const response = await fetch('/api/client-config');
            const config = await response.json();
            this.BASE_PATH = config.basePath || '';
            this.configLoaded = true;
            console.log('Client config loaded from local path:', config);
        } catch (error) {
            console.error('Failed to load client config from both paths, using defaults:', error);
            this.BASE_PATH = '';
            this.configLoaded = true;
        }
    }

    async loadSocketIOScript() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `${this.BASE_PATH}/socket.io/socket.io.js`;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async connect() {
        // Dynamically load Socket.IO script based on base path
        if (!window.io) {
            await this.loadSocketIOScript();
        }

        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.connected = true;
            this.emit('connected');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.connected = false;
            this.emit('disconnected');
        });

        // Game events
        this.socket.on('loginSuccess', (player) => {
            this.currentPlayer = player;
            this.emit('loginSuccess', player);
        });

        this.socket.on('gameState', (gameState) => {
            this.gameState = gameState;
            this.emit('gameState', gameState);
        });

        this.socket.on('gameStateUpdate', (gameState) => {
            this.gameState = gameState;
            this.emit('gameStateUpdate', gameState);
        });

        this.socket.on('playerJoined', (player) => {
            this.emit('playerJoined', player);
        });

        this.socket.on('playerLeft', (data) => {
            this.emit('playerLeft', data);
        });

        this.socket.on('playerMoved', (data) => {
            this.emit('playerMoved', data);
        });

        this.socket.on('playerBeam', (data) => {
            this.emit('playerBeam', data);
        });

        this.socket.on('levelLoaded', (data) => {
            this.emit('levelLoaded', data);
        });

        this.socket.on('chatMessage', (data) => {
            this.emit('chatMessage', data);
        });

        this.socket.on('error', (error) => {
            console.error('Server error:', error);
            this.emit('error', error);
        });
    }

    login(username, userId) {
        if (this.socket && this.connected) {
            this.socket.emit('login', { username, userId });
        }
    }

    sendPlayerInput(input) {
        if (this.socket && this.connected) {
            this.socket.emit('playerInput', input);
        }
    }

    sendBeamToggle(active) {
        if (this.socket && this.connected) {
            this.socket.emit('beamToggle', { active });
        }
    }

    sendBeamInteraction(targetX, targetY) {
        if (this.socket && this.connected) {
            this.socket.emit('beamInteraction', { targetX, targetY });
        }
    }

    loadLevel(levelName) {
        if (this.socket && this.connected) {
            this.socket.emit('loadLevel', levelName);
        }
    }

    sendChatMessage(message) {
        if (this.socket && this.connected) {
            this.socket.emit('chatMessage', { message });
        }
    }

    spawnTestEmote(emoteName) {
        if (this.socket && this.connected) {
            this.socket.emit('spawnTestEmote', { emoteName });
        }
    }

    // Event system
    on(event, callback) {
        if (!this.callbacks[event]) {
            this.callbacks[event] = [];
        }
        this.callbacks[event].push(callback);
    }

    off(event, callback) {
        if (this.callbacks[event]) {
            const index = this.callbacks[event].indexOf(callback);
            if (index > -1) {
                this.callbacks[event].splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => callback(data));
        }
    }

    // API calls for levels
    async fetchLevels() {
        try {
            const response = await fetch(`${this.BASE_PATH}/api/levels`);
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch levels:', error);
            return [];
        }
    }

    async fetchLevel(levelName) {
        try {
            const response = await fetch(`${this.BASE_PATH}/api/levels/${levelName}`);
            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (error) {
            console.error('Failed to fetch level:', error);
            return null;
        }
    }

    async saveLevel(levelName, levelData) {
        try {
            const response = await fetch(`${this.BASE_PATH}/api/levels/${levelName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(levelData),
            });
            return response.ok;
        } catch (error) {
            console.error('Failed to save level:', error);
            return false;
        }
    }

    getCurrentPlayer() {
        return this.currentPlayer;
    }

    getGameState() {
        return this.gameState;
    }

    isConnected() {
        return this.connected;
    }
}
