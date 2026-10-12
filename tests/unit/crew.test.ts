import { describe, expect, it } from 'vitest';

import { THUMBNAIL_WIDTHS, daysAboard, normaliseCrew, thumbnailUrl } from '@/lib/api/crew';

const FULL_PERSON = {
  id: 4,
  name: 'Pyotr Dubrov',
  country: 'Russia',
  flag_code: 'ru',
  agency: 'Roscosmos',
  position: 'Commander',
  spacecraft: 'Soyuz MS-29',
  launched: 1784040463,
  iss: true,
  days_in_space: 355,
  url: 'https://en.wikipedia.org/wiki/Pyotr_Dubrov',
  image: 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Pyotr_Dubrov_in_2021.jpg',
  instagram: '',
  twitter: '',
  facebook: '',
};

const TIANGONG_PERSON = { ...FULL_PERSON, id: 1, name: 'Zhu Yangzhu', iss: false };

const FEED = {
  number: 10,
  iss_expedition: 75,
  expedition_patch:
    'https://upload.wikimedia.org/wikipedia/commons/3/3d/ISS_Expedition_75_Patch.png',
  expedition_url: 'https://en.wikipedia.org/wiki/Expedition_75',
  people: [TIANGONG_PERSON, FULL_PERSON],
};

describe('normaliseCrew', () => {
  it('keeps only people aboard the ISS', () => {
    const crew = normaliseCrew(FEED);
    expect(crew.people.map((person) => person.name)).toEqual(['Pyotr Dubrov']);
  });

  it('maps the expedition fields and a full crew member', () => {
    const crew = normaliseCrew(FEED);
    expect(crew.expedition).toBe(75);
    expect(crew.expeditionUrl).toBe('https://en.wikipedia.org/wiki/Expedition_75');
    expect(crew.patchUrl).toContain('ISS_Expedition_75_Patch.png');
    expect(crew.people[0]).toEqual({
      name: 'Pyotr Dubrov',
      country: 'Russia',
      flagCode: 'ru',
      agency: 'Roscosmos',
      position: 'Commander',
      spacecraft: 'Soyuz MS-29',
      daysInSpace: 355,
      launchedAt: new Date(1784040463 * 1000),
      url: 'https://en.wikipedia.org/wiki/Pyotr_Dubrov',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Pyotr_Dubrov_in_2021.jpg',
    });
  });

  it('handles missing optional fields', () => {
    const crew = normaliseCrew({ people: [{ name: 'Sparse Person', iss: true }] });
    expect(crew).toEqual({
      expedition: null,
      expeditionUrl: null,
      patchUrl: null,
      people: [
        {
          name: 'Sparse Person',
          country: 'Unknown',
          flagCode: null,
          agency: 'Unknown',
          position: 'Crew member',
          spacecraft: 'Unknown',
          daysInSpace: null,
          launchedAt: null,
          url: null,
          imageUrl: null,
        },
      ],
    });
  });

  it('treats empty strings and nulls as missing', () => {
    const person = {
      ...FULL_PERSON,
      flag_code: '',
      url: '  ',
      image: null,
      launched: null,
      days_in_space: null,
    };
    const [member] = normaliseCrew({ ...FEED, expedition_patch: '', people: [person] }).people;
    expect(member).toMatchObject({
      flagCode: null,
      url: null,
      imageUrl: null,
      launchedAt: null,
      daysInSpace: null,
    });
  });

  it('drops links that are not http(s)', () => {
    const person = { ...FULL_PERSON, url: 'javascript:alert(1)', image: 'data:text/html,hi' };
    const crew = normaliseCrew({ ...FEED, expedition_url: 'not a url', people: [person] });
    expect(crew.people[0]).toMatchObject({ url: null, imageUrl: null });
    expect(crew.expeditionUrl).toBeNull();
  });

  it('returns an empty list when nobody is aboard', () => {
    expect(normaliseCrew({ ...FEED, people: [TIANGONG_PERSON] }).people).toEqual([]);
  });

  it('ignores malformed people who are not on the ISS', () => {
    const crew = normaliseCrew({ ...FEED, people: [{ iss: false }, 'junk', null, FULL_PERSON] });
    expect(crew.people).toHaveLength(1);
  });

  it('reports the index of an ISS crew member without a name', () => {
    expect(() => normaliseCrew({ ...FEED, people: [FULL_PERSON, { iss: true }] })).toThrow(
      /people\[1\].*name/,
    );
  });

  it('rejects payloads without a people array', () => {
    expect(() => normaliseCrew({ iss_expedition: 75 })).toThrow(/Invalid crew payload: people/);
    expect(() => normaliseCrew(null)).toThrow(/Invalid crew payload/);
  });
});

describe('daysAboard', () => {
  const launchedAt = new Date(1784040463 * 1000);
  const DAY = 86_400_000;

  it('counts whole days since the current launch, not the career total from the feed', () => {
    const crew = normaliseCrew(FEED);
    const [dubrov] = crew.people;
    expect(dubrov.daysInSpace).toBe(355);
    expect(daysAboard(dubrov.launchedAt, launchedAt.getTime() + 89.9 * DAY)).toBe(89);
    expect(daysAboard(dubrov.launchedAt, launchedAt.getTime() + 90 * DAY)).toBe(90);
  });

  it('reads 0 on launch day, even for someone with earlier flights', () => {
    expect(daysAboard(launchedAt, launchedAt.getTime() + 3_600_000)).toBe(0);
  });

  it('never goes negative when the device clock is behind the launch time', () => {
    expect(daysAboard(launchedAt, launchedAt.getTime() - 5 * DAY)).toBe(0);
  });

  it('is null without a launch time so the caller can fall back to the feed value', () => {
    expect(daysAboard(null, Date.now())).toBeNull();
  });
});

describe('thumbnailUrl', () => {
  const ORIGINAL = 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Pyotr_Dubrov_in_2021.jpg';

  it('points a Wikimedia original at the scaled copy of the same file', () => {
    expect(thumbnailUrl(ORIGINAL, 120)).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Pyotr_Dubrov_in_2021.jpg/120px-Pyotr_Dubrov_in_2021.jpg',
    );
  });

  it('snaps to a width Wikimedia serves, since it rejects any other with HTTP 400', () => {
    const widthOf = (requested: number): string | undefined =>
      /\/(\d+)px-/.exec(thumbnailUrl(ORIGINAL, requested))?.[1];
    expect(widthOf(96)).toBe('120');
    expect(widthOf(112)).toBe('120');
    expect(widthOf(120)).toBe('120');
    expect(widthOf(121)).toBe('250');
    expect(widthOf(1)).toBe('20');
    expect(widthOf(99_999)).toBe(String(THUMBNAIL_WIDTHS[THUMBNAIL_WIDTHS.length - 1]));
  });

  it('keeps percent-encoded file names as they are', () => {
    expect(
      thumbnailUrl('https://upload.wikimedia.org/wikipedia/commons/6/68/Zhang_Zhiyuan_%2820260523%29.jpg', 120),
    ).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Zhang_Zhiyuan_%2820260523%29.jpg/120px-Zhang_Zhiyuan_%2820260523%29.jpg',
    );
  });

  it('scales the expedition patch', () => {
    expect(
      thumbnailUrl('https://upload.wikimedia.org/wikipedia/commons/3/3d/ISS_Expedition_75_Patch.png', 120),
    ).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/ISS_Expedition_75_Patch.png/120px-ISS_Expedition_75_Patch.png',
    );
  });

  it('asks for a PNG rendering of an SVG', () => {
    expect(thumbnailUrl('https://upload.wikimedia.org/wikipedia/commons/a/ab/Logo.svg', 112)).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Logo.svg/120px-Logo.svg.png',
    );
  });

  it('leaves other hosts, existing thumbnails, odd formats and bad input unchanged', () => {
    const other = 'https://example.com/wikipedia/commons/d/d9/Photo.jpg';
    const thumb = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Photo.jpg/120px-Photo.jpg';
    const tiff = 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Scan.tif';
    expect(thumbnailUrl(other, 96)).toBe(other);
    expect(thumbnailUrl(thumb, 96)).toBe(thumb);
    expect(thumbnailUrl(tiff, 96)).toBe(tiff);
    expect(thumbnailUrl('not a url', 96)).toBe('not a url');
    expect(thumbnailUrl(ORIGINAL, 0)).toBe(ORIGINAL);
  });
});
