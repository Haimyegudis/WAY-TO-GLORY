import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State { failed: boolean }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Football Career UI failed', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    const hebrew = document.documentElement.lang === 'he';
    return (
      <div className="app">
        <section className="screen" role="alert" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
          <div className="card stack" style={{ maxWidth: 420 }}>
            <h1 className="headline">{hebrew ? 'המסך לא נטען' : 'This screen could not load'}</h1>
            <p>{hebrew ? 'הקריירה נשמרה מקומית. אפשר לטעון מחדש ולנסות שוב.' : 'Your career remains saved locally. Reload and try again.'}</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              {hebrew ? 'טען מחדש' : 'Reload'}
            </button>
          </div>
        </section>
      </div>
    );
  }
}
