export interface City {
  name: string;
  country: string;
  /** Degrees, positive north. */
  latitude: number;
  /** Degrees, positive east. */
  longitude: number;
}

const city = (name: string, country: string, latitude: number, longitude: number): City => ({
  name,
  country,
  latitude,
  longitude,
});

/** Large, widely known cities on every inhabited continent, for picking an observer without GPS. */
export const CITIES: readonly City[] = [
  // United Kingdom and Ireland
  city('London', 'United Kingdom', 51.51, -0.13),
  city('Manchester', 'United Kingdom', 53.48, -2.24),
  city('Edinburgh', 'United Kingdom', 55.95, -3.19),
  city('Cardiff', 'United Kingdom', 51.48, -3.18),
  city('Belfast', 'United Kingdom', 54.6, -5.93),
  city('Birmingham', 'United Kingdom', 52.49, -1.89),
  city('Glasgow', 'United Kingdom', 55.86, -4.25),
  city('Dublin', 'Ireland', 53.35, -6.26),
  // Rest of Europe
  city('Paris', 'France', 48.86, 2.35),
  city('Berlin', 'Germany', 52.52, 13.41),
  city('Madrid', 'Spain', 40.42, -3.7),
  city('Barcelona', 'Spain', 41.39, 2.17),
  city('Lisbon', 'Portugal', 38.72, -9.14),
  city('Rome', 'Italy', 41.9, 12.5),
  city('Milan', 'Italy', 45.46, 9.19),
  city('Amsterdam', 'Netherlands', 52.37, 4.9),
  city('Brussels', 'Belgium', 50.85, 4.35),
  city('Vienna', 'Austria', 48.21, 16.37),
  city('Zürich', 'Switzerland', 47.38, 8.54),
  city('Stockholm', 'Sweden', 59.33, 18.07),
  city('Oslo', 'Norway', 59.91, 10.75),
  city('Copenhagen', 'Denmark', 55.68, 12.57),
  city('Helsinki', 'Finland', 60.17, 24.94),
  city('Reykjavík', 'Iceland', 64.15, -21.94),
  city('Warsaw', 'Poland', 52.23, 21.01),
  city('Prague', 'Czechia', 50.08, 14.44),
  city('Budapest', 'Hungary', 47.5, 19.04),
  city('Athens', 'Greece', 37.98, 23.73),
  city('Istanbul', 'Turkey', 41.01, 28.98),
  city('Moscow', 'Russia', 55.76, 37.62),
  city('Kyiv', 'Ukraine', 50.45, 30.52),
  // Middle East
  city('Tehran', 'Iran', 35.69, 51.39),
  city('Dubai', 'United Arab Emirates', 25.2, 55.27),
  city('Riyadh', 'Saudi Arabia', 24.71, 46.68),
  city('Tel Aviv', 'Israel', 32.09, 34.78),
  city('Doha', 'Qatar', 25.29, 51.53),
  // Africa
  city('Cairo', 'Egypt', 30.04, 31.24),
  city('Lagos', 'Nigeria', 6.52, 3.38),
  city('Nairobi', 'Kenya', -1.29, 36.82),
  city('Johannesburg', 'South Africa', -26.2, 28.05),
  city('Cape Town', 'South Africa', -33.92, 18.42),
  city('Casablanca', 'Morocco', 33.57, -7.59),
  city('Addis Ababa', 'Ethiopia', 9.03, 38.74),
  city('Accra', 'Ghana', 5.6, -0.19),
  city('Dar es Salaam', 'Tanzania', -6.79, 39.21),
  city('Algiers', 'Algeria', 36.75, 3.06),
  // Asia
  city('Tokyo', 'Japan', 35.68, 139.69),
  city('Osaka', 'Japan', 34.69, 135.5),
  city('Beijing', 'China', 39.9, 116.41),
  city('Shanghai', 'China', 31.23, 121.47),
  city('Hong Kong', 'China', 22.32, 114.17),
  city('Seoul', 'South Korea', 37.57, 126.98),
  city('Taipei', 'Taiwan', 25.03, 121.57),
  city('Singapore', 'Singapore', 1.35, 103.82),
  city('Bangkok', 'Thailand', 13.76, 100.5),
  city('Jakarta', 'Indonesia', -6.21, 106.85),
  city('Manila', 'Philippines', 14.6, 120.98),
  city('Hanoi', 'Vietnam', 21.03, 105.85),
  city('Kuala Lumpur', 'Malaysia', 3.14, 101.69),
  city('Mumbai', 'India', 19.08, 72.88),
  city('Delhi', 'India', 28.61, 77.21),
  city('Bengaluru', 'India', 12.97, 77.59),
  city('Kolkata', 'India', 22.57, 88.36),
  city('Karachi', 'Pakistan', 24.86, 67.01),
  city('Dhaka', 'Bangladesh', 23.81, 90.41),
  city('Kathmandu', 'Nepal', 27.72, 85.32),
  city('Colombo', 'Sri Lanka', 6.93, 79.86),
  city('Almaty', 'Kazakhstan', 43.24, 76.89),
  // North America
  city('New York', 'United States', 40.71, -74.01),
  city('Los Angeles', 'United States', 34.05, -118.24),
  city('Chicago', 'United States', 41.88, -87.63),
  city('Houston', 'United States', 29.76, -95.37),
  city('Miami', 'United States', 25.76, -80.19),
  city('San Francisco', 'United States', 37.77, -122.42),
  city('Seattle', 'United States', 47.61, -122.33),
  city('Anchorage', 'United States', 61.22, -149.9),
  city('Toronto', 'Canada', 43.65, -79.38),
  city('Montréal', 'Canada', 45.5, -73.57),
  city('Vancouver', 'Canada', 49.28, -123.12),
  city('Mexico City', 'Mexico', 19.43, -99.13),
  // South America
  city('São Paulo', 'Brazil', -23.55, -46.63),
  city('Rio de Janeiro', 'Brazil', -22.91, -43.17),
  city('Buenos Aires', 'Argentina', -34.6, -58.38),
  city('Santiago', 'Chile', -33.45, -70.67),
  city('Lima', 'Peru', -12.05, -77.04),
  city('Bogotá', 'Colombia', 4.71, -74.07),
  city('Quito', 'Ecuador', -0.18, -78.47),
  // Oceania
  city('Sydney', 'Australia', -33.87, 151.21),
  city('Melbourne', 'Australia', -37.81, 144.96),
  city('Brisbane', 'Australia', -27.47, 153.03),
  city('Perth', 'Australia', -31.95, 115.86),
  city('Auckland', 'New Zealand', -36.85, 174.76),
  city('Wellington', 'New Zealand', -41.29, 174.78),
  city('Honolulu', 'United States', 21.31, -157.86),
];

/** Lower-cases and strips accents, so "sao" finds "São Paulo" and "zurich" finds "Zürich". */
function normaliseSearchText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

interface IndexedCity {
  city: City;
  name: string;
  country: string;
}

const INDEX: readonly IndexedCity[] = CITIES.map((entry) => ({
  city: entry,
  name: normaliseSearchText(entry.name),
  country: normaliseSearchText(entry.country),
}));

/** Lower is better: name prefix, then a word in the name, then anywhere in the name, then the country. */
function matchRank({ name, country }: IndexedCity, query: string): number | null {
  if (name.startsWith(query)) return 0;
  if (name.split(/[\s-]+/).some((word) => word.startsWith(query))) return 1;
  if (name.includes(query)) return 2;
  if (country.startsWith(query)) return 3;
  return null;
}

/** Case- and diacritic-insensitive city search; prefix matches come first, then alphabetical. */
export function searchCities(query: string, limit = 8): City[] {
  const needle = normaliseSearchText(query);
  if (needle === '' || limit <= 0) return [];

  return INDEX.flatMap((entry) => {
    const rank = matchRank(entry, needle);
    return rank === null ? [] : [{ entry, rank }];
  })
    .sort((a, b) => a.rank - b.rank || a.entry.name.localeCompare(b.entry.name, 'en'))
    .slice(0, limit)
    .map(({ entry }) => entry.city);
}
