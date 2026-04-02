import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      let isFirestoreError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.operationType) {
            errorMessage = `Intelligence Database Error: ${parsed.error}`;
            isFirestoreError = true;
          }
        }
      } catch (e) {
        // Not a JSON error message
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 font-mono">
          <div className="max-w-md w-full bg-[#0a0a0a] border border-red-500/30 p-8 rounded-lg text-center shadow-[0_0_50px_rgba(255,0,0,0.1)]">
            <AlertTriangle className="mx-auto mb-6 text-red-500" size={48} />
            <h2 className="text-xl font-bold text-[#eee] mb-4 uppercase tracking-widest">System Failure</h2>
            <p className="text-[#666] text-sm mb-8 leading-relaxed">
              {errorMessage}
              {isFirestoreError && (
                <span className="block mt-4 text-[10px] text-red-400/50">
                  This usually indicates a synchronization issue with the intelligence backend.
                </span>
              )}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-red-500/10 text-red-500 border border-red-500/50 font-bold uppercase tracking-widest rounded hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw size={18} />
              Reboot System
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
