// Default level structure and constants for the level editor

export const DEFAULT_LEVEL = {
    name: 'new-level',
    description: '',
    version: '1.0',
    backgroundImage: '',
    world: {
        gravity: 0.8
    },
    marble: {
        color: '#ff6b6b',
        radius: 30,
        friction: 0.000005,
        restitution: 0.7,
        density: 0.004
    },
    emote: {
        radius: 25,
        friction: 0.3,
        restitution: 0.7,
        density: 0.001,
        spawnAll: false
    },
    objects: [],
    connections: []
};

export const CANVAS_SCALE = {
    X: 1920 / 1280, // 1.5
    Y: 1080 / 720   // 1.5
};

export const RESIZE_HANDLE_SIZE = 10;
export const ROTATION_HANDLE_OFFSET = 30;

export const DEFAULT_OBJECT_PROPERTIES = {
    width: 100,
    height: 20,
    radius: 25,
    rotation: 0,
    color: '#888888',
    alpha: 255,
    friction: 0.3,
    restitution: 0.3,
    density: 0.001,
    zIndex: 0,
    isStatic: true,
    isSolid: true
};

export const CONNECTION_TYPES = {
    REVOLUTE: 'revolute',
    ROPE: 'rope',
    SPRING: 'spring',
    DISTANCE: 'distance',
    GLUE: 'glue'
};

export const CONNECTION_DEFAULTS = {
    [CONNECTION_TYPES.REVOLUTE]: { stiffness: 1, damping: 0.1 },
    [CONNECTION_TYPES.ROPE]: { stiffness: 0, damping: 0.05 },
    [CONNECTION_TYPES.SPRING]: { stiffness: 0.1, damping: 0.05 },
    [CONNECTION_TYPES.DISTANCE]: { stiffness: 1, damping: 0.1 },
    [CONNECTION_TYPES.GLUE]: { stiffness: 0, damping: 0 }
};
