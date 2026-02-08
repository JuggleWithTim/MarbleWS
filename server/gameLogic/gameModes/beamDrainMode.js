const Matter = require('matter-js');
const BaseGameMode = require('./baseMode');
const gameConfig = require('../../../shared/gameConfig');

class BeamDrainMode extends BaseGameMode {
  constructor(eventEmitter, playerManager, levelManager) {
    super(eventEmitter, playerManager, levelManager);

    this.roundState = 'waiting'; // waiting | active | results
    this.roundStartTime = 0;
    this.resultsStartTime = 0;
    this.resultsDuration = gameConfig.beamDrainMode?.resultsDurationMs || 15000;

    this.startEnergy = gameConfig.beamDrainMode?.startEnergy ?? 50;
    this.maxEnergy = gameConfig.beamDrainMode?.maxEnergy ?? 100;
    this.particleUnitValue = gameConfig.beamDrainMode?.particleUnitValue ?? 5;
    this.particleLifetimeMs = gameConfig.beamDrainMode?.particleLifetimeMs ?? 12000;
    this.pickupPerSecond = gameConfig.beamDrainMode?.pickupPerSecond ?? 14;
    this.minPlayersToStart = gameConfig.beamDrainMode?.minPlayersToStart ?? 2;

    this.roundNumber = 0;
    this.alivePlayers = new Set();
    this.waitingPlayers = new Set();
    this.energyByPlayer = new Map();
    this.eliminationTimes = new Map();
    this.eliminatedBy = new Map();
    this.drainedByPlayer = new Map();
    this.drainParticles = [];
    this.results = [];
  }

  getModeName() {
    return 'Beam Drain';
  }

  init(levelData) {
    super.init(levelData);
    this.resetModeState();
    console.log('Beam Drain mode initialized');
  }

  cleanup() {
    super.cleanup();
    this.resetModeState();
  }

  resetModeState() {
    this.roundState = 'waiting';
    this.roundStartTime = 0;
    this.resultsStartTime = 0;
    this.roundNumber = 0;
    this.alivePlayers.clear();
    this.waitingPlayers.clear();
    this.energyByPlayer.clear();
    this.eliminationTimes.clear();
    this.eliminatedBy.clear();
    this.drainedByPlayer.clear();
    this.drainParticles = [];
    this.results = [];
  }

  handlePlayerJoin(player) {
    if (this.roundState === 'active') {
      this.waitingPlayers.add(player.id);
      return { canJoin: true, spawnImmediately: false };
    }

    this.alivePlayers.add(player.id);
    this.energyByPlayer.set(player.id, this.startEnergy);
    this.drainedByPlayer.set(player.id, this.drainedByPlayer.get(player.id) || 0);
    return { canJoin: true, spawnImmediately: true };
  }

  handlePlayerLeave(playerId) {
    this.alivePlayers.delete(playerId);
    this.waitingPlayers.delete(playerId);
    this.energyByPlayer.delete(playerId);
    this.eliminationTimes.delete(playerId);
    this.eliminatedBy.delete(playerId);
    this.drainedByPlayer.delete(playerId);

    if (this.roundState === 'active' && this.alivePlayers.size <= 1) {
      this.endRound();
    }
  }

  handlePlayerInput(playerId, input) {
    if (this.roundState !== 'active') return false;
    return this.alivePlayers.has(playerId);
  }

  canPlayerUseBeam(playerId) {
    return this.roundState === 'active' && this.alivePlayers.has(playerId);
  }

  update(deltaTime) {
    const now = Date.now();

    if (this.roundState === 'waiting') {
      this.updateWaitingState();
      return;
    }

    if (this.roundState === 'active') {
      this.cleanupExpiredParticles(now);
      if (this.alivePlayers.size <= 1) {
        this.endRound();
      }
      return;
    }

    if (this.roundState === 'results') {
      if (now - this.resultsStartTime >= this.resultsDuration) {
        this.startNextRound(now);
      }
    }
  }

  updateWaitingState() {
    if (this.playerManager.players.size >= this.minPlayersToStart) {
      this.startRound();
    }
  }

  startRound() {
    this.roundState = 'active';
    this.roundStartTime = Date.now();
    this.roundNumber += 1;

    this.alivePlayers.clear();
    this.waitingPlayers.clear();
    this.energyByPlayer.clear();
    this.eliminationTimes.clear();
    this.eliminatedBy.clear();
    this.results = [];
    this.drainParticles = [];

    for (const [playerId] of this.playerManager.players) {
      this.alivePlayers.add(playerId);
      this.energyByPlayer.set(playerId, this.startEnergy);
      this.drainedByPlayer.set(playerId, 0);
    }

    this.respawnPlayers();

    this.eventEmitter.emit('beamDrainRoundStart', {
      round: this.roundNumber,
      playerCount: this.alivePlayers.size,
      startEnergy: this.startEnergy,
      maxEnergy: this.maxEnergy
    });
  }

  endRound() {
    if (this.roundState !== 'active') return;

    this.roundState = 'results';
    this.resultsStartTime = Date.now();
    this.playerManager.clearAllInputs();
    this.calculateResults();
    this.playerManager.awardXPAndCoinsForBeamDrain(this.results);

    this.eventEmitter.emit('beamDrainRoundEnd', {
      round: this.roundNumber,
      results: this.results,
      resultsStartTime: this.resultsStartTime,
      resultsDuration: this.resultsDuration
    });
  }

  startNextRound(now) {
    this.roundState = 'waiting';
    this.results = [];
    this.resultsStartTime = 0;
    this.waitingPlayers.clear();
    this.drainParticles = [];

    this.eventEmitter.emit('beamDrainNextRound', {
      nextRound: this.roundNumber + 1,
      startTime: now
    });
  }

  isPlayerAlive(playerId) {
    return this.roundState === 'active' && this.alivePlayers.has(playerId);
  }

  transferEnergy(attackerId, victimId, amount, dropPosition = null) {
    if (this.roundState !== 'active') return;
    if (!this.isPlayerAlive(attackerId) || !this.isPlayerAlive(victimId)) return;
    if (attackerId === victimId) return;

    const attackerEnergy = this.getPlayerEnergy(attackerId);
    const victimEnergy = this.getPlayerEnergy(victimId);
    const drainAmount = Math.max(0, Math.min(victimEnergy, amount));

    if (drainAmount <= 0) return;

    const newVictimEnergy = Math.max(0, victimEnergy - drainAmount);
    let newAttackerEnergy = attackerEnergy + drainAmount;
    const overflow = Math.max(0, newAttackerEnergy - this.maxEnergy);
    if (overflow > 0) {
      newAttackerEnergy = this.maxEnergy;
      const dropX = dropPosition?.x ?? this.playerManager.players.get(victimId)?.x ?? 960;
      const dropY = dropPosition?.y ?? this.playerManager.players.get(victimId)?.y ?? 540;
      this.spawnOverflowParticles(overflow, dropX, dropY);
    }

    this.energyByPlayer.set(attackerId, newAttackerEnergy);
    this.energyByPlayer.set(victimId, newVictimEnergy);
    this.drainedByPlayer.set(attackerId, (this.drainedByPlayer.get(attackerId) || 0) + drainAmount);

    if (newVictimEnergy <= 0) {
      this.eliminatePlayer(victimId, attackerId);
    }
  }

  collectParticlesInBeam(playerId, beamVerts, verticesAPI, deltaTime) {
    if (!this.isPlayerAlive(playerId) || !Array.isArray(this.drainParticles) || this.drainParticles.length === 0) {
      return;
    }

    const pickupBudget = this.pickupPerSecond * deltaTime;
    if (pickupBudget <= 0) return;

    let remainingBudget = pickupBudget;
    const updatedParticles = [];

    for (const particle of this.drainParticles) {
      if (remainingBudget <= 0) {
        updatedParticles.push(particle);
        continue;
      }

      const insideBeam = verticesAPI.contains(beamVerts, { x: particle.x, y: particle.y });
      if (!insideBeam) {
        updatedParticles.push(particle);
        continue;
      }

      const pickup = Math.min(particle.value, remainingBudget);
      if (pickup > 0) {
        this.addEnergyToPlayer(playerId, pickup, { x: particle.x, y: particle.y });
        particle.value -= pickup;
        remainingBudget -= pickup;
      }

      if (particle.value > 0.001) {
        updatedParticles.push(particle);
      }
    }

    this.drainParticles = updatedParticles;
  }

  addEnergyToPlayer(playerId, amount, overflowDropPosition = null) {
    const currentEnergy = this.getPlayerEnergy(playerId);
    let nextEnergy = currentEnergy + amount;
    const overflow = Math.max(0, nextEnergy - this.maxEnergy);

    if (overflow > 0) {
      nextEnergy = this.maxEnergy;
      const dropX = overflowDropPosition?.x ?? this.playerManager.players.get(playerId)?.x ?? 960;
      const dropY = overflowDropPosition?.y ?? this.playerManager.players.get(playerId)?.y ?? 540;
      this.spawnOverflowParticles(overflow, dropX, dropY);
    }

    this.energyByPlayer.set(playerId, Math.max(0, Math.min(this.maxEnergy, nextEnergy)));
  }

  spawnOverflowParticles(value, x, y) {
    const amount = Math.max(0, value);
    if (amount <= 0) return;

    const now = Date.now();
    const particles = [];
    let remaining = amount;

    while (remaining > 0.001) {
      const chunk = Math.min(this.particleUnitValue, remaining);
      remaining -= chunk;
      particles.push({
        id: `bdp_${now}_${Math.random().toString(36).slice(2, 9)}`,
        x: x + (Math.random() - 0.5) * 120,
        y: y + (Math.random() - 0.5) * 120,
        value: chunk,
        spawnedAt: now,
        expiresAt: now + this.particleLifetimeMs
      });
    }

    if (particles.length > 0) {
      this.drainParticles.push(...particles);
      this.eventEmitter.emit('beamDrainParticleSpawned', { particles });
    }
  }

  cleanupExpiredParticles(now) {
    if (!this.drainParticles || this.drainParticles.length === 0) return;
    this.drainParticles = this.drainParticles.filter(p => p.expiresAt > now && p.value > 0.001);
  }

  eliminatePlayer(playerId, eliminatedBy = null) {
    if (!this.alivePlayers.has(playerId)) return;

    this.alivePlayers.delete(playerId);
    this.eliminationTimes.set(playerId, Date.now());
    this.eliminatedBy.set(playerId, eliminatedBy || null);

    const player = this.playerManager.players.get(playerId);
    if (player) {
      player.input = null;
      player.beamActive = false;
      player.beamTarget = null;
    }

    this.eventEmitter.emit('beamDrainPlayerEliminated', {
      playerId,
      eliminatedBy,
      survivorsLeft: this.alivePlayers.size
    });
  }

  getPlayerEnergy(playerId) {
    return Math.max(0, Math.min(this.maxEnergy, this.energyByPlayer.get(playerId) ?? this.startEnergy));
  }

  calculateResults() {
    const roundEnd = Date.now();
    const players = Array.from(this.playerManager.players.values());

    const survivors = players
      .filter(player => this.alivePlayers.has(player.id))
      .map(player => ({
        playerId: player.id,
        username: player.username,
        survived: true,
        survivalTime: roundEnd - this.roundStartTime,
        finalEnergy: this.getPlayerEnergy(player.id),
        drained: Math.round(this.drainedByPlayer.get(player.id) || 0),
        eliminatedBy: null
      }))
      .sort((a, b) => b.finalEnergy - a.finalEnergy);

    const eliminated = players
      .filter(player => !this.alivePlayers.has(player.id))
      .map(player => {
        const eliminatedAt = this.eliminationTimes.get(player.id) || this.roundStartTime;
        return {
          playerId: player.id,
          username: player.username,
          survived: false,
          survivalTime: Math.max(0, eliminatedAt - this.roundStartTime),
          finalEnergy: this.getPlayerEnergy(player.id),
          drained: Math.round(this.drainedByPlayer.get(player.id) || 0),
          eliminatedBy: this.eliminatedBy.get(player.id) || null,
          eliminatedAt
        };
      })
      .sort((a, b) => b.eliminatedAt - a.eliminatedAt);

    this.results = [...survivors, ...eliminated].map(({ eliminatedAt, ...result }) => result);
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
      player.beamActive = false;
      player.beamTarget = null;

      Matter.Body.setPosition(player.body, { x: respawnX, y: respawnY });
      Matter.Body.setVelocity(player.body, { x: 0, y: 0 });
      player.x = respawnX;
      player.y = respawnY;
      this.energyByPlayer.set(playerId, this.startEnergy);
    }
  }

  getGameStateData() {
    const baseData = super.getGameStateData();
    const energyByPlayer = {};
    for (const [playerId, energy] of this.energyByPlayer.entries()) {
      energyByPlayer[playerId] = Math.round(energy * 10) / 10;
    }

    return {
      ...baseData,
      mode: 'beamDrain',
      roundState: this.roundState,
      roundNumber: this.roundNumber,
      roundStartTime: this.roundStartTime,
      resultsStartTime: this.resultsStartTime,
      resultsDuration: this.resultsDuration,
      alivePlayers: Array.from(this.alivePlayers),
      waitingPlayers: Array.from(this.waitingPlayers),
      energyByPlayer,
      drainParticles: this.drainParticles.map(p => ({
        id: p.id,
        x: p.x,
        y: p.y,
        value: Math.round(p.value * 100) / 100,
        expiresAt: p.expiresAt
      })),
      results: this.roundState === 'results' ? this.results : [],
      maxEnergy: this.maxEnergy,
      startEnergy: this.startEnergy
    };
  }

  checkWinConditions() {
    return null;
  }
}

module.exports = BeamDrainMode;
