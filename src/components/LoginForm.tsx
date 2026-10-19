import { useState, type FormEvent } from 'react';
import { getStateInstance } from '../api/greenApi';
import type { Credentials } from '../api/types';
import { loadLastLogin, saveLastLogin } from '../lib/storage';

const DEFAULT_API_URL = 'https://api.green-api.com';

interface LoginFormProps {
  onLogin: (credentials: Credentials) => void;
}

export const LoginForm = ({ onLogin }: LoginFormProps) => {
  const [lastLogin] = useState(loadLastLogin);
  const [apiUrl, setApiUrl] = useState(lastLogin?.apiUrl ?? DEFAULT_API_URL);
  const [idInstance, setIdInstance] = useState(lastLogin?.idInstance ?? '');
  const [apiTokenInstance, setApiTokenInstance] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const credentials: Credentials = {
      apiUrl: apiUrl.trim() || DEFAULT_API_URL,
      idInstance: idInstance.trim(),
      apiTokenInstance: apiTokenInstance.trim(),
    };

    if (!/^\d+$/.test(credentials.idInstance)) {
      setError('idInstance состоит только из цифр, например 3100123456');
      return;
    }

    setError(null);
    setIsChecking(true);
    try {
      const state = await getStateInstance(credentials);
      if (state === 'authorized') {
        saveLastLogin(credentials);
        onLogin(credentials);
      } else {
        setError(`Инстанс не авторизован (состояние: ${state}). Привяжите аккаунт MAX в консоли GREEN-API.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось проверить учётные данные');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <main className="login">
      <form className="login__card" onSubmit={handleSubmit}>
        <h1 className="login__title">Вход в чат</h1>
        <p className="login__hint">
          Данные инстанса из{' '}
          <a href="https://console.green-api.com" target="_blank" rel="noreferrer">
            консоли GREEN-API
          </a>
        </p>

        <label className="field">
          <span className="field__label">idInstance</span>
          <input
            className="field__input"
            value={idInstance}
            onChange={(e) => setIdInstance(e.target.value)}
            inputMode="numeric"
            autoComplete="username"
            required
            autoFocus={!lastLogin}
          />
        </label>

        <label className="field">
          <span className="field__label">apiTokenInstance</span>
          <input
            className="field__input"
            type="password"
            value={apiTokenInstance}
            onChange={(e) => setApiTokenInstance(e.target.value)}
            autoComplete="current-password"
            autoFocus={Boolean(lastLogin)}
            required
          />
        </label>

        <label className="field">
          <span className="field__label">apiUrl</span>
          <input
            className="field__input"
            type="url"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder={DEFAULT_API_URL}
          />
        </label>

        {error && (
          <p className="login__error" role="alert">
            {error}
          </p>
        )}

        <button className="button" type="submit" disabled={isChecking}>
          {isChecking ? 'Проверяем…' : 'Войти'}
        </button>
      </form>
    </main>
  );
};
