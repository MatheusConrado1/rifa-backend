import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AuthCard } from '../components/AuthCard';
import { login } from '../services/auth';
import { setToken } from '../state';
import { useAppState } from '../hooks/useAppState';

export function LoginPage() {
  const navigate = useNavigate();
  const {
    auth: { token },
  } = useAppState();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (token) {
    return <Navigate to="/lobby" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const normalized = username.trim().toLowerCase();
      const data = await login({ username: normalized, password });
      setToken(data.accessToken, data.username, data.userId);
      navigate('/lobby', { replace: true });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Falha no login. Tente novamente.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Entrar na mesa"
      subtitle="Use sua conta para entrar no lobby e conectar ao jogo em tempo real."
      submitLabel="Entrar"
      username={username}
      password={password}
      loading={loading}
      error={error}
      onUsernameChange={setUsername}
      onPasswordChange={setPassword}
      onSubmit={handleSubmit}
      footer={
        <p>
          Nao tem conta? <Link to="/register">Criar cadastro</Link>
        </p>
      }
    />
  );
}
