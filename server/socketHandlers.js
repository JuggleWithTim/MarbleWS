// Socket connection tracking for limiting
const connectedSockets = new Map(); // Track connections per IP
const MAX_CONNECTIONS_PER_IP = 10;

function setupSocketHandlers(io, gameLogic, validTokens) {
  // Function to extract real IP from proxy headers
  function getClientIP(socket) {
    // First try Socket.IO's built-in proxy detection
    if (socket.handshake.address && socket.handshake.address !== '::1' && socket.handshake.address !== '::ffff:127.0.0.1') {
      return socket.handshake.address;
    }

    // Fall back to manual extraction from proxy headers
    const forwardedFor = socket.handshake.headers['x-forwarded-for'];
    if (forwardedFor) {
      // X-Forwarded-For can contain multiple IPs, take the first (original client)
      return forwardedFor.split(',')[0].trim();
    }

    const realIP = socket.handshake.headers['x-real-ip'];
    if (realIP) {
      return realIP;
    }

    // Last resort - return whatever Socket.IO thinks it is
    return socket.handshake.address || 'unknown';
  }

  // Listen for loadNextLevel events from gameLogic
  gameLogic.on('loadNextLevel', (nextLevelName) => {
    // Load the next level
    const fs = require('fs');
    const path = require('path');
    const levelPath = path.join(__dirname, '../levels', `${nextLevelName}.json`);

    if (fs.existsSync(levelPath)) {
      const levelData = JSON.parse(fs.readFileSync(levelPath, 'utf8'));
      gameLogic.loadLevel(levelData);

      // Broadcast level change to all players
      io.emit('levelLoaded', {
        levelName: nextLevelName,
        levelData
      });
    } else {
      console.error(`Next level not found: ${nextLevelName}`);
    }
  });

  // Listen for player level up events from gameLogic
  gameLogic.on('playerLeveledUp', (levelUpData) => {
    // Send level up event only to the player who leveled up
    io.to(levelUpData.playerId).emit('playerLeveledUp', levelUpData);

    // Send level up announcement to Twitch chat
    gameLogic.eventEmitter.emit('sendAnnouncement', {
      type: 'levelUp',
      data: levelUpData
    });
  });

  // Listen for player cheer events from gameLogic
  gameLogic.on('playerReceivedCheer', (cheerData) => {
    // Send cheer notification only to the player who cheered
    io.to(cheerData.playerId).emit('playerReceivedCheer', cheerData);
  });

  // Listen for emote goal reached events from gameLogic
  gameLogic.on('emoteGoalReached', (emoteData) => {
    const { emote, interactedPlayers, goalX, goalY } = emoteData;

    // Award XP and coins to interacting players
    gameLogic.playerManager.awardXPAndCoinsForEmote(interactedPlayers);

    // Broadcast particle effect to all clients
    io.emit('emoteInGoal', {
      goalX,
      goalY,
      emoteName: emote.name
    });

    // Send emote goal announcement to Twitch chat
    gameLogic.eventEmitter.emit('sendAnnouncement', {
      type: 'emoteGoal',
      data: emoteData
    });
  });

  // Listen for Color Rush events
  gameLogic.on('colorRushRoundStart', (data) => {
    io.emit('colorRushRoundStart', data);
  });

  gameLogic.on('colorRushRoundEnd', (data) => {
    io.emit('colorRushRoundEnd', data);

    // Send Color Rush round end announcement to Twitch chat
    gameLogic.eventEmitter.emit('sendAnnouncement', {
      type: 'colorRushEnd',
      data: data
    });
  });

  gameLogic.on('colorRushNextRound', (data) => {
    io.emit('colorRushNextRound', data);
  });

  gameLogic.on('colorRushSafeSectionChange', (data) => {
    io.emit('colorRushSafeSectionChange', data);
  });

  gameLogic.on('colorRushPlayerDeath', (data) => {
    io.emit('colorRushPlayerDeath', data);
  });

  // Listen for Race mode events
  gameLogic.on('raceCountdown', (data) => {
    io.emit('raceCountdown', data);
  });

  gameLogic.on('raceStart', (data) => {
    io.emit('raceStart', data);
  });

  gameLogic.on('raceCheckpoint', (data) => {
    io.emit('raceCheckpoint', data);
  });

  gameLogic.on('raceLap', (data) => {
    io.emit('raceLap', data);
  });

  gameLogic.on('racePlayerEffect', (data) => {
    io.emit('racePlayerEffect', data);
  });

  gameLogic.on('raceFinished', (data) => {
    io.emit('raceFinished', data);
  });

  gameLogic.on('raceEnd', (data) => {
    io.emit('raceEnd', data);

    // Send race finish announcement to Twitch chat
    gameLogic.eventEmitter.emit('sendAnnouncement', {
      type: 'raceFinish',
      data: data
    });
  });

  gameLogic.on('raceNextRound', (data) => {
    io.emit('raceNextRound', data);
  });

  io.on('connection', (socket) => {
    // Get real client IP address from proxy headers
    const clientIP = getClientIP(socket);

    // Track connections per IP
    if (!connectedSockets.has(clientIP)) {
      connectedSockets.set(clientIP, new Set());
    }

    const connectionsFromIP = connectedSockets.get(clientIP);

    // Limit connections per IP
    if (connectionsFromIP.size >= MAX_CONNECTIONS_PER_IP) {
      console.log(`Connection rejected from ${clientIP}: too many connections`);
      socket.emit('error', { message: 'Too many connections from this IP address' });
      socket.disconnect(true);
      return;
    }

    // Add socket to tracking
    connectionsFromIP.add(socket.id);

    // Set up idle timeout (disconnect after 30 minutes of no activity)
    let idleTimeout = setTimeout(() => {
      console.log(`Idle timeout for socket ${socket.id}`);
      socket.disconnect(true);
    }, 30 * 60 * 1000); // 30 minutes

    console.log('Player connected:', socket.id, 'from IP:', clientIP);

    // Reset idle timeout on any activity
    const resetIdleTimeout = () => {
      clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        console.log(`Idle timeout for socket ${socket.id}`);
        socket.disconnect(true);
      }, 30 * 60 * 1000);
    };

    // Handle player login (requires authentication check)
    socket.on('login', async (data) => {
      resetIdleTimeout();

      // Input validation
      if (typeof data !== 'object' || !data.token) {
        socket.emit('error', { message: 'Invalid login data' });
        return;
      }

      const { token } = data;

      // Validate token format
      if (typeof token !== 'string' || token.length !== 64 || !/^[a-f0-9]+$/.test(token)) {
        socket.emit('error', { message: 'Invalid authentication token' });
        return;
      }

      // Check if token exists and is valid
      const tokenData = validTokens.get(token);

      if (!tokenData || tokenData.expires < Date.now()) {
        // Clean up expired token
        if (tokenData && tokenData.expires < Date.now()) {
          validTokens.delete(token);
        }
        socket.emit('error', { message: 'Invalid or expired authentication token' });
        return;
      }

      const { username, userId } = tokenData;

      // Additional validation
      if (typeof username !== 'string' || username.length === 0 || username.length > 50 ||
          typeof userId !== 'string' || userId.length === 0 || userId.length > 100) {
        socket.emit('error', { message: 'Invalid user data' });
        return;
      }

      // Check for existing session and force logout if found
      const existingPlayer = Array.from(gameLogic.players.values())
        .find(p => p.userId === userId.trim());

      if (existingPlayer) {
        // Find and disconnect the existing socket
        const existingSocketId = existingPlayer.id;
        const existingSocket = io.sockets.sockets.get(existingSocketId);

        if (existingSocket) {
          console.log(`Forcing logout of existing session for user ${username} (${userId})`);
          existingSocket.emit('error', { message: 'Logged in from another location' });
          existingSocket.disconnect(true);
        }

        // Remove the player from the game
        gameLogic.removePlayer(existingSocketId);
      }

      const player = await gameLogic.addPlayer(socket.id, username.trim(), userId.trim());

      // Handle player joining the current game mode
      gameLogic.levelManager.handlePlayerJoin(player);

      socket.emit('loginSuccess', player);
      socket.broadcast.emit('playerJoined', player);

      // Send join announcement to Twitch chat
      gameLogic.eventEmitter.emit('sendAnnouncement', {
        type: 'joinLeave',
        data: {
          username: player.username,
          action: 'join'
        }
      });

      // Send current game state to new player
      socket.emit('gameState', gameLogic.getGameState());
    });

    // Handle player input (WASD keys)
    socket.on('playerInput', (input) => {
      resetIdleTimeout();

      // Input validation
      if (typeof input !== 'object') {
        return;
      }

      const validatedInput = {};
      ['up', 'down', 'left', 'right'].forEach(key => {
        if (typeof input[key] === 'boolean') {
          validatedInput[key] = input[key];
        }
      });

      // Check if game mode allows this input
      if (gameLogic.levelManager.handlePlayerInput(socket.id, validatedInput)) {
        gameLogic.updatePlayerInput(socket.id, validatedInput);
      }
    });

    // Handle beam activation
    socket.on('beamToggle', (data) => {
      resetIdleTimeout();

      // Input validation
      if (typeof data !== 'object' || typeof data.active !== 'boolean') {
        return;
      }

      const { active } = data;

      // Check if game mode allows beam usage
      if (gameLogic.levelManager.canPlayerUseBeam(socket.id)) {
        gameLogic.activateBeam(socket.id, active);

        // Broadcast beam state to other players
        socket.broadcast.emit('playerBeam', {
          playerId: socket.id,
          active
        });
      }
    });

    // Handle beam interaction
    socket.on('beamInteraction', (data) => {
      resetIdleTimeout();

      // Input validation
      if (typeof data !== 'object' ||
          typeof data.targetX !== 'number' ||
          typeof data.targetY !== 'number') {
        return;
      }

      const { targetX, targetY } = data;
      gameLogic.handleBeamInteraction(socket.id, targetX, targetY);
    });

    // Handle level loading
    socket.on('loadLevel', (levelName) => {
      const fs = require('fs');
      const path = require('path');
      const levelPath = path.join(__dirname, '../levels', `${levelName}.json`);

      if (fs.existsSync(levelPath)) {
        const levelData = JSON.parse(fs.readFileSync(levelPath, 'utf8'));
        gameLogic.loadLevel(levelData);

        // Broadcast level change to all players
        io.emit('levelLoaded', {
          levelName,
          levelData
        });

        // Send level change announcement to Twitch chat
        gameLogic.eventEmitter.emit('sendAnnouncement', {
          type: 'levelChange',
          data: {
            levelName
          }
        });
      } else {
        socket.emit('error', { message: 'Level not found' });
      }
    });

    // Handle manual emote spawn (for testing)
    socket.on('spawnTestEmote', (data) => {
      const { emoteName } = data;
      // This would typically be restricted to admins/streamers
      gameLogic.spawnEmote(
        `https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/1.0`, 
        emoteName || 'Kappa'
      );
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Player disconnected:', socket.id);
      const player = gameLogic.players.get(socket.id);

      gameLogic.removePlayer(socket.id);

      // Clean up connection tracking - using same IP extraction as connect
      const clientIP = getClientIP(socket);
      if (connectedSockets.has(clientIP)) {
        connectedSockets.get(clientIP).delete(socket.id);
        if (connectedSockets.get(clientIP).size === 0) {
          connectedSockets.delete(clientIP);
        }
      }

      // Broadcast player left to other players
      socket.broadcast.emit('playerLeft', {
        playerId: socket.id
      });

      // Send leave announcement to Twitch chat
      if (player) {
        gameLogic.eventEmitter.emit('sendAnnouncement', {
          type: 'joinLeave',
          data: {
            username: player.username,
            action: 'leave'
          }
        });
      }
    });

    // Handle chat messages (optional feature)
    socket.on('chatMessage', (data) => {
      const { message } = data;
      const player = gameLogic.players.get(socket.id);

      if (player) {
        // Check for !sit command
        if (message.toLowerCase().startsWith('!sit')) {
          const parts = message.trim().split(/\s+/);
          let chairNumber = null;

          if (parts.length > 1) {
            const num = parseInt(parts[1]);
            if (!isNaN(num) && num >= 1 && num <= 99) {
              chairNumber = num;
            }
          }

          // Handle the sit command
          const result = gameLogic.handlePlayerSit(socket.id, chairNumber);

          // Send result back to the player
          socket.emit('sitResult', result);

          // If successful, broadcast to other players
          if (result.success) {
            socket.broadcast.emit('playerSat', {
              playerId: socket.id,
              username: player.username,
              chairNumber: result.chairNumber,
              x: result.x,
              y: result.y
            });
          }

          // Don't broadcast the command as a regular chat message
          return;
        }

        // Broadcast regular chat message to all players
        io.emit('chatMessage', {
          playerId: socket.id,
          username: player.username,
          message,
          timestamp: Date.now()
        });
      }
    });

    // Handle keepalive messages (for overlays and other passive clients)
    socket.on('keepalive', () => {
      resetIdleTimeout();
    });

    // Handle player appearance updates
    socket.on('updateAppearance', (data) => {
      resetIdleTimeout();

      // Input validation
      if (typeof data !== 'object' || !data.appearance || typeof data.appearance !== 'object') {
        return;
      }

      const { appearance } = data;

      // Validate appearance structure
      if (typeof appearance.type !== 'string' ||
          (appearance.type !== 'default' && appearance.type !== 'custom')) {
        return;
      }

      if (appearance.type === 'default' && typeof appearance.color !== 'string') {
        return;
      }

      if (appearance.type === 'custom' && typeof appearance.image !== 'string') {
        return;
      }

      // Update player appearance in game logic
      gameLogic.updatePlayerAppearance(socket.id, appearance);
    });

    // Handle UFO unlock purchases
    socket.on('unlockUFO', (data) => {
      resetIdleTimeout();

      // Input validation
      if (typeof data !== 'object' || typeof data.ufoImage !== 'string') {
        socket.emit('unlockResult', { success: false, message: 'Invalid request' });
        return;
      }

      const { ufoImage } = data;

      // Attempt to unlock the UFO
      const result = gameLogic.unlockUFO(socket.id, ufoImage);

      // Send result back to client
      socket.emit('unlockResult', result);
    });

    // Handle passenger unlock purchases
    socket.on('unlockPassenger', (data) => {
      resetIdleTimeout();

      // Input validation
      if (typeof data !== 'object' || typeof data.passengerImage !== 'string') {
        socket.emit('unlockResult', { success: false, message: 'Invalid request' });
        return;
      }

      const { passengerImage } = data;

      // Attempt to unlock the passenger
      const result = gameLogic.unlockPassenger(socket.id, passengerImage);

      // Send result back to client
      socket.emit('unlockResult', result);
    });

    // Handle hat unlock purchases
    socket.on('unlockHat', (data) => {
      resetIdleTimeout();

      // Input validation
      if (typeof data !== 'object' || typeof data.hatImage !== 'string') {
        socket.emit('unlockResult', { success: false, message: 'Invalid request' });
        return;
      }

      const { hatImage } = data;

      // Attempt to unlock the hat
      const result = gameLogic.unlockHat(socket.id, hatImage);

      // Send result back to client
      socket.emit('unlockResult', result);
    });
  });

  // Broadcast game state updates periodically
  setInterval(() => {
    const gameState = gameLogic.getGameState();
    io.emit('gameStateUpdate', gameState);
  }, 100); // 10 FPS for game state updates
}

module.exports = { setupSocketHandlers };
