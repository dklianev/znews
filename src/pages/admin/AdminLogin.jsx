import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Lock, User } from 'lucide-react';
import { useSessionData } from '../../context/DataContext';
import { makeTitle, useDocumentTitle } from '../../hooks/useDocumentTitle';

const INITIAL_LOGIN_STATE = Object.freeze({
  status: 'idle',
  message: '',
});

function AdminLoginSubmitButton({ disabled }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="w-full btn-primary text-center disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? 'Влизане...' : 'Вход'}
    </button>
  );
}

export default function AdminLogin() {
  useDocumentTitle(makeTitle('Вход в админ'));
  const navigate = useNavigate();
  const { login, session } = useSessionData();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [dismissLoginError, setDismissLoginError] = useState(false);
  const normalizedUsername = username.trim();
  const [loginState, submitLoginAction, isLoginPending] = useActionState(
    async (_previousState, formData) => {
      const nextUsername = String(formData.get('username') || '').trim();
      const nextPassword = String(formData.get('password') || '');

      if (!nextUsername || !nextPassword) {
        return {
          status: 'error',
          message: 'Попълни и потребителско име, и парола.',
        };
      }

      try {
        await login(nextUsername, nextPassword);
        return {
          status: 'success',
          message: '',
        };
      } catch (error) {
        return {
          status: 'error',
          message: error?.message || 'Входът не беше успешен. Опитай отново.',
        };
      }
    },
    INITIAL_LOGIN_STATE,
  );

  useEffect(() => {
    if (loginState.status === 'success') navigate('/admin');
  }, [loginState.status, navigate]);

  useEffect(() => {
    if (session?.token) navigate('/admin', { replace: true });
  }, [navigate, session?.token]);

  useEffect(() => {
    if (loginState.status !== 'error') {
      setDismissLoginError(false);
    }
  }, [loginState.status]);

  const error = loginState.status === 'error' && !dismissLoginError ? loginState.message : '';
  const canSubmit = normalizedUsername.length > 0 && password.length > 0;
  const describedBy = error ? 'admin-login-error admin-login-help' : 'admin-login-help';

  return (
    <div className="min-h-screen bg-zn-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-white">Los Santos News</h1>
          <p className="font-sans text-xs text-white/40 tracking-[0.3em] uppercase mt-1">Админ панел</p>
        </div>

        <form action={submitLoginAction} aria-busy={isLoginPending} className="bg-zn-bg border border-zn-border p-8">
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
                name="username"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  if (loginState.status === 'error') setDismissLoginError(true);
                }}
                autoComplete="username"
                autoFocus
                disabled={isLoginPending}
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
                name="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (loginState.status === 'error') setDismissLoginError(true);
                }}
                autoComplete="current-password"
                disabled={isLoginPending}
                aria-invalid={Boolean(error)}
                aria-describedby={describedBy}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-zn-border text-zn-text font-sans text-sm outline-none focus:border-zn-purple focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                placeholder="******"
                required
              />
            </div>
          </div>

          <p id="admin-login-help" className="mb-4 text-xs font-sans text-zn-text-muted" aria-live="polite">
            {error
              ? 'Провери данните и опитай отново.'
              : 'Използвай служебния си профил за достъп.'}
          </p>

          <AdminLoginSubmitButton disabled={!canSubmit} />
        </form>

        <p className="text-center mt-4 text-xs font-sans text-white/30">
          Неоторизиран достъп не е разрешен.
        </p>
      </div>
    </div>
  );
}
