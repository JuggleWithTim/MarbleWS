class TransparentRenderer extends Renderer {
    clear() {
        // Only clear the canvas, do not fill with any color or gradient
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

(function() {
    const canvas = document.getElementById('overlayCanvas');
    const renderer = new TransparentRenderer(canvas);
    const networking = new Networking();

    // Set camera to show the full board (centered, 1920x1080)
    function renderGameState(gameState) {
        renderer.clear();
        renderer.setCamera(960, 540, 1);

        // Draw level objects
        if (gameState.levelObjects) {
            // Sort by zIndex if present
            const sortedObjects = [...gameState.levelObjects].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
            sortedObjects.forEach(obj => renderer.drawLevelObject(obj));
        }

        // Draw marbles
        if (gameState.marbles) {
            gameState.marbles.forEach(marble => renderer.drawMarble(marble.x, marble.y, marble.angle));
        }

        // Draw emotes
        if (gameState.emotes) {
            gameState.emotes.forEach(emote => renderer.drawEmote(emote.x, emote.y, emote.url, emote.angle));
        }

        // Draw players (UFOs and names)
        if (gameState.players) {
            gameState.players.forEach(player => {
                renderer.drawUFO(player.x, player.y, '#ff6b6b', player.beamActive);
                renderer.drawPlayerName(player.x, player.y, player.username, '#ff6b6b');
            });
        }
    }

    networking.connect();

    networking.on('gameState', renderGameState);
    networking.on('gameStateUpdate', renderGameState);

    // Animation loop to keep canvas updated (in case of async image loads)
    function animationLoop() {
        if (networking.getGameState()) {
            renderGameState(networking.getGameState());
        }
        requestAnimationFrame(animationLoop);
    }
    animationLoop();
})();
