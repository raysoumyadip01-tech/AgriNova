import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected application error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-6 dark:bg-[#0F172A]">
          <div className="max-w-lg rounded-xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-900/50 dark:bg-[#1E293B]">
            <h2 className="font-display text-lg font-bold text-red-700 dark:text-red-300">
              Something went wrong
            </h2>
            <p className="mt-2 break-words text-sm text-slate-600 dark:text-slate-300">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-[#14532D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16A34A]"
            >
              Reload AgriNova
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
