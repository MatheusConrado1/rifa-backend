import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AuthCard } from '../components/AuthCard';
import { register } from '../services/auth';
import { useAppState } from '../hooks/useAppState';

export function RegisterPage() {
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
      await register({ username: username.trim().toLowerCase(), password });
      navigate('/login', { replace: true });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Falha no cadastro. Tente novamente.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Criar conta"
      subtitle="Cadastre um usuario para jogar nas mesas de Rifa."
      submitLabel="Cadastrar"
      username={username}
      password={password}
      loading={loading}
      error={error}
      onUsernameChange={setUsername}
      onPasswordChange={setPassword}
      onSubmit={handleSubmit}
      footer={
        <p>
          Ja tem conta? <Link to="/login">Fazer login</Link>
        </p>
      }
    />
  );
}
