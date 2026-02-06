const express = require('express');
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// In-memory token store (use Redis or database in production)
const validTokens = new Map();
const adminRealtimeTokens = new Map();

// Trust proxy for correct IP detection behind nginx
app.set('trust proxy', 1);

// Parse allowed origins from environment
const PORT = process.env.PORT || 3000;
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`];

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  trustProxy: true
});

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'marblews-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.DEV_MODE !== 'true', // HTTPS only when not in dev mode
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Middleware
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// Connection rate limiting (for HTTP requests)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to API routes only
app.use('/api/', limiter);

// Basic Auth middleware for admin routes
function basicAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
    return res.status(401).json({ error: 'Authentication required' });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');

  if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  next();
}

// Import game modules
const GameLogic = require('./gameLogic');
const TwitchChat = require('./twitchChat');
const { setupSocketHandlers } = require('./socketHandlers');

 // Initialize game logic
const gameLogic = new GameLogic();

 // Load default level at server start
const fs = require('fs');
const defaultLevelPath = path.join(__dirname, '../levels/level1.json');
if (fs.existsSync(defaultLevelPath)) {
  const levelData = JSON.parse(fs.readFileSync(defaultLevelPath, 'utf8'));
  gameLogic.loadLevel(levelData);
  console.log('Default level loaded at server start.');
} else {
  console.error('Default level file not found!');
}

// Initialize Twitch chat integration
const twitchChat = new TwitchChat(gameLogic);

function createAdminRealtimeToken() {
  const token = crypto.randomBytes(24).toString('hex');
  adminRealtimeTokens.set(token, Date.now() + 10 * 60 * 1000); // 10 min
  return token;
}

function isValidAdminRealtimeToken(token) {
  const expiresAt = adminRealtimeTokens.get(token);
  if (!expiresAt) return false;
  if (expiresAt < Date.now()) {
    adminRealtimeTokens.delete(token);
    return false;
  }

  // One-time use token to reduce replay risks
  adminRealtimeTokens.delete(token);
  return true;
}

function getLevelsForAdmin() {
  const levelsDir = path.join(__dirname, '../levels');

  if (!fs.existsSync(levelsDir)) {
    fs.mkdirSync(levelsDir, { recursive: true });
  }

  return fs.readdirSync(levelsDir)
    .filter(file => file.endsWith('.json'))
    .map(file => {
      const levelName = file.replace('.json', '');
      const levelPath = path.join(levelsDir, file);
      const stats = fs.statSync(levelPath);

      try {
        const levelData = JSON.parse(fs.readFileSync(levelPath, 'utf8'));
        return {
          name: levelName,
          modified: stats.mtime,
          size: stats.size,
          description: levelData.description || '',
          backgroundImage: levelData.backgroundImage || '',
          objects: levelData.objects || []
        };
      } catch (error) {
        return {
          name: levelName,
          modified: stats.mtime,
          size: stats.size,
          description: '',
          backgroundImage: '',
          objects: []
        };
      }
    });
}

function getPlayersForAdmin() {
  return new Promise((resolve, reject) => {
    const db = gameLogic.playerManager.db;
    const sql = `
      SELECT userId, username, level, xp, coins, banned, lastUpdated
      FROM players
      ORDER BY xp DESC
    `;

    db.all(sql, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });
  });
}

function getOnlinePlayersForAdmin() {
  return Array.from(gameLogic.playerManager.players.values()).map(player => ({
    socketId: player.id,
    userId: player.userId,
    username: player.username,
    x: player.x,
    y: player.y
  }));
}

async function getAdminSnapshot() {
  const levels = getLevelsForAdmin();
  const players = await getPlayersForAdmin();
  const onlinePlayers = getOnlinePlayersForAdmin();

  const gameConfig = require('../shared/gameConfig.js');

  return {
    currentLevel: gameLogic.currentLevel?.name || 'level1',
    twitchChannel: process.env.TWITCH_CHANNEL || '',
    twitchSpeechBubblesEnabled: Boolean(gameConfig.twitchSpeechBubbles?.enabled),
    levels,
    players,
    onlinePlayers,
    generatedAt: Date.now()
  };
}

function emitAdminActivity(type, message, payload = {}) {
  io.to('admins').emit('admin:activity:event', {
    type,
    message,
    payload,
    at: Date.now()
  });
}

async function emitAdminBootstrap() {
  try {
    const snapshot = await getAdminSnapshot();
    io.to('admins').emit('admin:bootstrap', snapshot);
  } catch (error) {
    console.error('Failed to emit admin bootstrap snapshot:', error);
  }
}

// Setup Socket.io handlers
setupSocketHandlers(io, gameLogic, validTokens, {
  isValidAdminToken: isValidAdminRealtimeToken,
  getAdminSnapshot,
  emitAdminActivity,
  emitAdminBootstrap,
  getOnlinePlayersForAdmin
});

// Authenticated routes - must come BEFORE static middleware
// Editor routes with authentication
app.get('/editor', basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/editor.html'));
});

app.get('/editor.html', basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/editor.html'));
});

// Admin routes
app.get('/admin', basicAuth, (req, res) => {
  const fs = require('fs');
  const filePath = path.join(__dirname, '../client/admin.html');
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(/__BASE_PATH__/g, process.env.BASE_PATH || '');
  res.send(html);
});

app.get('/admin.html', basicAuth, (req, res) => {
  const fs = require('fs');
  const filePath = path.join(__dirname, '../client/admin.html');
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(/__BASE_PATH__/g, process.env.BASE_PATH || '');
  res.send(html);
});

// Public routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Static middleware - comes AFTER authenticated routes
const basePath = process.env.BASE_PATH || '';
// More specific routes must come before general ones
app.use(`${basePath}/shared`, express.static(path.join(__dirname, '../shared')));
app.use(express.static(path.join(__dirname, '../client')));

// Client config endpoint (safe, no secrets)
app.get('/api/client-config', (req, res) => {
  res.json({
    devMode: process.env.DEV_MODE === 'true',
    basePath: process.env.BASE_PATH || ''
  });
});

// Game configuration endpoint
app.get('/api/game-config', (req, res) => {
  const gameConfig = require('../shared/gameConfig.js');
  res.json(gameConfig);
});

// Legacy config endpoint (keeping for backward compatibility)
app.get('/api/config', (req, res) => {
  res.json({
    devMode: process.env.DEV_MODE === 'true'
  });
});

// Dev mode login
app.post('/api/dev-login', (req, res) => {
  if (process.env.DEV_MODE !== 'true') {
    return res.status(403).json({ error: 'Dev mode not enabled' });
  }

  const { username } = req.body;
  if (!username || username.trim().length === 0) {
    return res.status(400).json({ error: 'Username required' });
  }

  // Generate a unique dev user ID
  const userId = 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  // Store user data in session
  req.session.authenticated = true;
  req.session.user = {
    username: username.trim(),
    userId: userId,
    authType: 'dev'
  };

  // Generate a secure token for this session
  const authToken = crypto.randomBytes(32).toString('hex');

  // Store token with user data (expires in 24 hours)
  validTokens.set(authToken, {
    ...req.session.user,
    expires: Date.now() + 24 * 60 * 60 * 1000
  });

  res.json({
    username: username.trim(),
    userId: userId,
    token: authToken
  });
});

// Twitch OAuth routes
app.get('/auth/twitch', (req, res) => {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const redirectUri = process.env.TWITCH_REDIRECT_URI;
  const scope = 'user:read:email';
  
  const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
  res.redirect(authUrl);
});

app.get('/auth/twitch/callback', async (req, res) => {
  const { code } = req.query;
  const basePath = process.env.BASE_PATH || '';

  try {
    const tokenResponse = await axios.post('https://id.twitch.tv/oauth2/token', {
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.TWITCH_REDIRECT_URI,
    });

    const { access_token } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID,
      },
    });

    const user = userResponse.data.data[0];

    // Store user data in session
    req.session.authenticated = true;
    req.session.user = {
      username: user.display_name,
      userId: user.id,
      authType: 'twitch'
    };

    // Generate a secure token for this session
    const authToken = crypto.randomBytes(32).toString('hex');

    // Store token with user data (expires in 24 hours)
    validTokens.set(authToken, {
      ...req.session.user,
      expires: Date.now() + 24 * 60 * 60 * 1000
    });

    // Redirect back to game with token
    res.redirect(`${basePath}/?token=${authToken}`);
  } catch (error) {
    console.error('Twitch OAuth error:', error);
    res.redirect(`${basePath}/?error=auth_failed`);
  }
});

// API endpoints
app.get('/api/levels', (req, res) => {
  const fs = require('fs');
  const levelsDir = path.join(__dirname, '../levels');
  
  if (!fs.existsSync(levelsDir)) {
    fs.mkdirSync(levelsDir, { recursive: true });
  }
  
  const levels = fs.readdirSync(levelsDir)
    .filter(file => file.endsWith('.json'))
    .map(file => file.replace('.json', ''));
  
  res.json(levels);
});

app.get('/api/levels/:levelName', (req, res) => {
  const fs = require('fs');
  const levelPath = path.join(__dirname, '../levels', `${req.params.levelName}.json`);

  if (fs.existsSync(levelPath)) {
    const levelData = JSON.parse(fs.readFileSync(levelPath, 'utf8'));
    res.json(levelData);
  } else {
    res.status(404).json({ error: 'Level not found' });
  }
});

app.get('/api/current-level', (req, res) => {
  if (gameLogic.currentLevel && gameLogic.currentLevel.name) {
    res.json({ levelName: gameLogic.currentLevel.name });
  } else {
    res.status(404).json({ error: 'No level currently loaded' });
  }
});

app.get('/api/toplist', (req, res) => {
  const db = gameLogic.playerManager.db;
  const sql = `
    SELECT username, level, xp
    FROM players
    ORDER BY xp DESC
    LIMIT 50
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Failed to fetch toplist:', err);
      res.status(500).json({ error: 'Failed to fetch toplist' });
      return;
    }

    res.json(rows);
  });
});

app.post('/api/levels/:levelName', basicAuth, (req, res) => {
  const fs = require('fs');
  const levelsDir = path.join(__dirname, '../levels');
  const levelPath = path.join(levelsDir, `${req.params.levelName}.json`);

  if (!fs.existsSync(levelsDir)) {
    fs.mkdirSync(levelsDir, { recursive: true });
  }

  try {
    fs.writeFileSync(levelPath, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save level' });
  }
});



// Admin API routes
app.get('/api/admin/levels', basicAuth, (req, res) => {
  res.json(getLevelsForAdmin());
});

app.delete('/api/admin/levels/:levelName', basicAuth, (req, res) => {
  const fs = require('fs');
  const levelPath = path.join(__dirname, '../levels', `${req.params.levelName}.json`);
  const deletedDir = path.join(__dirname, '../levels/deleted');

  if (fs.existsSync(levelPath)) {
    // Create deleted directory if it doesn't exist
    if (!fs.existsSync(deletedDir)) {
      fs.mkdirSync(deletedDir, { recursive: true });
    }

    // Move file to deleted directory with timestamp to avoid conflicts
    const timestamp = Date.now();
    const deletedPath = path.join(deletedDir, `${req.params.levelName}_${timestamp}.json`);
    fs.renameSync(levelPath, deletedPath);

    emitAdminActivity('level', `Level deleted: ${req.params.levelName}`, { levelName: req.params.levelName });
    emitAdminBootstrap();

    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Level not found' });
  }
});

// Admin player management endpoints
app.get('/api/admin/players', basicAuth, (req, res) => {
  getPlayersForAdmin().then((rows) => {
    res.json(rows);
  }).catch((err) => {
    if (err) {
      console.error('Failed to fetch players:', err);
      res.status(500).json({ error: 'Failed to fetch players' });
    }
  });
});

// Admin online player management endpoints
app.get('/api/admin/online-players', basicAuth, (req, res) => {
  res.json(getOnlinePlayersForAdmin());
});

app.get('/api/admin/realtime-token', basicAuth, (req, res) => {
  res.json({ token: createAdminRealtimeToken() });
});

app.get('/api/admin/snapshot', basicAuth, async (req, res) => {
  try {
    const snapshot = await getAdminSnapshot();
    res.json(snapshot);
  } catch (error) {
    console.error('Failed to get admin snapshot:', error);
    res.status(500).json({ error: 'Failed to load admin snapshot' });
  }
});

app.post('/api/admin/online-players/despawn', basicAuth, (req, res) => {
  const { socketId, userId } = req.body || {};

  if (!socketId && !userId) {
    return res.status(400).json({ error: 'socketId or userId is required' });
  }

  const player = socketId
    ? gameLogic.playerManager.players.get(socketId)
    : Array.from(gameLogic.playerManager.players.values()).find(p => p.userId === userId);

  if (!player) {
    return res.status(404).json({ error: 'Online player not found' });
  }

  const targetSocketId = player.id;
  const targetSocket = io.sockets.sockets.get(targetSocketId);

  if (targetSocket) {
    targetSocket.disconnect(true);
  } else {
    gameLogic.removePlayer(targetSocketId);
    io.emit('playerLeft', { playerId: targetSocketId });
  }

  emitAdminActivity('player', `Player despawned: ${player.username}`, {
    userId: player.userId,
    username: player.username
  });
  emitAdminBootstrap();

  res.json({ success: true, playerId: targetSocketId, username: player.username });
});

app.post('/api/admin/online-players/despawn-all', basicAuth, (req, res) => {
  const players = Array.from(gameLogic.playerManager.players.values());
  let disconnectedCount = 0;

  players.forEach(player => {
    const targetSocketId = player.id;
    const targetSocket = io.sockets.sockets.get(targetSocketId);

    if (targetSocket) {
      targetSocket.disconnect(true);
      disconnectedCount += 1;
    } else {
      gameLogic.removePlayer(targetSocketId);
      io.emit('playerLeft', { playerId: targetSocketId });
      disconnectedCount += 1;
    }
  });

  emitAdminActivity('player', `Despawned ${disconnectedCount} player(s)`, { count: disconnectedCount });
  emitAdminBootstrap();

  res.json({ success: true, count: disconnectedCount });
});

app.get('/api/admin/players/:userId', basicAuth, (req, res) => {
  const db = gameLogic.playerManager.db;
  const sql = 'SELECT * FROM players WHERE userId = ?';

  db.get(sql, [req.params.userId], (err, row) => {
    if (err) {
      console.error('Failed to fetch player:', err);
      res.status(500).json({ error: 'Failed to fetch player' });
      return;
    }

    if (!row) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    try {
      const playerData = {
        userId: row.userId,
        username: row.username,
        level: row.level || 1,
        xp: row.xp || 0,
        coins: row.coins || 100,
        banned: Boolean(row.banned),
        ufoAppearance: JSON.parse(row.ufoAppearance),
        unlockedUFOs: JSON.parse(row.unlockedUFOs) || [],
        unlockedPassengers: JSON.parse(row.unlockedPassengers) || [],
        unlockedHats: JSON.parse(row.unlockedHats) || [],
        lastUpdated: row.lastUpdated
      };
      res.json(playerData);
    } catch (parseError) {
      console.error('Failed to parse player data:', parseError);
      res.status(500).json({ error: 'Failed to parse player data' });
    }
  });
});

app.put('/api/admin/players/:userId', basicAuth, (req, res) => {
  const { level, xp, coins, banned } = req.body;
  const userId = req.params.userId;

  // Validate input
  if (typeof level !== 'number' || level < 1 || level > 1000) {
    return res.status(400).json({ error: 'Level must be a number between 1 and 1000' });
  }
  if (typeof xp !== 'number' || xp < 0 || xp > 10000000) {
    return res.status(400).json({ error: 'XP must be a number between 0 and 10,000,000' });
  }
  if (typeof coins !== 'number' || coins < 0 || coins > 1000000) {
    return res.status(400).json({ error: 'Coins must be a number between 0 and 1,000,000' });
  }
  if (typeof banned !== 'boolean') {
    return res.status(400).json({ error: 'Banned must be a boolean' });
  }

  const db = gameLogic.playerManager.db;

  // First get current player data
  const selectSql = 'SELECT * FROM players WHERE userId = ?';
  db.get(selectSql, [userId], (err, row) => {
    if (err) {
      console.error('Failed to fetch player for update:', err);
      return res.status(500).json({ error: 'Failed to fetch player' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Player not found' });
    }

    try {
      // Parse existing data
      const ufoAppearance = JSON.parse(row.ufoAppearance);
      const unlockedUFOs = JSON.parse(row.unlockedUFOs) || [];
      const unlockedPassengers = JSON.parse(row.unlockedPassengers) || [];

      // Update player data
      const updateSql = `
        UPDATE players
        SET level = ?, xp = ?, coins = ?, banned = ?, lastUpdated = ?
        WHERE userId = ?
      `;

      db.run(updateSql, [level, xp, coins, banned ? 1 : 0, new Date().toISOString(), userId], function(err) {
        if (err) {
          console.error('Failed to update player:', err);
          return res.status(500).json({ error: 'Failed to update player' });
        }

        // If player is online, update their in-memory state
        const onlinePlayer = Array.from(gameLogic.playerManager.players.values())
          .find(p => p.userId === userId);

        if (onlinePlayer) {
          onlinePlayer.level = level;
          onlinePlayer.xp = xp;
          onlinePlayer.coins = coins;
          onlinePlayer.banned = banned;
          console.log(`Updated online player ${onlinePlayer.username}'s data`);

          if (banned) {
            const targetSocket = io.sockets.sockets.get(onlinePlayer.id);
            if (targetSocket) {
              targetSocket.emit('error', { message: 'You are banned from this game.' });
              targetSocket.disconnect(true);
            } else {
              gameLogic.removePlayer(onlinePlayer.id);
              io.emit('playerLeft', { playerId: onlinePlayer.id });
            }
          }
        }

        res.json({
          success: true,
          userId,
          level,
          xp,
          coins,
          banned
        });

        emitAdminActivity('player', `Player updated: ${userId}`, { userId, level, xp, coins, banned });
        emitAdminBootstrap();
      });
    } catch (parseError) {
      console.error('Failed to parse existing player data:', parseError);
      res.status(500).json({ error: 'Failed to parse existing player data' });
    }
  });
});

// Admin Twitch configuration endpoints
app.get('/api/admin/config/twitch-channel', basicAuth, (req, res) => {
  res.json({ channel: process.env.TWITCH_CHANNEL || '' });
});

app.get('/api/admin/config/twitch-speech-bubbles', basicAuth, (req, res) => {
  const gameConfig = require('../shared/gameConfig.js');
  res.json({ enabled: Boolean(gameConfig.twitchSpeechBubbles?.enabled) });
});

app.put('/api/admin/config/twitch-channel', basicAuth, (req, res) => {
  const fs = require('fs');
  const { channel } = req.body;

  if (!channel || typeof channel !== 'string') {
    return res.status(400).json({ error: 'Channel name is required' });
  }

  const newChannel = channel.toLowerCase().trim();
  if (!newChannel) {
    return res.status(400).json({ error: 'Channel name cannot be empty' });
  }

  try {
    const envPath = path.join(__dirname, '../.env');
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Replace or add TWITCH_CHANNEL line
    const channelRegex = /^TWITCH_CHANNEL=.*/m;
    const newChannelLine = `TWITCH_CHANNEL=${newChannel}`;

    if (channelRegex.test(envContent)) {
      envContent = envContent.replace(channelRegex, newChannelLine);
    } else {
      envContent += `\n${newChannelLine}`;
    }

    fs.writeFileSync(envPath, envContent);

    // Update runtime environment and reconnect
    process.env.TWITCH_CHANNEL = newChannel;
    twitchChat.reconnect(newChannel);

    emitAdminActivity('config', `Twitch channel changed to ${newChannel}`, { channel: newChannel });
    emitAdminBootstrap();

    res.json({ success: true, channel: newChannel });
  } catch (error) {
    console.error('Failed to update Twitch channel:', error);
    res.status(500).json({ error: 'Failed to update channel configuration' });
  }
});

app.put('/api/admin/config/twitch-speech-bubbles', basicAuth, (req, res) => {
  const fs = require('fs');
  const { enabled } = req.body;

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'Enabled flag must be boolean' });
  }

  try {
    const envPath = path.join(__dirname, '../.env');
    let envContent = fs.readFileSync(envPath, 'utf8');

    const settingRegex = /^TWITCH_SPEECH_BUBBLES_ENABLED=.*/m;
    const newSettingLine = `TWITCH_SPEECH_BUBBLES_ENABLED=${enabled ? 'true' : 'false'}`;

    if (settingRegex.test(envContent)) {
      envContent = envContent.replace(settingRegex, newSettingLine);
    } else {
      envContent += `\n${newSettingLine}`;
    }

    fs.writeFileSync(envPath, envContent);

    const gameConfig = require('../shared/gameConfig.js');
    gameConfig.twitchSpeechBubbles.enabled = enabled;

    emitAdminActivity('config', `Twitch speech bubbles ${enabled ? 'enabled' : 'disabled'}`, { enabled });
    emitAdminBootstrap();

    res.json({ success: true, enabled });
  } catch (error) {
    console.error('Failed to update Twitch speech bubble config:', error);
    res.status(500).json({ error: 'Failed to update speech bubble configuration' });
  }
});

// Periodic cleanup of expired tokens
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of validTokens) {
    if (data.expires < now) {
      validTokens.delete(token);
    }
  }
}, 60 * 1000); // Clean up every minute

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Game: http://localhost:${PORT}`);
  console.log(`Level Editor: http://localhost:${PORT}/editor`);
  console.log(`Admin Panel: http://localhost:${PORT}/admin`);
});
