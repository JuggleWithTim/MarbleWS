const Matter = require('matter-js');
const fs = require('fs');
const path = require('path');
const { generateColorFromSeed } = require('./utils');

class PlayerManager {
  constructor(eventEmitter) {
    this.eventEmitter = eventEmitter;
    this.players = new Map();
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
      'ufoderp.png': 75,
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
      'luminoCoffee.png': 75,
      'Missy.png': 75,
      'Derp.png': 75,
      'Nox.png': 75,
      'Tim.png': 75
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

  addCoinsToPlayer(userId, amount, reason = 'unknown') {
    try {
      // Check if player data exists
      const playersDir = path.join(process.cwd(), 'players');
      const playerFile = path.join(playersDir, `${userId}.json`);

      if (!fs.existsSync(playerFile)) {
        console.log(`Player ${userId} does not exist, skipping coin addition from ${reason}`);
        return { success: false, reason: 'player_not_found' };
      }

      // Load player data
      const playerData = this.loadPlayerData(userId);

      // Add coins
      playerData.coins += amount;

      // Save to disk
      this.savePlayerData(
        userId,
        playerData.ufoAppearance,
        playerData.level,
        playerData.xp,
        playerData.coins,
        playerData.unlockedUFOs,
        playerData.unlockedPassengers
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

  awardXPAndCoinsForWin() {
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
        this.eventEmitter.emit('playerLeveledUp', {
          playerId: player.id,
          username: player.username,
          newLevel: player.level,
          coinReward: coinReward
        });
      }

      // Save progress after XP gain (whether leveled up or not)
      this.savePlayerData(player.userId, player.ufoAppearance, player.level, player.xp, player.coins, player.unlockedUFOs, player.unlockedPassengers);

      if (leveledUp) {
        console.log(`Player ${player.username} progress saved after leveling up`);
      }
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
