// Shared game configuration - single source of truth for all game items
// Used by: game.js, overlay.js (client-side) and playerManager.js (server-side)

const gameConfig = {
  // UFO customization data
  ufoData: {
    'ufoderp.png': { cost: 75, name: 'Derpcraft' },
    'Fez.png': { cost: 100, name: 'Fez' }
  },

  // Passenger (pilot) customization data
  passengerData: {
    'luminoCoffee.png': { cost: 75, name: 'Lilly', width: 50, height: 50 },
    'Missy.png': { cost: 75, name: 'Missy', width: 50, height: 50 },
    'Derp.png': { cost: 75, name: 'LuminousNova', width: 50, height: 50 },
    'Nox.png': { cost: 75, name: 'Noxanimus', width: 50, height: 50 },
    'Tim.png': { cost: 75, name: 'JuggleWithTim', width: 100, height: 60 }
  },

  // Hat customization data
  hatData: {
    'santahatpixel.png': { cost: 50, name: 'Santa Hat', width: 60, height: 50 }
  },

  // Emote reward data
  emoteReward: { xp: 50, coins: 10 }
};

// Client-side global variable (only in browser)
if (typeof window !== 'undefined') {
  window.gameConfig = gameConfig;
}

// Server-side CommonJS export (for playerManager.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = gameConfig;
}
