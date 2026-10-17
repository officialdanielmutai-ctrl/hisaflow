'use client';

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface WidgetErrorBoundaryProps {
  children: React.ReactNode;
  label?: string;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
}

/**
 * Isolates one widget: a render failure shows a small recovery card instead of
 * taking down the whole Home. Reset restores the widget's default position.
 */
export class WidgetErrorBoundary extends React.Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  state: WidgetErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): WidgetErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Widget failed to render:', this.props.label ?? 'unknown', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-[120px] flex-col items-start justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-800">
          <span className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            This widget could not load
          </span>
          <p className="text-xs">
            The rest of your Home is unaffected.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-amber-300 px-3 py-1 text-xs font-semibold"
          >
            <RotateCcw className="h-3 w-3" /> Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default WidgetErrorBoundary;
