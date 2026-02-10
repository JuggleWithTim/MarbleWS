const Matter = require('matter-js');

class PhysicsEngine {
  constructor(eventEmitter) {
    this.eventEmitter = eventEmitter;
    this.teleportCooldowns = new Map(); // Track teleport cooldowns per object
    this.goalCooldowns = new Map(); // Track goal cooldowns per object
    this.activeObjects = new Map(); // Track active object movement state
    this.playerEffectCooldowns = new Map(); // Track player effect spawn cooldowns
  }

  startPhysicsLoop() {
    setInterval(() => {
      Matter.Engine.update(this.engine, 1000 / 60); // Fixed 60 FPS timing
      this.updateGameState();
    }, 1000 / 60); // 16.67ms intervals
  }

  updateGameState() {
    // Apply player inputs first (like the reference game)
    this.playerManager.applyPlayerInputs();

    // Update continuous beam effects
    this.updateBeamEffects(1 / 60);

    // Check for player-emote collisions
    this.checkPlayerEmoteCollisions();

    // Update player positions from physics bodies
    this.playerManager.players.forEach(player => {
      player.x = player.body.position.x;
      player.y = player.body.position.y;
    });

    // Update player status effect expiry timers
    this.playerManager.updateStatusEffects();

    // Handle player effects (available in all modes)
    this.handlePlayerEffects();

    // Check win condition
    const winResult = this.checkWinCondition();
    if (winResult.win) {
      // Award XP to all players
      this.playerManager.awardXPAndCoinsForWin();

      // If there's a next level to load, load it
      if (winResult.nextLevel) {
        // Use the socketHandlers to load the next level
        // We'll emit an event that can be caught by the socket handlers
        this.eventEmitter.emit('loadNextLevel', winResult.nextLevel);
      }
    }

    // Update active object movements
    this.updateActiveObjects();

    // Enforce axis locks for dynamic (non-static) objects
    this.enforceAxisLocks();

    // Handle teleporter collisions
    this.handleTeleporters();

    // Update game mode logic
    this.levelManager.updateGameMode(1/60); // Pass delta time

    // Remove/respawn objects that fell off the world
    // Get level dimensions, defaulting to standard canvas size
    const levelWidth = Math.max(1920, this.levelManager.currentLevel?.levelWidth || 1920);
    const levelHeight = Math.max(1080, this.levelManager.currentLevel?.levelHeight || 1080);

    // Use margin of 700 for all directions to allow some off-screen movement
    const margin = 700;

    const worldBounds = {
      minX: -margin,
      maxX: levelWidth + margin,
      minY: -margin,
      maxY: levelHeight + margin
    };

    // Check marbles that went out of bounds in any direction and respawn them
    this.levelManager.marbles.forEach(marble => {
      const pos = marble.body.position;
      if (pos.x < worldBounds.minX || pos.x > worldBounds.maxX ||
          pos.y < worldBounds.minY || pos.y > worldBounds.maxY) {
        // Respawn marble at its original spawn location if available, otherwise find a spawnpoint
        let respawnX, respawnY;

        if (marble.spawnX !== undefined && marble.spawnY !== undefined) {
          // Use the marble's original spawn position
          respawnX = marble.spawnX;
          respawnY = marble.spawnY;
        } else {
          // Fallback: find any spawnpoint
          const spawnpoint = this.levelManager.levelObjects.find(obj =>
            obj.properties && obj.properties.includes('spawnpoint')
          );

          if (spawnpoint) {
            // Use current position if spawnpoint is moving
            respawnX = spawnpoint.body ? spawnpoint.body.position.x : spawnpoint.x;
            respawnY = spawnpoint.body ? spawnpoint.body.position.y : spawnpoint.y;
          } else {
            // Fallback to center if no spawnpoint found
            respawnX = 960;
            respawnY = 540;
          }
        }

        Matter.Body.setPosition(marble.body, {
          x: respawnX,
          y: respawnY - 50
        });
        Matter.Body.setVelocity(marble.body, { x: 0, y: 0 });
      }
    });

    // Check movable level objects that went out of bounds and respawn them
    this.levelManager.levelObjects.forEach(obj => {
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
            const spawnpoint = this.levelManager.levelObjects.find(sp =>
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
    this.levelManager.emotes = this.levelManager.emotes.filter(emote => {
      const pos = emote.body.position;
      if (pos.x < worldBounds.minX || pos.x > worldBounds.maxX ||
          pos.y < worldBounds.minY || pos.y > worldBounds.maxY) {
        Matter.World.remove(this.world, emote.body);
        return false;
      }
      return true;
    });

    // Remove players that went out of bounds and respawn them
    this.playerManager.players.forEach(player => {
      const pos = player.body.position;
      if (pos.x < worldBounds.minX || pos.x > worldBounds.maxX ||
          pos.y < worldBounds.minY || pos.y > worldBounds.maxY) {
        // Find respawn location - prioritize playerspawn, then fall back to spawnpoint, then center
        let respawnX = 960; // Center of canvas
        let respawnY = 540; // Center of canvas

        // First try playerspawn
        let respawnLocation = this.levelManager.levelObjects.find(obj =>
          obj.properties && obj.properties.includes('playerspawn')
        );

        // Fall back to spawnpoint if no playerspawn found
        if (!respawnLocation) {
          respawnLocation = this.levelManager.levelObjects.find(obj =>
            obj.properties && obj.properties.includes('spawnpoint')
          );
        }

        if (respawnLocation) {
          // Use current position if spawnpoint is moving
          respawnX = respawnLocation.body ? respawnLocation.body.position.x : respawnLocation.x;
          respawnY = respawnLocation.body ? respawnLocation.body.position.y : respawnLocation.y;
        }

        // Respawn UFO at spawn location or center of canvas
        Matter.Body.setPosition(player.body, { x: respawnX, y: respawnY });
        Matter.Body.setVelocity(player.body, { x: 0, y: 0 });
        player.x = respawnX;
        player.y = respawnY;
      }
    });
  }

  handleBeamInteraction(socketId, targetX, targetY) {
    const player = this.playerManager.players.get(socketId);
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
    const otherPlayers = Array.from(this.playerManager.players.values()).filter(p => p.id !== player.id);
    const candidates = [...this.levelManager.marbles, ...this.levelManager.emotes, ...this.levelManager.levelObjects.filter(obj => !obj.isStatic), ...otherPlayers];
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
  updateBeamEffects(deltaTime = 1 / 60) {
    const currentMode = this.levelManager?.gameModeManager?.getCurrentMode?.();
    const isBeamDrainMode = currentMode && currentMode.getModeName && currentMode.getModeName() === 'Beam Drain';
    const drainPerSecond = require('../../shared/gameConfig').beamDrainMode?.drainPerSecond || 18;

    this.playerManager.players.forEach(player => {
      if (!player.beamActive) return;

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

      const otherPlayers = Array.from(this.playerManager.players.values()).filter(p => p.id !== player.id);
      const nonPlayerCandidates = [
        ...this.levelManager.marbles,
        ...this.levelManager.emotes,
        ...this.levelManager.levelObjects.filter(obj => !obj.isStatic)
      ];

      if (isBeamDrainMode && currentMode && typeof currentMode.collectParticlesInBeam === 'function') {
        currentMode.collectParticlesInBeam(player.id, beamVerts, Matter.Vertices, deltaTime);
      }

      if (isBeamDrainMode && currentMode && typeof currentMode.transferEnergy === 'function') {
        otherPlayers.forEach(otherPlayer => {
          if (typeof currentMode.isPlayerAlive === 'function' && !currentMode.isPlayerAlive(otherPlayer.id)) {
            return;
          }

          const objVerts = otherPlayer.body.vertices;
          const overlap = objVerts.some(v => Matter.Vertices.contains(beamVerts, v));
          const beamOverlap = beamVerts.some(v => Matter.Vertices.contains(objVerts, v));
          if (!overlap && !beamOverlap) return;

          currentMode.transferEnergy(
            player.id,
            otherPlayer.id,
            drainPerSecond * deltaTime,
            { x: otherPlayer.body.position.x, y: otherPlayer.body.position.y }
          );
        });
      }

      // Keep chaotic beam-force feeling in all modes (including Beam Drain)
      const beamAffectedPlayers = (isBeamDrainMode && currentMode && typeof currentMode.isPlayerAlive === 'function')
        ? otherPlayers.filter(p => currentMode.isPlayerAlive(p.id))
        : otherPlayers;

      const candidates = [...nonPlayerCandidates, ...beamAffectedPlayers];
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

          // Track emote interactions
          if (obj.type === 'emote') {
            obj.interactedPlayers.add(player.id);
          }
        }
      });
    });
  }

  // Check for collisions between players and emotes
  checkPlayerEmoteCollisions() {
    const playerRadius = 25;
    const emoteRadius = this.levelManager.emoteProperties ? this.levelManager.emoteProperties.radius : 25; // Emote radius from level config
    const collisionDistance = playerRadius + emoteRadius + 1; // Add extra pixel for reliability

    this.playerManager.players.forEach(player => {
      this.levelManager.emotes.forEach(emote => {
        const playerX = player.x;
        const playerY = player.y;
        const emoteX = emote.body.position.x;
        const emoteY = emote.body.position.y;

        // Simple distance-based collision
        const distance = Math.sqrt(
          Math.pow(playerX - emoteX, 2) +
          Math.pow(playerY - emoteY, 2)
        );

        if (distance <= collisionDistance) { // Dynamic touching distance based on actual sizes
          emote.interactedPlayers.add(player.id);
        }
      });
    });
  }

  checkWinCondition() {
    const currentMode = this.levelManager?.gameModeManager?.getCurrentMode?.();
    if (currentMode && currentMode.getModeName && currentMode.getModeName() === 'Beam Drain') {
      return { win: false };
    }

    const goals = this.levelManager.levelObjects.filter(obj =>
      obj.properties && obj.properties.includes('goal')
    );

    if (goals.length === 0) return false;

    // Get current timestamp for cooldown checks
    const now = Date.now();

    // Get marble radius from properties
    const marbleRadius = this.levelManager.marbleProperties ? this.levelManager.marbleProperties.radius : 30;

    // Check if any marble reached any goal (with cooldown)
    for (const goal of goals) {
      // Check if goal is on cooldown for marbles
      const cooldownKey = goal.id;
      const lastWin = this.goalCooldowns.get(cooldownKey);
      if (lastWin && (now - lastWin) < 5000) { // 5 second cooldown for marbles
        // Still check emotes even if goal is on cooldown for marbles
        continue; // Skip marble check for this goal, but emotes can still trigger
      }

      for (const marble of this.levelManager.marbles) {
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
          // Set cooldown to prevent rapid repeated triggering for marbles
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

    // Check if any emote reached any goal (no cooldown for emotes)
    const emoteRadius = this.levelManager.emoteProperties ? this.levelManager.emoteProperties.radius : 25; // Emote radius from level config

    for (const goal of goals) {
      for (const emote of this.levelManager.emotes) {
        const emoteX = emote.body.position.x;
        const emoteY = emote.body.position.y;
        // Use current goal position if goal is moving
        const goalX = goal.body ? goal.body.position.x : goal.x;
        const goalY = goal.body ? goal.body.position.y : goal.y;
        let collision = false;

        if (goal.shape === 'circle') {
          // Circle-circle collision
          const goalRadius = goal.radius || 50; // Default radius if not specified
          const distance = Math.sqrt(
            Math.pow(emoteX - goalX, 2) +
            Math.pow(emoteY - goalY, 2)
          );
          collision = distance <= (emoteRadius + goalRadius);
        } else if (goal.shape === 'rectangle') {
          // Circle-rectangle collision
          const halfWidth = (goal.width || 100) / 2;
          const halfHeight = (goal.height || 100) / 2;

          // Find the closest point on the rectangle to the emote center
          const closestX = Math.max(goalX - halfWidth, Math.min(emoteX, goalX + halfWidth));
          const closestY = Math.max(goalY - halfHeight, Math.min(emoteY, goalY + halfHeight));

          // Calculate distance from emote center to closest point
          const distance = Math.sqrt(
            Math.pow(emoteX - closestX, 2) +
            Math.pow(emoteY - closestY, 2)
          );

          collision = distance <= emoteRadius; // Dynamic emote radius
        } else {
          // Fallback to distance-based check for unknown shapes
          const distance = Math.sqrt(
            Math.pow(emoteX - goalX, 2) +
            Math.pow(emoteY - goalY, 2)
          );
          collision = distance < 50; // Keep old behavior as fallback
        }

        if (collision) {
          // Award XP and coins to players who interacted with this emote
          const interactedPlayers = Array.from(emote.interactedPlayers);
          if (interactedPlayers.length > 0) {
            this.eventEmitter.emit('emoteGoalReached', {
              emote,
              interactedPlayers,
              goalX,
              goalY
            });
          }

          // Remove the emote from the world
          Matter.World.remove(this.world, emote.body);
          this.levelManager.emotes = this.levelManager.emotes.filter(e => e.id !== emote.id);

          // Do not trigger level progression for emotes
          return { win: false };
        }
      }
    }

    return { win: false };
  }

  handleTeleporters() {
    // Get all teleporter objects
    const teleporters = this.levelManager.levelObjects.filter(obj =>
      obj.properties && obj.properties.includes('teleporter') && obj.teleporterTarget
    );

    if (teleporters.length === 0) return;

    // Get current timestamp for cooldown checks
    const now = Date.now();

    // Collect all movable objects that can be teleported
    const otherPlayers = Array.from(this.playerManager.players.values());
    const movableObjects = [
      ...this.levelManager.marbles,
      ...this.levelManager.emotes,
      ...this.levelManager.levelObjects.filter(obj => !obj.isStatic && obj.body),
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
          const targetTeleporter = this.levelManager.levelObjects.find(target =>
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

  handlePlayerEffects() {
    const effectSpawns = this.levelManager.levelObjects.filter(obj =>
      obj.properties && obj.properties.includes('playereffect')
    );

    if (effectSpawns.length === 0) return;

    const now = Date.now();
    const config = require('../../shared/gameConfig').raceMode || {};
    const pickupCooldownMs = config.playerEffect?.pickupCooldownMs || 2000;

    effectSpawns.forEach(spawn => {
      for (const [playerId, player] of this.playerManager.players) {
        if (!this.isPlayerCollidingWithObject(player, spawn)) continue;

        const cooldownKey = `${playerId}-${spawn.id}`;
        const lastPickup = this.playerEffectCooldowns.get(cooldownKey);
        if (lastPickup && now - lastPickup < pickupCooldownMs) {
          continue;
        }

        const effect = this.pickItemForSpawn(spawn, config.items || { turbo: {}, slow: {}, confusion: {}, ghost: {} });
        this.playerEffectCooldowns.set(cooldownKey, now);
        this.applyItemEffect(playerId, effect, config.items || {});

        this.eventEmitter.emit('racePlayerEffect', {
          playerId,
          effect,
          spawnId: spawn.id
        });
      }
    });
  }

  pickItemForSpawn(spawn, itemsConfig) {
    if (spawn.itemType && itemsConfig[spawn.itemType]) {
      return spawn.itemType;
    }

    const items = Object.keys(itemsConfig);
    return items[Math.floor(Math.random() * items.length)] || 'turbo';
  }

  applyItemEffect(playerId, item, itemsConfig) {
    const itemConfig = itemsConfig[item] || {};
    const multiplier = itemConfig.speedMultiplier || 1;
    const durationMs = itemConfig.durationMs || 1000;

    if (item === 'ghost') {
      this.playerManager.applyGhost(playerId, durationMs);
      return;
    }

    if (item === 'confusion') {
      this.playerManager.applyConfusion(playerId, durationMs);
      return;
    }

    if (multiplier !== 1) {
      this.playerManager.applySpeedBoost(playerId, multiplier, durationMs);
    }
  }

  isPlayerCollidingWithObject(player, obj) {
    if (!player.body || !obj) return false;
    const playerX = player.body.position.x;
    const playerY = player.body.position.y;

    const objX = obj.body ? obj.body.position.x : obj.x;
    const objY = obj.body ? obj.body.position.y : obj.y;

    if (obj.shape === 'circle') {
      const radius = obj.radius || 50;
      const distance = Math.hypot(playerX - objX, playerY - objY);
      return distance <= radius + 25;
    }

    const halfWidth = (obj.width || 100) / 2;
    const halfHeight = (obj.height || 100) / 2;
    return (
      playerX >= objX - halfWidth &&
      playerX <= objX + halfWidth &&
      playerY >= objY - halfHeight &&
      playerY <= objY + halfHeight
    );
  }

  updateIndependentRotation(obj) {
    // Handle independent rotation when points are the same
    // Initialize rotation state if not exists
    if (!this.activeObjects.has(obj.id)) {
      this.activeObjects.set(obj.id, {
        phase: 'toB', // Start by rotating to Rotation B
        startTime: Date.now(),
        currentAngle: obj.body.angle
      });
    }

    const state = this.activeObjects.get(obj.id);
    const now = Date.now();
    const elapsed = (now - state.startTime) / 1000; // Convert to seconds

    // Get rotation values
    const rotationA = obj.rotationA !== undefined ? obj.rotationA : obj.rotation;
    const rotationB = obj.rotationB !== undefined ? obj.rotationB : obj.rotation;

      // Helper function to rotate object around a custom pivot point
      const rotateAroundPivot = (body, angle, pivotX, pivotY) => {
        // Calculate the angle difference to rotate by
        const angleDiff = angle - body.angle;

        // Translate to pivot point
        const translatedX = body.position.x - pivotX;
        const translatedY = body.position.y - pivotY;

        // Rotate around origin by the angle difference
        const cos = Math.cos(angleDiff);
        const sin = Math.sin(angleDiff);
        const rotatedX = translatedX * cos - translatedY * sin;
        const rotatedY = translatedX * sin + translatedY * cos;

        // Translate back
        const finalX = rotatedX + pivotX;
        const finalY = rotatedY + pivotY;

        Matter.Body.setPosition(body, { x: finalX, y: finalY });
        Matter.Body.setAngle(body, angle);
      };

    switch (state.phase) {
      case 'toB':
        // Rotate from current angle to Rotation B
        if (obj.timeToA && obj.timeToA > 0) {
          const progress = Math.min(elapsed / obj.timeToA, 1);
          const targetAngle = state.currentAngle + (rotationB - state.currentAngle) * progress;
          if (obj.rotationPoint) {
            const pivotX = obj.x + obj.rotationPoint.x;
            const pivotY = obj.y + obj.rotationPoint.y;
            rotateAroundPivot(obj.body, targetAngle, pivotX, pivotY);
          } else {
            Matter.Body.setAngle(obj.body, targetAngle);
          }

          if (progress >= 1) {
            // Reached Rotation B, start waiting
            state.phase = 'atB';
            state.startTime = now;
          }
        } else {
          // No time specified, rotate instantly
          if (obj.rotationPoint) {
            const pivotX = obj.x + obj.rotationPoint.x;
            const pivotY = obj.y + obj.rotationPoint.y;
            rotateAroundPivot(obj.body, rotationB, pivotX, pivotY);
          } else {
            Matter.Body.setAngle(obj.body, rotationB);
          }
          state.phase = 'atB';
          state.startTime = now;
        }
        break;

      case 'atB':
        // Wait at Rotation B for timeFromA seconds
        if (obj.timeFromA && obj.timeFromA > 0) {
          if (elapsed >= obj.timeFromA) {
            state.phase = 'toA';
            state.startTime = now;
            state.currentAngle = obj.body.angle;
          }
        } else {
          // No wait time, rotate back immediately
          state.phase = 'toA';
          state.startTime = now;
          state.currentAngle = obj.body.angle;
        }
        break;

      case 'toA':
        // Rotate from Rotation B back to Rotation A
        if (obj.timeToA && obj.timeToA > 0) {
          const progress = Math.min(elapsed / obj.timeToA, 1);
          const targetAngle = rotationB + (rotationA - rotationB) * progress;
          if (obj.rotationPoint) {
            const pivotX = obj.x + obj.rotationPoint.x;
            const pivotY = obj.y + obj.rotationPoint.y;
            rotateAroundPivot(obj.body, targetAngle, pivotX, pivotY);
          } else {
            Matter.Body.setAngle(obj.body, targetAngle);
          }

          if (progress >= 1) {
            // Reached Rotation A, restart cycle
            state.phase = 'toB';
            state.startTime = now;
            state.currentAngle = obj.body.angle;
          }
        } else {
          // No time specified, rotate instantly and restart
          if (obj.rotationPoint) {
            const pivotX = obj.x + obj.rotationPoint.x;
            const pivotY = obj.y + obj.rotationPoint.y;
            rotateAroundPivot(obj.body, rotationA, pivotX, pivotY);
          } else {
            Matter.Body.setAngle(obj.body, rotationA);
          }
          state.phase = 'toB';
          state.startTime = now;
          state.currentAngle = obj.body.angle;
        }
        break;
    }
  }

  updateActiveObjects() {
    // Get all active objects
    const activeObjects = this.levelManager.levelObjects.filter(obj => obj.active && obj.body);

    activeObjects.forEach(obj => {
      // Check if this is an independent rotation case (advancedRotation + same points)
      const pointsAreSame = obj.pointA && obj.pointB &&
        Math.abs(obj.pointA.x - obj.pointB.x) < 1 &&
        Math.abs(obj.pointA.y - obj.pointB.y) < 1;

      if (obj.advancedRotation && pointsAreSame) {
        // Independent rotation mode - ignore position, just rotate
        this.updateIndependentRotation(obj);
        return;
      }

      // Initialize movement state if not exists
      if (!this.activeObjects.has(obj.id)) {
        this.activeObjects.set(obj.id, {
          phase: 'toA', // 'toA', 'atA', 'toB', 'atB', 'fromB'
          startTime: Date.now(),
          currentPos: { x: obj.body.position.x, y: obj.body.position.y },
          currentAngle: obj.body.angle
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

      // Get rotation values, defaulting to current object rotation if not specified
      const rotationA = obj.rotationA !== undefined ? obj.rotationA : obj.rotation;
      const rotationB = obj.rotationB !== undefined ? obj.rotationB : obj.rotation;

      // Helper function to rotate object around a custom pivot point
      const rotateAroundPivot = (body, angle, pivotX, pivotY) => {
        // Calculate the angle difference to rotate by
        const angleDiff = angle - body.angle;

        // Translate to pivot point
        const translatedX = body.position.x - pivotX;
        const translatedY = body.position.y - pivotY;

        // Rotate around origin by the angle difference
        const cos = Math.cos(angleDiff);
        const sin = Math.sin(angleDiff);
        const rotatedX = translatedX * cos - translatedY * sin;
        const rotatedY = translatedX * sin + translatedY * cos;

        // Translate back
        const finalX = rotatedX + pivotX;
        const finalY = rotatedY + pivotY;

        Matter.Body.setPosition(body, { x: finalX, y: finalY });
        Matter.Body.setAngle(body, angle);
      };

      // Helper to constrain active movement to a single axis when requested
      const setPositionWithAxisLock = (targetPosition) => {
        if (obj.axisLock === 'x') {
          Matter.Body.setPosition(obj.body, { x: targetPosition.x, y: obj.body.position.y });
        } else if (obj.axisLock === 'y') {
          Matter.Body.setPosition(obj.body, { x: obj.body.position.x, y: targetPosition.y });
        } else {
          Matter.Body.setPosition(obj.body, targetPosition);
        }
      };

      switch (state.phase) {
        case 'toA':
          // Move from current position to point A
          if (obj.timeToA && obj.timeToA > 0) {
            const progress = Math.min(elapsed / obj.timeToA, 1);
            const newX = state.currentPos.x + (pointAWorld.x - state.currentPos.x) * progress;
            const newY = state.currentPos.y + (pointAWorld.y - state.currentPos.y) * progress;
            const newAngle = state.currentAngle + (rotationA - state.currentAngle) * progress;

            setPositionWithAxisLock({ x: newX, y: newY });
            if (obj.rotationPoint) {
              const pivotX = obj.body.position.x + obj.rotationPoint.x;
              const pivotY = obj.body.position.y + obj.rotationPoint.y;
              rotateAroundPivot(obj.body, newAngle, pivotX, pivotY);
            } else {
              Matter.Body.setAngle(obj.body, newAngle);
            }

            if (progress >= 1) {
              // Reached point A, start waiting
              state.phase = 'atA';
              state.startTime = now;
            }
          } else {
            // No time specified, move instantly
            setPositionWithAxisLock(pointAWorld);
            if (obj.rotationPoint) {
              const pivotX = obj.body.position.x + obj.rotationPoint.x;
              const pivotY = obj.body.position.y + obj.rotationPoint.y;
              rotateAroundPivot(obj.body, rotationA, pivotX, pivotY);
            } else {
              Matter.Body.setAngle(obj.body, rotationA);
            }
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
                setPositionWithAxisLock(pointBWorld);
                state.phase = 'atB';
                state.startTime = now;
              } else {
                // Move towards point B
                const ratio = moveDistance / distance;
                const newX = obj.body.position.x + dx * ratio;
                const newY = obj.body.position.y + dy * ratio;
                setPositionWithAxisLock({ x: newX, y: newY });
              }
            } else {
              state.phase = 'atB';
              state.startTime = now;
            }
          } else {
            // No speed specified, move instantly
            setPositionWithAxisLock(pointBWorld);
            state.phase = 'atB';
            state.startTime = now;
          }

          // Handle rotation based on advanced mode setting
          if (obj.advancedRotation) {
            // Advanced mode: Use independent rotation speeds
            if (obj.rotationSpeedToB && obj.rotationSpeedToB > 0) {
              const rotationSpeedRadPerSec = (obj.rotationSpeedToB * Math.PI) / 180; // Convert deg/sec to rad/sec
              const angleChange = rotationSpeedRadPerSec * (1/60); // Change this frame
              const angleDiff = rotationB - obj.body.angle;

              if (Math.abs(angleDiff) > 0.01) { // Not close enough to target
                if (Math.abs(angleChange) >= Math.abs(angleDiff)) {
                  // Reached target rotation
                  if (obj.rotationPoint) {
                    const pivotX = obj.body.position.x + obj.rotationPoint.x;
                    const pivotY = obj.body.position.y + obj.rotationPoint.y;
                    rotateAroundPivot(obj.body, rotationB, pivotX, pivotY);
                  } else {
                    Matter.Body.setAngle(obj.body, rotationB);
                  }
                } else {
                  // Rotate towards target
                  const direction = angleDiff > 0 ? 1 : -1;
                  const newAngle = obj.body.angle + angleChange * direction;
                  if (obj.rotationPoint) {
                    const pivotX = obj.body.position.x + obj.rotationPoint.x;
                    const pivotY = obj.body.position.y + obj.rotationPoint.y;
                    rotateAroundPivot(obj.body, newAngle, pivotX, pivotY);
                  } else {
                    Matter.Body.setAngle(obj.body, newAngle);
                  }
                }
              }
            }
          } else {
            // Default mode: Use position timing for rotation
            if (obj.speedToB && obj.speedToB > 0) {
              // Calculate rotation progress based on position progress
              const dx = pointBWorld.x - obj.body.position.x;
              const dy = pointBWorld.y - obj.body.position.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const totalDistance = Math.sqrt(
                (pointBWorld.x - pointAWorld.x) ** 2 +
                (pointBWorld.y - pointAWorld.y) ** 2
              );

              if (totalDistance > 0) {
                const progress = 1 - (distance / totalDistance);
                const targetAngle = rotationA + (rotationB - rotationA) * progress;
                if (obj.rotationPoint) {
                  const pivotX = obj.body.position.x + obj.rotationPoint.x;
                  const pivotY = obj.body.position.y + obj.rotationPoint.y;
                  rotateAroundPivot(obj.body, targetAngle, pivotX, pivotY);
                } else {
                  Matter.Body.setAngle(obj.body, targetAngle);
                }
              }
            }
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
                setPositionWithAxisLock(pointAWorld);
                state.phase = 'toA';
                state.startTime = now;
                state.currentPos = { x: obj.body.position.x, y: obj.body.position.y };
                state.currentAngle = obj.body.angle;
              } else {
                // Move towards point A
                const ratio = moveDistance / distance;
                const newX = obj.body.position.x + dx * ratio;
                const newY = obj.body.position.y + dy * ratio;
                setPositionWithAxisLock({ x: newX, y: newY });
              }
            } else {
              // Restart cycle
              state.phase = 'toA';
              state.startTime = now;
              state.currentPos = { x: obj.body.position.x, y: obj.body.position.y };
              state.currentAngle = obj.body.angle;
            }
          } else {
            // No speed specified, move instantly and restart
            setPositionWithAxisLock(pointAWorld);
            state.phase = 'toA';
            state.startTime = now;
            state.currentPos = { x: obj.body.position.x, y: obj.body.position.y };
            state.currentAngle = obj.body.angle;
          }

          // Handle rotation based on advanced mode setting
          if (obj.advancedRotation) {
            // Advanced mode: Use independent rotation speeds
            if (obj.rotationSpeedFromB && obj.rotationSpeedFromB > 0) {
              const rotationSpeedRadPerSec = (obj.rotationSpeedFromB * Math.PI) / 180; // Convert deg/sec to rad/sec
              const angleChange = rotationSpeedRadPerSec * (1/60); // Change this frame
              const angleDiff = rotationA - obj.body.angle;

              if (Math.abs(angleDiff) > 0.01) { // Not close enough to target
                if (Math.abs(angleChange) >= Math.abs(angleDiff)) {
                  // Reached target rotation
                  if (obj.rotationPoint) {
                    const pivotX = obj.body.position.x + obj.rotationPoint.x;
                    const pivotY = obj.body.position.y + obj.rotationPoint.y;
                    rotateAroundPivot(obj.body, rotationA, pivotX, pivotY);
                  } else {
                    Matter.Body.setAngle(obj.body, rotationA);
                  }
                } else {
                  // Rotate towards target
                  const direction = angleDiff > 0 ? 1 : -1;
                  const newAngle = obj.body.angle + angleChange * direction;
                  if (obj.rotationPoint) {
                    const pivotX = obj.body.position.x + obj.rotationPoint.x;
                    const pivotY = obj.body.position.y + obj.rotationPoint.y;
                    rotateAroundPivot(obj.body, newAngle, pivotX, pivotY);
                  } else {
                    Matter.Body.setAngle(obj.body, newAngle);
                  }
                }
              }
            }
          } else {
            // Default mode: Use position timing for rotation
            if (obj.speedFromB && obj.speedFromB > 0) {
              // Calculate rotation progress based on position progress
              const dx = pointAWorld.x - obj.body.position.x;
              const dy = pointAWorld.y - obj.body.position.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const totalDistance = Math.sqrt(
                (pointAWorld.x - pointBWorld.x) ** 2 +
                (pointAWorld.y - pointBWorld.y) ** 2
              );

              if (totalDistance > 0) {
                const progress = 1 - (distance / totalDistance);
                const targetAngle = rotationB + (rotationA - rotationB) * progress;
                if (obj.rotationPoint) {
                  const pivotX = obj.body.position.x + obj.rotationPoint.x;
                  const pivotY = obj.body.position.y + obj.rotationPoint.y;
                  rotateAroundPivot(obj.body, targetAngle, pivotX, pivotY);
                } else {
                  Matter.Body.setAngle(obj.body, targetAngle);
                }
              }
            }
          }
          break;
      }
    });
  }

  enforceAxisLocks() {
    this.levelManager.levelObjects.forEach(obj => {
      if (obj.isStatic || !obj.body) return;
      if (obj.axisLock !== 'x' && obj.axisLock !== 'y') return;

      if (obj.axisLock === 'x') {
        // Keep object on its original horizontal line (constant Y)
        const lockedY = (typeof obj.y === 'number') ? obj.y : obj.body.position.y;
        Matter.Body.setPosition(obj.body, { x: obj.body.position.x, y: lockedY });
        Matter.Body.setVelocity(obj.body, { x: obj.body.velocity.x, y: 0 });
      } else {
        // Keep object on its original vertical line (constant X)
        const lockedX = (typeof obj.x === 'number') ? obj.x : obj.body.position.x;
        Matter.Body.setPosition(obj.body, { x: lockedX, y: obj.body.position.y });
        Matter.Body.setVelocity(obj.body, { x: 0, y: obj.body.velocity.y });
      }
    });
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

  setLevelManager(levelManager) {
    this.levelManager = levelManager;
  }
}

module.exports = PhysicsEngine;
