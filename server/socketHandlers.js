// Socket connection tracking for limiting
const connectedSockets = new Map(); // Track connections per IP
const MAX_CONNECTIONS_PER_IP = 10;

function setupSocketHandlers(io, gameLogic) {
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
    socket.on('login', (data) => {
      resetIdleTimeout();

      // Input validation
      if (typeof data !== 'object' || !data.username || !data.userId) {
        socket.emit('error', { message: 'Invalid login data' });
        return;
      }

      const { username, userId } = data;

      // Validate username and userId
      if (typeof username !== 'string' || username.length === 0 || username.length > 50 ||
          typeof userId !== 'string' || userId.length === 0 || userId.length > 100) {
        socket.emit('error', { message: 'Invalid username or user ID' });
        return;
      }

      const player = gameLogic.addPlayer(socket.id, username.trim(), userId.trim());

      socket.emit('loginSuccess', player);
      socket.broadcast.emit('playerJoined', player);

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

      gameLogic.updatePlayerInput(socket.id, validatedInput);
    });

    // Handle beam activation
    socket.on('beamToggle', (data) => {
      resetIdleTimeout();

      // Input validation
      if (typeof data !== 'object' || typeof data.active !== 'boolean') {
        return;
      }

      const { active } = data;
      gameLogic.activateBeam(socket.id, active);

      // Broadcast beam state to other players
      socket.broadcast.emit('playerBeam', {
        playerId: socket.id,
        active
      });
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
    });

    // Handle chat messages (optional feature)
    socket.on('chatMessage', (data) => {
      const { message } = data;
      const player = gameLogic.players.get(socket.id);
      
      if (player) {
        // Broadcast chat message to all players
        io.emit('chatMessage', {
          playerId: socket.id,
          username: player.username,
          message,
          timestamp: Date.now()
        });
      }
    });
  });

  // Broadcast game state updates periodically
  setInterval(() => {
    const gameState = gameLogic.getGameState();
    io.emit('gameStateUpdate', gameState);
  }, 100); // 10 FPS for game state updates
}

module.exports = { setupSocketHandlers };
