import { useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import clsx from 'clsx';
import { nextRadioIndex } from './radio-nav';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * Radio group with a roving tabindex: Tab enters on the selected option, arrow keys move
 * and select (wrapping), Home/End jump to the ends.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  // With no matching value the group must still be reachable by keyboard.
  const tabbableIndex = selectedIndex === -1 ? 0 : selectedIndex;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = nextRadioIndex(event.key, index, options.length);
    if (target === null) return;
    event.preventDefault();
    const next = options[target];
    if (!next) return;
    onChange(next.value);
    itemRefs.current[target]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={clsx('toy-seg', className)}>
      {options.map((option, index) => {
        const checked = index === selectedIndex;
        return (
          <button
            key={option.value}
            ref={(element) => {
              itemRefs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={index === tabbableIndex ? 0 : -1}
            className="toy-seg-item"
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {option.icon ? <span aria-hidden="true">{option.icon}</span> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
