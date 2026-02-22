import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

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
          <div className="max-w-lg w-full relative">
            {/* Tape decorations */}
            <div className="absolute -top-3 left-8 w-16 h-5 bg-yellow-200/70 border border-black/5 transform -rotate-6 z-10" style={{ boxShadow: '1px 1px 2px rgba(0,0,0,0.1)' }} />
            <div className="absolute -top-3 right-10 w-14 h-5 bg-yellow-200/60 border border-black/5 transform rotate-4 z-10" style={{ boxShadow: '1px 1px 2px rgba(0,0,0,0.1)' }} />

            {/* Sticker */}
            <div className="absolute -top-5 -right-3 z-20">
              <span className="comic-sticker">ГРЕШКА!</span>
            </div>

            <div className="newspaper-page comic-panel comic-dots p-8 text-center relative" style={{ transform: 'rotate(-0.5deg)' }}>
              <div className="relative z-[2]">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-zn-hot/10 border-3 border-zn-hot mb-5" style={{ borderRadius: '50%' }}>
                  <AlertTriangle className="w-8 h-8 text-zn-hot" />
                </div>

                <h1 className="font-display text-3xl md:text-4xl font-black text-zn-black uppercase tracking-wider mb-2 text-shadow-comic">
                  Нещо се обърка
                </h1>

                <div className="h-1.5 bg-gradient-to-r from-zn-hot to-zn-orange mx-auto w-24 mb-5" />

                <p className="font-sans text-zn-text-muted mb-8 text-lg leading-relaxed">
                  Възникна неочаквана грешка. Моля, опитайте отново.
                </p>

                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => {
                      this.setState({ hasError: false, error: null });
                      window.location.href = '/';
                    }}
                    className="btn-hot px-6 py-2.5 text-sm font-display font-black uppercase tracking-wider"
                  >
                    Начална страница
                  </button>
                  <button
                    onClick={() => this.setState({ hasError: false, error: null })}
                    className="btn-primary px-6 py-2.5 text-sm font-display font-black uppercase tracking-wider"
                  >
                    Опитай отново
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
