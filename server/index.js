const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

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

// Setup Socket.io handlers
setupSocketHandlers(io, gameLogic);

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.get('/editor', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/editor.html'));
});

// Dev mode config endpoint
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
  
  res.json({
    username: username.trim(),
    userId: userId
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
    
    // Redirect back to game with user info
    res.redirect(`/?username=${user.display_name}&userId=${user.id}`);
  } catch (error) {
    console.error('Twitch OAuth error:', error);
    res.redirect('/?error=auth_failed');
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

app.post('/api/levels/:levelName', (req, res) => {
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

// Admin routes
app.get('/admin', basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/admin.html'));
});

// Admin API routes
app.get('/api/admin/levels', basicAuth, (req, res) => {
  const fs = require('fs');
  const levelsDir = path.join(__dirname, '../levels');

  if (!fs.existsSync(levelsDir)) {
    fs.mkdirSync(levelsDir, { recursive: true });
  }

  const levels = fs.readdirSync(levelsDir)
    .filter(file => file.endsWith('.json'))
    .map(file => {
      const levelName = file.replace('.json', '');
      const levelPath = path.join(levelsDir, file);
      const stats = fs.statSync(levelPath);
      return {
        name: levelName,
        modified: stats.mtime,
        size: stats.size
      };
    });

  res.json(levels);
});

app.delete('/api/admin/levels/:levelName', basicAuth, (req, res) => {
  const fs = require('fs');
  const levelPath = path.join(__dirname, '../levels', `${req.params.levelName}.json`);

  if (fs.existsSync(levelPath)) {
    fs.unlinkSync(levelPath);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Level not found' });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Game: http://localhost:${PORT}`);
  console.log(`Level Editor: http://localhost:${PORT}/editor`);
  console.log(`Admin Panel: http://localhost:${PORT}/admin`);
});
