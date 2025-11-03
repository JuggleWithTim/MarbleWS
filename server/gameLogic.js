const Matter = require('matter-js');
const fs = require('fs');
const path = require('path');

// Generate a consistent random color based on a string seed
function generateColorFromSeed(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Generate hue from hash (0-360)
  const hue = Math.abs(hash) % 360;

  // Use fixed saturation and lightness for vibrant, distinguishable colors
  const saturation = 70 + (Math.abs(hash) % 30); // 70-100%
  const lightness = 45 + (Math.abs(hash) % 20); // 45-65%

  // Convert HSL to RGB
  const h = hue / 360;
  const s = saturation / 100;
  const l = lightness / 100;

  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);

  return `rgb(${r}, ${g}, ${b})`;
}

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
    this.goalCooldowns = new Map(); // Track goal cooldowns per object
    this.activeObjects = new Map(); // Track active object movement state

    // Configure physics
    this.engine.world.gravity.y = 0.8; // Default gravity, will be updated when level loads

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
        // Use current position if spawnpoint is moving
        spawnX = spawnLocation.body ? spawnLocation.body.position.x : spawnLocation.x;
        spawnY = spawnLocation.body ? spawnLocation.body.position.y : spawnLocation.y;
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

    // Load saved appearance and progress data
    const savedData = this.loadPlayerData(userId);
    const color = savedData.ufoAppearance.type === 'default' ? savedData.ufoAppearance.color : generateColorFromSeed(userId);

    const player = {
      id: socketId,
      username,
      userId,
      color,
      ufoAppearance: savedData.ufoAppearance,
      unlockedUFOs: savedData.unlockedUFOs,
      unlockedPassengers: savedData.unlockedPassengers,
      body: ufoBody,
      x: spawnX,
      y: spawnY,
      beamActive: false,
      beamTarget: null,
      xp: savedData.xp,
      level: savedData.level,
      coins: savedData.coins,
      targetX: spawnX,
      targetY: spawnY
    };

    this.players.set(socketId, player);

    // Return clean player data without physics body
    return {
      id: socketId,
      username,
      userId,
      color,
      ufoAppearance: savedData.ufoAppearance,
      unlockedUFOs: savedData.unlockedUFOs,
      unlockedPassengers: savedData.unlockedPassengers,
      x: spawnX,
      y: spawnY,
      beamActive: false,
      beamTarget: null,
      xp: savedData.xp,
      level: savedData.level,
      coins: savedData.coins
    };
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (player && player.body) {
      Matter.World.remove(this.world, player.body);
    }
    this.players.delete(socketId);
  }

  repositionPlayersToSpawn(levelData) {
    // Find spawn position - prioritize playerspawn, then fall back to spawnpoint
    let spawnX = 960;
    let spawnY = 540;

    if (levelData && levelData.objects) {
      // First try playerspawn
      let spawnLocation = levelData.objects.find(obj =>
        obj.properties && obj.properties.includes('playerspawn')
      );

      // Fall back to spawnpoint if no playerspawn found
      if (!spawnLocation) {
        spawnLocation = levelData.objects.find(obj =>
          obj.properties && obj.properties.includes('spawnpoint')
        );
      }

      if (spawnLocation) {
        spawnX = spawnLocation.x;
        spawnY = spawnLocation.y;
      }
    }

    // Reposition all existing players to the spawnpoint
    this.players.forEach(player => {
      if (player.body) {
        Matter.Body.setPosition(player.body, { x: spawnX, y: spawnY });
        Matter.Body.setVelocity(player.body, { x: 0, y: 0 });
        player.x = spawnX;
        player.y = spawnY;

        // Reset beam state to ensure clean start
        player.beamActive = false;
        player.beamTarget = null;
      }
    });
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

  updatePlayerAppearance(socketId, appearance) {
    const player = this.players.get(socketId);
    if (player) {
      // Validate that custom UFOs are unlocked before allowing selection
      if (appearance.type === 'custom' && !player.unlockedUFOs.includes(appearance.image)) {
        console.log(`Player ${player.username} attempted to select locked UFO: ${appearance.image}`);
        return; // Reject the appearance change
      }

      // Validate that passengers are unlocked before allowing selection
      if (appearance.passenger && !player.unlockedPassengers.includes(appearance.passenger)) {
        console.log(`Player ${player.username} attempted to select locked passenger: ${appearance.passenger}`);
        return; // Reject the appearance change
      }

      // Update the player's appearance
      player.ufoAppearance = { ...appearance };

      // Always update the color field for username display, regardless of UFO type
      player.color = appearance.color;

      // Save appearance and progress to persistent storage
      this.savePlayerData(player.userId, appearance, player.level, player.xp, player.coins, player.unlockedUFOs, player.unlockedPassengers);

      console.log(`Player ${player.username} updated appearance:`, appearance);
    }
  }

  unlockUFO(socketId, ufoImage) {
    const player = this.players.get(socketId);
    if (!player) return { success: false, message: 'Player not found' };

    // Define UFO costs
    const ufoCosts = {
      'CustomUFO1.png': 50,
      'Fez.png': 100
    };

    const cost = ufoCosts[ufoImage];
    if (!cost) {
      return { success: false, message: 'Invalid UFO image' };
    }

    // Check if already unlocked
    if (player.unlockedUFOs.includes(ufoImage)) {
      return { success: false, message: 'UFO already unlocked' };
    }

    // Check if player has enough coins
    if (player.coins < cost) {
      return { success: false, message: 'Not enough coins' };
    }

    // Deduct coins and add to unlocked list
    player.coins -= cost;
    player.unlockedUFOs.push(ufoImage);

    // Save updated data
    this.savePlayerData(player.userId, player.ufoAppearance, player.level, player.xp, player.coins, player.unlockedUFOs, player.unlockedPassengers);

    console.log(`Player ${player.username} unlocked UFO ${ufoImage} for ${cost} coins`);

    return {
      success: true,
      ufoImage,
      cost,
      remainingCoins: player.coins,
      unlockedUFOs: player.unlockedUFOs
    };
  }

  unlockPassenger(socketId, passengerImage) {
    const player = this.players.get(socketId);
    if (!player) return { success: false, message: 'Player not found' };

    // Define passenger costs
    const passengerCosts = {
      'luminoCoffee.png': 75
    };

    const cost = passengerCosts[passengerImage];
    if (!cost) {
      return { success: false, message: 'Invalid passenger image' };
    }

    // Check if already unlocked
    if (player.unlockedPassengers.includes(passengerImage)) {
      return { success: false, message: 'Passenger already unlocked' };
    }

    // Check if player has enough coins
    if (player.coins < cost) {
      return { success: false, message: 'Not enough coins' };
    }

    // Deduct coins and add to unlocked list
    player.coins -= cost;
    player.unlockedPassengers.push(passengerImage);

    // Save updated data
    this.savePlayerData(player.userId, player.ufoAppearance, player.level, player.xp, player.coins, player.unlockedUFOs, player.unlockedPassengers);

    console.log(`Player ${player.username} unlocked passenger ${passengerImage} for ${cost} coins`);

    return {
      success: true,
      passengerImage,
      cost,
      remainingCoins: player.coins,
      unlockedPassengers: player.unlockedPassengers
    };
  }

  savePlayerData(userId, appearance, level = 1, xp = 0, coins = 100, unlockedUFOs = [], unlockedPassengers = []) {
    try {
      // Create players directory if it doesn't exist
      const playersDir = path.join(process.cwd(), 'players');
      if (!fs.existsSync(playersDir)) {
        fs.mkdirSync(playersDir, { recursive: true });
      }

      // Save appearance data to a JSON file named after the userId
      const appearanceFile = path.join(playersDir, `${userId}.json`);
      fs.writeFileSync(appearanceFile, JSON.stringify({
        userId,
        ufoAppearance: appearance,
        level,
        xp,
        coins,
        unlockedUFOs,
        unlockedPassengers,
        lastUpdated: new Date().toISOString()
      }, null, 2));

      console.log(`Saved player data for user ${userId}`);
    } catch (error) {
      console.error('Failed to save player data:', error);
    }
  }

  loadPlayerData(userId) {
    try {
      const playersDir = path.join(process.cwd(), 'players');
      const appearanceFile = path.join(playersDir, `${userId}.json`);

      if (fs.existsSync(appearanceFile)) {
        const data = JSON.parse(fs.readFileSync(appearanceFile, 'utf8'));
        return {
          ufoAppearance: data.ufoAppearance,
          level: data.level || 1,
          xp: data.xp || 0,
          coins: data.coins || 100,
          unlockedUFOs: data.unlockedUFOs || [],
          unlockedPassengers: data.unlockedPassengers || []
        };
      }
    } catch (error) {
      console.error('Failed to load player data:', error);
    }

    // Return default data if loading fails
    return {
      ufoAppearance: {
        type: 'default',
        color: generateColorFromSeed(userId),
        image: null
      },
      level: 1,
      xp: 0,
      coins: 100,
      unlockedUFOs: [],
      unlockedPassengers: []
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

    // Update world gravity from level data
    if (levelData.world && levelData.world.gravity !== undefined) {
      this.engine.world.gravity.y = levelData.world.gravity;
    } else {
      // Default gravity if not specified in level
      this.engine.world.gravity.y = 0.8;
    }

    // Reposition all players to the new level's spawnpoint
    this.repositionPlayersToSpawn(levelData);

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
      // Use current position if spawnpoint is moving
      const spawnX = spawnLocation.body ? spawnLocation.body.position.x : spawnLocation.x;
      const spawnY = spawnLocation.body ? spawnLocation.body.position.y : spawnLocation.y;
      const emote = Matter.Bodies.circle(
        spawnX + Math.random() * 100 - 50,
        spawnY - 50,
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

    // Get current timestamp for cooldown checks
    const now = Date.now();

    // Get marble radius from properties
    const marbleRadius = this.marbleProperties ? this.marbleProperties.radius : 30;

    // Check if any marble reached any goal
    for (const goal of goals) {
      // Check if goal is on cooldown
      const cooldownKey = goal.id;
      const lastWin = this.goalCooldowns.get(cooldownKey);
      if (lastWin && (now - lastWin) < 5000) { // 5 second cooldown
        continue; // Skip this goal, it's on cooldown
      }

      for (const marble of this.marbles) {
        const marbleX = marble.body.position.x;
        const marbleY = marble.body.position.y;
        // Use current goal position if goal is moving
        const goalX = goal.body ? goal.body.position.x : goal.x;
        const goalY = goal.body ? goal.body.position.y : goal.y;
        let collision = false;

        if (goal.shape === 'circle') {
          // Circle-circle collision
          const goalRadius = goal.radius || 50; // Default radius if not specified
          const distance = Math.sqrt(
            Math.pow(marbleX - goalX, 2) +
            Math.pow(marbleY - goalY, 2)
          );
          collision = distance <= (marbleRadius + goalRadius);
        } else if (goal.shape === 'rectangle') {
          // Circle-rectangle collision
          const halfWidth = (goal.width || 100) / 2;
          const halfHeight = (goal.height || 100) / 2;

          // Find the closest point on the rectangle to the marble center
          const closestX = Math.max(goalX - halfWidth, Math.min(marbleX, goalX + halfWidth));
          const closestY = Math.max(goalY - halfHeight, Math.min(marbleY, goalY + halfHeight));

          // Calculate distance from marble center to closest point
          const distance = Math.sqrt(
            Math.pow(marbleX - closestX, 2) +
            Math.pow(marbleY - closestY, 2)
          );

          collision = distance <= marbleRadius;
        } else {
          // Fallback to distance-based check for unknown shapes
          const distance = Math.sqrt(
            Math.pow(marbleX - goalX, 2) +
            Math.pow(marbleY - goalY, 2)
          );
          collision = distance < 50; // Keep old behavior as fallback
        }

        if (collision) {
          // Set cooldown to prevent rapid repeated triggering
          this.goalCooldowns.set(cooldownKey, now);

          // Clean up old cooldowns (keep only recent ones)
          for (const [key, timestamp] of this.goalCooldowns.entries()) {
            if (now - timestamp > 10000) { // Remove cooldowns older than 10 seconds
              this.goalCooldowns.delete(key);
            }
          }

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
        player.coins += 5;
        let leveledUp = false;
        if (player.xp >= player.level * 1000) {
          const oldLevel = player.level;
          player.level++;
          player.xp = 0;
          // Award coins for leveling up: level × 100
          const coinReward = oldLevel * 100;
          player.coins += coinReward;
          console.log(`Player ${player.username} leveled up to ${player.level} and gained ${coinReward} coins!`);
          leveledUp = true;

          // Emit level up event for splash screen
          this.emit('playerLeveledUp', {
            playerId: player.id,
            username: player.username,
            newLevel: player.level,
            coinReward: coinReward
          });
        }

        // Save progress after XP gain (whether leveled up or not)
        this.savePlayerData(player.userId, player.ufoAppearance, player.level, player.xp, player.coins);

        if (leveledUp) {
          console.log(`Player ${player.username} progress saved after leveling up`);
        }
      });

      // If there's a next level to load, load it
      if (winResult.nextLevel) {
        // Use the socketHandlers to load the next level
        // We'll emit an event that can be caught by the socket handlers
        this.emit('loadNextLevel', winResult.nextLevel);
      }
    }

    // Update active object movements
    this.updateActiveObjects();

    // Handle teleporter collisions
    this.handleTeleporters();

    // Remove/respawn objects that fell off the world
    const worldBounds = {
      minX: -700,   // Left bound with margin
      maxX: 2620,   // Right bound (1920 + margin)
      minY: -700,   // Top bound with margin (for inverted gravity)
      maxY: 1780    // Bottom bound (1080 + margin)
    };

    // Check marbles that went out of bounds in any direction and respawn them
    this.marbles.forEach(marble => {
      const pos = marble.body.position;
      if (pos.x < worldBounds.minX || pos.x > worldBounds.maxX ||
          pos.y < worldBounds.minY || pos.y > worldBounds.maxY) {
        // Find spawnpoint
        const spawnpoint = this.levelObjects.find(obj =>
          obj.properties && obj.properties.includes('spawnpoint')
        );

        if (spawnpoint) {
          // Respawn marble at spawnpoint (use current position if spawnpoint is moving)
          const spawnX = spawnpoint.body ? spawnpoint.body.position.x : spawnpoint.x;
          const spawnY = spawnpoint.body ? spawnpoint.body.position.y : spawnpoint.y;
          Matter.Body.setPosition(marble.body, {
            x: spawnX,
            y: spawnY - 50
          });
          Matter.Body.setVelocity(marble.body, { x: 0, y: 0 });
        }
      }
    });

    // Check movable level objects that went out of bounds and respawn them
    this.levelObjects.forEach(obj => {
      if (!obj.isStatic && obj.body) {
        const pos = obj.body.position;
        if (pos.x < worldBounds.minX || pos.x > worldBounds.maxX ||
            pos.y < worldBounds.minY || pos.y > worldBounds.maxY) {
          let respawnX, respawnY;

          // If the object being respawned is a spawnpoint, respawn at center of canvas
          if (obj.properties && obj.properties.includes('spawnpoint')) {
            respawnX = 960; // Center of canvas
            respawnY = 540;
          } else {
            // Find spawnpoint for other objects
            const spawnpoint = this.levelObjects.find(sp =>
              sp.properties && sp.properties.includes('spawnpoint')
            );

            if (spawnpoint) {
              // Respawn object at spawnpoint (use current position if spawnpoint is moving)
              respawnX = spawnpoint.body ? spawnpoint.body.position.x : spawnpoint.x;
              respawnY = spawnpoint.body ? spawnpoint.body.position.y : spawnpoint.y;
            } else {
              // Fallback to center if no spawnpoint found
              respawnX = 960;
              respawnY = 540;
            }
          }

          Matter.Body.setPosition(obj.body, {
            x: respawnX,
            y: respawnY - 50
          });
          Matter.Body.setVelocity(obj.body, { x: 0, y: 0 });
        }
      }
    });

    // Remove emotes that went out of bounds
    this.emotes = this.emotes.filter(emote => {
      const pos = emote.body.position;
      if (pos.x < worldBounds.minX || pos.x > worldBounds.maxX ||
          pos.y < worldBounds.minY || pos.y > worldBounds.maxY) {
        Matter.World.remove(this.world, emote.body);
        return false;
      }
      return true;
    });
    
    // Remove players that went out of bounds and respawn them
    this.players.forEach(player => {
      const pos = player.body.position;
      if (pos.x < worldBounds.minX || pos.x > worldBounds.maxX ||
          pos.y < worldBounds.minY || pos.y > worldBounds.maxY) {
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
          // Use current position if spawnpoint is moving
          respawnX = respawnLocation.body ? respawnLocation.body.position.x : respawnLocation.x;
          respawnY = respawnLocation.body ? respawnLocation.body.position.y : respawnLocation.y;
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

  updateActiveObjects() {
    // Get all active objects
    const activeObjects = this.levelObjects.filter(obj => obj.active && obj.body);

    activeObjects.forEach(obj => {
      // Initialize movement state if not exists
      if (!this.activeObjects.has(obj.id)) {
        this.activeObjects.set(obj.id, {
          phase: 'toA', // 'toA', 'atA', 'toB', 'atB', 'fromB'
          startTime: Date.now(),
          currentPos: { x: obj.body.position.x, y: obj.body.position.y }
        });
      }

      const state = this.activeObjects.get(obj.id);
      const now = Date.now();
      const elapsed = (now - state.startTime) / 1000; // Convert to seconds

      // Calculate world positions for points A and B (relative to object center)
      let pointAWorld = { x: obj.x, y: obj.y };
      let pointBWorld = { x: obj.x, y: obj.y };

      if (obj.pointA) {
        if (obj.rotation && obj.rotation !== 0) {
          const cos = Math.cos(obj.rotation);
          const sin = Math.sin(obj.rotation);
          pointAWorld.x += obj.pointA.x * cos - obj.pointA.y * sin;
          pointAWorld.y += obj.pointA.x * sin + obj.pointA.y * cos;
        } else {
          pointAWorld.x += obj.pointA.x;
          pointAWorld.y += obj.pointA.y;
        }
      }

      if (obj.pointB) {
        if (obj.rotation && obj.rotation !== 0) {
          const cos = Math.cos(obj.rotation);
          const sin = Math.sin(obj.rotation);
          pointBWorld.x += obj.pointB.x * cos - obj.pointB.y * sin;
          pointBWorld.y += obj.pointB.x * sin + obj.pointB.y * cos;
        } else {
          pointBWorld.x += obj.pointB.x;
          pointBWorld.y += obj.pointB.y;
        }
      }

      switch (state.phase) {
        case 'toA':
          // Move from current position to point A
          if (obj.timeToA && obj.timeToA > 0) {
            const progress = Math.min(elapsed / obj.timeToA, 1);
            const newX = state.currentPos.x + (pointAWorld.x - state.currentPos.x) * progress;
            const newY = state.currentPos.y + (pointAWorld.y - state.currentPos.y) * progress;

            Matter.Body.setPosition(obj.body, { x: newX, y: newY });

            if (progress >= 1) {
              // Reached point A, start waiting
              state.phase = 'atA';
              state.startTime = now;
            }
          } else {
            // No time specified, move instantly
            Matter.Body.setPosition(obj.body, pointAWorld);
            state.phase = 'atA';
            state.startTime = now;
          }
          break;

        case 'atA':
          // Wait at point A for timeFromA seconds
          if (obj.timeFromA && obj.timeFromA > 0) {
            if (elapsed >= obj.timeFromA) {
              state.phase = 'toB';
              state.startTime = now;
              state.currentPos = { x: obj.body.position.x, y: obj.body.position.y };
            }
          } else {
            // No wait time, move to B immediately
            state.phase = 'toB';
            state.startTime = now;
            state.currentPos = { x: obj.body.position.x, y: obj.body.position.y };
          }
          break;

        case 'toB':
          // Move from point A to point B
          if (obj.speedToB && obj.speedToB > 0) {
            // Use speed-based movement for toB
            const dx = pointBWorld.x - obj.body.position.x;
            const dy = pointBWorld.y - obj.body.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 1) { // Close enough
              const speed = obj.speedToB * 60; // Convert to pixels per second (assuming 60 FPS)
              const moveDistance = speed * (1/60); // Distance to move this frame

              if (moveDistance >= distance) {
                // Reached point B
                Matter.Body.setPosition(obj.body, pointBWorld);
                state.phase = 'atB';
                state.startTime = now;
              } else {
                // Move towards point B
                const ratio = moveDistance / distance;
                const newX = obj.body.position.x + dx * ratio;
                const newY = obj.body.position.y + dy * ratio;
                Matter.Body.setPosition(obj.body, { x: newX, y: newY });
              }
            } else {
              state.phase = 'atB';
              state.startTime = now;
            }
          } else {
            // No speed specified, move instantly
            Matter.Body.setPosition(obj.body, pointBWorld);
            state.phase = 'atB';
            state.startTime = now;
          }
          break;

        case 'atB':
          // Wait at point B (brief moment)
          state.phase = 'fromB';
          state.startTime = now;
          state.currentPos = { x: obj.body.position.x, y: obj.body.position.y };
          break;

        case 'fromB':
          // Move from point B back to point A
          if (obj.speedFromB && obj.speedFromB > 0) {
            // Use speed-based movement for fromB
            const dx = pointAWorld.x - obj.body.position.x;
            const dy = pointAWorld.y - obj.body.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 1) { // Close enough
              const speed = obj.speedFromB * 60; // Convert to pixels per second
              const moveDistance = speed * (1/60); // Distance to move this frame

              if (moveDistance >= distance) {
                // Reached point A, restart cycle
                Matter.Body.setPosition(obj.body, pointAWorld);
                state.phase = 'toA';
                state.startTime = now;
                state.currentPos = { x: obj.body.position.x, y: obj.body.position.y };
              } else {
                // Move towards point A
                const ratio = moveDistance / distance;
                const newX = obj.body.position.x + dx * ratio;
                const newY = obj.body.position.y + dy * ratio;
                Matter.Body.setPosition(obj.body, { x: newX, y: newY });
              }
            } else {
              // Restart cycle
              state.phase = 'toA';
              state.startTime = now;
              state.currentPos = { x: obj.body.position.x, y: obj.body.position.y };
            }
          } else {
            // No speed specified, move instantly and restart
            Matter.Body.setPosition(obj.body, pointAWorld);
            state.phase = 'toA';
            state.startTime = now;
            state.currentPos = { x: obj.body.position.x, y: obj.body.position.y };
          }
          break;
      }
    });
  }

  getGameState() {
    return {
      backgroundImage: (this.currentLevel && this.currentLevel.backgroundImage) ? this.currentLevel.backgroundImage : '',
      marbleProperties: this.marbleProperties, // Add marble properties to gameState
      players: Array.from(this.players.values()).map(player => ({
        id: player.id,
        username: player.username,
        userId: player.userId,
        color: player.color,
        ufoAppearance: player.ufoAppearance,
        unlockedUFOs: player.unlockedUFOs,
        unlockedPassengers: player.unlockedPassengers,
        x: player.x,
        y: player.y,
        beamActive: player.beamActive,
        beamTarget: player.beamTarget,
        xp: player.xp,
        level: player.level,
        coins: player.coins
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
