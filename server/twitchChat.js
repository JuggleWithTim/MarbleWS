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

    // Check for emotes in the message
    if (context.emotes) {
      const now = Date.now();
      if (now - this.lastEmoteSpawn < this.emoteSpawnCooldown) {
        return; // Cooldown active
      }

      // Parse emotes from the message
      const emotes = this.parseEmotes(msg, context.emotes);
      
      if (emotes.length > 0) {
        // Spawn the first emote found
        const emote = emotes[0];
        await this.spawnEmoteInGame(emote.id, emote.name);
        this.lastEmoteSpawn = now;
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
}

module.exports = TwitchChat;
