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
    this.eventListeners = new Map();
    
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
    // Create UFO physics body
    const ufoBody = Matter.Bodies.circle(960, 540, 25, {
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
      x: 960,
      y: 540,
      beamActive: false,
      beamTarget: null,
      xp: 0,
      level: 1,
      targetX: 960,
      targetY: 540
    };
    
    this.players.set(socketId, player);
    
    // Return clean player data without physics body
    return {
      id: socketId,
      username,
      userId,
      x: 960,
      y: 540,
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
    this.marbles = [];

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
  }

  spawnMarble(x, y) {
    const marble = Matter.Bodies.circle(x, y, 30, {
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
    const candidates = [...this.marbles, ...this.emotes, ...this.levelObjects.filter(obj => !obj.isStatic)];
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

        const candidates = [...this.marbles, ...this.emotes, ...this.levelObjects.filter(obj => !obj.isStatic)];
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
        // Respawn UFO at a safe location
        Matter.Body.setPosition(player.body, { x: 400, y: 200 });
        Matter.Body.setVelocity(player.body, { x: 0, y: 0 });
        player.x = 400;
        player.y = 200;
      }
    });
  }getGameState() {
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
      }))
    };
  }
}

module.exports = GameLogic;
