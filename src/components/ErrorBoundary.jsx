import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-zn-bg px-4">
          <div className="max-w-md w-full text-center">
            <h1 className="font-display text-4xl font-bold text-zn-text mb-4">Нещо се обърка</h1>
            <div className="h-0.5 bg-gradient-to-r from-zn-hot to-zn-orange rounded-full mx-auto w-16 mb-6" />
            <p className="font-sans text-zn-text-muted mb-6">
              Възникна неочаквана грешка. Моля, опитайте отново.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/';
                }}
                className="px-6 py-2.5 bg-zn-purple text-white text-sm font-sans font-semibold hover:bg-zn-purple-dark transition-colors"
              >
                Начална страница
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-6 py-2.5 border border-zn-border text-zn-text text-sm font-sans font-semibold hover:bg-zn-bg-warm/50 transition-colors"
              >
                Опитай отново
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
