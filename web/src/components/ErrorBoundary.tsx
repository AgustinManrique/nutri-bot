import { Component, type ReactNode } from 'react';

/** Si algo explota, mostramos el error en vez de una pantalla en blanco */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('[app]', error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <div className="card max-w-lg p-6">
          <p className="font-display text-xl font-bold">Algo se rompió 😵</p>
          <pre className="mt-3 overflow-auto rounded-2xl bg-crema p-3 text-xs whitespace-pre-wrap">
            {this.state.error.message}{'\n'}{this.state.error.stack?.split('\n').slice(0, 6).join('\n')}
          </pre>
          <button onClick={() => location.reload()} className="mt-4 rounded-2xl bg-salmon-400 px-4 py-2.5 font-semibold">Recargar</button>
        </div>
      </div>
    );
  }
}
