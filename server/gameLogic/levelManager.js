const Matter = require('matter-js');

class LevelManager {
  constructor(eventEmitter) {
    this.eventEmitter = eventEmitter;
    this.currentLevel = null;
    this.levelObjects = [];
    this.constraints = [];
    this.marbles = [];
    this.emotes = [];
    this.marbleProperties = {
      color: '#ff6b6b',
      radius: 30,
      friction: 0.000005,
      restitution: 0.7,
      density: 0.004
    };
    this.emoteProperties = {
      radius: 25,
      friction: 0.3,
      restitution: 0.7,
      density: 0.001
    };
  }

  loadLevel(levelData) {
    // Clear existing level objects
    this.levelObjects.forEach(obj => {
      Matter.World.remove(this.world, obj.body);
    });
    this.levelObjects = [];

    // Clear existing constraints
    this.constraints.forEach(constraint => {
      Matter.World.remove(this.world, constraint);
    });
    this.constraints = [];

    // Clear existing marbles
    this.marbles.forEach(marble => {
      Matter.World.remove(this.world, marble.body);
    });
    this.marbles = [];

    // Clear existing emotes
    this.emotes.forEach(emote => {
      Matter.World.remove(this.world, emote.body);
    });
    this.emotes = [];

    // Clear active object states
    this.activeObjects = new Map();

    // Store level data and marble properties
    this.currentLevel = levelData;
    this.marbleProperties = levelData.marble || {
      color: '#ff6b6b',
      radius: 30,
      friction: 0.000005,
      restitution: 0.7,
      density: 0.004
    };
    this.emoteProperties = levelData.emote || {
      radius: 25,
      friction: 0.3,
      restitution: 0.7,
      density: 0.001
    };

    // Update world gravity from level data
    if (levelData.world && levelData.world.gravity !== undefined) {
      this.engine.world.gravity.y = levelData.world.gravity;
    } else {
      // Default gravity if not specified in level
      this.engine.world.gravity.y = 0.8;
    }

    // Reposition all players to the new level's spawnpoint
    this.playerManager.repositionPlayersToSpawn(levelData);

    // Create physics bodies for level objects
    levelData.objects.forEach(obj => {
      let body;

      // Set up collision filtering based on isSolid property
      const collisionFilter = {
        category: 0x0001, // Default category
        mask: 0xFFFFFFFF  // Default mask (collide with everything)
      };

      // If isSolid is explicitly set to false, set up collision filtering
      if (obj.isSolid === false) {
        collisionFilter.mask = 0x0000; // Don't collide with anything
      }

      if (obj.shape === 'rectangle') {
        body = Matter.Bodies.rectangle(obj.x, obj.y, obj.width, obj.height, {
          isStatic: obj.isStatic,
          friction: obj.friction || 0.3,
          restitution: obj.restitution || 0.3,
          density: obj.density || 0.001,
          collisionFilter: collisionFilter,
          render: {
            fillStyle: obj.color || '#888888'
          }
        });
      } else if (obj.shape === 'circle') {
        body = Matter.Bodies.circle(obj.x, obj.y, obj.radius, {
          isStatic: obj.isStatic,
          friction: obj.friction || 0.3,
          restitution: obj.restitution || 0.3,
          density: obj.density || 0.001,
          collisionFilter: collisionFilter,
          render: {
            fillStyle: obj.color || '#888888'
          }
        });
      }

      if (body) {
        // Apply rotation if specified
        if (obj.rotation && obj.rotation !== 0) {
          Matter.Body.setAngle(body, obj.rotation);
        }

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

    // Create constraints between objects
    if (levelData.connections) {
      levelData.connections.forEach(connection => {
        this.createConstraint(connection);
      });
    }

    // Update playerManager's reference to levelObjects
    if (this.playerManager) {
      this.playerManager.setLevelObjects(this.levelObjects);
    }
  }

  createConstraint(connection) {
    // Find the bodies by their object IDs
    const bodyA = this.levelObjects.find(obj => obj.id === connection.bodyA)?.body;
    const bodyB = this.levelObjects.find(obj => obj.id === connection.bodyB)?.body;

    if (!bodyA || !bodyB) {
      console.warn(`Could not create constraint: bodies not found for ${connection.bodyA} and ${connection.bodyB}`);
      return;
    }

    // Rotate constraint points to account for body rotations
    const rotatePoint = (point, angle) => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return {
        x: point.x * cos - point.y * sin,
        y: point.x * sin + point.y * cos
      };
    };

    const pointA = connection.pointA ? rotatePoint(connection.pointA, bodyA.angle) : { x: 0, y: 0 };
    const pointB = connection.pointB ? rotatePoint(connection.pointB, bodyB.angle) : { x: 0, y: 0 };

    let constraint;

    switch (connection.type) {
      case 'revolute':
        // Revolute joint (hinge) - allows rotation around a point
        constraint = Matter.Constraint.create({
          bodyA: bodyA,
          bodyB: bodyB,
          pointA: pointA,
          pointB: pointB,
          length: connection.length || 0,
          stiffness: connection.stiffness || 1,
          damping: connection.damping || 0.1,
          render: {
            visible: true,
            lineWidth: 2,
            strokeStyle: '#ff6b6b'
          }
        });
        break;

      case 'rope':
        // Rope constraint - maximum distance, can go slack
        constraint = Matter.Constraint.create({
          bodyA: bodyA,
          bodyB: bodyB,
          pointA: pointA,
          pointB: pointB,
          length: connection.length || 100,
          stiffness: 0, // Rope should be slack
          render: {
            visible: true,
            lineWidth: 2,
            strokeStyle: '#4ecdc4'
          }
        });
        break;

      case 'spring':
        // Spring constraint - elastic connection
        constraint = Matter.Constraint.create({
          bodyA: bodyA,
          bodyB: bodyB,
          pointA: pointA,
          pointB: pointB,
          length: connection.length || 100,
          stiffness: connection.stiffness || 0.1,
          damping: connection.damping || 0.05,
          render: {
            visible: true,
            lineWidth: 2,
            strokeStyle: '#ffff00'
          }
        });
        break;

      case 'distance':
        // Fixed distance constraint
        constraint = Matter.Constraint.create({
          bodyA: bodyA,
          bodyB: bodyB,
          pointA: pointA,
          pointB: pointB,
          length: connection.length || 100,
          stiffness: 1, // Fixed length
          render: {
            visible: true,
            lineWidth: 2,
            strokeStyle: '#00ff00'
          }
        });
        break;

      case 'glue':
        // Glue constraint - rope with extremely small maximum distance for rigid connection
        constraint = Matter.Constraint.create({
          bodyA: bodyA,
          bodyB: bodyB,
          pointA: pointA,
          pointB: pointB,
          length: 0, // Extremely small maximum distance (almost rigid)
          stiffness: 0, // Rope stiffness (no active pulling)
          render: {
            visible: true,
            lineWidth: 2,
            strokeStyle: '#800080' // Purple color for glue
          }
        });
        break;

      default:
        console.warn(`Unknown constraint type: ${connection.type}`);
        return;
    }

    if (constraint) {
      Matter.World.add(this.world, constraint);
      this.constraints.push({
        ...connection,
        constraint
      });
    }
  }

  spawnMarble(x, y) {
    // Use marble properties from level data, with defaults
    const properties = this.marbleProperties || {
      color: '#ff6b6b',
      radius: 30,
      friction: 0.000005,
      restitution: 0.7,
      density: 0.004
    };

    const marble = Matter.Bodies.circle(x, y, properties.radius, {
      friction: properties.friction,
      restitution: properties.restitution,
      density: properties.density,
      render: {
        fillStyle: properties.color
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
    // Find emotespawn - emotes only spawn from dedicated emote spawners
    const spawnLocation = this.levelObjects.find(obj =>
      obj.properties && obj.properties.includes('emotespawn')
    );

    if (spawnLocation) {
      // Use current position if spawnpoint is moving
      const spawnX = spawnLocation.body ? spawnLocation.body.position.x : spawnLocation.x;
      const spawnY = spawnLocation.body ? spawnLocation.body.position.y : spawnLocation.y;

      // Use emote properties from level data, with defaults
      const properties = this.emoteProperties || {
        radius: 25,
        friction: 0.3,
        restitution: 0.7,
        density: 0.001
      };

      const emote = Matter.Bodies.circle(
        spawnX + Math.random() * 100 - 50,
        spawnY - 50,
        properties.radius,
        {
          friction: properties.friction,
          restitution: properties.restitution,
          density: properties.density,
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
        url: emoteUrl,
        interactedPlayers: new Set()
      });
    }
  }

  // Set references to external dependencies
  setWorld(world) {
    this.world = world;
  }

  setEngine(engine) {
    this.engine = engine;
  }

  setPlayerManager(playerManager) {
    this.playerManager = playerManager;
  }

  setActiveObjects(activeObjects) {
    this.activeObjects = activeObjects;
  }
}

module.exports = LevelManager;
