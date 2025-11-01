/**
 * High-resolution Earth texture configuration.
 * Uses NASA Blue Marble and Black Marble datasets.
 * 
 * Sources:
 * - Day texture: NASA Visible Earth Blue Marble Next Generation
 * - Night texture: NASA Black Marble (city lights)
 * 
 * All textures are public domain from NASA.
 * Using CORS-enabled sources for browser compatibility.
 */

// Alternative high-resolution texture sources (CORS-enabled)
const THREE_GLOBE_CDN = 'https://cdn.jsdelivr.net/npm/three-globe@2.28.0/example/img';

export const EARTH_TEXTURE_SOURCES = {
  // Ultra quality points to the best assets we can use with permissive CORS headers.
  ultra: {
    day: `${THREE_GLOBE_CDN}/earth-blue-marble.jpg`,
    night: `${THREE_GLOBE_CDN}/earth-night.jpg`,
    bump: `${THREE_GLOBE_CDN}/earth-topology.png`,
    clouds: `${THREE_GLOBE_CDN}/earth-clouds.png`,
  },
  // High/medium tiers currently point to the same CDN but give us a hook if we later add lighter-weight textures.
  high: {
    day: `${THREE_GLOBE_CDN}/earth-blue-marble.jpg`,
    night: `${THREE_GLOBE_CDN}/earth-night.jpg`,
    bump: `${THREE_GLOBE_CDN}/earth-topology.png`,
    clouds: `${THREE_GLOBE_CDN}/earth-clouds.png`,
  },
  medium: {
    day: `${THREE_GLOBE_CDN}/earth-blue-marble.jpg`,
    night: `${THREE_GLOBE_CDN}/earth-night.jpg`,
    bump: `${THREE_GLOBE_CDN}/earth-topology.png`,
    clouds: `${THREE_GLOBE_CDN}/earth-clouds.png`,
  },
} as const;

// Default to ultra quality (best balance tested against runtime performance)
export const DEFAULT_TEXTURE_QUALITY: keyof typeof EARTH_TEXTURE_SOURCES = 'ultra';
