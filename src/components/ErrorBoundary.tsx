import { Component, type ReactNode } from "react";

// Shows a message and a reload button instead of a blank page if something unexpected breaks.
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto flex min-h-screen max-w-[420px] flex-col items-center justify-center gap-4 px-6 text-center">
        <img src="/logo-192.png" alt="" className="h-14 w-14 rounded-2xl" />
        <h1 className="text-[20px] font-semibold text-text-primary">Something went wrong</h1>
        <p className="text-[13px] leading-5 text-text-secondary">
          Please reload the page. If your payment went through, your member or renewal is already saved.
        </p>
        <p className="break-all rounded-xl bg-thumb px-3 py-2 text-[11px] text-text-secondary">{this.state.error.message}</p>
        <button
          type="button"
          onClick={() => window.location.assign(window.location.pathname + "#/")}
          className="h-12 w-full rounded-2xl bg-ink text-[14px] font-medium text-on-ink"
        >
          Reload
        </button>
      </div>
    );
  }
}
