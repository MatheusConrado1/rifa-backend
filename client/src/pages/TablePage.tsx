import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { GameBoard } from '../components/GameBoard';
import { getSocket, disconnectSocket } from '../services/socket';
import {
  getState,
  resetGameState,
  setErrorMessage,
  setLobbyData,
  setSocketConnected,
  setStatusMessage,
  setTableState,
  setWarningMessage,
} from '../state';
import { useAppState } from '../hooks/useAppState';
import type { BettingAction, Rank, Suit, TableState } from '../types';

type SocketAck = {
  status: 'sucesso' | 'erro';
  mensagem?: string;
};

function emitWithAck<TPayload>(
  eventName: string,
  payload: TPayload,
): Promise<SocketAck> {
  const token = getState().auth.token;
  if (!token) {
    return Promise.reject(new Error('Sessao expirada.'));
  }

  const socket = getSocket(token);
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('Servidor demorou para responder.'));
    }, 7000);

    socket.emit(eventName, payload, (response: SocketAck) => {
      window.clearTimeout(timeout);
      resolve(response);
    });
  });
}

export function TablePage() {
  const navigate = useNavigate();
  const params = useParams();
  const app = useAppState();
  const [sendingAction, setSendingAction] = useState(false);
  const [lastBetAction, setLastBetAction] = useState<{
    playerId: string;
    action: BettingAction;
  } | null>(null);

  const routeTableId = useMemo(
    () => (params.mesaId ?? '').trim(),
    [params.mesaId],
  );
  const playerName = app.game.playerName || app.auth.username || '';

  useEffect(() => {
    if (!routeTableId || !app.auth.token) {
      return;
    }

    if (!playerName) {
      setErrorMessage('Nome do jogador ausente. Volte ao lobby.');
      return;
    }

    setWarningMessage('');

    setLobbyData(routeTableId, playerName);

    const socket = getSocket(app.auth.token);

    const onConnect = () => {
      setSocketConnected(true);
      setErrorMessage('');
      setWarningMessage('');
      setStatusMessage('Conectado ao servidor. Entrando na mesa...');

      socket.emit(
        'entrar_na_mesa',
        { nome: playerName, mesaId: routeTableId },
        (response: SocketAck) => {
          if (response?.status === 'erro') {
            setErrorMessage(response.mensagem ?? 'Falha ao entrar na mesa.');
          } else {
            setStatusMessage(response?.mensagem ?? 'Entrada confirmada.');
          }
        },
      );
    };

    const onDisconnect = () => {
      setSocketConnected(false);
      setStatusMessage('Conexao perdida. Tentando reconectar...');
    };

    const onStateUpdated = (payload: { mesa: TableState }) => {
      if (payload?.mesa) {
        setTableState(payload.mesa);
      }
    };

    const onRoundStarted = (payload: {
      mensagem?: string;
      mesa?: typeof app.game.table;
    }) => {
      setStatusMessage(payload?.mensagem ?? 'Rodada iniciada!');
      if (payload?.mesa) {
        setTableState(payload.mesa);
      }
    };

    const onPlayerJoined = (payload: { mensagem?: string }) => {
      if (payload?.mensagem) {
        setStatusMessage(payload.mensagem);
      }
    };

    const onError = (payload: { message?: string }) => {
      setErrorMessage(
        payload?.message ?? 'Erro de comunicacao com o servidor.',
      );
    };

    const onAutoAway = (payload: { mensagem?: string }) => {
      setWarningMessage(payload?.mensagem ?? 'Jogador ausente removido da rodada.');
    };

    const onBetActionProcessed = (payload: {
      playerId?: string;
      acao?: BettingAction;
    }) => {
      if (!payload?.playerId || !payload?.acao) {
        return;
      }

      setLastBetAction({ playerId: payload.playerId, action: payload.acao });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('estado_atualizado', onStateUpdated);
    socket.on('rodada_iniciada', onRoundStarted);
    socket.on('jogador_entrou', onPlayerJoined);
    socket.on('acao_aposta_processada', onBetActionProcessed);
    socket.on('jogador_away_auto', onAutoAway);
    socket.on('error', onError);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('estado_atualizado', onStateUpdated);
      socket.off('rodada_iniciada', onRoundStarted);
      socket.off('jogador_entrou', onPlayerJoined);
      socket.off('acao_aposta_processada', onBetActionProcessed);
      socket.off('jogador_away_auto', onAutoAway);
      socket.off('error', onError);
    };
  }, [app.auth.token, playerName, routeTableId]);

  if (!app.auth.token) {
    return <Navigate to="/login" replace />;
  }

  if (!routeTableId) {
    return <Navigate to="/lobby" replace />;
  }

  async function runAction(action: () => Promise<SocketAck>) {
    setSendingAction(true);
    setErrorMessage('');
    setWarningMessage('');

    try {
      const response = await action();
      if (response.status === 'erro') {
        const message = response.mensagem ?? 'Acao recusada.';
        const warningMarkers = [
          'Obrigação de servir',
          'Alguém já pegou a Macaca',
          'Trunfo para 3',
        ];

        if (warningMarkers.some((marker) => message.includes(marker))) {
          setWarningMessage(message);
          setStatusMessage('Atenção: ajuste sua jogada para continuar.');
        } else {
          setErrorMessage(message);
        }
      } else if (response.mensagem) {
        setStatusMessage(response.mensagem);
      }
    } catch (actionError) {
      setErrorMessage(
        actionError instanceof Error
          ? actionError.message
          : 'Falha ao enviar acao para o servidor.',
      );
    } finally {
      setSendingAction(false);
    }
  }

  function handleLeaveTable() {
    disconnectSocket();
    resetGameState();
    navigate('/lobby', { replace: true });
  }

  function handleStartRound() {
    runAction(() => emitWithAck('iniciar_jogo', { mesaId: routeTableId }));
  }

  function handleSetRoundStake(value: number) {
    runAction(() => emitWithAck('definir_boca', { mesaId: routeTableId, valor: value }));
  }

  function handleBetAction(action: BettingAction) {
    runAction(() =>
      emitWithAck('acao_aposta', { mesaId: routeTableId, acao: action }),
    );
  }

  function handlePlayCard(suit: string, rank: string) {
    runAction(() =>
      emitWithAck('jogar_carta', {
        mesaId: routeTableId,
        suit: suit as Suit,
        rank: rank as Rank,
      }),
    );
  }

  function phaseLabel(phase: TableState['phase']): string {
    if (phase === 'WAITING_PLAYERS') return 'Aguardando jogadores';
    if (phase === 'BETTING_PHASE') return 'Fase de apostas';
    if (phase === 'PLAYING_CARDS') return 'Disputa de cartas';
    if (phase === 'ROUND_END') return 'Fim da rodada';
    return 'Jogo encerrado';
  }

  return (
    <main className="table-shell">
      <header className="panel table-info-bar">
        <div>
          <p className="eyebrow">RIFA AO VIVO</p>
          <h1>Mesa {routeTableId}</h1>
        </div>
        <div className="chip-row">
          <span className="chip">Pote: {app.game.table?.pot ?? '-'}</span>
          <span className="chip">
            Fase: {app.game.table ? phaseLabel(app.game.table.phase) : 'Carregando'}
          </span>
          <span className="chip">Manilha: {app.game.table?.manilha ?? '-'}</span>
          <span className="chip">Naipe da mesa: {app.game.table?.service ?? '-'}</span>
        </div>
        <div className="button-row">
          <Link className="btn btn-ghost" to="/lobby">
            Lobby
          </Link>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleLeaveTable}
          >
            Sair da mesa
          </button>
        </div>
      </header>

      <section className="status-row compact-status">
        <span className={`chip ${app.game.socketConnected ? 'ok' : 'warn'}`}>
          {app.game.socketConnected ? 'socket online' : 'socket offline'}
        </span>
        {app.game.statusMessage ? (
          <span className="chip">{app.game.statusMessage}</span>
        ) : null}
        {app.game.warningMessage ? (
          <span className="chip attn">{app.game.warningMessage}</span>
        ) : null}
        {app.game.errorMessage ? (
          <span className="chip error">{app.game.errorMessage}</span>
        ) : null}
      </section>

      {app.game.table ? (
        <GameBoard
          table={app.game.table}
          meId={app.auth.userId}
          warningMessage={app.game.warningMessage}
          lastBetAction={lastBetAction}
          onStartRound={handleStartRound}
          onSetRoundStake={handleSetRoundStake}
          onBetAction={handleBetAction}
          onPlayCard={handlePlayCard}
          sendingAction={sendingAction}
        />
      ) : (
        <section className="panel waiting-panel">
          <h2>Aguardando estado da mesa...</h2>
          <p className="muted">
            Assim que o servidor enviar o primeiro estado, o tabuleiro aparece
            aqui.
          </p>
        </section>
      )}
    </main>
  );
}
