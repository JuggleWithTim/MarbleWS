const BaseGameMode = require('./baseMode');

class ColorRushMode extends BaseGameMode {
  constructor(eventEmitter, playerManager, levelManager) {
    super(eventEmitter, playerManager, levelManager);

    // Color Rush specific properties
    this.roundState = 'waiting'; // 'waiting', 'active', 'results'
    this.currentRound = 0;
    this.roundStartTime = 0;
    this.resultsStartTime = 0;

    // Game configuration
    this.resultsDuration = 10000; // 10 seconds period between rounds to show results
    this.safeColorChangeInterval = 5000; // 5 seconds between color changes
    this.initialGracePeriod = 8000; // 8 seconds initial grace period
    this.minGracePeriod = 2000; // 2 seconds minimum grace period
    this.gracePeriodDecay = 0.95; // Grace period reduces by 5% each change

    // Canvas sections (4 sections by default)
    this.sections = [
      { id: 0, color: '#ff6b6b', x: 0, y: 0, width: 960, height: 540 },      // Top-left (red)
      { id: 1, color: '#4ecdc4', x: 960, y: 0, width: 960, height: 540 },    // Top-right (teal)
      { id: 2, color: '#45b7d1', x: 0, y: 540, width: 960, height: 540 },    // Bottom-left (blue)
      { id: 3, color: '#f9ca24', x: 960, y: 540, width: 960, height: 540 }   // Bottom-right (yellow)
    ];

    this.safeSectionId = 0; // Current safe section
    this.lastColorChange = 0;
    this.currentGracePeriod = 0; // Current grace period duration
    this.gracePeriodEndTime = 0; // When the current grace period ends
    this.nextGracePeriod = 0; // Duration for the next grace period

    // Player tracking
    this.alivePlayers = new Set(); // Players still in game
    this.deadPlayers = new Map(); // playerId -> death time
    this.waitingPlayers = new Set(); // Players waiting for next round
    this.playerSections = new Map(); // playerId -> current section

    // Round results
    this.roundResults = [];
  }

  getModeName() {
    return 'Color Rush';
  }

  init(levelData) {
    super.init(levelData);
    this.resetRound();
    console.log('Color Rush mode initialized');
  }

  cleanup() {
    super.cleanup();
    this.resetRound();
  }

  resetRound() {
    this.roundState = 'waiting';
    this.currentRound = 0;
    this.roundStartTime = 0;
    this.resultsStartTime = 0;
    this.safeSectionId = 0;
    this.lastColorChange = 0;
    this.alivePlayers.clear();
    this.deadPlayers.clear();
    this.waitingPlayers.clear();
    this.playerSections.clear();
    this.roundResults = [];
  }

  handlePlayerJoin(player) {
    if (this.roundState === 'active') {
      // During active rounds, new players wait for next round
      this.waitingPlayers.add(player.id);
      return { canJoin: true, spawnImmediately: false };
    } else {
      // During waiting/results, players can join immediately
      this.alivePlayers.add(player.id);
      return { canJoin: true, spawnImmediately: true };
    }
  }

  handlePlayerLeave(playerId) {
    this.alivePlayers.delete(playerId);
    this.deadPlayers.delete(playerId);
    this.waitingPlayers.delete(playerId);
    this.playerSections.delete(playerId);
  }

  handlePlayerInput(playerId, input) {
    // Dead players cannot move
    if (this.deadPlayers.has(playerId)) {
      return false;
    }
    return true;
  }

  canPlayerUseBeam(playerId) {
    // Dead players cannot use beam
    return !this.deadPlayers.has(playerId);
  }

  update(deltaTime) {
    const currentTime = Date.now();

    switch (this.roundState) {
      case 'waiting':
        this.updateWaitingState(currentTime);
        break;
      case 'active':
        this.updateActiveState(currentTime, deltaTime);
        break;
      case 'results':
        this.updateResultsState(currentTime);
        break;
    }
  }

  updateWaitingState(currentTime) {
    // Check if we have enough players to start (at least 1)
    if (this.alivePlayers.size >= 1) {
      this.startRound(currentTime);
    }
  }

  updateActiveState(currentTime, deltaTime) {
    // Check if grace period has ended
    if (currentTime >= this.gracePeriodEndTime) {
      // Grace period ended - kill players not in safe section and start new grace period
      this.checkPlayerPositions();
      this.startNewGracePeriod();
    }
  }

  updateResultsState(currentTime) {
    // Check if results duration is over
    if (currentTime - this.resultsStartTime >= this.resultsDuration) {
      this.startNextRound(currentTime);
    }
  }

  startRound(currentTime) {
    this.roundState = 'active';
    this.roundStartTime = currentTime;
    this.lastColorChange = currentTime;
    this.currentRound++;

    // Choose random initial safe section for this round
    this.safeSectionId = Math.floor(Math.random() * this.sections.length);

    // Initialize grace period for first safe section
    this.currentGracePeriod = this.initialGracePeriod;
    this.gracePeriodEndTime = currentTime + this.currentGracePeriod;
    this.nextGracePeriod = this.currentGracePeriod;

    // Revive all connected players for the new round
    // Get all players from the player manager
    for (const [playerId, player] of this.playerManager.players) {
      this.alivePlayers.add(playerId);
    }

    // Move waiting players to alive (in case any were waiting)
    for (const playerId of this.waitingPlayers) {
      this.alivePlayers.add(playerId);
    }
    this.waitingPlayers.clear();

    // Reset dead players for new round
    this.deadPlayers.clear();

    console.log(`Round ${this.currentRound} started with ${this.alivePlayers.size} players. Initial safe section: ${this.getSectionName(this.safeSectionId)}, grace period: ${this.currentGracePeriod}ms`);

    // Emit round start event
    this.eventEmitter.emit('colorRushRoundStart', {
      round: this.currentRound,
      safeSection: this.safeSectionId,
      playerCount: this.alivePlayers.size,
      gracePeriod: this.currentGracePeriod
    });
  }

  endRound() {
    this.roundState = 'results';
    this.resultsStartTime = Date.now();

    // Calculate survival times and rankings
    this.calculateResults();

    console.log(`Round ${this.currentRound} ended. ${this.alivePlayers.size} survivors.`);

    // Emit round end event
    this.eventEmitter.emit('colorRushRoundEnd', {
      round: this.currentRound,
      results: this.roundResults,
      survivorCount: this.alivePlayers.size
    });
  }

  startNextRound(currentTime) {
    // If no one survived the previous round, revive all connected players
    if (this.alivePlayers.size === 0) {
      for (const [playerId, player] of this.playerManager.players) {
        this.alivePlayers.add(playerId);
      }
      console.log(`No survivors - revived all ${this.alivePlayers.size} connected players for next round.`);
    } else {
      console.log(`${this.alivePlayers.size} survivors carry over to next round.`);
    }

    // Reset round-specific state
    this.roundState = 'waiting';
    this.deadPlayers.clear();
    this.playerSections.clear();

    // Move any waiting players to alive (in case new players joined during results)
    for (const playerId of this.waitingPlayers) {
      this.alivePlayers.add(playerId);
    }
    this.waitingPlayers.clear();

    console.log(`Next round ready. ${this.alivePlayers.size} players waiting to start.`);

    // Emit next round event
    this.eventEmitter.emit('colorRushNextRound', {
      nextRound: this.currentRound + 1
    });
  }

  startNewGracePeriod() {
    // Change to a new safe section
    const oldSafeSection = this.safeSectionId;
    let newSafeSection;
    do {
      newSafeSection = Math.floor(Math.random() * this.sections.length);
    } while (newSafeSection === this.safeSectionId);

    this.safeSectionId = newSafeSection;

    // Calculate next grace period (decaying over time)
    this.nextGracePeriod = Math.max(this.minGracePeriod, this.nextGracePeriod * this.gracePeriodDecay);
    this.currentGracePeriod = Math.round(this.nextGracePeriod);
    this.gracePeriodEndTime = Date.now() + this.currentGracePeriod;

    console.log(`New safe section: ${this.getSectionName(this.safeSectionId)}. Grace period: ${this.currentGracePeriod}ms`);

    // Emit safe section change event
    this.eventEmitter.emit('colorRushSafeSectionChange', {
      safeSection: this.safeSectionId,
      color: this.sections[this.safeSectionId].color,
      gracePeriod: this.currentGracePeriod
    });
  }

  checkPlayerPositions() {
    // Get all players from playerManager
    const allPlayers = Array.from(this.playerManager.players.values());

    for (const player of allPlayers) {
      if (!this.alivePlayers.has(player.id) || this.deadPlayers.has(player.id)) {
        continue; // Skip dead or waiting players
      }

      // Determine which section the player is in
      const section = this.getPlayerSection(player.x, player.y);
      this.playerSections.set(player.id, section);

      // Check if player is in safe section
      if (section !== this.safeSectionId) {
        this.killPlayer(player.id);
      }
    }
  }

  getPlayerSection(x, y) {
    // Canvas is 1920x1080, divided into 4 sections
    const centerX = 960;
    const centerY = 540;

    if (x < centerX && y < centerY) return 0; // Top-left
    if (x >= centerX && y < centerY) return 1; // Top-right
    if (x < centerX && y >= centerY) return 2; // Bottom-left
    return 3; // Bottom-right
  }

  getSectionName(sectionId) {
    const names = ['Top-Left', 'Top-Right', 'Bottom-Left', 'Bottom-Right'];
    return names[sectionId] || 'Unknown';
  }

  killPlayer(playerId) {
    if (this.deadPlayers.has(playerId)) return; // Already dead

    this.alivePlayers.delete(playerId);
    const deathTime = Date.now() - this.roundStartTime;
    this.deadPlayers.set(playerId, deathTime);

    // Emit player death event
    this.eventEmitter.emit('colorRushPlayerDeath', {
      playerId: playerId,
      deathTime: deathTime,
      survivorsLeft: this.alivePlayers.size
    });

    // Check if round should end (only one player left)
    if (this.alivePlayers.size <= 1) {
      setTimeout(() => this.endRound(), 1000); // Small delay for effect
    }
  }

  calculateResults() {
    this.roundResults = [];

    // Add surviving players (they get maximum survival time)
    const roundDuration = Date.now() - this.roundStartTime;
    for (const playerId of this.alivePlayers) {
      this.roundResults.push({
        playerId: playerId,
        survivalTime: roundDuration,
        survived: true
      });
    }

    // Add dead players with their survival times
    for (const [playerId, deathTime] of this.deadPlayers) {
      this.roundResults.push({
        playerId: playerId,
        survivalTime: deathTime,
        survived: false
      });
    }

    // Sort by survival time (longest first)
    this.roundResults.sort((a, b) => b.survivalTime - a.survivalTime);
  }

  getGameStateData() {
    return {
      mode: 'colorRush',
      roundState: this.roundState,
      currentRound: this.currentRound,
      roundStartTime: this.roundStartTime,
      resultsStartTime: this.resultsStartTime,
      safeSectionId: this.safeSectionId,
      sections: this.sections,
      alivePlayers: Array.from(this.alivePlayers),
      deadPlayers: Array.from(this.deadPlayers.keys()),
      waitingPlayers: Array.from(this.waitingPlayers),
      playerSections: Object.fromEntries(this.playerSections),
      roundResults: this.roundState === 'results' ? this.roundResults : []
    };
  }

  checkWinConditions() {
    // Color Rush doesn't have traditional win conditions
    // Rounds end by timeout or when only one player survives
    return null;
  }
}

module.exports = ColorRushMode;
