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
      className="w-full px-6 py-3 bg-zn-comic-black text-white font-display font-black text-sm uppercase tracking-wider text-center rounded-none border-3 border-zn-comic-black disabled:cursor-not-allowed disabled:opacity-50 hover:bg-zn-purple transition-colors cursor-pointer"
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
    <div className="min-h-screen bg-zn-paper paper-lines dark:bg-[#1a1425] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-zn-text dark:text-white">Los Santos News</h1>
          <p className="font-sans text-xs text-zn-text-muted dark:text-white/40 tracking-[0.3em] uppercase mt-1">Админ панел</p>
        </div>

        <form action={submitLoginAction} aria-busy={isLoginPending} className="bg-white dark:bg-[#2a2438] border-3 border-zn-comic-black dark:border-[#524a62] p-8" style={{ boxShadow: '4px 4px 0 #1C1428' }}>
          <h2 className="font-display text-xl font-bold text-zn-text dark:text-white mb-6 text-center">Вход</h2>

          {error && (
            <div id="admin-login-error" role="alert" className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm font-sans">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-sans font-semibold uppercase tracking-wider text-zn-text-muted dark:text-white/50 mb-1.5">
              Потребител
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zn-text-muted dark:text-white/40" />
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
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#1a1425] border border-zn-border dark:border-[#524a62] text-zn-text dark:text-white font-sans text-sm outline-none focus:border-zn-purple dark:focus:border-zn-purple-light focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#2a2438]"
                placeholder="admin"
                required
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-xs font-sans font-semibold uppercase tracking-wider text-zn-text-muted dark:text-white/50 mb-1.5">
              Парола
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zn-text-muted dark:text-white/40" />
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
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#1a1425] border border-zn-border dark:border-[#524a62] text-zn-text dark:text-white font-sans text-sm outline-none focus:border-zn-purple dark:focus:border-zn-purple-light focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#2a2438]"
                placeholder="******"
                required
              />
            </div>
          </div>

          <p id="admin-login-help" className="mb-4 text-xs font-sans text-zn-text-muted dark:text-white/40" aria-live="polite">
            {error
              ? 'Провери данните и опитай отново.'
              : 'Използвай служебния си профил за достъп.'}
          </p>

          <AdminLoginSubmitButton disabled={!canSubmit} />
        </form>

        <p className="text-center mt-4 text-xs font-sans text-zn-text-dim dark:text-white/30">
          Неоторизиран достъп не е разрешен.
        </p>
      </div>
    </div>
  );
}
