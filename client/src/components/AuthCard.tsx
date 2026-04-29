import type { FormEvent, ReactNode } from 'react';

type AuthCardProps = {
  title: string;
  subtitle: string;
  submitLabel: string;
  username: string;
  password: string;
  loading: boolean;
  error: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  footer: ReactNode;
};

export function AuthCard(props: AuthCardProps) {
  const {
    title,
    subtitle,
    submitLabel,
    username,
    password,
    loading,
    error,
    onUsernameChange,
    onPasswordChange,
    onSubmit,
    footer,
  } = props;

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <p className="eyebrow">RIFA ONLINE</p>
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>

        <form onSubmit={onSubmit} className="auth-form">
          <label>
            Usuario
            <input
              value={username}
              onChange={(event) => onUsernameChange(event.target.value)}
              autoComplete="username"
              minLength={3}
              maxLength={32}
              required
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              autoComplete="current-password"
              minLength={6}
              maxLength={64}
              required
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Enviando...' : submitLabel}
          </button>
        </form>

        <div className="auth-footer">{footer}</div>
      </div>
    </div>
  );
}
