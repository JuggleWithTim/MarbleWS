const Matter = require('matter-js');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { generateColorFromSeed } = require('./utils');
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
      }
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
    const savedData = await this.loadPlayerData(userId);
    const color = savedData.ufoAppearance.type === 'default' ? savedData.ufoAppearance.color : generateColorFromSeed(userId);

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
      unlockedHats: savedData.unlockedHats,
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

      // Validate that hats are unlocked before allowing selection
      if (appearance.hat && !player.unlockedHats.includes(appearance.hat)) {
        console.log(`Player ${player.username} attempted to select locked hat: ${appearance.hat}`);
        return; // Reject the appearance change
      }

      // Update the player's appearance
      player.ufoAppearance = { ...appearance };

      // Always update the color field for username display, regardless of UFO type
      player.color = appearance.color;

      // Save appearance and progress to persistent storage
      this.savePlayerData(player.userId, appearance, player.level, player.xp, player.coins, player.unlockedUFOs, player.unlockedPassengers, player.unlockedHats, player.username);

      console.log(`Player ${player.username} updated appearance:`, appearance);
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
    this.savePlayerData(player.userId, player.ufoAppearance, player.level, player.xp, player.coins, player.unlockedUFOs, player.unlockedPassengers, player.username);

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
    this.savePlayerData(player.userId, player.ufoAppearance, player.level, player.xp, player.coins, player.unlockedUFOs, player.unlockedPassengers, player.unlockedHats, player.username);

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
    this.savePlayerData(player.userId, player.ufoAppearance, player.level, player.xp, player.coins, player.unlockedUFOs, player.unlockedPassengers, player.unlockedHats, player.username);

    console.log(`Player ${player.username} unlocked hat ${hatImage} for ${cost} coins`);

    return {
      success: true,
      hatImage,
      cost,
      remainingCoins: player.coins,
      unlockedHats: player.unlockedHats
    };
  }

  savePlayerData(userId, appearance, level = 1, xp = 0, coins = 100, unlockedUFOs = [], unlockedPassengers = [], unlockedHats = [], username = null) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO players (userId, username, ufoAppearance, level, xp, coins, unlockedUFOs, unlockedPassengers, unlockedHats, lastUpdated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        userId,
        username,
        JSON.stringify(appearance),
        level,
        xp,
        coins,
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

  async addCoinsToPlayer(userId, amount, reason = 'unknown') {
    try {
      // Load player data
      const playerData = await this.loadPlayerData(userId);

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
        playerData.unlockedHats
      );

      // If player is online, update their in-memory state
      const onlinePlayer = Array.from(this.players.values())
        .find(p => p.userId === userId);

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
            resolve({
              ufoAppearance: JSON.parse(row.ufoAppearance),
              level: row.level || 1,
              xp: row.xp || 0,
              coins: row.coins || 100,
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
      this.savePlayerData(player.userId, player.ufoAppearance, player.level, player.xp, player.coins, player.unlockedUFOs, player.unlockedPassengers, player.unlockedHats, player.username);

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
      this.savePlayerData(player.userId, player.ufoAppearance, player.level, player.xp, player.coins, player.unlockedUFOs, player.unlockedPassengers, player.unlockedHats, player.username);

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
      this.savePlayerData(player.userId, player.ufoAppearance, player.level, player.xp, player.coins, player.unlockedUFOs, player.unlockedPassengers, player.unlockedHats, player.username);

      console.log(`Player ${player.username} (#${placement}) gained ${xpReward} XP and ${coinReward} coins from Color Rush!`);
    });
  }

  // Set references to external dependencies
  setWorld(world) {
    this.world = world;
  }

  setLevelObjects(levelObjects) {
    this.levelObjects = levelObjects;
  }
}

module.exports = PlayerManager;
