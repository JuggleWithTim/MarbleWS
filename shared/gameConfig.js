// Shared game configuration - single source of truth for all game items
// Used by: game.js, overlay.js (client-side) and playerManager.js (server-side)

const gameConfig = {
  // UFO customization data
  ufoData: {
    'ufoderp.png': { cost: 222, name: 'Derpcraft' },
    'Fez.png': { cost: 111, name: 'Fez' },
    'ftail.png': { cost: 123, name: 'Fish tail' }
  },

  // Passenger (pilot) customization data
  passengerData: {
    'luminoCoffee.png': { cost: 100, name: 'Lilly', width: 50, height: 50, offsetX: 0, offsetY: 0 },
    'Missy.png': { cost: 100, name: 'Missy', width: 50, height: 50, offsetX: 0, offsetY: 0 },
    'Derp.png': { cost: 333, name: 'LuminousNova', width: 50, height: 50, offsetX: 0, offsetY: 0 },
    'Nox.png': { cost: 333, name: 'Noxanimus', width: 50, height: 50, offsetX: 0, offsetY: 0 },
    'Tim.png': { cost: 333, name: 'JuggleWithTim', width: 100, height: 60, offsetX: 0, offsetY: 0 },
    'pepe.png': { cost: 123, name: 'Pepe', width: 50, height: 50, offsetX: 0, offsetY: 0 },
    'trollface.png': { cost: 69, name: 'Trollolololol', width: 50, height: 50, offsetX: 0, offsetY: 0 },
    'fhead.png': { cost: 444, name: 'Fish head', width: 70, height: 60, offsetX: 0, offsetY: -15 }
  },

  // Hat customization data
  hatData: {
    'santahatpixel.png': { cost: 111, name: 'Santa Hat', width: 60, height: 50, offsetX: 0, offsetY: 0 },
    'captain.png': { cost: 300, name: 'Captain Hat', width: 50, height: 50, offsetX: 0, offsetY: 0 },
    'crown.png': { cost: 744, name: 'Crown', width: 75, height: 45, offsetX: 0, offsetY: 0 },
    //'jester.png': { cost: 321, name: 'Jester Hat', width: 50, height: 50, offsetX: 0, offsetY: 0 },
    'jester2.png': { cost: 321, name: 'Jester Hat', width: 83, height: 60, offsetX: 0, offsetY: 0 },
    'propeller.png': { cost: 67, name: 'Propeller Hat', width: 50, height: 50, offsetX: 0, offsetY: 0 },
    //'tophat.png': { cost: 555, name: 'Top Hat', width: 50, height: 50, offsetX: 0, offsetY: 0 },
    'tophatcat.png': { cost: 555, name: 'Top Hat Top Cat', width: 67, height: 60, offsetX: 0, offsetY: 0 },
    'viking.png': { cost: 333, name: 'Viking Helmet', width: 65, height: 45, offsetX: 0, offsetY: 5 },
    'witch.png': { cost: 333, name: 'Witch Hat', width: 65, height: 50, offsetX: 0, offsetY: 10 },
    'purplesanta.png': { cost: 222, name: 'Purple Santa Hat', width: 75, height: 95, offsetX: 10, offsetY: 55 },
    'pirate.png': { cost: 333, name: 'Pirate Hat', width: 75, height: 45, offsetX: 0, offsetY: 0 }
  },

  // Emote reward data
  emoteReward: { xp: 50, coins: 10 },

  // Maximum active emotes in a level (oldest despawned when exceeded)
  maxActiveEmotes: 222,

  // Color Rush reward data (per player contribution to reward pot)
  colorRushReward: { xp: 5, coins: 10 },

  // Race reward data (per player contribution to reward pot)
  raceReward: { xp: 5, coins: 10 },

  // Race mode configuration
  raceMode: {
    laps: 3,
    countdownSeconds: 3,
    resultsDurationMs: 15000,
    maxRaceDurationMs: 300000,
    playerEffect: {
      pickupCooldownMs: 2000,
      maxActiveItems: 1
    },
    items: {
      turbo: {
        speedMultiplier: 1.8,
        durationMs: 1200
      },
      slow: {
        speedMultiplier: 0.6,
        durationMs: 1500
      },
      confusion: {
        durationMs: 2000
      }
    }
  },

  // Twitch chat announcements configuration
  announcements: {
    twitch: {
      enabled: false, // Master toggle for all announcements

      // Player join/leave announcements
      joinLeave: {
        enabled: true,
        joinMessage: "{username} joined the game!",
        leaveMessage: "{username} left the game"
      },

      // Player level up announcements
      levelUp: {
        enabled: true,
        message: "{username} leveled up to level {newLevel}!"
      },

      // Emote goal reached announcements
      emoteGoal: {
        enabled: false,
        message: "Emote goal reached! PogChamp" // Needs to be updated to announce what players made the goal.
      },

      // Color Rush round end announcements
      colorRushEnd: {
        enabled: true,
        message: "Top {count} Color Rush players: {players}",
        maxPlayers: 3
      },

      // Race finish announcements
      raceFinish: {
        enabled: true,
        message: "Race finished! Top {count}: {players}",
        maxPlayers: 3
      },

      // Race mode lifecycle announcements
      raceCountdown: {
        enabled: false,
        message: "Race starts in {remaining}..."
      },
      raceStart: {
        enabled: true,
        message: "Race started! {playerCount} racers, {laps} laps"
      },
      raceCheckpoint: {
        enabled: false,
        message: "{username} reached checkpoint {checkpoint}/{checkpointCount} on lap {lap}"
      },
      raceLap: {
        enabled: false,
        message: "{username} started lap {lap}/{totalLaps}"
      },
      racePlayerFinish: {
        enabled: true,
        message: "{username} finished in position {position} with time {finishTime}"
      },
      raceTimeout: {
        enabled: true,
        message: "Race timed out! Top {count}: {players}",
        maxPlayers: 3
      },
      raceNextRound: {
        enabled: false,
        message: "Next race starts in {countdownSeconds} seconds"
      },

      // Level change announcements
      levelChange: {
        enabled: true,
        message: "Level changed to: {levelName}"
      },

      // Game mode change announcements
      modeChange: {
        enabled: false, //Game mode always change together with a level change, so this announcement is redundant. But keeping it in case we need it at some point.
        message: "Game mode changed to: {modeName}"
      }
    }
  },

  // Twitch chat speech bubbles
  twitchSpeechBubbles: {
    enabled: true
  }
};

// Client-side global variable (only in browser)
if (typeof window !== 'undefined') {
  window.gameConfig = gameConfig;
}

// Server-side CommonJS export (for playerManager.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = gameConfig;
}
