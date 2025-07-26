const Matter = require('matter-js');

class GameLogic {
  constructor() {
    this.engine = Matter.Engine.create();
    this.world = this.engine.world;
    this.players = new Map();
    this.marbles = [];
    this.emotes = [];
    this.currentLevel = null;
    this.levelObjects = [];
    
    // Configure physics
    this.engine.world.gravity.y = 0.8;
    
    // Start physics loop
    this.startPhysicsLoop();
  }

  startPhysicsLoop() {
    setInterval(() => {
      Matter.Engine.update(this.engine, 16.67); // 60 FPS
      this.updateGameState();
    }, 16.67);
  }

  addPlayer(socketId, username, userId) {
    const player = {
      id: socketId,
      username,
      userId,
      x: 400,
      y: 300,
      beamActive: false,
      beamTarget: null,
      xp: 0,
      level: 1
    };
    
    this.players.set(socketId, player);
    return player;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
  }

  updatePlayerPosition(socketId, x, y) {
    const player = this.players.get(socketId);
    if (player) {
      player.x = x;
      player.y = y;
    }
  }

  activateBeam(socketId, active) {
    const player = this.players.get(socketId);
    if (player) {
      player.beamActive = active;
      if (!active) {
        player.beamTarget = null;
      }
    }
  }

  loadLevel(levelData) {
    // Clear existing level objects
    this.levelObjects.forEach(obj => {
      Matter.World.remove(this.world, obj.body);
    });
    this.levelObjects = [];
    this.marbles = [];

    this.currentLevel = levelData;

    // Create physics bodies for level objects
    levelData.objects.forEach(obj => {
      let body;
      
      if (obj.shape === 'rectangle') {
        body = Matter.Bodies.rectangle(obj.x, obj.y, obj.width, obj.height, {
          isStatic: obj.isStatic,
          friction: obj.friction || 0.3,
          restitution: obj.restitution || 0.3,
          render: {
            fillStyle: obj.color || '#888888'
          }
        });
      } else if (obj.shape === 'circle') {
        body = Matter.Bodies.circle(obj.x, obj.y, obj.radius, {
          isStatic: obj.isStatic,
          friction: obj.friction || 0.3,
          restitution: obj.restitution || 0.3,
          render: {
            fillStyle: obj.color || '#888888'
          }
        });
      }

      if (body) {
        Matter.World.add(this.world, body);
        this.levelObjects.push({
          ...obj,
          body
        });

        // Spawn marble at spawnpoint
        if (obj.properties && obj.properties.includes('spawnpoint')) {
          this.spawnMarble(obj.x, obj.y - 50);
        }
      }
    });
  }

  spawnMarble(x, y) {
    const marble = Matter.Bodies.circle(x, y, 10, {
      friction: 0.3,
      restitution: 0.6,
      render: {
        fillStyle: '#ff6b6b'
      }
    });

    Matter.World.add(this.world, marble);
    this.marbles.push({
      id: Date.now(),
      body: marble,
      type: 'marble'
    });
  }

  spawnEmote(emoteUrl, emoteName) {
    // Find spawnpoint
    const spawnpoint = this.levelObjects.find(obj => 
      obj.properties && obj.properties.includes('spawnpoint')
    );

    if (spawnpoint) {
      const emote = Matter.Bodies.circle(
        spawnpoint.x + Math.random() * 100 - 50,
        spawnpoint.y - 50,
        8,
        {
          friction: 0.3,
          restitution: 0.7,
          render: {
            sprite: {
          texture: emoteUrl
            }
          }
        }
      );

      Matter.World.add(this.world, emote);
      this.emotes.push({
        id: Date.now() + Math.random(),
        body: emote,
        type: 'emote',
        name: emoteName,
        url: emoteUrl
      });
    }
  }

  handleBeamInteraction(socketId, targetX, targetY) {
    const player = this.players.get(socketId);
    if (!player || !player.beamActive) return;

    // Find objects within beam range
    const beamRange = 100;
    const distance = Math.sqrt(
      Math.pow(targetX - player.x, 2) + Math.pow(targetY - player.y, 2)
    );

    if (distance <= beamRange) {
      // Find closest movable object
      let closestObject = null;
      let closestDistance = Infinity;

      [...this.marbles, ...this.emotes, ...this.levelObjects.filter(obj => !obj.isStatic)]
        .forEach(obj => {
          const objDistance = Math.sqrt(
            Math.pow(obj.body.position.x - targetX, 2) + 
            Math.pow(obj.body.position.y - targetY, 2)
          );

          if (objDistance < 30 && objDistance < closestDistance) {
            closestObject = obj;
            closestDistance = objDistance;
          }
        });

      if (closestObject) {
        // Apply upward force to lift object
        Matter.Body.applyForce(closestObject.body, closestObject.body.position, {
          x: (player.x - closestObject.body.position.x) * 0.001,
          y: -0.01
        });
        player.beamTarget = closestObject.id;
      }
    }
  }

  checkWinCondition() {
    const goal = this.levelObjects.find(obj => 
      obj.properties && obj.properties.includes('goal')
    );

    if (!goal) return false;

    // Check if any marble reached the goal
    return this.marbles.some(marble => {
      const distance = Math.sqrt(
        Math.pow(marble.body.position.x - goal.x, 2) + 
        Math.pow(marble.body.position.y - goal.y, 2)
      );
      return distance < 50;
    });
  }

  updateGameState() {
    // Check win condition
    if (this.checkWinCondition()) {
      // Award XP to all players
      this.players.forEach(player => {
        player.xp += 100;
        if (player.xp >= player.level * 1000) {
          player.level++;
          player.xp = 0;
        }
      });
    }

    // Remove objects that fell off the world
    const worldBounds = { minY: 1000 };
    
    this.marbles = this.marbles.filter(marble => {
      if (marble.body.position.y > worldBounds.minY) {
        Matter.World.remove(this.world, marble.body);
        return false;
      }
      return true;
    });

    this.emotes = this.emotes.filter(emote => {
      if (emote.body.position.y > worldBounds.minY) {
        Matter.World.remove(this.world, emote.body);
        return false;
      }
      return true;
    });
  }

  getGameState() {
    return {
      players: Array.from(this.players.values()),
      marbles: this.marbles.map(marble => ({
        id: marble.id,
        x: marble.body.position.x,
        y: marble.body.position.y,
        angle: marble.body.angle,
        type: marble.type
      })),
      emotes: this.emotes.map(emote => ({
        id: emote.id,
        x: emote.body.position.x,
        y: emote.body.position.y,
        angle: emote.body.angle,
        type: emote.type,
        name: emote.name,
        url: emote.url
      })),
      levelObjects: this.levelObjects.map(obj => ({
        id: obj.id,
        x: obj.body ? obj.body.position.x : obj.x,
        y: obj.body ? obj.body.position.y : obj.y,
        angle: obj.body ? obj.body.angle : 0,
        shape: obj.shape,
        width: obj.width,
        height: obj.height,
        radius: obj.radius,
        color: obj.color,
        isStatic: obj.isStatic,
        properties: obj.properties
      }))
    };
  }
}

module.exports = GameLogic;
