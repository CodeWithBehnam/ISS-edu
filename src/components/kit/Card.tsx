import { useId } from 'react';
import type { ReactNode } from 'react';
import clsx from 'clsx';

export type CardTag = 'section' | 'div' | 'aside' | 'article';

export interface CardProps {
  /** Rendered as an h2. Omit it for an unlabelled panel (no heading is emitted). */
  title?: ReactNode;
  icon?: ReactNode;
  /** Right-aligned header slot, e.g. a small IconButton. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Defaults to `section` when a title is given, otherwise `div`. */
  as?: CardTag;
  id?: string;
}

export function Card({ title, icon, action, children, className, as, id }: CardProps) {
  const headingId = useId();
  const hasTitle = Boolean(title);
  const hasHeader = hasTitle || Boolean(icon) || Boolean(action);
  const Tag = as ?? (hasTitle ? 'section' : 'div');

  return (
    <Tag
      id={id}
      className={clsx('toy-card p-4 sm:p-5', className)}
      aria-labelledby={hasTitle ? headingId : undefined}
    >
      {hasHeader ? (
        <header className="mb-3 flex items-center gap-2.5">
          {icon ? (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-peach text-ink" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          {hasTitle ? (
            <h2 id={headingId} className="min-w-0 flex-1 truncate font-display text-lg font-semibold leading-tight">
              {title}
            </h2>
          ) : (
            <span className="flex-1" />
          )}
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      {children}
    </Tag>
  );
}
