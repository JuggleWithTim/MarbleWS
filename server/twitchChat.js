const tmi = require('tmi.js');
const axios = require('axios');

class TwitchChat {
  constructor(gameLogic) {
    this.gameLogic = gameLogic;
    this.client = null;
    this.emoteCache = new Map();
    this.lastEmoteSpawn = 0;
    this.emoteSpawnCooldown = 0.1; // 0.1 seconds between emote spawns
    
    this.initializeChat();
  }

  initializeChat() {
    if (!process.env.TWITCH_CHANNEL) {
      console.log('No Twitch channel specified, skipping chat integration');
      return;
    }

    const opts = {
      identity: {
        username: process.env.TWITCH_BOT_USERNAME || 'justinfan12345',
        password: process.env.TWITCH_BOT_OAUTH_TOKEN || 'oauth:'
      },
      channels: [process.env.TWITCH_CHANNEL]
    };

    this.client = new tmi.client(opts);

    // Event handlers
    this.client.on('message', this.onMessage.bind(this));
    this.client.on('cheer', this.onCheer.bind(this));
    this.client.on('connected', this.onConnected.bind(this));
    this.client.on('disconnected', this.onDisconnected.bind(this));

    // Connect to chat
    this.client.connect().catch(console.error);
  }

  onConnected(addr, port) {
    console.log(`Connected to Twitch chat: ${addr}:${port}`);
  }

  onDisconnected(reason) {
    console.log(`Disconnected from Twitch chat: ${reason}`);
  }

  async onMessage(target, context, msg, self) {
    if (self) return; // Ignore messages from the bot itself

    const username = context['display-name'] || context.username;
    const userId = context['user-id'];

    // Check for !sit command
    if (msg.toLowerCase().startsWith('!sit')) {
      const parts = msg.trim().split(/\s+/);
      let chairNumber = null;

      if (parts.length > 1) {
        const num = parseInt(parts[1]);
        if (!isNaN(num) && num >= 1 && num <= 99) {
          chairNumber = num;
        }
      }

      // Handle the sit command for the user
      const result = await this.gameLogic.handlePlayerSitByUserId(userId, chairNumber, username);

      // Log the result
      if (result.success) {
        console.log(`${username} sat on chair ${result.chairNumber}`);
      } else {
        console.log(`${username} failed to sit: ${result.message}`);
      }

      // Don't process emotes for commands
      return;
    }

    // Check for !unsit command
    if (msg.toLowerCase() === '!unsit') {
      // Handle the unsit command for the user
      const result = this.gameLogic.handlePlayerUnsitByUserId(userId);

      // Log the result
      if (result.success) {
        console.log(`${username} despawned`);
      } else {
        console.log(`${username} failed to unsit: ${result.message}`);
      }

      // Don't process emotes for commands
      return;
    }

    // Check for !spectate command (for Dungeon mode overlay)
    if (msg.toLowerCase().startsWith('!spectate')) {
      const parts = msg.trim().split(/\s+/);

      if (parts.length > 1) {
        const targetUsername = parts[1].toLowerCase();

        // Check if current game mode is Dungeon
        const currentMode = this.gameLogic.levelManager.gameModeManager.getCurrentMode();
        if (currentMode && currentMode.getModeName() === 'Dungeon') {
          // Set follow target for dungeon mode
          this.gameLogic.setDungeonFollowTarget(targetUsername);
          console.log(`Dungeon mode overlay now spectating user: ${targetUsername}`);
        } else {
          console.log(`Spectate command ignored - not in Dungeon mode`);
        }
      }

      // Don't process emotes for commands
      return;
    }

    // Check for !unspectate command (for Dungeon mode overlay)
    if (msg.toLowerCase() === '!unspectate') {
      // Check if current game mode is Dungeon
      const currentMode = this.gameLogic.levelManager.gameModeManager.getCurrentMode();
      if (currentMode && currentMode.getModeName() === 'Dungeon') {
        // Clear follow target for dungeon mode
        this.gameLogic.clearDungeonFollowTarget();
        console.log(`Dungeon mode overlay stopped spectating`);
      } else {
        console.log(`Unspectate command ignored - not in Dungeon mode`);
      }

      // Don't process emotes for commands
      return;
    }

    // Check for emotes in the message
    if (context.emotes) {
      // Parse emotes from the message
      const emotes = this.parseEmotes(msg, context.emotes);

      if (emotes.length > 0) {
        // Check level setting for spawnAll
        const levelEmoteSettings = this.gameLogic.levelManager.currentLevel?.emote || {};
        const spawnAll = levelEmoteSettings.spawnAll || false;

        if (spawnAll) {
          // Spawn all emotes found
          for (const emote of emotes) {
            await this.spawnEmoteInGame(emote.id, emote.name);
          }
        } else {
          // Spawn only the first emote (legacy behavior)
          const emote = emotes[0];
          await this.spawnEmoteInGame(emote.id, emote.name);
        }
      }
    }
  }

  async onCheer(channel, userstate, message) {
    // Extract cheer information
    const bits = parseInt(userstate.bits) || 0;
    const userId = userstate['user-id'];
    const username = userstate['display-name'] || userstate.username;

    if (bits <= 0 || !userId) {
      console.log('Invalid cheer data received');
      return;
    }

    console.log(`${username} (${userId}) cheered ${bits} bits!`);

    // Add coins to player (1:1 ratio)
    const result = this.gameLogic.addCoinsToPlayer(userId, bits, 'cheer');

    if (result.success) {
      console.log(`Successfully added ${bits} coins to ${username}. New balance: ${result.newBalance}`);
    } else {
      if (result.reason === 'player_not_found') {
        console.log(`Player ${username} (${userId}) has not played the game yet, skipping coin reward`);
      } else {
        console.log(`Failed to add coins to ${username}: ${result.reason}`);
      }
    }
  }

  parseEmotes(message, emotesData) {
    const emotes = [];
    
    for (const emoteId in emotesData) {
      const positions = emotesData[emoteId];
      
      for (const position of positions) {
        const [start, end] = position.split('-').map(Number);
        const emoteName = message.substring(start, end + 1);
        
        emotes.push({
          id: emoteId,
          name: emoteName,
          url: `https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/default/dark/3.0`
        });
      }
    }
    
    return emotes;
  }

  async spawnEmoteInGame(emoteId, emoteName) {
    try {
      // Check cache first
      let emoteUrl = this.emoteCache.get(emoteId);
      
      if (!emoteUrl) {
        // Construct Twitch emote URL
        emoteUrl = `https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/default/dark/3.0`;
        
        // Verify the emote exists
        try {
          await axios.head(emoteUrl);
          this.emoteCache.set(emoteId, emoteUrl);
        } catch (error) {
          console.log(`Failed to verify emote ${emoteId}:`, error.message);
          return;
        }
      }

      // Spawn emote in game
      this.gameLogic.spawnEmote(emoteUrl, emoteName);
      console.log(`Spawned emote: ${emoteName} (${emoteId})`);
      
    } catch (error) {
      console.error('Error spawning emote:', error);
    }
  }

  // Method to manually spawn an emote (for testing)
  testSpawnEmote(emoteName = 'Kappa') {
    const testEmotes = {
      'Kappa': '25',
      'PogChamp': '88',
      'LUL': '425618',
      'MonkaS': '56',
      'OMEGALUL': '583'
    };

    const emoteId = testEmotes[emoteName] || testEmotes['Kappa'];
    this.spawnEmoteInGame(emoteId, emoteName);
  }

  disconnect() {
    if (this.client) {
      this.client.disconnect();
    }
  }

  // Reconnect with a new channel
  reconnect(newChannel) {
    console.log(`Reconnecting Twitch chat to channel: ${newChannel}`);

    // Disconnect existing connection
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }

    // Update environment variable for future reference
    process.env.TWITCH_CHANNEL = newChannel;

    // Reinitialize with new channel
    this.initializeChat();
  }
}

module.exports = TwitchChat;
