const Matter = require('matter-js');
const EventEmitter = require('./eventEmitter');
const PlayerManager = require('./playerManager');
const LevelManager = require('./levelManager');
const PhysicsEngine = require('./physicsEngine');
const GameState = require('./gameState');
const GameModeManager = require('./gameModes/index');

class GameLogic {
  constructor() {
    // Initialize Matter.js engine and world
    this.engine = Matter.Engine.create();
    this.world = this.engine.world;

    // Configure physics
    this.engine.world.gravity.y = 0.8; // Default gravity, will be updated when level loads

    // Initialize modules
    this.eventEmitter = new EventEmitter();
    this.playerManager = new PlayerManager(this.eventEmitter);
    this.levelManager = new LevelManager(this.eventEmitter);
    this.physicsEngine = new PhysicsEngine(this.eventEmitter);
    this.gameState = new GameState(this.eventEmitter, this.playerManager, this.levelManager);
    this.gameModeManager = new GameModeManager(this.eventEmitter, this.playerManager, this.levelManager);

    // Dungeon mode follow target tracking
    this.dungeonFollowTarget = null;

    // Set up cross-module references
    this.playerManager.setWorld(this.world);
    this.playerManager.setLevelObjects(this.levelManager.levelObjects);
    this.playerManager.setGameMode(this.gameModeManager.currentGameMode);

    this.levelManager.setWorld(this.world);
    this.levelManager.setEngine(this.engine);
    this.levelManager.setPlayerManager(this.playerManager);
    this.levelManager.setActiveObjects(this.physicsEngine.activeObjects);

    this.physicsEngine.setWorld(this.world);
    this.physicsEngine.setEngine(this.engine);
    this.physicsEngine.setPlayerManager(this.playerManager);
    this.physicsEngine.setLevelManager(this.levelManager);

    // Start physics loop
    this.physicsEngine.startPhysicsLoop();
  }

  // Event system (delegate to eventEmitter)
  on(event, callback) {
    this.eventEmitter.on(event, callback);
  }

  emit(event, data) {
    this.eventEmitter.emit(event, data);
  }

  // Player management (delegate to playerManager)
  addPlayer(socketId, username, userId) {
    return this.playerManager.addPlayer(socketId, username, userId);
  }

  removePlayer(socketId) {
    this.playerManager.removePlayer(socketId);
  }

  updatePlayerInput(socketId, input) {
    this.playerManager.updatePlayerInput(socketId, input);
  }

  activateBeam(socketId, active) {
    this.playerManager.activateBeam(socketId, active);
  }

  updatePlayerAppearance(socketId, appearance) {
    this.playerManager.updatePlayerAppearance(socketId, appearance);
  }

  unlockUFO(socketId, ufoImage) {
    return this.playerManager.unlockUFO(socketId, ufoImage);
  }

  unlockPassenger(socketId, passengerImage) {
    return this.playerManager.unlockPassenger(socketId, passengerImage);
  }

  unlockHat(socketId, hatImage) {
    return this.playerManager.unlockHat(socketId, hatImage);
  }

  addCoinsToPlayer(userId, amount, reason = 'unknown') {
    return this.playerManager.addCoinsToPlayer(userId, amount, reason);
  }

  // Twitch chat movement helpers
  handlePlayerJumpByUserId(userId) {
    const player = Array.from(this.players.values()).find(p => p.userId === userId);
    if (!player || !player.body) {
      return { success: false, message: 'Player not found or offline' };
    }

    const Matter = require('matter-js');
    const steps = 6; // up/down 3 times
    const intervalMs = 150;
    let step = 0;

    const timer = setInterval(() => {
      if (!player.body) {
        clearInterval(timer);
        return;
      }

      const isUp = step % 2 === 0;
      const forceY = isUp ? -0.03 : 0.03;
      Matter.Body.applyForce(player.body, player.body.position, { x: 0, y: forceY });
      step += 1;

      if (step >= steps) {
        clearInterval(timer);
      }
    }, intervalMs);

    return { success: true, message: 'Jumped!' };
  }

  handlePlayerWiggleByUserId(userId) {
    const player = Array.from(this.players.values()).find(p => p.userId === userId);
    if (!player || !player.body) {
      return { success: false, message: 'Player not found or offline' };
    }

    const Matter = require('matter-js');
    const steps = 8; // left/right 4 times
    const intervalMs = 150;
    let step = 0;

    const timer = setInterval(() => {
      if (!player.body) {
        clearInterval(timer);
        return;
      }

      const isLeft = step % 2 === 0;
      const forceX = isLeft ? -0.03 : 0.03;
      Matter.Body.applyForce(player.body, player.body.position, { x: forceX, y: 0 });
      step += 1;

      if (step >= steps) {
        clearInterval(timer);
      }
    }, intervalMs);

    return { success: true, message: 'Wiggled!' };
  }

  // Chair sitting functionality
  handlePlayerSit(socketId, chairNumber) {
    const player = this.players.get(socketId);
    if (!player) {
      return { success: false, message: 'Player not found' };
    }

    return this.sitPlayerOnChair(player, chairNumber);
  }

  async handlePlayerSitByUserId(userId, chairNumber, username) {
    // Find online player first
    let player = Array.from(this.players.values()).find(p => p.userId === userId);

    if (player) {
      // Player is online, move their existing UFO
      return this.sitPlayerOnChair(player, chairNumber);
    } else {
      // Player is offline, spawn them at the chair
      return await this.spawnPlayerAtChair(userId, username, chairNumber);
    }
  }

  sitPlayerOnChair(player, chairNumber) {
    // Find available chairs in current level
    const chairs = this.levelManager.levelObjects.filter(obj => obj.chair !== undefined);

    if (chairs.length === 0) {
      return { success: false, message: 'No chairs available in this level' };
    }

    let targetChair;
    if (chairNumber !== null) {
      // Find specific chair
      targetChair = chairs.find(chair => chair.chair === chairNumber);
      if (!targetChair) {
        return { success: false, message: `Chair ${chairNumber} not found` };
      }
    } else {
      // Pick random available chair
      targetChair = chairs[Math.floor(Math.random() * chairs.length)];
      chairNumber = targetChair.chair;
    }

    // Move player to chair position (50px higher)
    if (player.body) {
      Matter.Body.setPosition(player.body, { x: targetChair.x, y: targetChair.y - 50 });
      Matter.Body.setVelocity(player.body, { x: 0, y: 0 });
      player.x = targetChair.x;
      player.y = targetChair.y - 50;
    }

    return {
      success: true,
      message: `Sat on chair ${chairNumber}`,
      chairNumber,
      x: targetChair.x,
      y: targetChair.y - 50
    };
  }

  async spawnPlayerAtChair(userId, username, chairNumber) {
    // Find available chairs in current level
    const chairs = this.levelManager.levelObjects.filter(obj => obj.chair !== undefined);

    if (chairs.length === 0) {
      return { success: false, message: 'No chairs available in this level' };
    }

    let targetChair;
    if (chairNumber !== null) {
      // Find specific chair
      targetChair = chairs.find(chair => chair.chair === chairNumber);
      if (!targetChair) {
        return { success: false, message: `Chair ${chairNumber} not found` };
      }
    } else {
      // Pick random available chair
      targetChair = chairs[Math.floor(Math.random() * chairs.length)];
      chairNumber = targetChair.chair;
    }

    // Create a temporary socket-like object for spawning
    const tempSocketId = `offline_${userId}_${Date.now()}`;

    // Spawn player at chair position
    const playerData = await this.playerManager.addPlayer(tempSocketId, username, userId);

    // Override spawn position to chair (50px higher)
    const player = this.players.get(tempSocketId);
    if (player && player.body) {
      Matter.Body.setPosition(player.body, { x: targetChair.x, y: targetChair.y - 50});
      player.x = targetChair.x;
      player.y = targetChair.y - 50;

      // Mark as offline spawn (could be used for cleanup later)
      player.isOfflineSpawn = true;
    }

    return {
      success: true,
      message: `Spawned at chair ${chairNumber}`,
      chairNumber,
      x: targetChair.x,
      y: targetChair.y - 50,
      playerId: tempSocketId
    };
  }

  // Chair unsit functionality
  handlePlayerUnsitByUserId(userId) {
    // Find player by userId (could be online or offline-spawned)
    const player = Array.from(this.players.values()).find(p => p.userId === userId);

    if (!player) {
      return { success: false, message: 'Player not found' };
    }

    // Remove the player from the game
    this.removePlayer(player.id);

    return {
      success: true,
      message: 'Player despawned',
      playerId: player.id,
      username: player.username
    };
  }

  // Level management (delegate to levelManager)
  loadLevel(levelData) {
    this.levelManager.loadLevel(levelData);
  }

  spawnMarble(x, y) {
    this.levelManager.spawnMarble(x, y);
  }

  spawnEmote(emoteUrl, emoteName) {
    this.levelManager.spawnEmote(emoteUrl, emoteName);
  }

  // Physics and interactions (delegate to physicsEngine)
  handleBeamInteraction(socketId, targetX, targetY) {
    this.physicsEngine.handleBeamInteraction(socketId, targetX, targetY);
  }

  // Game state (delegate to gameState)
  getGameState() {
    const gameState = this.gameState.getGameState();

    // Add dungeon follow target to game state if in dungeon mode
    if (gameState.gameMode && gameState.gameMode.mode === 'dungeon') {
      gameState.gameMode.followTarget = this.dungeonFollowTarget;
    }

    return gameState;
  }

  // Dungeon mode follow target management
  setDungeonFollowTarget(username) {
    this.dungeonFollowTarget = username;
    console.log(`Dungeon mode overlay follow target set to: ${username}`);
  }

  clearDungeonFollowTarget() {
    this.dungeonFollowTarget = null;
    console.log(`Dungeon mode overlay follow target cleared`);
  }

  getDungeonFollowTarget() {
    return this.dungeonFollowTarget;
  }

  // Expose current level for backward compatibility
  get currentLevel() {
    return this.levelManager.currentLevel;
  }

  // Expose players for backward compatibility
  get players() {
    return this.playerManager.players;
  }
}

module.exports = GameLogic;
