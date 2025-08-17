# Developer Guide - AnotherGame

This guide provides comprehensive instructions for customizing and extending the AnotherGame multiplayer physics marble game.

## 🎯 Quick Start Customization

### Essential Files to Know
- **Game Logic**: `server/gameLogic.js` - Physics and game state
- **Client Game**: `client/js/game.js` - Main game loop and rendering
- **Controls**: `client/js/controls.js` - Input handling
- **Styling**: `client/css/styles.css` - Visual appearance
- **Levels**: `levels/*.json` - Level definitions

---

## 🎮 Game Mechanics Customization

### Physics Properties
**File**: `server/gameLogic.js`

#### Gravity
```javascript
// Line ~15: Adjust world gravity
this.engine.world.gravity.y = 0.8; // Default: 0.8 (positive = downward)
```

#### UFO Properties
```javascript
// Lines ~25-35: UFO movement settings
const UFO_SPEED = 5;        // Movement speed
const BEAM_RANGE = 150;     // Tractor beam reach
const BEAM_STRENGTH = 0.1;  // Pulling force
```

#### Marble Properties
```javascript
// Lines ~40-50: Marble physics
const MARBLE_RADIUS = 15;   // Size
const MARBLE_DENSITY = 0.001; // Weight
const MARBLE_FRICTION = 0.01; // Surface friction
const MARBLE_RESTITUTION = 0.8; // Bounciness (0-1)
```

### Controls Configuration
**File**: `client/js/controls.js`

#### Key Bindings
```javascript
// Lines ~10-20: Control keys
const KEYS = {
    UP: 'KeyW',
    DOWN: 'KeyS',
    LEFT: 'KeyA',
    RIGHT: 'KeyD',
    BEAM: 'Space'
};
```

#### Mouse Controls
```javascript
// Lines ~50-70: Mouse sensitivity
const MOUSE_SENSITIVITY = 1.0; // Beam targeting sensitivity
```

---

## 🎨 Visual Customization

### Colors & Themes
**File**: `client/css/styles.css`

#### Primary Color Scheme
```css
/* Lines ~10-30: Main theme colors */
--primary-color: #4ecdc4;      /* Teal accents */
--secondary-color: #ff6b6b;    /* Red for marbles */
--background-color: #1a1a2e;   /* Dark blue background */
--text-color: #ffffff;         /* White text */
```

#### UFO Colors
**File**: `server/gameLogic.js`
```javascript
// Lines ~60-75: Player colors
const PLAYER_COLORS = [
    '#4ecdc4', '#ff6b6b', '#45b7d1', '#96ceb4', 
    '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'
];
```

#### Special Effects
**File**: `client/css/styles.css`
```css
/* Lines ~200-250: Visual effects */
.ufo { filter: drop-shadow(0 0 10px #4ecdc4); }
.marble { filter: drop-shadow(0 0 5px #ff6b6b); }
.goal { animation: pulse 2s infinite; }
```

### Canvas Scaling
**File**: `client/index.html`
```html
<!-- Lines ~50-60: Canvas dimensions -->
<canvas id="gameCanvas" width="1920" height="1080"></canvas>
<!-- CSS scales this to 1280x720 for display -->
```

---

## 🏗️ Level Design

### Creating Custom Levels

#### Using the Level Editor
1. Navigate to `http://localhost:3000/editor`
2. Use tools: Rectangle, Circle, Select, Delete
3. Set properties: Color, physics, special flags
4. Save with unique name in `levels/` directory

#### Manual Level Creation
**File Format**: JSON in `levels/your-level.json`

```json
{
  "name": "Your Level Name",
  "description": "Level description",
  "version": "1.0",
  "objects": [
    {
      "id": "unique-id",
      "shape": "rectangle|circle",
      "x": 100,
      "y": 200,
      "width": 100,      // For rectangles
      "height": 20,      // For rectangles
      "radius": 25,      // For circles
      "color": "#hexcolor",
      "isStatic": true|false,
      "friction": 0.3,
      "restitution": 0.3,
      "properties": ["spawnpoint", "goal"] // Special flags
    }
  ]
}
```

#### Required Elements
- **At least 1 spawnpoint** (green) - Where marbles spawn
- **At least 1 goal** (yellow) - Where marbles must reach
- **Ground/platform objects** for marble to roll on

### Level Object Properties
| Property | Range | Description |
|----------|--------|-------------|
| `friction` | 0-2 | Surface slipperiness (0 = ice, 2 = sticky) |
| `restitution` | 0-2 | Bounciness (0 = no bounce, 2 = super bouncy) |
| `isStatic` | true/false | Whether object can move |
| `color` | hex code | Visual appearance |

---

## 📺 Twitch Integration

### Setup Configuration
**File**: `.env` (create if doesn't exist)

```bash
# Required Twitch settings
TWITCH_CLIENT_ID=your_twitch_client_id_here
TWITCH_CLIENT_SECRET=your_twitch_client_secret_here
TWITCH_REDIRECT_URI=http://localhost:3000/auth/twitch/callback
TWITCH_CHANNEL=your_twitch_channel_name

# Optional settings
DEV_MODE=true  # Enable guest login for development
```

### Getting Twitch Credentials
1. Go to https://dev.twitch.tv/console
2. Create new application
3. Set OAuth redirect URI to: `http://localhost:3000/auth/twitch/callback`
4. Copy Client ID and Client Secret to `.env`

### Emote Spawning
**File**: `server/twitchChat.js`

#### Emote Rate Limiting
```javascript
// Line ~25: Emote spawn cooldown
const EMOTE_COOLDOWN = 2000; // 2 seconds between emotes
```

#### Emote Physics
```javascript
// Lines ~40-50: Emote properties
const EMOTE_SIZE = 28;        // Pixel size
const EMOTE_DENSITY = 0.0005; // Weight
const EMOTE_LIFETIME = 30000; // 30 seconds before deletion
```

---

## 🌐 Networking & Events

### Socket Events
**Files**: `server/socketHandlers.js` and `client/js/networking.js`

#### Client → Server Events
| Event | Data | Description |
|-------|------|-------------|
| `login` | `{username, userId}` | Player authentication |
| `playerMove` | `{x, y, angle}` | UFO position update |
| `beamToggle` | `{active}` | Tractor beam on/off |
| `beamInteraction` | `{targetId, action}` | Beam interaction |
| `chatMessage` | `{text}` | Chat message |
| `loadLevel` | `{levelName}` | Request level change |

#### Server → Client Events
| Event | Data | Description |
|-------|------|-------------|
| `gameState` | `{players, objects}` | Full game state |
| `gameStateUpdate` | `{players, objects}` | Delta updates |
| `playerJoined` | `{player}` | New player connected |
| `playerLeft` | `{playerId}` | Player disconnected |
| `levelLoaded` | `{levelData}` | New level loaded |

### Adding New Events
1. **Server**: Add handler in `server/socketHandlers.js`
2. **Client**: Add listener in `client/js/networking.js`
3. **Game**: Implement logic in `client/js/game.js`

---

## 🎛️ UI/UX Customization

### Layout Adjustments
**File**: `client/index.html`

#### Game UI Positioning
```css
/* In client/css/styles.css */
#gameUI {
    top: 20px;      /* Distance from top */
    left: 20px;     /* Distance from left */
    width: 200px;   /* Sidebar width */
}
```

#### Chat Position
```css
#chat {
    bottom: 20px;   /* Distance from bottom */
    right: 20px;    /* Distance from right */
    width: 300px;   /* Chat width */
    height: 200px;  /* Chat height */
}
```

### Responsive Design
**File**: `client/css/styles.css`
```css
/* Lines ~300-350: Mobile adjustments */
@media (max-width: 768px) {
    #gameCanvas {
        width: calc(100vw - 40px);
        height: calc(100vh - 200px);
    }
}
```

---

## 🔧 Development Workflow

### Quick Development Setup
```bash
# 1. Install dependencies
npm install

# 2. Create .env file with your settings
cp .env.example .env  # Edit with your values

# 3. Start development server
npm run dev

# 4. Access:
#    Game: http://localhost:3000
#    Editor: http://localhost:3000/editor
```

### Testing Without Twitch
Set `DEV_MODE=true` in `.env` to enable guest login with custom usernames.

### Debugging Tips
1. **Browser Console**: Check for client-side errors
2. **Server Console**: Check for server-side errors
3. **Network Tab**: Monitor Socket.io connections
4. **Physics Debug**: Uncomment debug rendering in `game.js`

---

## 📊 Performance Optimization

### Level Complexity
- **Recommended**: < 50 objects per level
- **Maximum**: ~100 objects (performance degrades)
- **Emote Limit**: 50 active emotes (auto-cleanup)

### Canvas Scaling
**File**: `client/js/renderer.js`
```javascript
// Lines ~20-30: Render optimization
const RENDER_SCALE = 0.67; // 1920x1080 → 1280x720
const TARGET_FPS = 60;
```

### Network Optimization
**File**: `server/gameLogic.js`
```javascript
// Lines ~80-90: Update rates
const PHYSICS_FPS = 60;     // Physics simulation
const NETWORK_FPS = 10;     // State sync to clients
```

---

## 🚀 Adding New Features

### Example: New Game Object Type
1. **Define in level JSON**:
```json
{
  "shape": "triangle",
  "special": "conveyor"
}
```

2. **Add rendering** in `client/js/renderer.js`
3. **Add physics** in `server/gameLogic.js`
4. **Add editor support** in `client/js/editor.js`

### Example: New Power-up
1. **Server**: Add power-up logic in `gameLogic.js`
2. **Client**: Add visual effects in `renderer.js`
3. **Controls**: Add activation key in `controls.js`
4. **UI**: Add indicator in `index.html`

---

## 📁 Project Structure Reference

```
AnotherGame/
├── server/                 # Backend code
│   ├── index.js           # Main server & routes
│   ├── gameLogic.js       # Physics & game state
│   ├── socketHandlers.js  # Socket.io events
│   └── twitchChat.js      # Twitch integration
├── client/                # Frontend code
│   ├── index.html         # Game interface
│   ├── editor.html        # Level editor
│   ├── css/styles.css     # Styling
│   └── js/
│       ├── game.js        # Main game logic
│       ├── networking.js  # Socket client
│       ├── renderer.js    # Canvas rendering
│       ├── controls.js    # Input handling
│       └── editor.js      # Level editor logic
├── levels/                # Level files
│   ├── *.json            # Custom levels
└── package.json          # Dependencies
```

---

## 🆘 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| **Twitch login fails** | Check `.env` credentials and redirect URI |
| **Chat not working** | Verify `TWITCH_CHANNEL` in `.env` |
| **Physics lag** | Reduce objects or lower `PHYSICS_FPS` |
| **Connection issues** | Check firewall for port 3000 |
| **Levels not loading** | Verify JSON syntax in level files |

### Performance Issues
- **Too many objects**: Reduce level complexity
- **Slow rendering**: Lower canvas resolution
- **Network lag**: Check internet connection, reduce `NETWORK_FPS`

---

## 📝 Best Practices

### Level Design
- Always include spawnpoint and goal
- Test marble path before publishing
- Use friction 0.8+ for ground objects
- Keep restitution < 0.5 for stable platforms

### Code Organization
- Add new features in appropriate modules
- Use consistent naming conventions
- Comment complex physics calculations
- Test multiplayer functionality

### Performance
- Limit active emotes to < 30
- Use static objects for platforms
- Avoid tiny physics objects (< 5px)
- Test on lower-end devices

---

**Need help?** Check the README.md for basic setup, or examine the existing level files in `levels/` for examples.
