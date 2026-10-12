import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import clsx from 'clsx';

import { IconLocate, IconSearch } from '@/components/kit';
import { searchCities, type City } from '@/lib/geo/cities';
import { useGeolocation } from '@/lib/hooks/useGeolocation';
import { useTrackerStore } from '@/lib/state/tracker-store';

export interface LocationPickerProps {
  /** Called once a place has been chosen, whichever way it was chosen. */
  onSelected?: () => void;
  /** Moves keyboard focus into the city field on mount, for when the user asked to change place. */
  focusOnMount?: boolean;
  className?: string;
}

const MAX_RESULTS = 6;

/**
 * "Use my location" (asks the browser only on click) plus a WAI-ARIA combobox over a built-in
 * list of big cities. DOM focus never leaves the input; the highlighted option is exposed through
 * aria-activedescendant.
 */
export function LocationPicker({ onSelected, focusOnMount = false, className }: LocationPickerProps) {
  const setObserver = useTrackerStore((state) => state.setObserver);
  const { request, status, error } = useGeolocation();

  const baseId = useId();
  const inputId = `${baseId}-city`;
  const listId = `${baseId}-cities`;
  const optionId = (index: number): string => `${baseId}-option-${index}`;

  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const results = useMemo(() => searchCities(query, MAX_RESULTS), [query]);
  const expanded = open && results.length > 0;
  const active = expanded ? Math.min(highlighted, results.length - 1) : -1;

  // The parent may swap callbacks every render; a ref keeps the status effect from re-firing.
  const onSelectedRef = useRef(onSelected);
  useEffect(() => {
    onSelectedRef.current = onSelected;
  });

  useEffect(() => {
    if (focusOnMount) inputRef.current?.focus();
  }, [focusOnMount]);

  useEffect(() => {
    if (status === 'granted') onSelectedRef.current?.();
  }, [status]);

  const choose = (city: City): void => {
    setObserver({
      latitude: city.latitude,
      longitude: city.longitude,
      label: `${city.name}, ${city.country}`,
      source: 'city',
    });
    setQuery('');
    setOpen(false);
    setHighlighted(0);
    onSelectedRef.current?.();
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setQuery(event.target.value);
    setOpen(true);
    setHighlighted(0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    const count = results.length;
    switch (event.key) {
      case 'ArrowDown':
        if (count === 0) return;
        event.preventDefault();
        setOpen(true);
        setHighlighted(expanded ? (active + 1) % count : 0);
        return;
      case 'ArrowUp':
        if (count === 0) return;
        event.preventDefault();
        setOpen(true);
        setHighlighted(expanded ? (active - 1 + count) % count : count - 1);
        return;
      case 'Enter': {
        const city = active >= 0 ? results[active] : undefined;
        if (!city) return;
        event.preventDefault();
        choose(city);
        return;
      }
      case 'Escape':
        // The first press closes the list; a second press clears what was typed.
        if (expanded) {
          event.preventDefault();
          setOpen(false);
        } else if (query !== '') {
          event.preventDefault();
          setQuery('');
        }
        return;
      default:
    }
  };

  const hasQuery = query.trim() !== '';
  const announcement = !hasQuery
    ? ''
    : results.length === 0
      ? 'No places match.'
      : `${results.length} ${results.length === 1 ? 'place' : 'places'} found. Use the up and down arrow keys to choose.`;
  const locationMessage = status === 'pending' ? 'Finding your location…' : error;

  return (
    <div className={className}>
      <button
        type="button"
        className="toy-btn toy-btn-coral w-full"
        onClick={request}
        disabled={status === 'pending'}
        aria-busy={status === 'pending'}
      >
        <IconLocate className="h-4 w-4" />
        Use my location
      </button>
      <p
        role="status"
        className={clsx(
          'm-0 text-xs font-semibold text-ink',
          locationMessage ? 'mt-2.5 rounded-xl border-2 border-blush bg-peach/50 px-3 py-2' : 'sr-only',
        )}
      >
        {locationMessage}
      </p>
      <p className="m-0 mt-2 text-xs font-semibold text-ink-soft">
        We never send your location anywhere. It is only used to work out the sky above you.
      </p>

      <div className="my-3 flex items-center gap-3 text-xs font-bold text-ink-soft">
        <span className="h-0.5 flex-1 rounded bg-line" aria-hidden="true" />
        <label htmlFor={inputId}>or choose a city</label>
        <span className="h-0.5 flex-1 rounded bg-line" aria-hidden="true" />
      </div>

      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
          placeholder="Try London, Tokyo or Lagos"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className="w-full rounded-full border-2 border-ink-soft/80 bg-paper py-2.5 pl-10 pr-4 text-base font-semibold text-ink placeholder:text-ink-soft sm:text-sm"
        />
      </div>

      <ul
        id={listId}
        role="listbox"
        aria-label="Matching cities"
        hidden={!expanded}
        className="m-0 mt-2 list-none space-y-1 rounded-2xl border-2 border-line bg-paper p-1.5"
      >
        {results.map((city, index) => (
          <li
            key={`${city.name}-${city.country}`}
            id={optionId(index)}
            role="option"
            aria-selected={index === active}
            // Selecting on mouse down keeps focus in the input, so the blur handler never closes the list first.
            onMouseDown={(event) => {
              event.preventDefault();
              choose(city);
            }}
            onMouseMove={() => {
              if (index !== active) setHighlighted(index);
            }}
            className={clsx(
              'flex cursor-pointer items-baseline justify-between gap-3 rounded-xl px-3 py-2 text-sm',
              index === active ? 'bg-butter' : 'bg-transparent',
            )}
          >
            <span className="font-bold text-ink">{city.name}</span>
            <span className="sr-only">, </span>
            <span className="truncate text-xs font-semibold text-ink-soft">{city.country}</span>
          </li>
        ))}
      </ul>

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
      {hasQuery && results.length === 0 ? (
        <p className="m-0 mt-2 text-xs font-semibold text-ink-soft" aria-hidden="true">
          No match yet. Try a bigger city nearby.
        </p>
      ) : null}
    </div>
  );
}
