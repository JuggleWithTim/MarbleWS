const Matter = require('matter-js');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { generateColorFromSeed, normalizeColor } = require('./utils');
const gameConfig = require('../../shared/gameConfig.js');

class PlayerManager {
  constructor(eventEmitter) {
    this.eventEmitter = eventEmitter;
    this.players = new Map();

    // Initialize SQLite database
    this.db = new sqlite3.Database(path.join(process.cwd(), 'players.db'), (err) => {
      if (err) {
        console.error('Failed to open database:', err.message);
      } else {
        console.log('Connected to SQLite database.');
        this.initDatabase();
      }
    });
  }

  initDatabase() {
    const sql = `
      CREATE TABLE IF NOT EXISTS players (
        userId TEXT PRIMARY KEY,
        username TEXT,
        ufoAppearance TEXT,
        level INTEGER DEFAULT 1,
        xp INTEGER DEFAULT 0,
        coins INTEGER DEFAULT 100,
        banned INTEGER DEFAULT 0,
        unlockedUFOs TEXT,
        unlockedPassengers TEXT,
        unlockedHats TEXT,
        lastUpdated TEXT
      )
    `;

    this.db.run(sql, (err) => {
      if (err) {
        console.error('Failed to create table:', err.message);
      } else {
        console.log('Players table ready.');
        this.ensureBannedColumn();
      }
    });
  }

  ensureBannedColumn() {
    this.db.all('PRAGMA table_info(players)', (pragmaErr, columns) => {
      if (pragmaErr) {
        console.error('Failed to inspect players table:', pragmaErr.message);
        return;
      }

      const hasBannedColumn = columns.some(column => column.name === 'banned');
      if (hasBannedColumn) {
        return;
      }

      this.db.run('ALTER TABLE players ADD COLUMN banned INTEGER DEFAULT 0', (alterErr) => {
        if (alterErr) {
          console.error('Failed to add banned column:', alterErr.message);
          return;
        }

        console.log('Added banned column to players table.');
      });
    });
  }

  isUserBanned(userId) {
    return new Promise((resolve) => {
      const sql = 'SELECT banned FROM players WHERE userId = ?';
      this.db.get(sql, [userId], (err, row) => {
        if (err) {
          console.error('Failed to check banned status:', err.message);
          resolve(false);
          return;
        }

        resolve(Boolean(row && row.banned));
      });
    });
  }

  // Calculate level from total XP with progressive requirements
  // Level 1: 0-999 XP, Level 2: 1000-2999 XP, Level 3: 3000-5999 XP, etc.
  calculateLevelFromXP(totalXP) {
    let level = 1;
    let requiredXP = 0;

    while (requiredXP + level * 1000 <= totalXP) {
      requiredXP += level * 1000;
      level++;
    }

    return level;
  }

  // Get XP progress percentage within current level (0-100)
  getXPProgress(totalXP, level) {
    const xpForPreviousLevels = (level - 1) * level * 1000 / 2;
    const xpInCurrentLevel = totalXP - xpForPreviousLevels;
    const xpNeededForNextLevel = level * 1000;

    return Math.min((xpInCurrentLevel / xpNeededForNextLevel) * 100, 100);
  }

  async addPlayer(socketId, username, userId) {
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

    // Calculate UFO physics radius and density (normal size for all modes)
    let physicsRadius = 25; // Default radius
    let physicsDensity = 0.0008; // Default density

    // Create UFO physics body
    const ufoBody = Matter.Bodies.circle(spawnX, spawnY, physicsRadius, {
      isStatic: false,
      friction: 0.2,        // Increased from 0.1
      frictionAir: 0.05,    // Increased from 0.05 for better stopping
      restitution: 0.2,     // Reduced from 0.3 for less bouncing
      density: physicsDensity,  // Adjusted for dungeon mode to maintain mass
      render: {
        fillStyle: '#4ecdc4'
      }
    });

    // Add UFO to physics world
    Matter.World.add(this.world, ufoBody);

    // Load saved appearance and progress data
    const savedData = await this.loadPlayerData(userId);
    const color = normalizeColor(savedData.ufoAppearance.color, generateColorFromSeed(userId));

    const player = {
      id: socketId,
      username,
      userId,
      color,
      ufoAppearance: savedData.ufoAppearance,
      unlockedUFOs: savedData.unlockedUFOs,
      unlockedPassengers: savedData.unlockedPassengers,
      unlockedHats: savedData.unlockedHats,
      body: ufoBody,
      x: spawnX,
      y: spawnY,
      beamActive: false,
      beamTarget: null,
      xp: savedData.xp,
      level: savedData.level,
      coins: savedData.coins,
      targetX: spawnX,
      targetY: spawnY,
      speedMultiplier: 1,
      speedBoostExpiresAt: 0,
      controlsInverted: false,
      controlsInvertedExpiresAt: 0,
      isGhost: false,
      ghostExpiresAt: 0,
      banned: savedData.banned
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
      unlockedHats: savedData.unlockedHats,
      x: spawnX,
      y: spawnY,
      beamActive: false,
      beamTarget: null,
      xp: savedData.xp,
      level: savedData.level,
      coins: savedData.coins,
      isGhost: false,
      banned: savedData.banned
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
    const isDungeonMode = levelData && levelData.levelType === 'Dungeon';

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
        // Remove old body from physics world
        Matter.World.remove(this.world, player.body);

        // Use standard physics size for all modes
        let physicsRadius = 25; // Default radius
        let physicsDensity = 0.0008; // Default density

        // Create new body with correct radius and adjusted density
        const newBody = Matter.Bodies.circle(spawnX, spawnY, physicsRadius, {
          isStatic: false,
          friction: 0.2,
          frictionAir: 0.05,
          restitution: 0.2,
          density: physicsDensity,
          render: {
            fillStyle: '#4ecdc4'
          }
        });

        // Add new body to physics world
        Matter.World.add(this.world, newBody);

        // Update player reference
        player.body = newBody;
        player.x = spawnX;
        player.y = spawnY;

        // Reset beam state to ensure clean start
        player.beamActive = false;
        player.beamTarget = null;
        player.speedMultiplier = 1;
        player.speedBoostExpiresAt = 0;
        player.controlsInverted = false;
        player.controlsInvertedExpiresAt = 0;
        player.isGhost = false;
        player.ghostExpiresAt = 0;
        this.setPlayerCollisionEnabled(player, true);
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
        const speedMultiplier = player.speedMultiplier || 1;
        const forceAmount = 0.003 * speedMultiplier; // Similar to reference game's 0.0035
        let fx = 0, fy = 0;

        const input = player.controlsInverted
          ? {
              up: player.input.down,
              down: player.input.up,
              left: player.input.right,
              right: player.input.left
            }
          : player.input;

        if (input.up) fy -= forceAmount;
        if (input.down) fy += forceAmount;
        if (input.left) fx -= forceAmount;
        if (input.right) fx += forceAmount;

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

  applySpeedBoost(playerId, multiplier, durationMs) {
    const player = this.players.get(playerId);
    if (!player) return;

    player.speedMultiplier = multiplier;
    player.speedBoostExpiresAt = Date.now() + durationMs;
  }

  applyConfusion(playerId, durationMs) {
    const player = this.players.get(playerId);
    if (!player) return;

    player.controlsInverted = true;
    player.controlsInvertedExpiresAt = Date.now() + durationMs;
  }

  setPlayerCollisionEnabled(player, enabled) {
    if (!player || !player.body) return;

    const currentFilter = player.body.collisionFilter || {};
    Matter.Body.set(player.body, 'collisionFilter', {
      ...currentFilter,
      mask: enabled ? 0xFFFFFFFF : 0x0000
    });
  }

  applyGhost(playerId, durationMs) {
    const player = this.players.get(playerId);
    if (!player) return;

    player.isGhost = true;
    player.ghostExpiresAt = Date.now() + durationMs;
    this.setPlayerCollisionEnabled(player, false);
  }

  clearGhost(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;

    player.isGhost = false;
    player.ghostExpiresAt = 0;
    this.setPlayerCollisionEnabled(player, true);
  }

  updateSpeedBoosts(now = Date.now()) {
    this.players.forEach(player => {
      if (player.speedBoostExpiresAt && player.speedBoostExpiresAt <= now) {
        player.speedMultiplier = 1;
        player.speedBoostExpiresAt = 0;
      }
    });
  }

  updateStatusEffects(now = Date.now()) {
    this.updateSpeedBoosts(now);

    this.players.forEach(player => {
      if (player.controlsInvertedExpiresAt && player.controlsInvertedExpiresAt <= now) {
        player.controlsInverted = false;
        player.controlsInvertedExpiresAt = 0;
      }

      if (player.ghostExpiresAt && player.ghostExpiresAt <= now) {
        this.clearGhost(player.id);
      }
    });
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

      // Validate that hats are unlocked before allowing selection
      if (appearance.hat && !player.unlockedHats.includes(appearance.hat)) {
        console.log(`Player ${player.username} attempted to select locked hat: ${appearance.hat}`);
        return; // Reject the appearance change
      }

      const fallbackColor = normalizeColor(player.color, generateColorFromSeed(player.userId));
      const normalizedAppearance = {
        ...appearance,
        color: normalizeColor(appearance.color, fallbackColor)
      };

      // Update the player's appearance
      player.ufoAppearance = normalizedAppearance;

      // Always update the color field for username display, regardless of UFO type
      player.color = normalizedAppearance.color;

      // Save appearance and progress to persistent storage
      this.savePlayerData(player.userId, normalizedAppearance, player.level, player.xp, player.coins, player.unlockedUFOs, player.unlockedPassengers, player.unlockedHats, player.username, player.banned);

      console.log(`Player ${player.username} updated appearance:`, normalizedAppearance);
    }
  }

  unlockUFO(socketId, ufoImage) {
    const player = this.players.get(socketId);
    if (!player) return { success: false, message: 'Player not found' };

    // Get UFO cost from shared config
    const ufoData = gameConfig.ufoData[ufoImage];
    if (!ufoData || !ufoData.cost) {
      return { success: false, message: 'Invalid UFO image' };
    }

    const cost = ufoData.cost;

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
    this.savePlayerData(player.userId, player.ufoAppearance, player.level, player.xp, player.coins, player.unlockedUFOs, player.unlockedPassengers, player.unlockedHats, player.username, player.banned);

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

    // Get passenger cost from shared config
    const passengerData = gameConfig.passengerData[passengerImage];
    if (!passengerData || !passengerData.cost) {
      return { success: false, message: 'Invalid passenger image' };
    }

    const cost = passengerData.cost;

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
    this.savePlayerData(player.userId, player.ufoAppearance, player.level, player.xp, player.coins, player.unlockedUFOs, player.unlockedPassengers, player.unlockedHats, player.username, player.banned);

    console.log(`Player ${player.username} unlocked passenger ${passengerImage} for ${cost} coins`);

    return {
      success: true,
      passengerImage,
      cost,
      remainingCoins: player.coins,
      unlockedPassengers: player.unlockedPassengers
    };
  }

  unlockHat(socketId, hatImage) {
    const player = this.players.get(socketId);
    if (!player) return { success: false, message: 'Player not found' };

    // Get hat cost from shared config
    const hatData = gameConfig.hatData[hatImage];
    if (!hatData || !hatData.cost) {
      return { success: false, message: 'Invalid hat image' };
    }

    const cost = hatData.cost;

    // Check if already unlocked
    if (player.unlockedHats.includes(hatImage)) {
      return { success: false, message: 'Hat already unlocked' };
    }

    // Check if player has enough coins
    if (player.coins < cost) {
      return { success: false, message: 'Not enough coins' };
    }

    // Deduct coins and add to unlocked list
    player.coins -= cost;
    player.unlockedHats.push(hatImage);

    // Save updated data
    this.savePlayerData(player.userId, player.ufoAppearance, player.level, player.xp, player.coins, player.unlockedUFOs, player.unlockedPassengers, player.unlockedHats, player.username, player.banned);

    console.log(`Player ${player.username} unlocked hat ${hatImage} for ${cost} coins`);

    return {
      success: true,
      hatImage,
      cost,
      remainingCoins: player.coins,
      unlockedHats: player.unlockedHats
    };
  }

  savePlayerData(userId, appearance, level = 1, xp = 0, coins = 100, unlockedUFOs = [], unlockedPassengers = [], unlockedHats = [], username = null, banned = false) {
    return new Promise((resolve, reject) => {
      const normalizedUsername = (typeof username === 'string' && username.trim().length > 0)
        ? username.trim()
        : null;

      const sql = `
        INSERT INTO players (userId, username, ufoAppearance, level, xp, coins, banned, unlockedUFOs, unlockedPassengers, unlockedHats, lastUpdated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(userId) DO UPDATE SET
          username = COALESCE(excluded.username, players.username),
          ufoAppearance = excluded.ufoAppearance,
          level = excluded.level,
          xp = excluded.xp,
          coins = excluded.coins,
          banned = excluded.banned,
          unlockedUFOs = excluded.unlockedUFOs,
          unlockedPassengers = excluded.unlockedPassengers,
          unlockedHats = excluded.unlockedHats,
          lastUpdated = excluded.lastUpdated
      `;

      const params = [
        userId,
        normalizedUsername,
        JSON.stringify(appearance),
        level,
        xp,
        coins,
        banned ? 1 : 0,
        JSON.stringify(unlockedUFOs),
        JSON.stringify(unlockedPassengers),
        JSON.stringify(unlockedHats),
        new Date().toISOString()
      ];

      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('Failed to save player data:', err);
          reject(err);
        } else {
          console.log(`Saved player data for user ${userId}`);
          resolve();
        }
      });
    });
  }

  getStoredUsername(userId) {
    return new Promise((resolve) => {
      const sql = 'SELECT username FROM players WHERE userId = ?';
      this.db.get(sql, [userId], (err, row) => {
        if (err) {
          console.error('Failed to load stored username:', err.message);
          resolve(null);
          return;
        }

        if (row && typeof row.username === 'string' && row.username.trim().length > 0) {
          resolve(row.username.trim());
          return;
        }

        resolve(null);
      });
    });
  }

  async addCoinsToPlayer(userId, amount, reason = 'unknown') {
    try {
      // Load player data
      const playerData = await this.loadPlayerData(userId);

      // Resolve best available username to prevent accidental null persistence
      const onlinePlayer = Array.from(this.players.values())
        .find(p => p.userId === userId);
      const usernameToPersist =
        (onlinePlayer && typeof onlinePlayer.username === 'string' && onlinePlayer.username.trim().length > 0)
          ? onlinePlayer.username.trim()
          : await this.getStoredUsername(userId);

      // Check if player exists (if all fields are default, assume doesn't exist)
      if (playerData.level === 1 && playerData.xp === 0 && playerData.coins === 100 &&
          playerData.unlockedUFOs.length === 0 && playerData.unlockedPassengers.length === 0) {
        console.log(`Player ${userId} does not exist, skipping coin addition from ${reason}`);
        return { success: false, reason: 'player_not_found' };
      }

      // Add coins
      playerData.coins += amount;

      // Save to database
      await this.savePlayerData(
        userId,
        playerData.ufoAppearance,
        playerData.level,
        playerData.xp,
        playerData.coins,
        playerData.unlockedUFOs,
        playerData.unlockedPassengers,
        playerData.unlockedHats,
        usernameToPersist,
        playerData.banned
      );

      if (onlinePlayer) {
        onlinePlayer.coins = playerData.coins;
        console.log(`Updated online player ${onlinePlayer.username}'s coins to ${playerData.coins} (${reason}: +${amount})`);

        // Emit event for notification (only to the specific player)
        this.eventEmitter.emit('playerReceivedCheer', {
          playerId: onlinePlayer.id,
          username: onlinePlayer.username,
          userId: userId,
          bitsAmount: amount,
          coinsAwarded: amount,
          newBalance: playerData.coins
        });
      } else {
        console.log(`Updated offline player ${userId}'s coins to ${playerData.coins} (${reason}: +${amount})`);
      }

      return { success: true, newBalance: playerData.coins, wasOnline: !!onlinePlayer };
    } catch (error) {
      console.error(`Failed to add coins to player ${userId}:`, error);
      return { success: false, reason: 'error', error: error.message };
    }
  }

  loadPlayerData(userId) {
    return new Promise((resolve) => {
      const sql = 'SELECT * FROM players WHERE userId = ?';

      this.db.get(sql, [userId], (err, row) => {
        if (err) {
          console.error('Failed to load player data:', err);
          resolve(this.getDefaultPlayerData(userId));
          return;
        }

        if (row) {
          try {
            const parsedAppearance = JSON.parse(row.ufoAppearance);
            const normalizedAppearance = {
              ...parsedAppearance,
              color: normalizeColor(parsedAppearance?.color, generateColorFromSeed(userId))
            };

            resolve({
              ufoAppearance: normalizedAppearance,
              level: row.level || 1,
              xp: row.xp || 0,
              coins: row.coins || 100,
              banned: Boolean(row.banned),
              unlockedUFOs: JSON.parse(row.unlockedUFOs) || [],
              unlockedPassengers: JSON.parse(row.unlockedPassengers) || [],
              unlockedHats: JSON.parse(row.unlockedHats) || []
            });
          } catch (parseError) {
            console.error('Failed to parse player data:', parseError);
            resolve(this.getDefaultPlayerData(userId));
          }
        } else {
          resolve(this.getDefaultPlayerData(userId));
        }
      });
    });
  }

  getDefaultPlayerData(userId) {
    return {
      ufoAppearance: {
        type: 'default',
        color: generateColorFromSeed(userId),
        image: null
      },
      level: 1,
      xp: 0,
      coins: 100,
      banned: false,
      unlockedUFOs: [],
      unlockedPassengers: [],
      unlockedHats: []
    };
  }

  awardXPAndCoinsForWin() {
    this.players.forEach(player => {
      const oldLevel = player.level;
      player.xp += 100;
      player.coins += 5;

      // Calculate new level based on total XP
      const newLevel = this.calculateLevelFromXP(player.xp);
      let leveledUp = false;

      if (newLevel > oldLevel) {
        player.level = newLevel;
        // Award coins for leveling up: old level × 100
        const coinReward = oldLevel * 100;
        player.coins += coinReward;
        console.log(`Player ${player.username} leveled up to ${player.level} and gained ${coinReward} coins!`);
        leveledUp = true;

        // Emit level up event for splash screen
        this.eventEmitter.emit('playerLeveledUp', {
          playerId: player.id,
          username: player.username,
          newLevel: player.level,
          coinReward: coinReward
        });
      }

      // Save progress after XP gain (whether leveled up or not)
      this.savePlayerData(player.userId, player.ufoAppearance, player.level, player.xp, player.coins, player.unlockedUFOs, player.unlockedPassengers, player.unlockedHats, player.username, player.banned);

      if (leveledUp) {
        console.log(`Player ${player.username} progress saved after leveling up`);
      }
    });
  }

  awardXPAndCoinsForEmote(playerIds, xpAmount = 50, coinAmount = 10) {
    playerIds.forEach(playerId => {
      const player = Array.from(this.players.values()).find(p => p.id === playerId);
      if (!player) return;

      const oldLevel = player.level;
      player.xp += xpAmount;
      player.coins += coinAmount;

      // Calculate new level based on total XP
      const newLevel = this.calculateLevelFromXP(player.xp);
      let leveledUp = false;

      if (newLevel > oldLevel) {
        player.level = newLevel;
        // Award coins for leveling up: old level × 100
        const coinReward = oldLevel * 100;
        player.coins += coinReward;
        console.log(`Player ${player.username} leveled up to ${player.level} and gained ${coinReward} coins from emote!`);
        leveledUp = true;

        // Emit level up event for splash screen
        this.eventEmitter.emit('playerLeveledUp', {
          playerId: player.id,
          username: player.username,
          newLevel: player.level,
          coinReward: coinReward
        });
      }

      // Save progress after XP gain (whether leveled up or not)
      this.savePlayerData(player.userId, player.ufoAppearance, player.level, player.xp, player.coins, player.unlockedUFOs, player.unlockedPassengers, player.unlockedHats, player.username, player.banned);

      console.log(`Player ${player.username} gained ${xpAmount} XP and ${coinAmount} coins from emote goal!`);
    });
  }

  awardXPAndCoinsForColorRush(roundResults) {
    if (!roundResults || roundResults.length === 0) return;

    const playerCount = roundResults.length;
    const baseXP = gameConfig.colorRushReward.xp;
    const baseCoins = gameConfig.colorRushReward.coins;

    // Calculate total reward pot
    const totalXP = playerCount * baseXP;
    const totalCoins = playerCount * baseCoins;

    console.log(`Color Rush round ended with ${playerCount} players. Reward pot: ${totalXP} XP, ${totalCoins} coins`);

    // Calculate normalized weights for fair distribution
    // Higher placements get exponentially more rewards, but total doesn't exceed pot
    const weights = [];
    let totalWeight = 0;

    for (let i = 0; i < playerCount; i++) {
      const weight = Math.pow(0.7, i); // Decreasing multiplier: 1, 0.7, 0.49, etc.
      weights.push(weight);
      totalWeight += weight;
    }

    // Distribute rewards based on normalized weights
    roundResults.forEach((result, index) => {
      const placement = index + 1; // 1-based placement
      const player = Array.from(this.players.values()).find(p => p.id === result.playerId);

      if (!player) return;

      // Calculate reward based on normalized weight
      const normalizedWeight = weights[index] / totalWeight;
      const xpReward = Math.max(1, Math.round(totalXP * normalizedWeight));
      const coinReward = Math.max(1, Math.round(totalCoins * normalizedWeight));

      // Apply rewards
      const oldLevel = player.level;
      player.xp += xpReward;
      player.coins += coinReward;

      // Store reward amounts for event emission
      result.xpReward = xpReward;
      result.coinReward = coinReward;

      // Calculate new level based on total XP
      const newLevel = this.calculateLevelFromXP(player.xp);
      let leveledUp = false;

      if (newLevel > oldLevel) {
        player.level = newLevel;
        // Award coins for leveling up: old level × 100
        const levelUpCoins = oldLevel * 100;
        player.coins += levelUpCoins;
        console.log(`Player ${player.username} leveled up to ${player.level} and gained ${levelUpCoins} coins from Color Rush!`);
        leveledUp = true;

        // Emit level up event for splash screen
        this.eventEmitter.emit('playerLeveledUp', {
          playerId: player.id,
          username: player.username,
          newLevel: player.level,
          coinReward: levelUpCoins
        });
      }

      // Save progress after XP gain (whether leveled up or not)
      this.savePlayerData(player.userId, player.ufoAppearance, player.level, player.xp, player.coins, player.unlockedUFOs, player.unlockedPassengers, player.unlockedHats, player.username, player.banned);

      console.log(`Player ${player.username} (#${placement}) gained ${xpReward} XP and ${coinReward} coins from Color Rush!`);
    });
  }

  awardXPAndCoinsForRace(finishOrder) {
    if (!finishOrder || finishOrder.length === 0) return;

    const finishers = finishOrder.filter(result => result.finishTime !== null && result.finishTime !== undefined);
    if (finishers.length === 0) return;

    const playerCount = finishers.length;
    const raceRewardConfig = gameConfig.raceReward || gameConfig.colorRushReward;
    const baseXP = raceRewardConfig.xp;
    const baseCoins = raceRewardConfig.coins;

    // Calculate total reward pot
    const totalXP = playerCount * baseXP;
    const totalCoins = playerCount * baseCoins;

    console.log(`Race ended with ${playerCount} players. Reward pot: ${totalXP} XP, ${totalCoins} coins`);

    // Calculate normalized weights for fair distribution
    const weights = [];
    let totalWeight = 0;

    for (let i = 0; i < playerCount; i++) {
      const weight = Math.pow(0.7, i);
      weights.push(weight);
      totalWeight += weight;
    }

    // Distribute rewards based on normalized weights
    finishers.forEach((result, index) => {
      const placement = index + 1;
      const player = Array.from(this.players.values()).find(p => p.id === result.playerId);

      if (!player) return;

      const normalizedWeight = weights[index] / totalWeight;
      const xpReward = Math.max(1, Math.round(totalXP * normalizedWeight));
      const coinReward = Math.max(1, Math.round(totalCoins * normalizedWeight));

      const oldLevel = player.level;
      player.xp += xpReward;
      player.coins += coinReward;

      result.xpReward = xpReward;
      result.coinReward = coinReward;

      const newLevel = this.calculateLevelFromXP(player.xp);
      let leveledUp = false;

      if (newLevel > oldLevel) {
        player.level = newLevel;
        const levelUpCoins = oldLevel * 100;
        player.coins += levelUpCoins;
        console.log(`Player ${player.username} leveled up to ${player.level} and gained ${levelUpCoins} coins from Race!`);
        leveledUp = true;

        this.eventEmitter.emit('playerLeveledUp', {
          playerId: player.id,
          username: player.username,
          newLevel: player.level,
          coinReward: levelUpCoins
        });
      }

      this.savePlayerData(player.userId, player.ufoAppearance, player.level, player.xp, player.coins, player.unlockedUFOs, player.unlockedPassengers, player.unlockedHats, player.username, player.banned);

      console.log(`Player ${player.username} (#${placement}) gained ${xpReward} XP and ${coinReward} coins from Race!`);
    });
  }

  awardXPAndCoinsForBeamDrain(results) {
    if (!results || results.length === 0) return;

    const playerCount = results.length;
    const rewardConfig = gameConfig.beamDrainReward || gameConfig.colorRushReward;
    const baseXP = rewardConfig.xp;
    const baseCoins = rewardConfig.coins;

    const totalXP = playerCount * baseXP;
    const totalCoins = playerCount * baseCoins;

    console.log(`Beam Drain ended with ${playerCount} players. Reward pot: ${totalXP} XP, ${totalCoins} coins`);

    const weights = [];
    let totalWeight = 0;
    for (let i = 0; i < playerCount; i++) {
      const weight = Math.pow(0.7, i);
      weights.push(weight);
      totalWeight += weight;
    }

    results.forEach((result, index) => {
      const placement = index + 1;
      const player = Array.from(this.players.values()).find(p => p.id === result.playerId);
      if (!player) return;

      const normalizedWeight = weights[index] / totalWeight;
      const xpReward = Math.max(1, Math.round(totalXP * normalizedWeight));
      const coinReward = Math.max(1, Math.round(totalCoins * normalizedWeight));

      const oldLevel = player.level;
      player.xp += xpReward;
      player.coins += coinReward;

      result.xpReward = xpReward;
      result.coinReward = coinReward;

      const newLevel = this.calculateLevelFromXP(player.xp);
      if (newLevel > oldLevel) {
        player.level = newLevel;
        const levelUpCoins = oldLevel * 100;
        player.coins += levelUpCoins;

        this.eventEmitter.emit('playerLeveledUp', {
          playerId: player.id,
          username: player.username,
          newLevel: player.level,
          coinReward: levelUpCoins
        });
      }

      this.savePlayerData(
        player.userId,
        player.ufoAppearance,
        player.level,
        player.xp,
        player.coins,
        player.unlockedUFOs,
        player.unlockedPassengers,
        player.unlockedHats,
        player.username,
        player.banned
      );

      console.log(`Player ${player.username} (#${placement}) gained ${xpReward} XP and ${coinReward} coins from Beam Drain!`);
    });
  }

  // Set references to external dependencies
  setWorld(world) {
    this.world = world;
  }

  setLevelObjects(levelObjects) {
    this.levelObjects = levelObjects;
  }

  // Set reference to current game mode
  setGameMode(gameMode) {
    this.gameMode = gameMode;
  }

  clearAllInputs() {
    this.players.forEach(player => {
      player.input = null;
    });
  }
}

module.exports = PlayerManager;
