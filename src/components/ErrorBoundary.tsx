import React, { ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an uncaught exception:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    // Clear local cache/auth/storage that could cause persistent crashes, then redirect
    try {
      sessionStorage.clear();
    } catch (e) {
      console.error(e);
    }
    window.location.href = window.location.origin;
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-950 text-zinc-100 flex flex-col items-center justify-center p-6 font-sans">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-3xl p-8 relative shadow-2xl text-center space-y-6 overflow-hidden">
            <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-60" />

            <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 text-red-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-display font-black tracking-tight text-red-400 uppercase">Something went wrong.</h1>
              <p className="text-xs text-zinc-400">
                The terminal experienced an unexpected crash. No funds, profiles, or details were harmed.
              </p>
            </div>

            <div className="bg-slate-950/80 rounded-2xl p-4.5 border border-zinc-900 text-left font-mono text-[11px] text-zinc-500 max-h-40 overflow-y-auto space-y-1">
              <p className="text-zinc-400 font-semibold uppercase">Error Details:</p>
              <p className="text-red-400 font-bold break-all">{this.state.error?.name || "Error"}: {this.state.error?.message || "Unknown error"}</p>
              {this.state.error?.stack && (
                <p className="text-zinc-600 whitespace-pre-wrap text-[9px] mt-1 break-all">
                  {this.state.error.stack.split("\n").slice(0, 3).join("\n")}
                </p>
              )}
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center space-x-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 text-xs uppercase tracking-wider font-extrabold py-3.5 px-4 rounded-xl cursor-pointer transition-all active:scale-98 shadow-md"
              >
                <RefreshCw className="w-4 h-4 shrink-0" />
                <span>Reload Terminal</span>
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex-1 flex items-center justify-center space-x-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs uppercase tracking-wider font-bold py-3.5 px-4 rounded-xl cursor-pointer transition-all active:scale-98"
              >
                <Home className="w-4 h-4 shrink-0" />
                <span>Reset Portal</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
