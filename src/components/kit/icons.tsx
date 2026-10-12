import type { ReactNode } from 'react';
import clsx from 'clsx';

export interface IconProps {
  className?: string;
}

interface IconBaseProps extends IconProps {
  children: ReactNode;
}

// Rounded 2px strokes match the chunky toy look. The default size only applies when
// no className is given, because Tailwind cannot reliably let h-5 lose to a later h-4.
function IconBase({ className, children }: IconBaseProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={clsx('shrink-0', className ?? 'h-5 w-5')}
    >
      {children}
    </svg>
  );
}

export function IconSatellite({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <g transform="rotate(-35 12 12)">
        <rect x="8.5" y="7.5" width="7" height="9.5" rx="2" />
        <rect x="2.5" y="9.5" width="4.5" height="5.5" rx="1" />
        <rect x="17" y="9.5" width="4.5" height="5.5" rx="1" />
        <path d="M7 12.2h1.5M15.5 12.2H17M12 7.5V5" />
        <circle cx="12" cy="3.8" r="0.9" fill="currentColor" />
      </g>
    </IconBase>
  );
}

export function IconGlobe({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c3.2 3 3.2 15 0 18-3.2-3-3.2-15 0-18z" />
    </IconBase>
  );
}

export function IconEye({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </IconBase>
  );
}

export function IconClock({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </IconBase>
  );
}

export function IconPlay({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M8 5.8v12.4a1 1 0 0 0 1.5.9l9.9-6.2a1 1 0 0 0 0-1.8L9.5 4.9A1 1 0 0 0 8 5.8z" fill="currentColor" />
    </IconBase>
  );
}

export function IconPause({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
    </IconBase>
  );
}

export function IconForward({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M4 7v10l7-5z" fill="currentColor" />
      <path d="M13 7v10l7-5z" fill="currentColor" />
    </IconBase>
  );
}

export function IconSun({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </IconBase>
  );
}

export function IconMoon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M20 14.6A8.5 8.5 0 1 1 9.4 4a7 7 0 0 0 10.6 10.6z" />
    </IconBase>
  );
}

export function IconMapPin({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M12 21.5s-7-5.6-7-11.5a7 7 0 0 1 14 0c0 5.9-7 11.5-7 11.5z" />
      <circle cx="12" cy="10" r="2.5" />
    </IconBase>
  );
}

export function IconUsers({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M17.2 14c2.7.1 4.3 2 4.3 5" />
    </IconBase>
  );
}

export function IconOrbit({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-30 12 12)" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="20.7" cy="7" r="1.3" fill="currentColor" />
    </IconBase>
  );
}

export function IconCrosshair({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5" />
    </IconBase>
  );
}

export function IconLayers({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M12 3 3 8l9 5 9-5-9-5z" />
      <path d="M3 12.5l9 5 9-5" />
      <path d="M3 16.5l9 5 9-5" />
    </IconBase>
  );
}

export function IconLocate({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M3.5 11 20.5 3.5 13 20.5l-2-7.5-7.5-2z" />
    </IconBase>
  );
}

export function IconSparkle({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M11 4c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z" />
      <path d="M19 3v3M17.5 4.5h3" />
    </IconBase>
  );
}

export function IconRefresh({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </IconBase>
  );
}

export function IconSearch({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20.5 20.5 16 16" />
    </IconBase>
  );
}

export function IconCheck({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </IconBase>
  );
}
