class GameState {
  constructor(eventEmitter, playerManager, levelManager) {
    this.eventEmitter = eventEmitter;
    this.playerManager = playerManager;
    this.levelManager = levelManager;
  }

  getGameState() {
    return {
      backgroundImage: (this.levelManager.currentLevel && this.levelManager.currentLevel.backgroundImage) ? this.levelManager.currentLevel.backgroundImage : '',
      marbleProperties: this.levelManager.marbleProperties, // Add marble properties to gameState
      gameMode: this.levelManager.getGameModeData(), // Add game mode data
      players: Array.from(this.playerManager.players.values()).map(player => ({
        id: player.id,
        username: player.username,
        userId: player.userId,
        color: player.color,
        ufoAppearance: player.ufoAppearance,
        unlockedUFOs: player.unlockedUFOs,
        unlockedPassengers: player.unlockedPassengers,
        unlockedHats: player.unlockedHats,
        x: player.x,
        y: player.y,
        beamActive: player.beamActive,
        beamTarget: player.beamTarget,
        xp: player.xp,
        level: player.level,
        xpProgress: this.playerManager.getXPProgress(player.xp, player.level),
        coins: player.coins
      })),
      marbles: this.levelManager.marbles.map(marble => ({
        id: marble.id,
        x: marble.body.position.x,
        y: marble.body.position.y,
        angle: marble.body.angle,
        type: marble.type
      })),
      emotes: this.levelManager.emotes.map(emote => ({
        id: emote.id,
        x: emote.body.position.x,
        y: emote.body.position.y,
        angle: emote.body.angle,
        type: emote.type,
        name: emote.name,
        url: emote.url
      })),
      levelObjects: this.levelManager.levelObjects.map(obj => ({
        id: obj.id,
        x: obj.body ? obj.body.position.x : obj.x,
        y: obj.body ? obj.body.position.y : obj.y,
        angle: obj.body ? obj.body.angle : 0,
        shape: obj.shape,
        width: obj.width,
        height: obj.height,
        radius: obj.radius,
        vertices: obj.vertices,
        color: obj.color,
        backgroundImage: obj.backgroundImage,
        isStatic: obj.isStatic,
        isSolid: obj.isSolid !== false, // Default to true if not specified
        zIndex: obj.zIndex || 0,
        nextLevel: obj.nextLevel,
        properties: obj.properties
      })),
      connections: this.levelManager.constraints.map(constraint => ({
        id: constraint.id,
        type: constraint.type,
        bodyA: constraint.bodyA,
        bodyB: constraint.bodyB,
        pointA: constraint.pointA,
        pointB: constraint.pointB,
        length: constraint.length,
        stiffness: constraint.stiffness,
        damping: constraint.damping
      }))
    };
  }
}

module.exports = GameState;
