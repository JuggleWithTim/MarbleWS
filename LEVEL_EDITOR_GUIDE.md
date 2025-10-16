# MarbleWS Level Editor Guide

Welcome to the MarbleWS Level Editor! This guide will teach you how to create, edit, and test levels for MarbleWS, a real-time multiplayer physics game where players use UFOs to help marbles navigate through challenging physics levels while Twitch chat emotes spawn as interactive objects.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Editor Interface Overview](#editor-interface-overview)
3. [Creating a New Level](#creating-a-new-level)
4. [Level Settings](#level-settings)
5. [Working with Objects](#working-with-objects)
6. [Object Properties](#object-properties)
7. [Special Object Types](#special-object-types)
8. [Physics Properties](#physics-properties)
9. [Tools Overview](#tools-overview)
10. [Connections](#connections)
11. [Advanced Features](#advanced-features)
12. [Testing Levels](#testing-levels)
13. [JSON Editor](#json-editor)
14. [Tips and Best Practices](#tips-and-best-practices)
15. [Troubleshooting](#troubleshooting)

## Getting Started

### Accessing the Editor
1. Start the MarbleWS server using `npm start`
2. Open your browser and navigate to: `http://localhost:3000/editor`

### Prerequisites
- At least one **spawnpoint** (where marbles appear)
- At least one **goal** (where marbles need to reach)
- Level name (required for saving)

## Editor Interface Overview

The editor consists of several main areas:

### Left Sidebar
- **Level Information**: Name, description, and background settings
- **Tools**: Select, Rectangle, Circle, Connect, Delete tools
- **Object Properties**: Configure selected object's properties
- **Object List**: View and manage all objects in the level

### Main Canvas Area
- **Toolbar**: New, Load, Save, Test buttons; Grid/Snap toggles
- **Canvas**: 1920x1080 level editing area (scaled to fit editor)
- **Status Bar**: Current tool status and mouse coordinates

### JSON Panel
- **Raw Level Data**: View and edit level JSON directly
- **Format/Apply/Reset**: JSON manipulation tools

## Creating a New Level

1. Click the **"New"** button in the toolbar
2. Confirm you want to clear the current level
3. Set your level name and description
4. Start creating objects!

## Level Settings

### Basic Information
- **Level Name**: Identifier used for saving/loading (required)
- **Description**: Optional descriptive text
- **Background Image**: URL or path to background image

### Grid System
- **Show Grid**: Toggle grid visibility (helps with alignment)
- **Snap to Grid**: Objects snap to grid intersections when moving/creating
- **Grid Size**: Adjust grid spacing (10-50 pixels)

## Working with Objects

### Creating Objects

1. **Select a Tool**: Choose Rectangle or Circle from the toolbar
2. **Configure Properties**: Set properties in the sidebar before creating or while having the object selected
3. **Click on Canvas**: Place the object at the desired location
4. **Object Appears**: New object is created and selected automatically

### Selecting Objects

- Use the **Select tool** to click on objects
- Selected objects show a red outline with resize/rotation handles
- Selected object's properties appear in the sidebar
- Use the **Object List** to select by name

### Editing Objects

#### Moving
- Click and drag the object center to move while using the Select tool

#### Resizing
- Drag the corner handles (squares) to resize
- Hold Shift while resizing to maintain aspect ratio
- Circles have a single resize handle on the right edge

#### Rotating
- Drag the rotation handle (square above object center)
- Rotation is measured in degrees (0-360°)
- Applies to the object's pivot point

### Deleting Objects
- Use the **Delete tool** and click objects
- Press the **Delete key** when an object is selected
- Use the **X** button in the Object List

## Object Properties

### Basic Properties
- **Static**: Object doesn't move (platforms, walls)
- **Solid**: Object has collision
- **Z-Index**: Layering order (-10 to 10, higher values render on top)

### Visual Properties
- **Color**: Supports hex color code and rgba(0, 0, 0, 0)
- **Alpha**: Transparency (0%=invisible, 100%=opaque)
- **Background Image**: URL/path to image
- **Width/Height/Radius**: Object dimensions (Width/Height for rectangles, Radius for circles.)

### Physics Properties
- **Friction**: How slippery (0.0 - 2.0, higher = less slippery)
- **Restitution**: How bouncy (0.0 - 2.0, higher = more bouncy)
- **Density**: Mass per area (0.0001 - 1.0, higher = heavier)

### Marble Properties
Marbles are the main object players interact with in each level. Customize them to match your level's theme and difficulty:

- **Color**: Marble color using color picker
- **Radius**: Marble size
- **Friction**: How slippery marbles are (0.0 = very slippery, 2.0 = sticky)
- **Restitution**: How bouncy marbles are (0.0 = no bounce, 2.0 = very bouncy)
- **Density**: Mass per area (0.0001 = light, 0.1 = heavy) - affects how marbles respond to forces

## Special Object Types

### Core Types (Required)
- **Spawnpoint**: Where marbles and emotes appear
- **Goal**: Where marbles need to reach to complete the level

### Special Types
- **Playerspawn**: Where players start their UFOs
- **Emotespawn**: Where Twitch chat emotes specifically spawn
- **Teleporter**: Warps objects to another teleporter
- **Active/Elevator**: Moves between Point A and Point B

### Teleporter Setup
1. Create two objects marked as "Teleporter"
2. Note their object names (e.g., "circle_1", "circle_2")
3. Set "Teleporter Target" property to the destination object's name (remember to set this on both objects for a two way portal)
4. Objects entering the teleporter warp to the target location

### Elevator Setup
1. Check "Active (Elevator)" checkbox
2. Use "Pick Point A/B" buttons to visually set points:
   - **Point A**: Starting position offset (X, Y)
   - **Point B**: Ending position offset (X, Y)
   - **Time to A**: Seconds to move from B to A
   - **Time from A**: Seconds to move from A to B
   - **Speed to B**: Movement speed when going to B
   - **Speed from B**: Movement speed when returning to A

## Tools Overview

### Select Tool
- **Primary Use**: Select and modify existing objects
- **Features**: Move, resize, rotate selected objects
- **Cursor**: Default pointer

### Rectangle Tool
- **Draws**: Rectangular physics objects
- **Usage**: Click to place rectangles
- **Cursor**: Crosshair

### Circle Tool
- **Draws**: Circular physics objects
- **Usage**: Click to place circles
- **Cursor**: Crosshair

### Connect Tool
- **Purpose**: Create joints/connections between objects
- **Types**: Revolute (hinge), Rope, Spring, Distance
- **Usage**:
  1. Click Connect tool
  2. Click first object
  3. Click second object to connect
  4. Connection appears as colored line between objects

### Delete Tool
- **Removes**: Objects from level
- **Usage**: Click on objects to delete them
- **Cursor**: Not-allowed symbol

### Connection Types
- **Revolute**: Objects rotate around fixed point (hinges, doors)
- **Rope**: Objects connected by massless rope (swing physics)
- **Spring**: Objects connected by spring (bouncy connections)
- **Distance**: Objects maintain fixed distance (rigid connections)

## Advanced Features

### Background Images
- Supports URLs or file paths
- Displays behind all objects
- Can be set per-level or per-object

### JSON Raw Editing
- **Toggle Panel**: Click "📄 JSON" button
- **Format**: Prettify JSON structure
- **Apply**: Apply edited JSON to level
- **Reset**: Revert to saved level state

## Testing Levels

### Test Button Workflow
Not functional. Just load the level in game to test it. Load using the DEV_MODE enabled button in game or through the admin panel.

### Validation Requirements
Level must have:
- ✅ At least one spawnpoint
- ✅ At least one goal
- ❌ Invalid: Will show error and prevent saving

## JSON Structure Reference

```json
{
  "name": "My Level",
  "description": "Level description",
  "version": "1.0",
  "backgroundImage": "path/to/image.png",
  "objects": [
    {
      "id": "unique_object_id",
      "shape": "rectangle", // or "circle"
      "x": 400,
      "y": 300,
      "width": 100,        // rectangles only
      "height": 20,        // rectangles only
      "radius": 0,        // circles only
      "rotation": 0,       // degrees
      "color": "rgba(136,136,136,1.0)",
      "backgroundImage": "", // optional
      "isStatic": true,
      "isSolid": true,
      "zIndex": 0,
      "friction": 0.3,
      "restitution": 0.3,
      "density": 0.001,
      "properties": ["spawnpoint"], // array of special properties
      "active": false,     // for elevators
      "pointA": {"x": 0, "y": 0}, // elevator start
      "pointB": {"x": 0, "y": 0}, // elevator end
      "timeToA": 2.0,      // seconds
      "timeFromA": 2.0,    // seconds
      "speedToB": 1.0,     // movement speed
      "speedFromB": 1.0,   // return speed
      "teleporterTarget": "", // for teleporters
      "nextLevel": ""      // for goals
    }
  ],
  "connections": [
    {
      "id": "connection_1",
      "type": "revolute", // revolute, rope, spring, distance
      "bodyA": "object_id_1",
      "bodyB": "object_id_2",
      "pointA": {"x": 0, "y": 0}, // offset from object A center
      "pointB": {"x": 0, "y": 0}, // offset from object B center
      "length": 100,      // distance between connection points
      "stiffness": 1,     // connection rigidity (0-1)
      "damping": 0.1      // oscillation damping
    }
  ]
}
```

## Tips and Best Practices

### Level Design
- **Start Simple**: Begin with basic platforms and gradually add complexity
- **Test Frequently**: Test often to check playability
- **Balance Physics**: Adjust friction/restitution for desired feel
- **Clear Objectives**: Make spawnpoints and goals visually distinct

## Troubleshooting

### Common Issues
- **Can't Save**: Ensure level has spawnpoint and goal
- **Goal Not Reacting**: Ensure the object is not solid.
Ensure that a next level is defined and that the level exists.
If the goal is a circle, only define size using Radius. If it's a rectangle, only define size using Width and Height.
- **Images Not Loading**: Ensure that the image exists at the location you have specified. Does it load if you go directly to the URL in a spearate tab?
- **Can't grab object**: You might have made it too small to grab, manually change values in the left panel or in .json editor.
- **Can't find object**: Select it in the Object list, the selection border around the object will be visible in the canvas.

### Connection Problems
- **Connection Not Working**: Check if both objects exist and are valid
- **Wrong Connection Type**: Use Select tool to verify connection properties
- **I want to remove a connection**: Remove the objects associated with the connection and recreate them, or manually remove the connections from the .json editor.

### Technical Issues
- **JSON Errors**: Use Format button to check JSON syntax

---

**Enjoy creating levels for MarbleWS!** 🎮✨
