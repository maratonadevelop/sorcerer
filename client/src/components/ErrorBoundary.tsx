import React from 'react';

type State = { error: Error | null };

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: any) {
    // Log to console and window for quick debugging
    console.error('ErrorBoundary caught:', error, info);
    try { (window as any).__lastRenderError = { error, info }; } catch {}
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 text-red-500 font-mono text-sm">
          <h2 className="font-bold mb-2">Render error</h2>
          <pre className="whitespace-pre-wrap">{this.state.error.message}</pre>
          <button className="mt-4 px-3 py-2 rounded bg-red-600 text-white" onClick={() => this.setState({ error: null })}>Tentar novamente</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;