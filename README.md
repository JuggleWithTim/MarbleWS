# AnotherGame - Multiplayer Physics Marble Game

A real-time multiplayer 2D physics game built with Node.js, Socket.io, and Matter.js. Players control UFOs to help marbles navigate through physics-based levels while Twitch chat emotes spawn as interactive objects.

## Features

### 🎮 Core Gameplay
- **Multiplayer UFO Control**: Players control UFOs using WASD keys
- **Tractor Beam Mechanics**: Use SPACEBAR to activate beam and move objects
- **Physics-Based Marble**: Guide marbles through levels using Matter.js physics
- **Goal-Based Levels**: Help marbles reach the finish line to progress

### 🎭 Twitch Integration
- **OAuth Login**: Players log in with their Twitch accounts
- **Live Chat Integration**: Emotes from Twitch chat spawn as physics objects
- **Real-time Emote Spawning**: Chat emotes roll around and interact with the game world

### 🛠️ Level Editor
- **Visual Level Designer**: Drag-and-drop interface for creating levels
- **Physics Properties**: Configure friction, restitution, and static/dynamic objects
- **Special Objects**: Set spawnpoints and goals for marbles
- **Save/Load System**: Levels saved as JSON files in the `levels/` directory

### 🌐 Multiplayer Features
- **Real-time Synchronization**: All players see the same game state
- **Player Identification**: Each player has a unique colored UFO
- **Chat System**: In-game chat for player communication
- **XP/Level System**: Players gain experience and level up

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Twitch Developer Account (for OAuth)

### Setup

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd AnotherGame
   npm install
   ```

2. **Configure Twitch Integration**
   - Create a Twitch application at https://dev.twitch.tv/console
   - Update `.env` file with your credentials:
   ```env

   # Twitch API Configuration
   TWITCH_CLIENT_ID=your_twitch_client_id_here
   TWITCH_CLIENT_SECRET=your_twitch_client_secret_here
   TWITCH_REDIRECT_URI=http://localhost:3000/auth/twitch/callback/
   TWITCH_CHANNEL=channelname

   # Twitch Bot Configuration
   TWITCH_BOT_USERNAME=botusername
   TWITCH_BOT_OAUTH_TOKEN=oauth:00000000000

   # Server Configuration
   PORT=3000
   DEV_MODE=true

   # Admin Panel Configuration
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=change_this_password
   ```

3. **Start the Server**
   ```bash
   # Development mode (with auto-restart)
   npm run dev
   
   # Production mode
   npm start
   ```

4. **Access the Game**
   - Game: http://localhost:3000
   - Level Editor: http://localhost:3000/editor
   - Admin panel: http://localhost:3000/admin

## Project Structure

```
AnotherGame/
├── server/
│   ├── index.js          # Main server file
│   ├── gameLogic.js      # Game state and physics management
│   ├── twitchChat.js     # Twitch chat integration
│   └── socketHandlers.js # Socket.io event handlers
├── client/
│   ├── index.html        # Main game page
│   ├── editor.html       # Level editor page
│   ├── css/
│   │   └── styles.css    # Game and editor styles
│   └── js/
│       ├── game.js       # Main game logic
│       ├── networking.js # Socket.io client
│       ├── renderer.js   # Canvas rendering
│       ├── controls.js   # Input handling
│       └── editor.js     # Level editor logic
├── levels/               # Saved level JSON files
│   └── sample-level.json # Example level
├── package.json
├── .env                  # Environment variables
└── .gitignore
```

## How to Play

### For Players
1. **Login**: Click "Login with Twitch" to authenticate
2. **Movement**: Use WASD keys to move your UFO
3. **Tractor Beam**: Hold SPACEBAR and click to lift objects
4. **Objective**: Help the red marble reach the yellow goal area
5. **Teamwork**: Work with other players to solve physics puzzles

### For Streamers
1. **Setup Twitch Integration**: Configure your channel in `.env`
2. **Create Levels**: Use the level editor to design custom challenges
3. **Engage Viewers**: Chat emotes automatically spawn in the game
4. **Moderate**: Control emote spawn rate (2-second cooldown)

## Level Editor Guide

### Creating Levels
1. **Access Editor**: Visit http://localhost:3000/editor
2. **Select Tools**: Choose Rectangle, Circle, or Select tool
3. **Place Objects**: Click on canvas to create objects
4. **Set Properties**: Configure physics properties in sidebar
5. **Special Objects**: Mark objects as spawnpoints or goals
6. **Save Level**: Give your level a name and click Save

### Level Requirements
- **Must have**: At least one spawnpoint and one goal
- **Spawnpoint**: Where marbles and emotes spawn (green)
- **Goal**: Where marbles need to reach (yellow, glowing)
- **Physics Objects**: Static platforms and movable pieces

### Object Properties
- **Static**: Objects that don't move (platforms, walls)
- **Dynamic**: Objects players can move with tractor beams
- **Friction**: How slippery the surface is (0-2)
- **Restitution**: How bouncy the object is (0-2)

## API Endpoints

### Level Management
- `GET /api/levels` - List all available levels
- `GET /api/levels/:name` - Get specific level data
- `POST /api/levels/:name` - Save level data

### Authentication
- `GET /auth/twitch` - Initiate Twitch OAuth flow
- `GET /auth/twitch/callback` - Handle OAuth callback

## Socket.io Events

### Client → Server
- `login` - Player authentication
- `playerMove` - Player position updates
- `beamToggle` - Tractor beam activation
- `beamInteraction` - Beam target interaction
- `loadLevel` - Request level change
- `chatMessage` - Send chat message

### Server → Client
- `loginSuccess` - Authentication confirmation
- `gameState` - Initial game state
- `gameStateUpdate` - Real-time state updates
- `playerJoined/Left` - Player connection events
- `levelLoaded` - Level change notification
- `chatMessage` - Broadcast chat messages

## Technical Details

### Physics Engine
- **Matter.js**: Handles all physics simulation
- **60 FPS**: Physics updates at 60 frames per second
- **Gravity**: Configurable world gravity (default: 0.8)
- **Collision Detection**: Automatic collision handling

### Networking
- **Socket.io**: Real-time bidirectional communication
- **Server Authority**: Physics simulation runs on server
- **Client Prediction**: Smooth UFO movement with prediction
- **State Synchronization**: 10 FPS game state broadcasts

### Twitch Integration
- **tmi.js**: Twitch chat client library
- **Anonymous Connection**: No bot account required
- **Emote Parsing**: Automatic emote detection and URL generation
- **Rate Limiting**: 2-second cooldown between emote spawns

## Development

### Adding New Features
1. **Server Logic**: Add to appropriate server module
2. **Client Logic**: Update corresponding client module
3. **Networking**: Add socket events if needed
4. **UI**: Update HTML/CSS as required

### Debugging
- **Server Logs**: Check console for server-side issues
- **Client Console**: Use browser dev tools for client debugging
- **Network Tab**: Monitor Socket.io connections
- **Physics Debug**: Uncomment debug rendering in game.js

## Troubleshooting

### Common Issues
1. **Twitch Login Fails**: Check client ID/secret in `.env`
2. **Chat Not Working**: Verify channel name in `.env`
3. **Physics Lag**: Reduce number of objects or lower update rate
4. **Connection Issues**: Check firewall settings for port 3000

### Performance Tips
- **Limit Objects**: Keep level objects under 50 for best performance
- **Optimize Images**: Use small emote images (28x28px recommended)
- **Clean Up**: Old chat messages auto-delete after 50 messages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source. Feel free to modify and distribute according to your needs.

## Credits

- **Matter.js**: Physics engine
- **Socket.io**: Real-time communication
- **tmi.js**: Twitch chat integration
- **Express.js**: Web server framework

---

**Have fun building and playing AnotherGame!** 🎮✨
