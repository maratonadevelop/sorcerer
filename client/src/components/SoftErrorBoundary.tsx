import React from 'react';

type State = { error: Error | null };

// Minimal, non-intrusive error boundary that auto-reseta e não mostra UI de debug.
export default class SoftErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };
  private timer: number | null = null;

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidCatch(error: Error, info: any) {
    try { console.error('[soft-boundary]', error, info); } catch {}
    // Tenta limpar o erro após um pequeno intervalo.
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.setState({ error: null });
    }, 100);
  }

  componentWillUnmount(): void {
    if (this.timer) window.clearTimeout(this.timer);
  }

  render() {
    if (this.state.error) {
      // Renderiza um fallback invisível por instantes enquanto reseta.
      return null;
    }
    return this.props.children as any;
  }
}
