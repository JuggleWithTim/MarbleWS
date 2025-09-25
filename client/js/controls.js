class Controls {
    constructor() {
        this.keys = {};
        this.mousePos = { x: 0, y: 0 };
        this.mouseDown = false;
        this.callbacks = {};
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Keyboard events
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            this.handleKeyDown(e);
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            this.handleKeyUp(e);
        });

        // Mouse events
        document.addEventListener('mousemove', (e) => {
            this.mousePos.x = e.clientX;
            this.mousePos.y = e.clientY;
        });

        document.addEventListener('mousedown', (e) => {
            this.mouseDown = true;
            this.emit('mouseDown', { x: e.clientX, y: e.clientY, button: e.button });
        });

        document.addEventListener('mouseup', (e) => {
            this.mouseDown = false;
            this.emit('mouseUp', { x: e.clientX, y: e.clientY, button: e.button });
        });

        // Prevent context menu on right click
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Prevent default behavior for game keys
        document.addEventListener('keydown', (e) => {
            if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) {
                e.preventDefault();
            }
        });
    }

    handleKeyDown(e) {
        switch (e.code) {
            case 'Space':
                this.emit('beamActivate');
                break;
            case 'Enter':
                this.emit('chatFocus');
                break;
            case 'Escape':
                this.emit('escape');
                break;
        }
    }

    handleKeyUp(e) {
        switch (e.code) {
            case 'Space':
                this.emit('beamDeactivate');
                break;
        }
    }

    getMovementVector() {
        const movement = { x: 0, y: 0 };
        
        if (this.keys['KeyW'] || this.keys['ArrowUp']) {
            movement.y -= 1;
        }
        if (this.keys['KeyS'] || this.keys['ArrowDown']) {
            movement.y += 1;
        }
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
            movement.x -= 1;
        }
        if (this.keys['KeyD'] || this.keys['ArrowRight']) {
            movement.x += 1;
        }

        // Normalize diagonal movement
        if (movement.x !== 0 && movement.y !== 0) {
            const length = Math.sqrt(movement.x * movement.x + movement.y * movement.y);
            movement.x /= length;
            movement.y /= length;
        }

        return movement;
    }

    isKeyPressed(keyCode) {
        return !!this.keys[keyCode];
    }

    isBeamActive() {
        return this.keys['Space'];
    }

    getMousePosition() {
        return { ...this.mousePos };
    }

    isMouseDown() {
        return this.mouseDown;
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

    // Utility methods for UI interactions
    setupUIControls(game, basePath = '') {
        // Twitch login button
        const twitchLoginBtn = document.getElementById('twitchLoginBtn');
        if (twitchLoginBtn) {
            twitchLoginBtn.addEventListener('click', () => {
                window.location.href = `${basePath}/auth/twitch`;
            });
        }

        // Level select button
        const levelSelectBtn = document.getElementById('levelSelectBtn');
        if (levelSelectBtn) {
            levelSelectBtn.addEventListener('click', () => {
                game.showLevelSelect();
            });
        }

        // Editor button
        const editorBtn = document.getElementById('editorBtn');
        if (editorBtn) {
            editorBtn.addEventListener('click', () => {
                window.open(`${basePath}/editor`, '_blank');
            });
        }

        // Test emote button
        const testEmoteBtn = document.getElementById('testEmoteBtn');
        if (testEmoteBtn) {
            testEmoteBtn.addEventListener('click', () => {
                game.spawnTestEmote();
            });
        }

        // Chat input
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        
        if (messageInput && sendBtn) {
            const sendMessage = () => {
                const message = messageInput.value.trim();
                if (message) {
                    game.sendChatMessage(message);
                    messageInput.value = '';
                }
            };

            sendBtn.addEventListener('click', sendMessage);
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            });

            // Focus chat input when Enter is pressed
            this.on('chatFocus', () => {
                messageInput.focus();
            });
        }

        // Level select modal
        const levelSelectModal = document.getElementById('levelSelectModal');
        const closeBtn = levelSelectModal?.querySelector('.close');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                levelSelectModal.style.display = 'none';
            });
        }

        if (levelSelectModal) {
            levelSelectModal.addEventListener('click', (e) => {
                if (e.target === levelSelectModal) {
                    levelSelectModal.style.display = 'none';
                }
            });
        }

        // Close modals with Escape key
        this.on('escape', () => {
            if (levelSelectModal && levelSelectModal.style.display !== 'none') {
                levelSelectModal.style.display = 'none';
            }
        });
    }

    // Canvas-specific controls
    setupCanvasControls(canvas, game) {
        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;
            
            this.emit('canvasClick', { x: canvasX, y: canvasY });
        });

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;
            
            this.emit('canvasMouseMove', { x: canvasX, y: canvasY });
            
            // Continuous beam interaction while spacebar is held
            if (this.isBeamActive()) {
                game.handleBeamTarget(canvasX, canvasY);
            }
        });

        // Handle beam targeting on click
        this.on('canvasClick', (pos) => {
            if (this.isBeamActive()) {
                game.handleBeamTarget(pos.x, pos.y);
            }
        });
        
        // Continuous beam targeting while moving mouse
        this.on('canvasMouseMove', (pos) => {
            if (this.isBeamActive()) {
                game.handleBeamTarget(pos.x, pos.y);
            }
        });
    }

    // Disable controls (useful for chat input focus)
    disable() {
        this.disabled = true;
    }

    enable() {
        this.disabled = false;
    }

    isDisabled() {
        return this.disabled;
    }
}
