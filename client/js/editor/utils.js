// Utility functions for the level editor

// Color utility functions
export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

export function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export function parseRgba(rgbaString) {
    const match = rgbaString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
        return {
            r: parseInt(match[1]),
            g: parseInt(match[2]),
            b: parseInt(match[3]),
            a: match[4] ? parseFloat(match[4]) : 1
        };
    }
    return null;
}

export function createRgba(hexColor, alpha) {
    const rgb = hexToRgb(hexColor);
    if (rgb) {
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha / 255})`;
    }
    return hexColor; // fallback
}

// ID generation and validation
export function generateUniqueObjectName(baseName, existingObjects) {
    let counter = 1;
    let candidateName = `${baseName}_${counter}`;

    // Keep incrementing counter until we find a unique name
    while (existingObjects.some(obj => obj.id === candidateName)) {
        counter++;
        candidateName = `${baseName}_${counter}`;
    }

    return candidateName;
}

export function updateObjectCounters(level) {
    let maxRectId = 0;
    let maxCircleId = 0;
    let maxConnectionId = 0;

    // Scan existing objects to find highest IDs
    level.objects.forEach(obj => {
        if (obj.id.startsWith('rect_')) {
            const idNum = parseInt(obj.id.replace('rect_', ''));
            if (!isNaN(idNum) && idNum > maxRectId) {
                maxRectId = idNum;
            }
        } else if (obj.id.startsWith('circle_')) {
            const idNum = parseInt(obj.id.replace('circle_', ''));
            if (!isNaN(idNum) && idNum > maxCircleId) {
                maxCircleId = idNum;
            }
        }
    });

    // Scan connections for highest ID
    if (level.connections) {
        level.connections.forEach(conn => {
            if (conn.id.startsWith('connection_')) {
                const idNum = parseInt(conn.id.replace('connection_', ''));
                if (!isNaN(idNum) && idNum > maxConnectionId) {
                    maxConnectionId = idNum;
                }
            }
        });
    }

    return {
        objectIdCounter: Math.max(maxRectId, maxCircleId) + 1,
        connectionIdCounter: maxConnectionId + 1
    };
}

export function validateAndFixDuplicateIds(level) {
    const seenIds = new Set();
    const duplicates = [];

    // Find duplicates
    level.objects.forEach(obj => {
        if (seenIds.has(obj.id)) {
            duplicates.push(obj);
        } else {
            seenIds.add(obj.id);
        }
    });

    // Fix duplicates by generating new unique names
    duplicates.forEach(obj => {
        const baseName = obj.shape; // 'rectangle' or 'circle'
        const newId = generateUniqueObjectName(baseName, level.objects);
        console.warn(`Fixed duplicate ID: ${obj.id} -> ${newId}`);
        obj.id = newId;
    });

    // Update connections that reference the old IDs
    if (level.connections) {
        level.connections.forEach(conn => {
            if (duplicates.some(obj => obj.id === conn.bodyA)) {
                const oldObj = duplicates.find(obj => obj.id === conn.bodyA);
                if (oldObj) conn.bodyA = oldObj.id;
            }
            if (duplicates.some(obj => obj.id === conn.bodyB)) {
                const oldObj = duplicates.find(obj => obj.id === conn.bodyB);
                if (oldObj) conn.bodyB = oldObj.id;
            }
        });
    }

    if (duplicates.length > 0) {
        console.log(`Fixed ${duplicates.length} duplicate object IDs`);
    }

    return duplicates.length > 0;
}

// Connection utilities
export function recalculateConnectionLengths(level) {
    if (!level.connections) return;

    level.connections.forEach(connection => {
        // Find the connected objects
        const objA = level.objects.find(obj => obj.id === connection.bodyA);
        const objB = level.objects.find(obj => obj.id === connection.bodyB);

        if (!objA || !objB) return;

        // Calculate the actual attachment points in world coordinates
        let attachPointA = { x: objA.x, y: objA.y };
        let attachPointB = { x: objB.x, y: objB.y };

        // Apply pointA offset to object A
        if (connection.pointA) {
            if (objA.rotation && objA.rotation !== 0) {
                // Apply rotation to the offset point
                const cos = Math.cos(objA.rotation);
                const sin = Math.sin(objA.rotation);
                attachPointA.x += connection.pointA.x * cos - connection.pointA.y * sin;
                attachPointA.y += connection.pointA.x * sin + connection.pointA.y * cos;
            } else {
                attachPointA.x += connection.pointA.x;
                attachPointA.y += connection.pointA.y;
            }
        }

        // Apply pointB offset to object B
        if (connection.pointB) {
            if (objB.rotation && objB.rotation !== 0) {
                // Apply rotation to the offset point
                const cos = Math.cos(objB.rotation);
                const sin = Math.sin(objB.rotation);
                attachPointB.x += connection.pointB.x * cos - connection.pointB.y * sin;
                attachPointB.y += connection.pointB.x * sin + connection.pointB.y * cos;
            } else {
                attachPointB.x += connection.pointB.x;
                attachPointB.y += connection.pointB.y;
            }
        }

        // Recalculate the distance between attachment points
        connection.length = Math.sqrt(Math.pow(attachPointB.x - attachPointA.x, 2) + Math.pow(attachPointB.y - attachPointA.y, 2));
    });
}

// Connection creation utilities
export function createConnection(objA, objB, pointA, pointB, connectionType, connectionIdCounter) {
    // Calculate the actual attachment points in world coordinates
    let attachPointA = { x: objA.x, y: objA.y };
    let attachPointB = { x: objB.x, y: objB.y };

    // Apply pointA offset to object A
    if (pointA) {
        if (objA.rotation && objA.rotation !== 0) {
            // Apply rotation to the offset point
            const cos = Math.cos(objA.rotation);
            const sin = Math.sin(objA.rotation);
            attachPointA.x += pointA.x * cos - pointA.y * sin;
            attachPointA.y += pointA.x * sin + pointA.y * cos;
        } else {
            attachPointA.x += pointA.x;
            attachPointA.y += pointA.y;
        }
    }

    // Apply pointB offset to object B
    if (pointB) {
        if (objB.rotation && objB.rotation !== 0) {
            // Apply rotation to the offset point
            const cos = Math.cos(objB.rotation);
            const sin = Math.sin(objB.rotation);
            attachPointB.x += pointB.x * cos - pointB.y * sin;
            attachPointB.y += pointB.x * sin + pointB.y * cos;
        } else {
            attachPointB.x += pointB.x;
            attachPointB.y += pointB.y;
        }
    }

    // Calculate the actual distance between attachment points
    const length = Math.sqrt(Math.pow(attachPointB.x - attachPointA.x, 2) + Math.pow(attachPointB.y - attachPointA.y, 2));

    // Create connection properties based on type
    const connection = {
        id: `connection_${connectionIdCounter++}`,
        type: connectionType,
        bodyA: objA.id,
        bodyB: objB.id,
        pointA: pointA, // Use the captured click position relative to object center
        pointB: pointB, // Use the captured click position relative to object center
        length: length, // Distance between actual attachment points
        stiffness: 1,
        damping: 0.1
    };

    // Adjust properties based on connection type
    switch (connectionType) {
        case 'revolute':
            // Revolute joint - fixed stiffness, low damping
            connection.stiffness = 1;
            connection.damping = 0.1;
            break;
        case 'rope':
            // Rope - no stiffness (slack), low damping
            connection.stiffness = 0;
            connection.damping = 0.05;
            break;
        case 'spring':
            // Spring - medium stiffness, medium damping
            connection.stiffness = 0.1;
            connection.damping = 0.05;
            break;
        case 'distance':
            // Distance - high stiffness (fixed length), low damping
            connection.stiffness = 1;
            connection.damping = 0.1;
            break;
    }

    return connection;
}

// Image loading utilities
export function loadObjectImage(url, imageCache) {
    if (!url) return Promise.resolve(null);

    // Check if image is already cached
    if (imageCache.has(url)) {
        const cached = imageCache.get(url);
        if (cached instanceof Promise) {
            return cached;
        } else {
            return Promise.resolve(cached);
        }
    }

    // Create a new image and cache it
    const img = new Image();
    img.src = url;

    // Store a promise that resolves when the image loads
    const promise = new Promise((resolve) => {
        img.onload = () => {
            imageCache.set(url, img);
            resolve(img);
        };
        img.onerror = () => {
            imageCache.set(url, null);
            resolve(null);
        };
    });

    imageCache.set(url, promise);
    return promise;
}

export function loadBackgroundImage(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
    });
}
