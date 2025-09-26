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
    this.constraints = [];
    this.eventListeners = new Map();
    this.teleportCooldowns = new Map(); // Track teleport cooldowns per object

    // Configure physics
    this.engine.world.gravity.y = 0.8;

    // Start physics loop
    this.startPhysicsLoop();
  }
  
  // Event system
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }
  
  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => callback(data));
    }
  }

  startPhysicsLoop() {
    setInterval(() => {
      Matter.Engine.update(this.engine, 1000 / 60); // Fixed 60 FPS timing
      this.updateGameState();
    }, 1000 / 60); // 16.67ms intervals
  }

  addPlayer(socketId, username, userId) {
    // Find spawn position - prioritize playerspawn, then fall back to spawnpoint
    let spawnX = 960;
    let spawnY = 540;
    if (this.levelObjects) {
      // First try playerspawn
      let spawnLocation = this.levelObjects.find(obj =>
        obj.properties && obj.properties.includes('playerspawn')
      );

      // Fall back to spawnpoint if no playerspawn found
      if (!spawnLocation) {
        spawnLocation = this.levelObjects.find(obj =>
          obj.properties && obj.properties.includes('spawnpoint')
        );
      }

      if (spawnLocation) {
        spawnX = spawnLocation.x;
        spawnY = spawnLocation.y;
      }
    }

    // Create UFO physics body
    const ufoBody = Matter.Bodies.circle(spawnX, spawnY, 25, {
      isStatic: false,
      friction: 0.2,        // Increased from 0.1
      frictionAir: 0.05,    // Increased from 0.05 for better stopping
      restitution: 0.2,     // Reduced from 0.3 for less bouncing
      density: 0.0008,       // Increased from 0.001 for more stability
      render: {
        fillStyle: '#4ecdc4'
      }
    });

    // Add UFO to physics world
    Matter.World.add(this.world, ufoBody);

    const player = {
      id: socketId,
      username,
      userId,
      body: ufoBody,
      x: spawnX,
      y: spawnY,
      beamActive: false,
      beamTarget: null,
      xp: 0,
      level: 1,
      targetX: spawnX,
      targetY: spawnY
    };

    this.players.set(socketId, player);

    // Return clean player data without physics body
    return {
      id: socketId,
      username,
      userId,
      x: spawnX,
      y: spawnY,
      beamActive: false,
      beamTarget: null,
      xp: 0,
      level: 1
    };
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (player && player.body) {
      Matter.World.remove(this.world, player.body);
    }
    this.players.delete(socketId);
  }

  updatePlayerInput(socketId, input) {
    const player = this.players.get(socketId);
    if (player) {
      player.input = input;
    }
  }

  // Apply input forces directly like the reference game
  applyPlayerInputs() {
    this.players.forEach(player => {
      if (player.input && player.body) {
        const forceAmount = 0.003; // Similar to reference game's 0.0035
        let fx = 0, fy = 0;
        
        if (player.input.up) fy -= forceAmount;
        if (player.input.down) fy += forceAmount;
        if (player.input.left) fx -= forceAmount;
        if (player.input.right) fx += forceAmount;
        
        if (fx !== 0 || fy !== 0) {
          Matter.Body.applyForce(
            player.body,
            player.body.position,
            { x: fx, y: fy }
          );
        }
      }
    });
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

    this.currentLevel = levelData;

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
  }

  createConstraint(connection) {
    // Find the bodies by their object IDs
    const bodyA = this.levelObjects.find(obj => obj.id === connection.bodyA)?.body;
    const bodyB = this.levelObjects.find(obj => obj.id === connection.bodyB)?.body;

    if (!bodyA || !bodyB) {
      console.warn(`Could not create constraint: bodies not found for ${connection.bodyA} and ${connection.bodyB}`);
      return;
    }

    let constraint;

    switch (connection.type) {
      case 'revolute':
        // Revolute joint (hinge) - allows rotation around a point
        constraint = Matter.Constraint.create({
          bodyA: bodyA,
          bodyB: bodyB,
          pointA: connection.pointA || { x: 0, y: 0 },
          pointB: connection.pointB || { x: 0, y: 0 },
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
          pointA: connection.pointA || { x: 0, y: 0 },
          pointB: connection.pointB || { x: 0, y: 0 },
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
          pointA: connection.pointA || { x: 0, y: 0 },
          pointB: connection.pointB || { x: 0, y: 0 },
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
          pointA: connection.pointA || { x: 0, y: 0 },
          pointB: connection.pointB || { x: 0, y: 0 },
          length: connection.length || 100,
          stiffness: 1, // Fixed length
          render: {
            visible: true,
            lineWidth: 2,
            strokeStyle: '#00ff00'
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
    const marble = Matter.Bodies.circle(x, y, 30, {
      friction: 0.000005,
      restitution: 0.7,
      density: 0.004,
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
    // Find emotespawn first, then fall back to spawnpoint
    let spawnLocation = this.levelObjects.find(obj =>
      obj.properties && obj.properties.includes('emotespawn')
    );

    if (!spawnLocation) {
      // Fall back to spawnpoint
      spawnLocation = this.levelObjects.find(obj =>
        obj.properties && obj.properties.includes('spawnpoint')
      );
    }

    if (spawnLocation) {
      const emote = Matter.Bodies.circle(
        spawnLocation.x + Math.random() * 100 - 50,
        spawnLocation.y - 50,
        20,
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

    // Define beam polygon (trapezoid) under UFO
    const beamRange = 120;
    const beamWidth = 80;
    const px = player.x;
    const py = player.y;

    // Vertices of the beam polygon (trapezoid)
    const beamPolygon = [
      { x: px - beamWidth * 0.5, y: py + 18 }, // left top
      { x: px + beamWidth * 0.5, y: py + 18 }, // right top
      { x: px + beamWidth * 1.5, y: py + beamRange }, // right bottom
      { x: px - beamWidth * 1.5, y: py + beamRange }  // left bottom
    ];

    // Create a Matter.Vertices object for the beam polygon
    const MatterVertices = Matter.Vertices || require('matter-js').Vertices;
    const beamVerts = beamPolygon.map(v => ({ x: v.x, y: v.y }));

    // Find all objects whose body overlaps the beam polygon
    const otherPlayers = Array.from(this.players.values()).filter(p => p.id !== player.id);
    const candidates = [...this.marbles, ...this.emotes, ...this.levelObjects.filter(obj => !obj.isStatic), ...otherPlayers];
    const objectsInBeam = [];

    candidates.forEach(obj => {
      // Use Matter.Query.region to check for overlap
      // Get the object's bounds
      const bounds = obj.body.bounds;
      // Check if any of the object's vertices are inside the beam polygon
      const objVerts = obj.body.vertices;
      const overlap = objVerts.some(v => Matter.Vertices.contains(beamVerts, v));
      // Also check if any of the beam polygon's vertices are inside the object (for full overlap)
      const beamOverlap = beamVerts.some(v => Matter.Vertices.contains(objVerts, v));
      if (overlap || beamOverlap) {
        // Use distance for force scaling
        const objDx = obj.body.position.x - px;
        const objDy = obj.body.position.y - py;
        const objDistance = Math.sqrt(objDx * objDx + objDy * objDy);
        objectsInBeam.push({
          obj,
          distance: objDistance
        });
      }
    });

    // Apply forces to all objects in beam
    objectsInBeam.forEach(({ obj, distance }) => {
      const forceMultiplier = Math.max(0.1, 1 - (distance / beamRange));
      // Strong upward force
      const upwardForce = -0.05 * forceMultiplier;
      // Slight attraction towards UFO center
      const attractionForce = {
        x: (px - obj.body.position.x) * 0.002 * forceMultiplier,
        y: upwardForce
      };
      Matter.Body.applyForce(obj.body, obj.body.position, attractionForce);
      // Reduce gravity effect while in beam
      if (obj.body.render) {
        obj.body.render.strokeStyle = '#4ecdc4';
        obj.body.render.lineWidth = 2;
      }
    });

    if (objectsInBeam.length > 0) {
      player.beamTarget = objectsInBeam[0].obj.id;
    }
  }

  // New method for continuous beam effects
  updateBeamEffects() {
    const MatterVertices = Matter.Vertices || require('matter-js').Vertices;
    this.players.forEach(player => {
      if (player.beamActive) {
        // Define beam polygon (trapezoid) under UFO
        const beamRange = 120;
        const beamWidth = 80;
        const px = player.x;
        const py = player.y;
        const beamPolygon = [
          { x: px - beamWidth * 0.5, y: py + 18 },
          { x: px + beamWidth * 0.5, y: py + 18 },
          { x: px + beamWidth * 1.5, y: py + beamRange },
          { x: px - beamWidth * 1.5, y: py + beamRange }
        ];
        const beamVerts = beamPolygon.map(v => ({ x: v.x, y: v.y }));

        // Include other players in beam candidates
        const otherPlayers = Array.from(this.players.values()).filter(p => p.id !== player.id);
        const candidates = [...this.marbles, ...this.emotes, ...this.levelObjects.filter(obj => !obj.isStatic), ...otherPlayers];
        candidates.forEach(obj => {
          const objVerts = obj.body.vertices;
          const overlap = objVerts.some(v => Matter.Vertices.contains(beamVerts, v));
          const beamOverlap = beamVerts.some(v => Matter.Vertices.contains(objVerts, v));
          if (overlap || beamOverlap) {
            const dx = obj.body.position.x - px;
            const dy = obj.body.position.y - py;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const forceMultiplier = Math.max(0.1, 1 - (distance / beamRange));
            // Continuous upward force
            const upwardForce = -0.02 * forceMultiplier;
            // Attraction towards UFO center
            const attractionForce = {
              x: (px - obj.body.position.x) * 0.001 * forceMultiplier,
              y: upwardForce
            };
            Matter.Body.applyForce(obj.body, obj.body.position, attractionForce);
            // Visual effect for objects in beam
            if (obj.body.render) {
              obj.body.render.strokeStyle = '#4ecdc4';
              obj.body.render.lineWidth = 2;
            }
          }
        });
      }
    });
  }

  checkWinCondition() {
    const goals = this.levelObjects.filter(obj => 
      obj.properties && obj.properties.includes('goal')
    );

    if (goals.length === 0) return false;

    // Check if any marble reached any goal
    for (const goal of goals) {
      for (const marble of this.marbles) {
        const distance = Math.sqrt(
          Math.pow(marble.body.position.x - goal.x, 2) + 
          Math.pow(marble.body.position.y - goal.y, 2)
        );
        
        if (distance < 50) {
          // If this goal has a nextLevel property, return it
          if (goal.nextLevel) {
            return { win: true, nextLevel: goal.nextLevel };
          }
          return { win: true };
        }
      }
    }
    
    return { win: false };
  }

  updateGameState() {
    // Apply player inputs first (like the reference game)
    this.applyPlayerInputs();
    
    // Update continuous beam effects
    this.updateBeamEffects();
    
    // Update player positions from physics bodies
    this.players.forEach(player => {
      player.x = player.body.position.x;
      player.y = player.body.position.y;
    });
    
    // Check win condition
    const winResult = this.checkWinCondition();
    if (winResult.win) {
      // Award XP to all players
      this.players.forEach(player => {
        player.xp += 100;
        if (player.xp >= player.level * 1000) {
          player.level++;
          player.xp = 0;
        }
      });

      // If there's a next level to load, load it
      if (winResult.nextLevel) {
        // Use the socketHandlers to load the next level
        // We'll emit an event that can be caught by the socket handlers
        this.emit('loadNextLevel', winResult.nextLevel);
      }
    }

    // Handle teleporter collisions
    this.handleTeleporters();

    // Remove objects that fell off the world (updated for 1920x1080 canvas)
    const worldBounds = { minY: 1200 };// Check marbles that fell off the world and respawn them
    this.marbles.forEach(marble => {
      if (marble.body.position.y > worldBounds.minY) {
        // Find spawnpoint
        const spawnpoint = this.levelObjects.find(obj =>
          obj.properties && obj.properties.includes('spawnpoint')
        );

        if (spawnpoint) {
          // Respawn marble at spawnpoint
          Matter.Body.setPosition(marble.body, {
            x: spawnpoint.x,
            y: spawnpoint.y - 50
          });
          Matter.Body.setVelocity(marble.body, { x: 0, y: 0 });
        }
      }
    });

    // Check movable level objects that fell off the world and respawn them
    this.levelObjects.forEach(obj => {
      if (!obj.isStatic && obj.body && obj.body.position.y > worldBounds.minY) {
        // Find spawnpoint
        const spawnpoint = this.levelObjects.find(sp =>
          sp.properties && sp.properties.includes('spawnpoint')
        );

        if (spawnpoint) {
          // Respawn object at spawnpoint
          Matter.Body.setPosition(obj.body, {
            x: spawnpoint.x,
            y: spawnpoint.y - 50
          });
          Matter.Body.setVelocity(obj.body, { x: 0, y: 0 });
        }
      }
    });

    this.emotes = this.emotes.filter(emote => {
      if (emote.body.position.y > worldBounds.minY) {
        Matter.World.remove(this.world, emote.body);
        return false;
      }
      return true;
    });
    
    // Remove players that fell off the world and respawn them
    this.players.forEach(player => {
      if (player.body.position.y > worldBounds.minY) {
        // Find respawn location - prioritize playerspawn, then fall back to spawnpoint
        let respawnX = 400;
        let respawnY = 200;

        // First try playerspawn
        let respawnLocation = this.levelObjects.find(obj =>
          obj.properties && obj.properties.includes('playerspawn')
        );

        // Fall back to spawnpoint if no playerspawn found
        if (!respawnLocation) {
          respawnLocation = this.levelObjects.find(obj =>
            obj.properties && obj.properties.includes('spawnpoint')
          );
        }

        if (respawnLocation) {
          respawnX = respawnLocation.x;
          respawnY = respawnLocation.y;
        }

        // Respawn UFO at spawn location or safe location
        Matter.Body.setPosition(player.body, { x: respawnX, y: respawnY });
        Matter.Body.setVelocity(player.body, { x: 0, y: 0 });
        player.x = respawnX;
        player.y = respawnY;
      }
    });
  }

  handleTeleporters() {
    // Get all teleporter objects
    const teleporters = this.levelObjects.filter(obj =>
      obj.properties && obj.properties.includes('teleporter') && obj.teleporterTarget
    );

    if (teleporters.length === 0) return;

    // Get current timestamp for cooldown checks
    const now = Date.now();

    // Collect all movable objects that can be teleported
    const otherPlayers = Array.from(this.players.values());
    const movableObjects = [
      ...this.marbles,
      ...this.emotes,
      ...this.levelObjects.filter(obj => !obj.isStatic && obj.body),
      ...otherPlayers
    ];

    // Check each teleporter for collisions
    teleporters.forEach(teleporter => {
      const teleporterBounds = teleporter.body.bounds;

      movableObjects.forEach(obj => {
        // Skip if object is the teleporter itself
        if (obj.id === teleporter.id) return;

        // Check if object is on cooldown (global per object)
        const cooldownKey = `${obj.id}`;
        const lastTeleport = this.teleportCooldowns.get(cooldownKey);
        if (lastTeleport && (now - lastTeleport) < 5000) { // 5 second cooldown
          return;
        }

        // Check for collision using bounds overlap
        const objBounds = obj.body.bounds;
        const collision = !(
          objBounds.max.x < teleporterBounds.min.x ||
          objBounds.min.x > teleporterBounds.max.x ||
          objBounds.max.y < teleporterBounds.min.y ||
          objBounds.min.y > teleporterBounds.max.y
        );

        if (collision) {
          // Find the target teleporter
          const targetTeleporter = this.levelObjects.find(target =>
            target.id === teleporter.teleporterTarget &&
            target.properties && target.properties.includes('teleporter')
          );

          if (targetTeleporter && targetTeleporter.body) {
            // Teleport the object to the target position
            const targetX = targetTeleporter.body.position.x;
            const targetY = targetTeleporter.body.position.y - 50; // Offset slightly above the target

            Matter.Body.setPosition(obj.body, { x: targetX, y: targetY });
            Matter.Body.setVelocity(obj.body, { x: 0, y: 0 }); // Stop movement

            // Set cooldown to prevent infinite teleportation loops
            this.teleportCooldowns.set(cooldownKey, now);

            // Clean up old cooldowns (keep only recent ones)
            for (const [key, timestamp] of this.teleportCooldowns.entries()) {
              if (now - timestamp > 2000) { // Remove cooldowns older than 2 seconds
                this.teleportCooldowns.delete(key);
              }
            }
          }
        }
      });
    });
  }

  getGameState() {
    return {
      backgroundImage: (this.currentLevel && this.currentLevel.backgroundImage) ? this.currentLevel.backgroundImage : '',
      players: Array.from(this.players.values()).map(player => ({
        id: player.id,
        username: player.username,
        userId: player.userId,
        x: player.x,
        y: player.y,
        beamActive: player.beamActive,
        beamTarget: player.beamTarget,
        xp: player.xp,
        level: player.level
      })),
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
        backgroundImage: obj.backgroundImage,
        isStatic: obj.isStatic,
        isSolid: obj.isSolid !== false, // Default to true if not specified
        zIndex: obj.zIndex || 0,
        nextLevel: obj.nextLevel,
        properties: obj.properties
      })),
      connections: this.constraints.map(constraint => ({
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

module.exports = GameLogic;
