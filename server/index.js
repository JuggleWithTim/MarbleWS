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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Game: http://localhost:${PORT}`);
  console.log(`Level Editor: http://localhost:${PORT}/editor`);
});
