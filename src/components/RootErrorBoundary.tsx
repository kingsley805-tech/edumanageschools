import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
          <div className="max-w-lg space-y-4 text-center">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">{this.state.error.message}</p>
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
              onClick={() => window.location.assign("/")}
            >
              Reload app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
