// Shared game configuration - single source of truth for all game items
// Used by: game.js, overlay.js (client-side) and playerManager.js (server-side)

const gameConfig = {
  // UFO customization data
  ufoData: {
    'ufoderp.png': { cost: 222, name: 'Derpcraft' },
    'Fez.png': { cost: 111, name: 'Fez' }
  },

  // Passenger (pilot) customization data
  passengerData: {
    'luminoCoffee.png': { cost: 100, name: 'Lilly', width: 50, height: 50, offsetX: 0, offsetY: 0 },
    'Missy.png': { cost: 100, name: 'Missy', width: 50, height: 50, offsetX: 0, offsetY: 0 },
    'Derp.png': { cost: 333, name: 'LuminousNova', width: 50, height: 50, offsetX: 0, offsetY: 0 },
    'Nox.png': { cost: 333, name: 'Noxanimus', width: 50, height: 50, offsetX: 0, offsetY: 0 },
    'Tim.png': { cost: 333, name: 'JuggleWithTim', width: 100, height: 60, offsetX: 0, offsetY: 0 },
    'pepe.png': { cost: 123, name: 'Pepe', width: 50, height: 50, offsetX: 0, offsetY: 0 },
    'trollface.png': { cost: 69, name: 'Trollolololol', width: 50, height: 50, offsetX: 0, offsetY: 0 }
  },

  // Hat customization data
  hatData: {
    'santahatpixel.png': { cost: 7531, name: 'Santa Hat (Wait until December or spend one hell of a lot of coins for it LUL)', width: 60, height: 50, offsetX: 0, offsetY: 0 },
    'captain.png': { cost: 300, name: 'Captain Hat', width: 50, height: 50, offsetX: 0, offsetY: 0 },
    'crown.png': { cost: 744, name: 'Crown', width: 50, height: 50, offsetX: 0, offsetY: 0 },
    //'jester.png': { cost: 321, name: 'Jester Hat', width: 50, height: 50, offsetX: 0, offsetY: 0 },
    'jester2.png': { cost: 321, name: 'Jester Hat', width: 83, height: 60, offsetX: 0, offsetY: 0 },
    'propeller.png': { cost: 67, name: 'Propeller Hat', width: 50, height: 50, offsetX: 0, offsetY: 0 },
    //'tophat.png': { cost: 555, name: 'Top Hat', width: 50, height: 50, offsetX: 0, offsetY: 0 },
    'tophatcat.png': { cost: 555, name: 'Top Hat Top Cat', width: 67, height: 60, offsetX: 0, offsetY: 0 },
    'viking.png': { cost: 333, name: 'Viking Helmet', width: 60, height: 60, offsetX: 0, offsetY: 0 },
    'witch.png': { cost: 333, name: 'Witch Hat', width: 60, height: 60, offsetX: 0, offsetY: 0 },
    'purplesanta.png': { cost: 333, name: 'Purple Santa Hat', width: 75, height: 95, offsetX: 10, offsetY: 55 }
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
