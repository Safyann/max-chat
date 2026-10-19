import { useState } from 'react';
import type { Credentials } from './api/types';
import { LoginForm } from './components/LoginForm';
import { Messenger } from './components/Messenger';
import { clearCredentials, loadCredentials, saveCredentials } from './lib/storage';

export const App = () => {
  const [credentials, setCredentials] = useState<Credentials | null>(loadCredentials);

  const handleLogin = (next: Credentials) => {
    saveCredentials(next);
    setCredentials(next);
  };

  const handleLogout = () => {
    clearCredentials();
    setCredentials(null);
  };

  return credentials ? (
    <Messenger key={credentials.idInstance} credentials={credentials} onLogout={handleLogout} />
  ) : (
    <LoginForm onLogin={handleLogin} />
  );
};
