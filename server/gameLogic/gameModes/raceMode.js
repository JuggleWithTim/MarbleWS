const BaseGameMode = require('./baseMode');
const gameConfig = require('../../../shared/gameConfig');

class RaceMode extends BaseGameMode {
  constructor(eventEmitter, playerManager, levelManager) {
    super(eventEmitter, playerManager, levelManager);

    this.raceState = 'waiting'; // waiting | countdown | active | finished
    this.countdownStartTime = 0;
    this.raceStartTime = 0;

    this.laps = gameConfig.raceMode?.laps || 3;
    this.checkpoints = [];
    this.finishLines = [];
    this.playerProgress = new Map();
    this.finishOrder = [];

    this.resultsStartTime = 0;
    this.resultsDuration = gameConfig.raceMode?.resultsDurationMs || 15000;
  }

  getModeName() {
    return 'Race';
  }

  init(levelData) {
    super.init(levelData);
    this.laps = levelData.race?.laps || gameConfig.raceMode?.laps || 3;
    this.checkpoints = this.collectObjectsByProperty('checkpoint');
    this.finishLines = this.collectObjectsByProperty('finish');
    this.sortCheckpoints();
    this.resetRaceState();
    this.startCountdown();
    console.log(`Race mode initialized with ${this.checkpoints.length} checkpoints and ${this.laps} laps`);
  }

  cleanup() {
    super.cleanup();
    this.resetRaceState();
  }

  resetRaceState() {
    this.raceState = 'waiting';
    this.countdownStartTime = 0;
    this.raceStartTime = 0;
    this.playerProgress.clear();
    this.finishOrder = [];
    this.resultsStartTime = 0;
  }

  collectObjectsByProperty(propertyName) {
    if (!this.levelManager || !this.levelManager.levelObjects) return [];
    return this.levelManager.levelObjects.filter(obj =>
      obj.properties && obj.properties.includes(propertyName)
    );
  }

  sortCheckpoints() {
    this.checkpoints.sort((a, b) => {
      const orderA = typeof a.checkpointOrder === 'number' ? a.checkpointOrder : Number.MAX_SAFE_INTEGER;
      const orderB = typeof b.checkpointOrder === 'number' ? b.checkpointOrder : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) {
        return orderA - orderB;
      }

      return a.id.localeCompare(b.id);
    });
  }

  handlePlayerJoin(player) {
    this.ensurePlayerProgress(player.id);
    return { canJoin: true, spawnImmediately: true };
  }

  handlePlayerLeave(playerId) {
    this.playerProgress.delete(playerId);
  }

  handlePlayerInput(playerId, input) {
    if (this.raceState === 'countdown') {
      return false;
    }

    if (this.raceState !== 'active') {
      return false;
    }

    return true;
  }

  update(deltaTime) {
    const now = Date.now();

    if (this.raceState === 'countdown') {
      this.updateCountdown(now);
      return;
    }

    if (this.raceState === 'finished') {
      this.updateResultsState(now);
      return;
    }

    if (this.raceState !== 'active') return;

    this.checkCheckpointProgress();
    this.checkFinishLine();
  }

  updateResultsState(now) {
    if (!this.resultsStartTime) return;
    if (now - this.resultsStartTime >= this.resultsDuration) {
      this.startNextRace(now);
    }
  }

  updateCountdown(now) {
    const countdownSeconds = gameConfig.raceMode?.countdownSeconds || 3;
    const elapsed = (now - this.countdownStartTime) / 1000;
    const remaining = Math.max(0, Math.ceil(countdownSeconds - elapsed));

    if (remaining !== this.lastCountdownValue) {
      this.lastCountdownValue = remaining;
      this.eventEmitter.emit('raceCountdown', {
        remaining,
        total: countdownSeconds
      });
    }

    if (elapsed >= countdownSeconds) {
      this.startRace(now);
    }
  }

  startCountdown() {
    this.raceState = 'countdown';
    this.countdownStartTime = Date.now();
    this.lastCountdownValue = null;
  }

  startRace(now) {
    this.raceState = 'active';
    this.raceStartTime = now;
    this.eventEmitter.emit('raceStart', {
      startTime: this.raceStartTime
    });
  }

  ensurePlayerProgress(playerId) {
    if (!this.playerProgress.has(playerId)) {
      this.playerProgress.set(playerId, {
        lap: 1,
        checkpointIndex: 0,
        lastCheckpointId: null,
        finished: false,
        finishTime: null
      });
    }

  }

  resetPlayerProgress() {
    for (const [playerId] of this.playerManager.players) {
      this.playerProgress.set(playerId, {
        lap: 1,
        checkpointIndex: 0,
        lastCheckpointId: null,
        finished: false,
        finishTime: null
      });
    }
  }

  checkCheckpointProgress() {
    if (this.checkpoints.length === 0) return;

    for (const [playerId, player] of this.playerManager.players) {
      const progress = this.playerProgress.get(playerId);
      if (!progress || progress.finished) continue;

      const nextCheckpoint = this.checkpoints[progress.checkpointIndex];
      if (!nextCheckpoint) continue;

      if (this.isPlayerCollidingWithObject(player, nextCheckpoint)) {
        progress.lastCheckpointId = nextCheckpoint.id;
        progress.checkpointIndex = (progress.checkpointIndex + 1) % this.checkpoints.length;

        this.eventEmitter.emit('raceCheckpoint', {
          playerId,
          checkpointId: nextCheckpoint.id,
          checkpointIndex: progress.checkpointIndex,
          lap: progress.lap
        });
      }
    }
  }

  checkFinishLine() {
    if (this.finishLines.length === 0) return;

    for (const [playerId, player] of this.playerManager.players) {
      const progress = this.playerProgress.get(playerId);
      if (!progress || progress.finished) continue;

      const finishLine = this.finishLines[0];
      if (!this.isPlayerCollidingWithObject(player, finishLine)) {
        continue;
      }

      // Require all checkpoints for a lap completion
      if (progress.checkpointIndex === 0 && progress.lastCheckpointId) {
        progress.lap += 1;
        progress.lastCheckpointId = null;

        this.eventEmitter.emit('raceLap', {
          playerId,
          lap: progress.lap,
          totalLaps: this.laps
        });
      }

      if (progress.lap > this.laps) {
        progress.finished = true;
        progress.finishTime = Date.now() - this.raceStartTime;
        const player = this.playerManager.players.get(playerId);
        this.finishOrder.push({
          playerId,
          finishTime: progress.finishTime
        });

        this.eventEmitter.emit('raceFinished', {
          playerId,
          playerName: player ? player.username : undefined,
          finishTime: progress.finishTime,
          position: this.finishOrder.length
        });

        if (this.finishOrder.length >= this.playerManager.players.size) {
          this.endRace();
        }
      }
    }
  }

  endRace() {
    this.raceState = 'finished';
    this.resultsStartTime = Date.now();
    this.eventEmitter.emit('raceEnd', {
      results: this.finishOrder,
      resultsStartTime: this.resultsStartTime,
      resultsDuration: this.resultsDuration
    });
  }

  startNextRace(now) {
    this.finishOrder = [];
    this.resetPlayerProgress();
    this.respawnPlayers();
    this.startCountdown();
    this.eventEmitter.emit('raceNextRound', {
      startTime: now + (gameConfig.raceMode?.countdownSeconds || 3) * 1000
    });
  }

  respawnPlayers() {
    let respawnLocation = this.levelManager.levelObjects.find(obj =>
      obj.properties && obj.properties.includes('playerspawn')
    );

    if (!respawnLocation) {
      respawnLocation = this.levelManager.levelObjects.find(obj =>
        obj.properties && obj.properties.includes('spawnpoint')
      );
    }

    const respawnX = respawnLocation ? (respawnLocation.body ? respawnLocation.body.position.x : respawnLocation.x) : 960;
    const respawnY = respawnLocation ? (respawnLocation.body ? respawnLocation.body.position.y : respawnLocation.y) : 540;

    for (const [playerId, player] of this.playerManager.players) {
      if (!player.body) continue;
      player.input = null;
      player.speedMultiplier = 1;
      player.speedBoostExpiresAt = 0;
      player.beamActive = false;
      player.beamTarget = null;
      const Matter = require('matter-js');
      Matter.Body.setPosition(player.body, { x: respawnX, y: respawnY });
      Matter.Body.setVelocity(player.body, { x: 0, y: 0 });
      player.x = respawnX;
      player.y = respawnY;
    }
  }

  isPlayerCollidingWithObject(player, obj) {
    if (!player.body || !obj) return false;
    const playerX = player.body.position.x;
    const playerY = player.body.position.y;

    const objX = obj.body ? obj.body.position.x : obj.x;
    const objY = obj.body ? obj.body.position.y : obj.y;

    if (obj.shape === 'circle') {
      const radius = obj.radius || 50;
      const distance = Math.hypot(playerX - objX, playerY - objY);
      return distance <= radius + 25;
    }

    const halfWidth = (obj.width || 100) / 2;
    const halfHeight = (obj.height || 100) / 2;
    return (
      playerX >= objX - halfWidth &&
      playerX <= objX + halfWidth &&
      playerY >= objY - halfHeight &&
      playerY <= objY + halfHeight
    );
  }

  getGameStateData() {
    const positions = this.calculatePositions();
    return {
      mode: 'race',
      raceState: this.raceState,
      laps: this.laps,
      countdownStartTime: this.countdownStartTime,
      raceStartTime: this.raceStartTime,
      resultsStartTime: this.resultsStartTime,
      resultsDuration: this.resultsDuration,
      checkpoints: this.checkpoints.map(cp => ({ id: cp.id, x: cp.x, y: cp.y })),
      finishLines: this.finishLines.map(fl => ({ id: fl.id, x: fl.x, y: fl.y })),
      playerProgress: Object.fromEntries(this.playerProgress),
      positions,
      results: this.raceState === 'finished' ? this.finishOrder : []
    };
  }

  calculatePositions() {
    const standings = [];
    for (const [playerId, player] of this.playerManager.players) {
      const progress = this.playerProgress.get(playerId);
      if (!progress) continue;

      const checkpointIndex = progress.checkpointIndex || 0;
      const lap = progress.lap || 1;
      const progressScore = lap * 1000 + checkpointIndex * 10;

      standings.push({
        playerId,
        lap,
        checkpointIndex,
        finished: progress.finished,
        finishTime: progress.finishTime,
        score: progressScore
      });
    }

    standings.sort((a, b) => {
      if (a.finished && b.finished) {
        return a.finishTime - b.finishTime;
      }
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.score - a.score;
    });

    return standings;
  }
}

module.exports = RaceMode;