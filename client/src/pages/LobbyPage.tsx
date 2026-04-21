import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { disconnectSocket } from '../services/socket';
import {
  clearAuthAndGame,
  getState,
  resetGameState,
  setLobbyData,
} from '../state';
import { useAppState } from '../hooks/useAppState';

export function LobbyPage() {
  const navigate = useNavigate();
  const app = useAppState();

  const initialTable = getState().game.selectedTableId;
  const initialName = getState().game.playerName || app.auth.username || '';

  const [tableId, setTableId] = useState(initialTable);
  const [playerName, setPlayerName] = useState(initialName);
  const [error, setError] = useState('');

  const defaultTableHint = useMemo(() => {
    return tableId.trim() ? '' : 'ex.: mesa-1';
  }, [tableId]);

  function handleLogout() {
    disconnectSocket();
    clearAuthAndGame();
    navigate('/login', { replace: true });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const cleanedTable = tableId.trim();
    const cleanedName = playerName.trim() || app.auth.username || '';

    if (!cleanedTable) {
      setError('Informe o ID da mesa para continuar.');
      return;
    }

    if (cleanedName.length < 3) {
      setError('Seu nome precisa ter pelo menos 3 caracteres.');
      return;
    }

    disconnectSocket();
    resetGameState();
    setLobbyData(cleanedTable, cleanedName);
    navigate(`/mesa/${encodeURIComponent(cleanedTable)}`);
  }

  return (
    <main className="shell">
      <section className="panel hero-panel">
        <p className="eyebrow">LOBBY</p>
        <h1>Organize sua mesa e entre na rodada</h1>
        <p className="muted">
          Backend com JWT + Socket em tempo real. Escolha a mesa, seu nome de jogo e conecte.
        </p>
        <div className="chip-row">
          <span className="chip">Usuario: {app.auth.username}</span>
          <span className="chip">Status: autenticado</span>
        </div>
      </section>

      <section className="panel form-panel">
        <form onSubmit={handleSubmit} className="lobby-form">
          <label>
            ID da mesa
            <input
              value={tableId}
              onChange={(event) => setTableId(event.target.value)}
              placeholder={defaultTableHint}
              required
            />
          </label>

          <label>
            Nome exibido na mesa
            <input
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
              minLength={3}
              maxLength={32}
              required
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <button type="submit" className="btn btn-primary">
            Entrar na mesa
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Sair da conta
          </button>
        </form>
      </section>
    </main>
  );
}
