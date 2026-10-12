import { Component, type ErrorInfo, type ReactNode } from 'react';

import { clientLog } from '@/lib/observability/client-log';

interface ModelErrorBoundaryProps {
  /** Rendered instead of the children once anything below throws (a failed glTF load, say). */
  fallback: ReactNode;
  /** Names the failing part in the log. */
  name?: string;
  /** Called once after the failure, so the page can adjust the controls that depended on the part. */
  onFail?: () => void;
  children?: ReactNode;
}

interface ModelErrorBoundaryState {
  failed: boolean;
}

/**
 * Keeps one broken asset from taking the whole page down. It never retries: a missing model
 * stays missing until the page is reloaded, so the low-poly fallback simply stays on screen.
 * React only supports error boundaries as classes.
 */
export class ModelErrorBoundary extends Component<ModelErrorBoundaryProps, ModelErrorBoundaryState> {
  state: ModelErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ModelErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    clientLog('warn', 'scene-part-failed', {
      part: this.props.name ?? 'unnamed',
      message: error.message,
      componentStack: info.componentStack,
    });
    this.props.onFail?.();
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
