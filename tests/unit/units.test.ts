import { describe, expect, it } from 'vitest';

import {
  compassPoint,
  formatAltitude,
  formatClock,
  formatCountdown,
  formatDay,
  formatDistance,
  formatDuration,
  formatLatitude,
  formatLongitude,
  formatSpeed,
} from '@/lib/format/units';

describe('formatLatitude and formatLongitude', () => {
  it('adds hemisphere letters and two decimals by default', () => {
    expect(formatLatitude(51.2899)).toBe('51.29° N');
    expect(formatLatitude(-33.8688)).toBe('33.87° S');
    expect(formatLongitude(153.3)).toBe('153.30° E');
    expect(formatLongitude(-0.1278)).toBe('0.13° W');
  });

  it('honours the digits argument', () => {
    expect(formatLatitude(51.2899, 0)).toBe('51° N');
    expect(formatLongitude(-0.1278, 4)).toBe('0.1278° W');
  });

  it('does not show a hemisphere flip for values that round to zero', () => {
    expect(formatLatitude(-0.001)).toBe('0.00° N');
    expect(formatLongitude(-0.001)).toBe('0.00° E');
    expect(formatLatitude(0)).toBe('0.00° N');
  });

  it('wraps longitudes outside [-180, 180)', () => {
    expect(formatLongitude(190)).toBe('170.00° W');
    expect(formatLongitude(-190)).toBe('170.00° E');
    expect(formatLongitude(360)).toBe('0.00° E');
  });

  it('shows a placeholder for non-finite input', () => {
    expect(formatLatitude(Number.NaN)).toBe('n/a');
    expect(formatLongitude(Number.POSITIVE_INFINITY)).toBe('n/a');
  });
});

describe('formatAltitude', () => {
  it('formats kilometres and miles', () => {
    expect(formatAltitude(420, 'metric')).toBe('420 km');
    expect(formatAltitude(420, 'imperial')).toBe('261 mi');
  });

  it('rounds to whole numbers', () => {
    expect(formatAltitude(419.6, 'metric')).toBe('420 km');
  });
});

describe('formatSpeed', () => {
  it('converts km/s to grouped km/h and mph', () => {
    expect(formatSpeed(7.661, 'metric')).toBe('27,580 km/h');
    expect(formatSpeed(7.661, 'imperial')).toBe('17,137 mph');
  });
});

describe('formatDistance', () => {
  it('groups thousands and drops decimals from ten upwards', () => {
    expect(formatDistance(7000, 'metric')).toBe('7,000 km');
    expect(formatDistance(12.4, 'metric')).toBe('12 km');
  });

  it('keeps one decimal for short distances', () => {
    expect(formatDistance(0.84, 'metric')).toBe('0.8 km');
    expect(formatDistance(8, 'imperial')).toBe('5.0 mi');
  });

  it('converts to miles', () => {
    expect(formatDistance(1609.344, 'imperial')).toBe('1,000 mi');
  });
});

describe('compassPoint', () => {
  it('names the 16 winds at their exact bearings', () => {
    const names = [
      'N',
      'NNE',
      'NE',
      'ENE',
      'E',
      'ESE',
      'SE',
      'SSE',
      'S',
      'SSW',
      'SW',
      'WSW',
      'W',
      'WNW',
      'NW',
      'NNW',
    ];
    names.forEach((name, index) => expect(compassPoint(index * 22.5)).toBe(name));
  });

  it('rounds to the nearest wind and wraps', () => {
    expect(compassPoint(11)).toBe('N');
    expect(compassPoint(11.5)).toBe('NNE');
    expect(compassPoint(359)).toBe('N');
    expect(compassPoint(360)).toBe('N');
    expect(compassPoint(-90)).toBe('W');
    expect(compassPoint(450)).toBe('E');
  });
});

describe('formatDuration', () => {
  it('uses seconds, minutes and hours', () => {
    expect(formatDuration(42)).toBe('42 s');
    expect(formatDuration(332)).toBe('5 min 32 s');
    expect(formatDuration(3900)).toBe('1 h 05 min');
  });

  it('pads the smaller unit and handles the boundaries', () => {
    expect(formatDuration(0)).toBe('0 s');
    expect(formatDuration(59.6)).toBe('1 min 00 s');
    expect(formatDuration(305)).toBe('5 min 05 s');
    expect(formatDuration(3600)).toBe('1 h 00 min');
    expect(formatDuration(-5)).toBe('0 s');
  });
});

describe('formatCountdown', () => {
  const second = 1000;
  const minute = 60 * second;
  const hour = 60 * minute;

  it('describes the future', () => {
    expect(formatCountdown(45 * second)).toBe('in 45 s');
    expect(formatCountdown(12 * minute + 20 * second)).toBe('in 12 min');
    expect(formatCountdown(2 * hour + 13 * minute)).toBe('in 2 h 13 min');
    expect(formatCountdown(2 * hour + 5 * minute)).toBe('in 2 h 05 min');
    expect(formatCountdown(26 * hour + 30 * minute)).toBe('in 1 d 2 h');
  });

  it('describes the past', () => {
    expect(formatCountdown(-12 * minute)).toBe('12 min ago');
    expect(formatCountdown(-30 * second)).toBe('30 s ago');
  });

  it('says now for sub-second differences', () => {
    expect(formatCountdown(0)).toBe('now');
    expect(formatCountdown(400)).toBe('now');
    expect(formatCountdown(-400)).toBe('now');
  });
});

describe('formatClock and formatDay', () => {
  const instant = new Date('2026-10-12T14:05:09Z');

  it('formats a 24 hour clock in the requested zone', () => {
    expect(formatClock(instant, 'UTC')).toBe('14:05:09');
    expect(formatClock(instant, 'Asia/Tokyo')).toBe('23:05:09');
  });

  it('never shows 24:00 at midnight', () => {
    expect(formatClock(new Date('2026-10-12T00:00:05Z'), 'UTC')).toBe('00:00:05');
  });

  it('formats the day without punctuation', () => {
    expect(formatDay(instant, 'UTC')).toBe('Mon 12 Oct');
    expect(formatDay(new Date('2026-10-12T23:30:00Z'), 'Asia/Tokyo')).toBe('Tue 13 Oct');
  });

  it('shows a placeholder for an invalid date', () => {
    expect(formatClock(new Date(Number.NaN))).toBe('n/a');
    expect(formatDay(new Date(Number.NaN))).toBe('n/a');
  });
});
