/**
 * Pass prediction utilities.
 * Computes visible passes for an observer location using SGP4 propagation.
 * Detects AOS (Acquisition of Signal), peak elevation, and LOS (Loss of Signal).
 */

import * as sat from 'satellite.js';
import type { GeodeticPosition } from './propagation';
import { parseTle } from './propagation';

export interface ObserverLocation {
  latitude: number; // degrees
  longitude: number; // degrees
  altitudeKm?: number; // kilometres (default: 0)
}

export interface PassEvent {
  type: 'aos' | 'peak' | 'los';
  time: Date;
  elevation: number; // degrees
  azimuth: number; // degrees
  distanceKm: number; // kilometres
}

export interface Pass {
  aos: PassEvent;
  peak: PassEvent;
  los: PassEvent;
  durationMinutes: number;
  maxElevation: number; // degrees
  likelyVisible: boolean; // Based on sun/satellite illumination
}

const EARTH_RADIUS_KM = 6371;
const HORIZON_ELEVATION_DEG = 0; // Horizon crossing threshold

/**
 * Computes elevation and azimuth of satellite from observer location.
 */
function computeTopocentric(
  satellitePos: GeodeticPosition,
  observer: ObserverLocation
): { elevation: number; azimuth: number; distanceKm: number } {
  const observerAlt = observer.altitudeKm ?? 0;

  // Convert to radians
  const obsLatRad = (observer.latitude * Math.PI) / 180;
  const obsLonRad = (observer.longitude * Math.PI) / 180;
  const satLatRad = (satellitePos.latitude * Math.PI) / 180;
  const satLonRad = (satellitePos.longitude * Math.PI) / 180;

  // Observer position in ECEF (Earth-Centred, Earth-Fixed)
  const obsRadius = EARTH_RADIUS_KM + observerAlt;
  const obsX = obsRadius * Math.cos(obsLatRad) * Math.cos(obsLonRad);
  const obsY = obsRadius * Math.cos(obsLatRad) * Math.sin(obsLonRad);
  const obsZ = obsRadius * Math.sin(obsLatRad);

  // Satellite position in ECEF
  const satRadius = EARTH_RADIUS_KM + satellitePos.altitudeKm;
  const satX = satRadius * Math.cos(satLatRad) * Math.cos(satLonRad);
  const satY = satRadius * Math.cos(satLatRad) * Math.sin(satLonRad);
  const satZ = satRadius * Math.sin(satLatRad);

  // Vector from observer to satellite
  const dx = satX - obsX;
  const dy = satY - obsY;
  const dz = satZ - obsZ;

  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Convert to topocentric (local horizon frame)
  const sinLat = Math.sin(obsLatRad);
  const cosLat = Math.cos(obsLatRad);
  const sinLon = Math.sin(obsLonRad);
  const cosLon = Math.cos(obsLonRad);

  const north = -sinLat * cosLon * dx - sinLat * sinLon * dy + cosLat * dz;
  const east = -sinLon * dx + cosLon * dy;
  const up = cosLat * cosLon * dx + cosLat * sinLon * dy + sinLat * dz;

  // Elevation (angle above horizon)
  const elevation = Math.asin(up / distance) * (180 / Math.PI);

  // Azimuth (degrees from north, clockwise)
  const azimuth = Math.atan2(east, north) * (180 / Math.PI);
  const azimuthNormalised = azimuth < 0 ? azimuth + 360 : azimuth;

  return {
    elevation,
    azimuth: azimuthNormalised,
    distanceKm: distance,
  };
}

/**
 * Estimates if satellite is sunlit at given time.
 * Simplified: assumes satellite is visible if it's in daylight.
 */
function isSatelliteSunlit(date: Date, position: GeodeticPosition): boolean {
  // Simplified check: if satellite is over daylit hemisphere
  // In practice, we'd compute sun position and check if satellite is illuminated
  // For now, use a rough approximation based on time of day at satellite location
  const utcHours = date.getUTCHours();
  const lonHours = (position.longitude / 15) % 24;
  const localSolarTime = (utcHours + lonHours + 24) % 24;

  // Roughly: daylight if local solar time is between 6 and 18
  return localSolarTime >= 6 && localSolarTime < 18;
}

/**
 * Estimates if sun is below horizon at observer location.
 */
function isSunBelowHorizon(
  date: Date,
  observer: ObserverLocation
): boolean {
  // Simplified: check if local time is roughly nighttime
  // In practice, compute actual sun elevation
  const utcHours = date.getUTCHours();
  const lonHours = (observer.longitude / 15) % 24;
  const localSolarTime = (utcHours + lonHours + 24) % 24;

  // Roughly: night if local solar time is before 6 or after 18
  return localSolarTime < 6 || localSolarTime >= 18;
}

/**
 * Computes next N visible passes for an observer location.
 * Uses SGP4 propagation to sweep forward in time.
 */
export function computePasses(
  tle: string,
  observer: ObserverLocation,
  windowHours: number = 48,
  maxPasses: number = 10
): Pass[] {
  const passes: Pass[] = [];
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + windowHours * 60 * 60 * 1000);
  const stepSeconds = 10; // Sample every 10 seconds

  let currentTime = new Date(startTime);
  let inPass = false;
  let currentPass: PassEvent[] = [];
  let maxElevation = -90;
  let peakEvent: PassEvent | null = null;

  const satrec = parseTle(tle);

  while (currentTime <= endTime && passes.length < maxPasses) {
    try {
      const gmst = sat.gstime(currentTime);
      const positionAndVelocity = sat.propagate(satrec, currentTime);

      if (!positionAndVelocity.position) {
        currentTime = new Date(currentTime.getTime() + stepSeconds * 1000);
        continue;
      }

      const positionEci = positionAndVelocity.position;
      const geodetic = sat.eciToGeodetic(positionEci, gmst);
      const satellitePos: GeodeticPosition = {
        latitude: sat.degreesLat(geodetic.latitude),
        longitude: sat.degreesLong(geodetic.longitude),
        altitudeKm: geodetic.height,
      };

      const topo = computeTopocentric(satellitePos, observer);

      // Detect AOS (Acquisition of Signal) - crossing above horizon
      if (!inPass && topo.elevation >= HORIZON_ELEVATION_DEG) {
        inPass = true;
        currentPass = [
          {
            type: 'aos',
            time: new Date(currentTime),
            elevation: topo.elevation,
            azimuth: topo.azimuth,
            distanceKm: topo.distanceKm,
          },
        ];
        maxElevation = topo.elevation;
        peakEvent = currentPass[0];
      }

      // Track peak elevation
      if (inPass) {
        if (topo.elevation > maxElevation) {
          maxElevation = topo.elevation;
          peakEvent = {
            type: 'peak',
            time: new Date(currentTime),
            elevation: topo.elevation,
            azimuth: topo.azimuth,
            distanceKm: topo.distanceKm,
          };
        }

        // Detect LOS (Loss of Signal) - crossing below horizon
        if (topo.elevation < HORIZON_ELEVATION_DEG) {
          inPass = false;
          if (peakEvent && currentPass.length > 0) {
            const aos = currentPass[0];
            const los: PassEvent = {
              type: 'los',
              time: new Date(currentTime),
              elevation: topo.elevation,
              azimuth: topo.azimuth,
              distanceKm: topo.distanceKm,
            };

            const durationMinutes =
              (los.time.getTime() - aos.time.getTime()) / (60 * 1000);

            // Check visibility conditions
            const sunlit = isSatelliteSunlit(peakEvent.time, satellitePos);
            const sunBelow = isSunBelowHorizon(peakEvent.time, observer);
            const likelyVisible = sunlit && sunBelow && maxElevation > 10;

            passes.push({
              aos,
              peak: peakEvent,
              los,
              durationMinutes,
              maxElevation,
              likelyVisible,
            });
          }

          currentPass = [];
          maxElevation = -90;
          peakEvent = null;
        }
      }

      currentTime = new Date(currentTime.getTime() + stepSeconds * 1000);
    } catch (error) {
      // Skip invalid propagations
      console.warn(`Pass computation error at ${currentTime.toISOString()}:`, error);
      currentTime = new Date(currentTime.getTime() + stepSeconds * 1000);
    }
  }

  return passes;
}
