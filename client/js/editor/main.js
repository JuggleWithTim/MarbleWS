// Main LevelEditor class that composes all modules

import { LevelEditorCore } from './core.js';
import { events } from './events.js';
import { tools } from './tools.js';
import { mouse } from './mouse.js';
import { transform } from './transform.js';
import { objects } from './objects.js';
import { rendering } from './rendering.js';
import { level } from './level.js';
import { json } from './json.js';
import { updateObjectCounters, validateAndFixDuplicateIds, recalculateConnectionLengths } from './utils.js';

// Create the main LevelEditor class by extending the core and mixing in all modules
export class LevelEditor extends LevelEditorCore {
    constructor() {
        super();

        // Mix in all the module methods
        Object.assign(this, events);
        Object.assign(this, tools);
        Object.assign(this, mouse);
        Object.assign(this, transform);
        Object.assign(this, objects);
        Object.assign(this, rendering);
        Object.assign(this, level);
        Object.assign(this, json);

        // Add utility methods that need to be bound to this instance
        this.updateObjectCounters = updateObjectCounters;
        this.validateAndFixDuplicateIds = validateAndFixDuplicateIds;
        this.recalculateConnectionLengths = recalculateConnectionLengths;
    }
}
