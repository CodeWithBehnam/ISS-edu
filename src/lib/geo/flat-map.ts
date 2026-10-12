import type { CountryShape } from '@/lib/geo/regions';
import type { GeoPoint } from '@/lib/orbit/types';

export const MAP_WIDTH = 360;
export const MAP_HEIGHT = 180;

const DEG = Math.PI / 180;
const NIGHT_LONGITUDE_STEP = 3;

export type MapPoint = readonly [number, number];
type LonLat = readonly [number, number];

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Equirectangular: one degree is one SVG unit, with (-180, 90) at the top-left corner. */
export function projectPoint(point: GeoPoint): MapPoint {
  return [point.longitude + 180, 90 - point.latitude];
}

const pathPoint = ([x, y]: MapPoint, index: number): string =>
  `${index === 0 ? 'M' : 'L'}${round1(x)} ${round1(y)}`;

/** Starts a new segment wherever the track wraps round the map edge, so no line streaks across it. */
export function splitAtAntimeridian(points: readonly GeoPoint[]): GeoPoint[][] {
  return points.reduce<GeoPoint[][]>((segments, point, index) => {
    const previous = points[index - 1];
    if (previous === undefined || Math.abs(point.longitude - previous.longitude) > 180) {
      segments.push([point]);
    } else {
      segments[segments.length - 1].push(point);
    }
    return segments;
  }, []);
}

export function trackPath(points: readonly GeoPoint[]): string {
  return splitAtAntimeridian(points)
    .filter((segment) => segment.length > 1)
    .map((segment) => segment.map((point, index) => pathPoint(projectPoint(point), index)).join(''))
    .join('');
}

function ringPath(ring: readonly LonLat[]): string {
  const points = ring.map(([longitude, latitude], index) =>
    pathPoint(projectPoint({ latitude, longitude }), index),
  );
  return `${points.join('')}Z`;
}

/** One compound path for every country; the even-odd fill rule cuts holes such as Lesotho. */
export function countriesPath(countries: readonly CountryShape[]): string {
  return countries.flatMap((country) => country.polygons.flatMap((rings) => rings.map(ringPath))).join('');
}

/**
 * Night-side polygon as map points. The terminator is where the Sun sits on the horizon:
 * tan(lat) = -cos(lon - subsolarLon) / tan(declination). The night lies on the winter-pole
 * side of that curve, so the polygon closes along that pole's edge.
 */
export function nightPolygon(sun: GeoPoint): MapPoint[] {
  // At an exact equinox the tangent is zero; nudge it so the curve stays finite.
  const declination = Math.abs(sun.latitude) < 0.01 ? 0.01 : sun.latitude;
  const tanDeclination = Math.tan(declination * DEG);
  const poleLatitude = declination > 0 ? -90 : 90;
  const steps = Array.from(
    { length: 360 / NIGHT_LONGITUDE_STEP + 1 },
    (_, index) => -180 + index * NIGHT_LONGITUDE_STEP,
  );
  const curve = steps.map((longitude): MapPoint => {
    const latitude = Math.atan(-Math.cos((longitude - sun.longitude) * DEG) / tanDeclination) / DEG;
    return projectPoint({ latitude, longitude });
  });
  return [
    projectPoint({ latitude: poleLatitude, longitude: -180 }),
    ...curve,
    projectPoint({ latitude: poleLatitude, longitude: 180 }),
  ];
}

/** Value for an SVG `points` attribute. */
export function pointsAttribute(points: readonly MapPoint[]): string {
  return points.map(([x, y]) => `${round1(x)},${round1(y)}`).join(' ');
}
