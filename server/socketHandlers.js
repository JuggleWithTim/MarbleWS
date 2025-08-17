function setupSocketHandlers(io, gameLogic) {
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
    console.log('Player connected:', socket.id);

    // Handle player login
    socket.on('login', (data) => {
      const { username, userId } = data;
      const player = gameLogic.addPlayer(socket.id, username, userId);
      
      socket.emit('loginSuccess', player);
      socket.broadcast.emit('playerJoined', player);
      
      // Send current game state to new player
      socket.emit('gameState', gameLogic.getGameState());
    });

    // Handle player input (WASD keys)
    socket.on('playerInput', (input) => {
      gameLogic.updatePlayerInput(socket.id, input);
    });

    // Handle beam activation
    socket.on('beamToggle', (data) => {
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
