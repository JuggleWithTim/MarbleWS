class RaceRenderer {
    constructor(renderer, game) {
        this.renderer = renderer;
        this.game = game;
        this.canvas = renderer.canvas;
        this.ctx = renderer.ctx;

        this.raceState = 'waiting';
        this.countdownStartTime = 0;
        this.raceStartTime = 0;
        this.laps = 3;
        this.playerProgress = {};
        this.positions = [];
        this.finishLines = [];
        this.checkpoints = [];

        this.resultsData = [];
        this.resultsStartTime = 0;
        this.resultsDuration = 15000;
        this.showResults = false;

        this.countdownFlash = 0;
        this.lastCountdownPulse = 0;

        this.lastRaceEvent = null;
        this.lastRaceEventTime = 0;
        this.raceEventDuration = 3500;

    }

    updateGameModeData(gameModeData) {
        if (!gameModeData || gameModeData.mode !== 'race') return;

        this.raceState = gameModeData.raceState || 'waiting';
        this.countdownStartTime = gameModeData.countdownStartTime || 0;
        this.raceStartTime = gameModeData.raceStartTime || 0;
        this.laps = gameModeData.laps || 3;
        this.playerProgress = gameModeData.playerProgress || {};
        this.positions = gameModeData.positions || [];
        this.finishLines = gameModeData.finishLines || [];
        this.checkpoints = gameModeData.checkpoints || [];
        this.resultsData = gameModeData.results || [];
        this.resultsStartTime = gameModeData.resultsStartTime || this.resultsStartTime;
        this.resultsDuration = gameModeData.resultsDuration || this.resultsDuration;
        this.showResults = this.raceState === 'finished';
    }

    render() {
        if (!this.game.gameState || !this.game.gameState.gameMode ||
            this.game.gameState.gameMode.mode !== 'race') {
            return;
        }

        this.updateGameModeData(this.game.gameState.gameMode);

        this.renderHUD();
        this.renderCountdown();
        this.renderRaceEventBanner();
        if (this.showResults) {
            this.renderResultsScreen();
        }
    }

    renderHUD() {
        this.renderRaceStatusPanel();
        this.renderLeaderboard();
    }

    renderRaceStatusPanel() {
        this.ctx.save();

        const panelWidth = 280;
        const panelHeight = 90;
        const x = 10;
        const y = 10;

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        this.ctx.fillRect(x, y, panelWidth, panelHeight);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 18px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('Race Mode', x + 12, y + 26);

        this.ctx.font = '14px Arial';
        this.ctx.fillText(`State: ${this.raceState.toUpperCase()}`, x + 12, y + 48);
        this.ctx.fillText(`Laps: ${this.laps}`, x + 12, y + 68);

        const localProgress = this.getLocalPlayerProgress();
        if (localProgress) {
            const lapLabel = `Lap: ${Math.min(localProgress.lap, this.laps)}/${this.laps}`;
            this.ctx.fillText(lapLabel, x + 120, y + 68);
        }

        this.ctx.restore();
    }

    renderLeaderboard() {
        if (!this.positions.length) return;

        const x = this.canvas.width - 260;
        const y = 10;
        const width = 250;
        const height = Math.min(30 + this.positions.length * 24, 240);

        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(x, y, width, height);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('Standings', x + 10, y + 22);

        this.ctx.font = '13px Arial';
        this.positions.slice(0, 8).forEach((pos, index) => {
            const player = this.game.gameState.players.find(p => p.id === pos.playerId);
            if (!player) return;
            const isLocal = this.game.currentPlayer && this.game.currentPlayer.id === pos.playerId;
            this.ctx.fillStyle = isLocal ? '#4ecdc4' : '#ffffff';
            const status = pos.finished ? `(${(pos.finishTime / 1000).toFixed(1)}s)` : '';
            this.ctx.fillText(`${index + 1}. ${player.username} ${status}`, x + 10, y + 46 + index * 22);
        });

        this.ctx.restore();
    }

    renderCountdown() {
        if (this.raceState !== 'countdown') return;

        const countdownSeconds = 3;
        const elapsed = (Date.now() - this.countdownStartTime) / 1000;
        const remaining = Math.max(0, Math.ceil(countdownSeconds - elapsed));

        const now = performance.now();
        if (now - this.lastCountdownPulse > 50) {
            this.countdownFlash += 0.08;
            this.lastCountdownPulse = now;
        }

        const alpha = 0.6 + Math.sin(this.countdownFlash) * 0.4;

        this.ctx.save();
        this.ctx.fillStyle = `rgba(0, 0, 0, ${0.5 + alpha * 0.3})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 96px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(remaining > 0 ? remaining : 'GO!', this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.restore();
    }

    renderResultsScreen() {
        if (!this.resultsData || this.resultsData.length === 0) return;

        this.ctx.save();

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('RACE RESULTS', this.canvas.width / 2, 100);

        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'left';

        const startY = 180;
        const lineHeight = 40;

        this.resultsData.slice(0, 10).forEach((result, index) => {
            const y = startY + index * lineHeight;
            const player = this.game.gameState.players.find(p => p.id === result.playerId);
            if (!player) return;
            const rank = (index + 1).toString().padStart(2, ' ');
            const finishTime = result.finishTime !== null && result.finishTime !== undefined
                ? `${(result.finishTime / 1000).toFixed(2)}s`
                : 'DNF';
            let rewardText = '';
            if (result.xpReward !== undefined && result.coinReward !== undefined) {
                rewardText = ` (+${result.xpReward} XP, ${result.coinReward} coins)`;
            }
            this.ctx.fillStyle = index === 0 ? '#ffd166' : '#ffffff';
            this.ctx.fillText(`${rank}. ${player.username} - ${finishTime}${rewardText}`, this.canvas.width / 2 - 250, y);
        });

        const elapsed = Date.now() - this.resultsStartTime;
        const remaining = Math.max(0, this.resultsDuration - elapsed);
        const seconds = Math.ceil(remaining / 1000);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Next race starts in ${seconds} seconds`, this.canvas.width / 2, this.canvas.height - 50);

        this.ctx.restore();
    }

    renderRaceEventBanner() {
        if (!this.lastRaceEvent) return;

        const elapsed = Date.now() - this.lastRaceEventTime;
        if (elapsed > this.raceEventDuration) {
            this.lastRaceEvent = null;
            return;
        }

        const alpha = 1 - elapsed / this.raceEventDuration;
        this.ctx.save();
        this.ctx.fillStyle = `rgba(0, 0, 0, ${0.6 * alpha})`;
        this.ctx.fillRect(this.canvas.width / 2 - 200, 100, 400, 50);
        this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(this.lastRaceEvent, this.canvas.width / 2, 132);
        this.ctx.restore();
    }

    getLocalPlayerProgress() {
        if (!this.game.currentPlayer) return null;
        return this.playerProgress[this.game.currentPlayer.id];
    }

    handleCountdown(data) {
        this.countdownStartTime = Date.now() - ((data.total - data.remaining) * 1000);
        this.raceState = 'countdown';
    }

    handleRaceStart(data) {
        this.raceState = 'active';
        this.raceStartTime = data.startTime || Date.now();
        this.setRaceEvent('Race started!');
    }

    handleCheckpoint(data) {
        this.setRaceEvent(`Checkpoint reached!`);
    }

    handleLap(data) {
        this.setRaceEvent(`Lap ${data.lap - 1} complete!`);
    }


    handlePlayerEffect(data) {
        const effect = data.effectType || data.effect || data.itemType || data.item || 'Effect';
        this.setRaceEvent(`${effect.toUpperCase()} activated!`);
    }

    handleFinish(data) {
        this.setRaceEvent(`${data.playerName || 'Player'} finished!`);
    }

    handleRaceEnd(data) {
        this.raceState = 'finished';
        this.resultsData = data.results || [];
        this.resultsStartTime = data.resultsStartTime || Date.now();
        this.resultsDuration = data.resultsDuration || this.resultsDuration;
        this.showResults = true;
        this.setRaceEvent('Race finished!');
    }

    handleNextRace(data) {
        this.raceState = 'waiting';
        this.showResults = false;
        this.resultsData = [];
        this.setRaceEvent('Next race starting...');
    }

    setRaceEvent(message) {
        this.lastRaceEvent = message;
        this.lastRaceEventTime = Date.now();
    }
}

window.RaceRenderer = RaceRenderer;