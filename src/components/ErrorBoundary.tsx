import { Component, type ReactNode, type ErrorInfo } from "react";
import { reportError } from "../lib/analytics";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error?.message ?? "Something went wrong." };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    reportError("ErrorBoundary", error, { componentStack: info.componentStack ?? "" });
  }

  isChunkLoadError() {
    const message = this.state.errorMessage;
    return (
      message.includes("Failed to fetch dynamically imported module") ||
      message.includes("Importing a module script failed") ||
      message.includes("error loading dynamically imported module") ||
      message.includes("ChunkLoadError")
    );
  }

  handleRetry = () => {
    if (this.isChunkLoadError()) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, errorMessage: "" });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
          <div className="bg-gray-900 border border-red-800/60 rounded-2xl w-full max-w-sm p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-red-900/30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h2 className="text-white font-bold text-lg mb-2">Something went wrong</h2>
            <p className="text-gray-400 text-sm mb-6">
              {this.isChunkLoadError()
                ? "A fresh app update or weak network interrupted this page. Refreshing will load the latest files."
                : "An unexpected error occurred. Your data is safe - please retry or refresh the page."}
            </p>
            <button
              onClick={this.handleRetry}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors mb-3"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl py-2.5 text-sm font-medium transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
