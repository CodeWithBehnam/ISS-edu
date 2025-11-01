/**
 * SGP4/SDP4 orbit propagation utilities using satellite.js.
 * Converts TLE data to geodetic coordinates (lat/lon/alt).
 */

import * as sat from 'satellite.js';

export interface GeodeticPosition {
  latitude: number; // degrees
  longitude: number; // degrees
  altitudeKm: number; // kilometres
}

export interface EciPosition {
  x: number; // kilometres
  y: number;
  z: number;
}

/**
 * Parses TLE string and creates satellite record for propagation.
 */
export function parseTle(tle: string): sat.SatRec {
  const lines = tle.trim().split('\n').filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('Invalid TLE: expected 2 lines');
  }

  const [line1, line2] = lines.slice(-2);
  const satrec = sat.twoline2satrec(line1.trim(), line2.trim());

  if (satrec.error !== 0) {
    throw new Error(`TLE parse error: ${satrec.error}`);
  }

  return satrec;
}

/**
 * Propagates satellite position at a given date/time using SGP4/SDP4.
 * Returns geodetic coordinates (latitude, longitude, altitude).
 */
export function propagateToGeodetic(
  tle: string,
  date: Date
): GeodeticPosition {
  const satrec = parseTle(tle);
  const gmst = sat.gstime(date);

  const positionAndVelocity = sat.propagate(satrec, date);

  if (!positionAndVelocity.position || !positionAndVelocity.velocity) {
    throw new Error('Propagation failed: invalid position/velocity');
  }

  const positionEci = positionAndVelocity.position;
  const geodetic = sat.eciToGeodetic(positionEci, gmst);

  return {
    latitude: sat.degreesLat(geodetic.latitude),
    longitude: sat.degreesLong(geodetic.longitude),
    altitudeKm: geodetic.height,
  };
}

/**
 * Propagates satellite position at a given date/time.
 * Returns ECI coordinates (for vector calculations).
 */
export function propagateToEci(tle: string, date: Date): EciPosition {
  const satrec = parseTle(tle);
  const positionAndVelocity = sat.propagate(satrec, date);

  if (!positionAndVelocity.position) {
    throw new Error('Propagation failed: invalid position');
  }

  const pos = positionAndVelocity.position;
  return {
    x: pos.x,
    y: pos.y,
    z: pos.z,
  };
}

/**
 * Samples orbit track over a time window.
 * Returns array of geodetic positions with timestamps.
 */
export function sampleOrbitTrack(
  tle: string,
  startTime: Date,
  endTime: Date,
  stepSeconds: number = 15
): Array<{ time: Date; position: GeodeticPosition }> {
  const points: Array<{ time: Date; position: GeodeticPosition }> = [];
  const stepMs = stepSeconds * 1000;
  let current = new Date(startTime);

  while (current <= endTime) {
    try {
      const position = propagateToGeodetic(tle, current);
      points.push({ time: new Date(current), position });
    } catch (error) {
      // Skip invalid propagations (e.g., beyond TLE validity)
      console.warn(`Propagation failed at ${current.toISOString()}:`, error);
    }
    current = new Date(current.getTime() + stepMs);
  }

  return points;
}

/**
 * Handles International Date Line (IDL) crossing for ground tracks.
 * Breaks the track into segments to avoid wrapping around the globe.
 */
export function breakTrackAtIdl(
  points: Array<{ time: Date; position: GeodeticPosition }>
): Array<Array<{ time: Date; position: GeodeticPosition }>> {
  if (points.length === 0) return [];

  const segments: Array<Array<{ time: Date; position: GeodeticPosition }>> = [];
  let currentSegment: Array<{ time: Date; position: GeodeticPosition }> = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    // Detect IDL crossing (longitude jumps from ~180 to ~-180 or vice versa)
    const lonDiff = Math.abs(curr.position.longitude - prev.position.longitude);
    if (lonDiff > 180) {
      // Break segment
      segments.push(currentSegment);
      currentSegment = [curr];
    } else {
      currentSegment.push(curr);
    }
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}

