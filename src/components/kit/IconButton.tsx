import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

export type IconButtonVariant = 'default' | 'coral' | 'sky' | 'ghost';
export type IconButtonSize = 'md' | 'sm';

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children' | 'title'> {
  /** Required accessible name; also shown as the native tooltip. */
  label: string;
  children: ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  default: '',
  coral: 'toy-btn-coral',
  sky: 'toy-btn-sky',
  ghost: 'toy-btn-ghost',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, variant = 'default', size = 'md', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={clsx('toy-btn toy-icon-btn', VARIANT_CLASSES[variant], size === 'sm' && 'toy-btn-sm', className)}
      {...rest}
    >
      <span aria-hidden="true" className="grid place-items-center">
        {children}
      </span>
    </button>
  );
});
