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

    // Streamer state
    this.streamerPlayer = null;
    this.streamerGrabbedObject = null;
    this.streamerSocketId = null;
    this.streamerGrabbedConstraint = null;

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

  // Streamer functionality
  addStreamerPlayer(socketId) {
    // Remove existing streamer player if it exists
    if (this.streamerPlayer) {
      this.removePlayer(this.streamerPlayer.id);
    }

    // Create streamer player as a special player
    this.streamerPlayer = {
      id: socketId,
      username: 'Alien Claw',
      userId: 'streamer_system',
      x: 960,
      y: 540,
      color: '#9b59b6',
      level: 999,
      xp: 0,
      coins: 0,
      beamActive: false,
      isStreamer: true
    };

    this.streamerSocketId = socketId;

    console.log('Streamer player added:', this.streamerPlayer.username);
    return this.streamerPlayer;
  }

  removeStreamerPlayer() {
    if (this.streamerPlayer) {
      // Clean up any grabbed objects and constraints
      if (this.streamerGrabbedConstraint) {
        Matter.World.remove(this.world, this.streamerGrabbedConstraint);
      }

      this.streamerPlayer = null;
      this.streamerGrabbedObject = null;
      this.streamerSocketId = null;
      this.streamerGrabbedConstraint = null;
      console.log('Streamer player removed');
    }
  }

  handleStreamerGrabObject(socketId, worldX, worldY) {
    if (socketId !== this.streamerSocketId || !this.streamerPlayer || this.streamerGrabbedObject) return;

    // Get all objects that have physics bodies (can be grabbed)
    const allObjects = [
      ...this.levelManager.levelObjects,
      ...this.levelManager.marbles,
      ...this.levelManager.emotes
    ].filter(obj => obj.body); // Only objects with physics bodies can be grabbed

    if (allObjects.length === 0) {
      console.log(`No grab-able objects found in level`);
      return;
    }

    // Find the closest object at the given position (within 75px radius for better reach)
    let closestObject = null;
    let closestDistance = 75; // Increased reach

    for (const obj of allObjects) {
      const distance = Math.sqrt(Math.pow(obj.x - worldX, 2) + Math.pow(obj.y - worldY, 2));
      if (distance < closestDistance) {
        closestDistance = distance;
        closestObject = obj;
      }
    }

    if (closestObject) {
      this.streamerGrabbedObject = closestObject;

      // Create a constraint to fix the object to the mouse position
      this.streamerGrabbedConstraint = Matter.Constraint.create({
        bodyA: closestObject.body,
        pointA: { x: 0, y: 0 },
        pointB: { x: worldX, y: worldY },
        stiffness: 1.0, // Perfectly rigid
        damping: 1.0
      });

      Matter.World.add(this.world, this.streamerGrabbedConstraint);

      console.log(`Streamer grabbed object (type: ${closestObject.shape || 'marble'}, distance: ${closestDistance.toFixed(1)}px) at (${worldX}, ${worldY})`);
    } else {
      console.log(`No objects found within 75px of (${worldX}, ${worldY}). Total grab-able objects: ${allObjects.length}`);
    }
  }

  handleStreamerMoveObject(socketId, worldX, worldY) {
    if (socketId !== this.streamerSocketId || !this.streamerGrabbedConstraint) return;

    // Update the constraint point to move the object
    this.streamerGrabbedConstraint.pointB.x = worldX;
    this.streamerGrabbedConstraint.pointB.y = worldY;
  }

  handleStreamerReleaseObject(socketId) {
    if (socketId !== this.streamerSocketId) return;

    if (this.streamerGrabbedObject && this.streamerGrabbedConstraint) {
      console.log('Streamer released object');

      // Remove the constraint from the world
      Matter.World.remove(this.world, this.streamerGrabbedConstraint);

      // Clear references
      this.streamerGrabbedObject = null;
      this.streamerGrabbedConstraint = null;
    }
  }

  updateStreamerClawPosition(worldX, worldY) {
    if (!this.streamerPlayer) return;

    this.streamerPlayer.x = worldX;
    this.streamerPlayer.y = worldY;
  }

  // Modified removePlayer to handle streamer removal
  removePlayer(socketId) {
    if (socketId === this.streamerSocketId) {
      this.removeStreamerPlayer();
    } else {
      this.playerManager.removePlayer(socketId);
    }
  }

  // Modified getGameState to include streamer data
  getGameState() {
    const gameState = this.gameState.getGameState();

    // Add dungeon follow target to game state if in dungeon mode
    if (gameState.gameMode && gameState.gameMode.mode === 'dungeon') {
      gameState.gameMode.followTarget = this.dungeonFollowTarget;
    }

    // Add streamer claw position to game state
    if (this.streamerPlayer) {
      gameState.streamerClaw = {
        x: this.streamerPlayer.x,
        y: this.streamerPlayer.y
      };
    }

    // Mark grabbed object for visual feedback
    if (this.streamerGrabbedObject) {
      gameState.streamerGrabbedObject = this.streamerGrabbedObject.id;
    }

    return gameState;
  }
}

module.exports = GameLogic;
