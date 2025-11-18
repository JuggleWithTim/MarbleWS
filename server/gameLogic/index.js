const Matter = require('matter-js');
const EventEmitter = require('./eventEmitter');
const PlayerManager = require('./playerManager');
const LevelManager = require('./levelManager');
const PhysicsEngine = require('./physicsEngine');
const GameState = require('./gameState');

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

    // Set up cross-module references
    this.playerManager.setWorld(this.world);
    this.playerManager.setLevelObjects(this.levelManager.levelObjects);

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
    return this.gameState.getGameState();
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
