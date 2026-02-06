// Utility functions for game logic

function componentToHex(value) {
  const clamped = Math.max(0, Math.min(255, Number(value) || 0));
  return clamped.toString(16).padStart(2, '0');
}

function rgbToHex(r, g, b) {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}

function normalizeColor(input, fallback = '#4ecdc4') {
  if (typeof input !== 'string') {
    return fallback;
  }

  const color = input.trim().toLowerCase();

  // #rgb
  const shortHexMatch = color.match(/^#([0-9a-f]{3})$/i);
  if (shortHexMatch) {
    const [r, g, b] = shortHexMatch[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  // #rrggbb
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color;
  }

  // rgb()/rgba()
  const rgbMatch = color.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)$/i);
  if (rgbMatch) {
    return rgbToHex(parseInt(rgbMatch[1], 10), parseInt(rgbMatch[2], 10), parseInt(rgbMatch[3], 10));
  }

  return fallback;
}

// Generate a consistent random color based on a string seed
function generateColorFromSeed(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Generate hue from hash (0-360)
  const hue = Math.abs(hash) % 360;

  // Use fixed saturation and lightness for vibrant, distinguishable colors
  const saturation = 70 + (Math.abs(hash) % 30); // 70-100%
  const lightness = 45 + (Math.abs(hash) % 20); // 45-65%

  // Convert HSL to RGB
  const h = hue / 360;
  const s = saturation / 100;
  const l = lightness / 100;

  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);

  return rgbToHex(r, g, b);
}

module.exports = {
  generateColorFromSeed,
  normalizeColor
};
