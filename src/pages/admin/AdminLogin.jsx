import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionData } from '../../context/DataContext';
import { Lock, User } from 'lucide-react';
import { makeTitle, useDocumentTitle } from '../../hooks/useDocumentTitle';

export default function AdminLogin() {
  useDocumentTitle(makeTitle('Админ вход'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { login } = useSessionData();
  const normalizedUsername = username.trim();
  const canSubmit = normalizedUsername.length > 0 && password.length > 0 && !submitting;
  const describedBy = error ? 'admin-login-error admin-login-help' : 'admin-login-help';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!normalizedUsername || !password) {
      setError('?????? ?????????? ? ??????');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const session = await login(normalizedUsername, password);
      if (session) {
        navigate('/admin');
      } else {
        setError('Грешно потребителско име или парола');
      }
    } catch {
      setError('Грешка при връзка със сървъра');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zn-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-white">Los Santos News</h1>
          <p className="font-sans text-xs text-white/40 tracking-[0.3em] uppercase mt-1">Админ панел</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-zn-bg border border-zn-border p-8">
          <h2 className="font-display text-xl font-bold text-zn-text mb-6 text-center">Вход</h2>

          {error && (
            <div id="admin-login-error" role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm font-sans">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-sans font-semibold uppercase tracking-wider text-zn-text-muted mb-1.5">
              Потребител
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zn-text-muted" />
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError('');
                }}
                autoComplete="username"
                autoFocus
                aria-invalid={Boolean(error)}
                aria-describedby={describedBy}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-zn-border text-zn-text font-sans text-sm outline-none focus:border-zn-purple focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                placeholder="admin"
                required
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-xs font-sans font-semibold uppercase tracking-wider text-zn-text-muted mb-1.5">
              Парола
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zn-text-muted" />
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                autoComplete="current-password"
                aria-invalid={Boolean(error)}
                aria-describedby={describedBy}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-zn-border text-zn-text font-sans text-sm outline-none focus:border-zn-purple focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                placeholder="••••••"
                required
              />
            </div>
          </div>

          <p id="admin-login-help" className="mb-4 text-xs font-sans text-zn-text-muted" aria-live="polite">
            {error ? '???????? ??????? ?? ???????? ? ????????.' : '???????? ???????? ??? ??????? ??????????.'}
          </p>

          <button type="submit" disabled={!canSubmit} className="w-full btn-primary text-center disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? 'Влизане...' : 'Влез'}
          </button>
        </form>

        <p className="text-center mt-4 text-xs font-sans text-white/30">
          Използвайте служебните си данни за достъп.
        </p>
      </div>
    </div>
  );
}
