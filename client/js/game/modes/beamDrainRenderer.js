class BeamDrainRenderer {
constructor(renderer, game) {
        this.renderer = renderer;
        this.game = game;
        this.canvas = renderer.canvas;
        this.ctx = renderer.ctx;

        this.roundState = 'waiting';
        this.roundNumber = 0;
        this.roundStartTime = 0;
        this.resultsStartTime = 0;
        this.resultsDuration = 15000;
        this.maxEnergy = 100;
        this.startEnergy = 50;

        this.alivePlayers = [];
        this.waitingPlayers = [];
        this.energyByPlayer = {};
        this.resultsData = [];
        this.drainParticles = [];

        this.lastEventText = null;
        this.lastEventTime = 0;
        this.eventDuration = 2500;
    }

    updateGameModeData(gameModeData) {
        if (!gameModeData || gameModeData.mode !== 'beamDrain') return;

        this.roundState = gameModeData.roundState || 'waiting';
        this.roundNumber = gameModeData.roundNumber || 0;
        this.roundStartTime = gameModeData.roundStartTime || 0;
        this.resultsStartTime = gameModeData.resultsStartTime || this.resultsStartTime;
        this.resultsDuration = gameModeData.resultsDuration || this.resultsDuration;
        this.maxEnergy = gameModeData.maxEnergy || this.maxEnergy;
        this.startEnergy = gameModeData.startEnergy || this.startEnergy;

        this.alivePlayers = gameModeData.alivePlayers || [];
        this.waitingPlayers = gameModeData.waitingPlayers || [];
        this.energyByPlayer = gameModeData.energyByPlayer || {};
        this.resultsData = gameModeData.results || [];
        this.drainParticles = gameModeData.drainParticles || [];
    }

    render() {
        if (!this.game.gameState || !this.game.gameState.gameMode ||
            this.game.gameState.gameMode.mode !== 'beamDrain') {
            return;
        }

        this.updateGameModeData(this.game.gameState.gameMode);

        this.renderParticleDrops();
        this.renderModeStatus();
        this.renderPlayerEnergyBars();
        this.renderBanner();

        if (this.roundState === 'results') {
            this.renderResultsScreen();
        }
    }

    renderModeStatus() {
        const players = this.game.gameState.players || [];
        if (players.length === 0) return;

        this.ctx.save();

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(10, 10, 260, 92);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('Beam Drain', 20, 35);

        this.ctx.font = '14px Arial';
        this.ctx.fillText(`Round: ${this.roundNumber}`, 20, 56);
        this.ctx.fillText(`State: ${String(this.roundState || '').toUpperCase()}`, 20, 76);
        this.ctx.fillText(`Alive: ${this.alivePlayers.length}`, 20, 96);

        this.ctx.restore();
    }

    renderPlayerEnergyBars() {
        const players = this.game.gameState.players || [];
        if (players.length === 0) return;

        this.ctx.save();

        players.forEach(player => {
            if (this.waitingPlayers.includes(player.id)) {
                return;
            }

            const energy = Number(this.energyByPlayer[player.id] ?? this.startEnergy);
            const isAlive = this.alivePlayers.includes(player.id);

            const interpolated = typeof this.game.getInterpolatedPosition === 'function'
                ? this.game.getInterpolatedPosition(`player_${player.id}`)
                : null;

            const worldX = interpolated ? interpolated.x : player.x;
            const worldY = interpolated ? interpolated.y : player.y;
            const screen = this.renderer.worldToScreen(worldX, worldY);

            const zoom = this.renderer.camera.zoom;
            const visibilityBoost = zoom <= 1 ? 1.35 : 1;
            const width = 68 * zoom * visibilityBoost;
            const height = 9 * zoom * visibilityBoost;
            const x = screen.x - width / 2;
            const y = screen.y - ((49 + (visibilityBoost - 1) * 8) * zoom);
            const ratio = Math.max(0, Math.min(1, energy / Math.max(1, this.maxEnergy)));

            this.ctx.fillStyle = 'rgba(0,0,0,0.55)';
            this.ctx.fillRect(x - 1, y - 1, width + 2, height + 2);

            this.ctx.fillStyle = 'rgba(255,255,255,0.25)';
            this.ctx.fillRect(x, y, width, height);

            const r = Math.floor((1 - ratio) * 255);
            const g = Math.floor(ratio * 220 + 35);
            const alpha = isAlive ? 1 : 0.5;
            this.ctx.fillStyle = `rgba(${r},${g},90,${alpha})`;
            this.ctx.fillRect(x, y, width * ratio, height);

            this.ctx.strokeStyle = isAlive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)';
            this.ctx.strokeRect(x, y, width, height);
        });

        this.ctx.restore();
    }

    drawEnergyBar(x, y, width, height, energy, maxEnergy, labelLocal = false) {
        const ratio = Math.max(0, Math.min(1, energy / Math.max(1, maxEnergy)));
        this.ctx.fillStyle = 'rgba(255,255,255,0.2)';
        this.ctx.fillRect(x, y, width, height);

        const r = Math.floor((1 - ratio) * 255);
        const g = Math.floor(ratio * 220 + 35);
        this.ctx.fillStyle = `rgb(${r},${g},90)`;
        this.ctx.fillRect(x, y, width * ratio, height);

        this.ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        this.ctx.strokeRect(x, y, width, height);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px Arial';
        this.ctx.fillText(`${labelLocal ? 'Your Energy: ' : ''}${energy.toFixed(1)}%`, x + 8, y + 13);
    }

    renderParticleDrops() {
        if (!Array.isArray(this.drainParticles) || this.drainParticles.length === 0) return;

        this.ctx.save();
        const now = Date.now();
        this.drainParticles.forEach(p => {
            const screenPos = this.renderer.worldToScreen(p.x, p.y);
            const lifeRatio = Math.max(0, Math.min(1, (p.expiresAt - now) / 12000));
            const alpha = 0.3 + lifeRatio * 0.7;
            const size = Math.max(3, Math.min(10, 3 + (p.value || 1) * 0.4)) * this.renderer.camera.zoom;

            this.ctx.beginPath();
            this.ctx.fillStyle = `rgba(120, 255, 220, ${alpha})`;
            this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.restore();
    }

    renderResultsScreen() {
        if (!this.resultsData || this.resultsData.length === 0) return;

        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 46px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('BEAM DRAIN RESULTS', this.canvas.width / 2, 95);

        this.ctx.font = 'bold 22px Arial';
        this.ctx.textAlign = 'left';

        const players = this.game.gameState.players || [];
        const startY = 165;
        const lineHeight = 36;

        this.resultsData.slice(0, 10).forEach((result, index) => {
            const player = players.find(p => p.id === result.playerId);
            const username = player ? player.username : (result.username || result.playerId);
            const y = startY + index * lineHeight;
            const place = `${index + 1}.`;
            const status = result.survived ? 'SURVIVED' : 'OUT';
            const survivalSeconds = ((result.survivalTime || 0) / 1000).toFixed(1);
            const finalEnergy = Number(result.finalEnergy || 0).toFixed(1);
            const drained = Number(result.drained || 0).toFixed(1);
            const reward = (result.xpReward !== undefined && result.coinReward !== undefined)
                ? ` (+${result.xpReward} XP, ${result.coinReward} coins)`
                : '';

            this.ctx.fillStyle = index === 0 ? '#ffd166' : (result.survived ? '#a8ffcf' : '#ffb3b3');
            this.ctx.fillText(
                `${place} ${username} - ${status} | ${survivalSeconds}s | E:${finalEnergy}% | Drain:${drained}${reward}`,
                this.canvas.width / 2 - 460,
                y
            );
        });

        const elapsed = Date.now() - this.resultsStartTime;
        const remaining = Math.max(0, this.resultsDuration - elapsed);
        const seconds = Math.ceil(remaining / 1000);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Next round starts in ${seconds}s`, this.canvas.width / 2, this.canvas.height - 44);
        this.ctx.restore();
    }

    renderBanner() {
        if (!this.lastEventText) return;
        const elapsed = Date.now() - this.lastEventTime;
        if (elapsed > this.eventDuration) {
            this.lastEventText = null;
            return;
        }

        const alpha = 1 - (elapsed / this.eventDuration);
        this.ctx.save();
        this.ctx.fillStyle = `rgba(0,0,0,${0.6 * alpha})`;
        this.ctx.fillRect(this.canvas.width / 2 - 250, 110, 500, 48);
        this.ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(this.lastEventText, this.canvas.width / 2, 140);
        this.ctx.restore();
    }

    setEvent(message) {
        this.lastEventText = message;
        this.lastEventTime = Date.now();
    }

    handleRoundStart(data) {
        this.roundState = 'active';
        this.roundNumber = data?.round || this.roundNumber;
        this.setEvent('Beam Drain started!');
    }

    handleRoundEnd(data) {
        this.roundState = 'results';
        this.resultsData = data?.results || this.resultsData;
        this.resultsStartTime = data?.resultsStartTime || Date.now();
        this.resultsDuration = data?.resultsDuration || this.resultsDuration;
        this.setEvent('Round finished!');
    }

    handleNextRound() {
        this.roundState = 'waiting';
        this.resultsData = [];
        this.setEvent('Next round preparing...');
    }

    handlePlayerEliminated(data) {
        if (!data || !data.playerId) return;
        const player = (this.game.gameState?.players || []).find(p => p.id === data.playerId);
        this.setEvent(`${player?.username || 'A player'} was eliminated!`);
    }
}

window.BeamDrainRenderer = BeamDrainRenderer;
