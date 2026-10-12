/** A coordinate pair in [longitude, latitude] order (GeoJSON convention). */
export type LonLat = readonly [number, number];
export type Ring = ReadonlyArray<LonLat>;

/**
 * Even-odd ray casting along +longitude. Works for open or closed rings (the closing edge
 * of a closed ring has zero length and never toggles). Points exactly on an edge may fall
 * either way, which is fine for labelling at 110 m map resolution.
 */
export function pointInRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    // The strict comparison on latitude also guards the division against yi === yj.
    const crosses = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** First ring is the outer boundary, any further rings are holes. */
export function pointInPolygon(lon: number, lat: number, rings: ReadonlyArray<Ring>): boolean {
  const [outer, ...holes] = rings;
  if (!outer || !pointInRing(lon, lat, outer)) return false;
  return !holes.some((hole) => pointInRing(lon, lat, hole));
}
