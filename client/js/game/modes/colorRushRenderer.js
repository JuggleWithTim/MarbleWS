class ColorRushRenderer {
    constructor(renderer, game) {
        this.renderer = renderer;
        this.game = game;
        this.canvas = renderer.canvas;
        this.ctx = renderer.ctx;

        // Color Rush specific properties
        this.safeSectionId = 0;
        this.roundState = 'waiting';
        this.roundNumber = 0;
        this.sections = [
            { id: 0, color: '#ff7b00', x: 0, y: 0, width: 960, height: 540 },      // Top-left
            { id: 1, color: '#7300a9', x: 960, y: 0, width: 960, height: 540 },    // Top-right
            { id: 2, color: '#48c5e0', x: 0, y: 540, width: 960, height: 540 },    // Bottom-left
            { id: 3, color: '#db930e', x: 960, y: 540, width: 960, height: 540 }   // Bottom-right
        ];

        // Animation properties for section highlighting
        this.highlightAlpha = 0;
        this.highlightDirection = 1;
        this.lastHighlightChange = 0;

        // Results screen properties
        this.resultsData = [];
        this.showResults = false;
        this.resultsStartTime = 0;
        this.resultsDuration = 15000; // 15 seconds

        // Grace period properties
        this.currentGracePeriod = 0;
        this.gracePeriodEndTime = 0;
    }

    // Update Color Rush specific data
    updateGameModeData(gameModeData) {
        if (!gameModeData || gameModeData.mode !== 'colorRush') return;

        this.roundState = gameModeData.roundState;
        this.roundNumber = gameModeData.currentRound;
        this.safeSectionId = gameModeData.safeSectionId;
        this.resultsData = gameModeData.roundResults || [];
        this.showResults = this.roundState === 'results';

        if (this.roundState === 'results' && gameModeData.resultsStartTime) {
            this.resultsStartTime = gameModeData.resultsStartTime;
        }
    }

    // Render Color Rush specific elements
    render() {
        if (!this.game.gameState || !this.game.gameState.gameMode ||
            this.game.gameState.gameMode.mode !== 'colorRush') {
            return;
        }

        // Update from game state
        this.updateGameModeData(this.game.gameState.gameMode);

        // Render section overlays
        this.renderSectionOverlays();

        // Render safe section highlighting
        this.renderSafeSectionHighlight();

        // Render round status
        this.renderRoundStatus();

        // Render results screen if active
        if (this.showResults) {
            this.renderResultsScreen();
        }

        // Render player status indicators
        this.renderPlayerStatusIndicators();
    }

    renderSectionOverlays() {
        this.ctx.save();

        // Draw semi-transparent colored overlays for each section
        this.sections.forEach(section => {
            this.ctx.fillStyle = section.color + '20'; // 12% opacity
            this.ctx.fillRect(section.x, section.y, section.width, section.height);

            // Draw section borders
            this.ctx.strokeStyle = section.color + '40'; // 25% opacity
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(section.x, section.y, section.width, section.height);
        });

        this.ctx.restore();
    }

    renderSafeSectionHighlight() {
        if (this.roundState !== 'active') return;

        // Animate highlight alpha
        const currentTime = performance.now();
        if (currentTime - this.lastHighlightChange > 50) { // Update every 50ms
            this.highlightAlpha += this.highlightDirection * 0.05;
            if (this.highlightAlpha >= 0.8) {
                this.highlightAlpha = 0.8;
                this.highlightDirection = -1;
            } else if (this.highlightAlpha <= 0.2) {
                this.highlightAlpha = 0.2;
                this.highlightDirection = 1;
            }
            this.lastHighlightChange = currentTime;
        }

        this.ctx.save();

        const safeSection = this.sections[this.safeSectionId];
        if (safeSection) {
            // Draw pulsing highlight overlay
            const alphaHex = Math.floor(this.highlightAlpha * 255).toString(16).padStart(2, '0');
            this.ctx.fillStyle = safeSection.color + alphaHex;
            this.ctx.fillRect(safeSection.x, safeSection.y, safeSection.width, safeSection.height);

            // Draw brighter border
            this.ctx.strokeStyle = safeSection.color;
            this.ctx.lineWidth = 4;
            this.ctx.strokeRect(safeSection.x + 2, safeSection.y + 2,
                               safeSection.width - 4, safeSection.height - 4);
        }

        this.ctx.restore();
    }

    renderRoundStatus() {
        if (this.roundState === 'waiting') {
            this.renderWaitingStatus();
        } else if (this.roundState === 'active') {
            this.renderActiveStatus();
        }
    }

    renderWaitingStatus() {
        this.ctx.save();

        // Draw waiting overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw waiting text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('WAITING FOR PLAYERS', this.canvas.width / 2, this.canvas.height / 2 - 50);

        this.ctx.font = '24px Arial';
        this.ctx.fillText('Round will start when players join', this.canvas.width / 2, this.canvas.height / 2 + 20);

        this.ctx.restore();
    }

    renderActiveStatus() {
        this.ctx.save();

        // Calculate grace period remaining
        const currentTime = Date.now();
        const graceRemaining = Math.max(0, this.gracePeriodEndTime - currentTime);
        const graceSeconds = Math.ceil(graceRemaining / 1000);

        // Draw round info in top-left corner (expanded for grace period)
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(10, 10, 250, graceRemaining > 0 ? 100 : 80);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Round ${this.roundNumber}`, 20, 35);

        const safeSection = this.sections[this.safeSectionId];
        if (safeSection) {
            this.ctx.fillStyle = safeSection.color;
            this.ctx.fillText(`Safe: ${this.getSectionName(this.safeSectionId)}`, 20, 60);

            // Show grace period countdown if active
            if (graceRemaining > 0) {
                this.ctx.fillStyle = graceSeconds <= 2 ? '#ff6b6b' : '#ffffff';
                this.ctx.font = 'bold 16px Arial';
                this.ctx.fillText(`Move now: ${graceSeconds}s`, 20, 85);
            }
        }

        this.ctx.restore();
    }

    renderResultsScreen() {
        if (!this.resultsData || this.resultsData.length === 0) return;

        this.ctx.save();

        // Semi-transparent background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Title
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('ROUND RESULTS', this.canvas.width / 2, 100);

        // Results list
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'left';

        const startY = 180;
        const lineHeight = 40;

        this.resultsData.slice(0, 10).forEach((result, index) => {
            const y = startY + index * lineHeight;
            const player = this.game.gameState.players.find(p => p.id === result.playerId);

            if (player) {
                // Rank and name
                this.ctx.fillStyle = result.survived ? '#4ecdc4' : '#ff6b6b';
                const rank = (index + 1).toString().padStart(2, ' ');
                const survivalTime = (result.survivalTime / 1000).toFixed(1);
                const status = result.survived ? '✓' : '✗';

                // Show rewards if available
                let rewardText = '';
                if (result.xpReward !== undefined && result.coinReward !== undefined) {
                    rewardText = ` (+${result.xpReward} XP, ${result.coinReward} coins)`;
                }

                this.ctx.fillText(`${rank}. ${player.username} - ${survivalTime}s ${status}${rewardText}`,
                                this.canvas.width / 2 - 250, y);
            }
        });

        // Next round countdown
        const elapsed = Date.now() - this.resultsStartTime;
        const remaining = Math.max(0, this.resultsDuration - elapsed);
        const seconds = Math.ceil(remaining / 1000);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Next round starts in ${seconds} seconds`,
                        this.canvas.width / 2, this.canvas.height - 50);

        this.ctx.restore();
    }

    renderPlayerStatusIndicators() {
        if (!this.game.gameState || !this.game.gameState.gameMode) return;

        const gameModeData = this.game.gameState.gameMode;
        const deadPlayers = new Set(gameModeData.deadPlayers || []);
        const waitingPlayers = new Set(gameModeData.waitingPlayers || []);

        // Render dead player indicators
        this.game.gameState.players.forEach(player => {
            if (deadPlayers.has(player.id)) {
                this.renderDeadPlayerIndicator(player);
            } else if (waitingPlayers.has(player.id)) {
                this.renderWaitingPlayerIndicator(player);
            }
        });
    }

    renderDeadPlayerIndicator(player) {
        // Draw "OUT" indicator above player
        const interpolated = this.game.getInterpolatedPosition(`player_${player.id}`);
        const x = interpolated ? interpolated.x : player.x;
        const y = interpolated ? interpolated.y : player.y;

        this.ctx.save();

        this.ctx.fillStyle = 'rgba(255, 107, 107, 0.8)';
        this.ctx.fillRect(x - 30, y - 60, 60, 20);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('OUT', x, y - 45);

        this.ctx.restore();
    }

    renderWaitingPlayerIndicator(player) {
        // Draw "WAITING" indicator above player
        const interpolated = this.game.getInterpolatedPosition(`player_${player.id}`);
        const x = interpolated ? interpolated.x : player.x;
        const y = interpolated ? interpolated.y : player.y;

        this.ctx.save();

        this.ctx.fillStyle = 'rgba(78, 205, 196, 0.8)';
        this.ctx.fillRect(x - 40, y - 60, 80, 20);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('WAITING', x, y - 45);

        this.ctx.restore();
    }

    getSectionName(sectionId) {
        const names = ['Top-Left', 'Top-Right', 'Bottom-Left', 'Bottom-Right'];
        return names[sectionId] || 'Unknown';
    }

    // Handle Color Rush specific events
    handleRoundStart(data) {
        console.log('Color Rush round started:', data);
        this.roundNumber = data.round;
        this.safeSectionId = data.safeSection;
        this.roundState = 'active';
        this.currentGracePeriod = data.gracePeriod || 0;
        this.gracePeriodEndTime = Date.now() + this.currentGracePeriod;
    }

    handleRoundEnd(data) {
        console.log('Color Rush round ended:', data);
        this.roundState = 'results';
        this.resultsData = data.results;
        this.resultsStartTime = Date.now();
    }

    handleNextRound(data) {
        console.log('Color Rush next round:', data);
        this.roundState = 'waiting';
        this.resultsData = [];
        this.showResults = false;
    }

    handleSafeSectionChange(data) {
        console.log('Safe section changed:', data);
        this.safeSectionId = data.safeSection;
        this.currentGracePeriod = data.gracePeriod || 0;
        this.gracePeriodEndTime = Date.now() + this.currentGracePeriod;
        // Add visual flash effect
        this.highlightAlpha = 1.0;
        this.highlightDirection = -1;
    }

    handlePlayerDeath(data) {
        console.log('Player died:', data);
        // Could add death animation or effect here
    }
}

// Make it globally available
window.ColorRushRenderer = ColorRushRenderer;
