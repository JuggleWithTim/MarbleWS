class Networking {
    constructor() {
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
    }

    connect() {
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
            const response = await fetch('/api/levels');
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch levels:', error);
            return [];
        }
    }

    async fetchLevel(levelName) {
        try {
            const response = await fetch(`/api/levels/${levelName}`);
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
            const response = await fetch(`/api/levels/${levelName}`, {
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
