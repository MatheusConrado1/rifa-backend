import './style.css';
import { login, register } from './services/auth';
import { GameSocketClient } from './services/socket';
import { clearAuth, pushLog, setAuth, state } from './state';
import type { BettingAction, Card, PlayerState, TableState } from './types';

type AuthMode = 'login' | 'register';
type ToastType = 'info' | 'success' | 'error';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface Seat {
  player: PlayerState;
  x: number;
  y: number;
  isSelf: boolean;
  isTurn: boolean;
  isDealer: boolean;
  originalIndex: number;
}

const DEFAULT_TABLE_ID = 'mesa-principal';

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const PHASE_LABELS: Record<string, string> = {
  WAITING_PLAYERS: 'Aguardando jogadores',
  BETTING_PHASE: 'Apostas',
  PLAYING_CARDS: 'Jogo de cartas',
  ROUND_END: 'Fim da rodada',
  GAME_OVER: 'Fim de jogo',
};

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Elemento #app nao encontrado.');
}

const socketClient = new GameSocketClient();
let authMode: AuthMode = 'login';
let connecting = false;
let hasJoinedTable = false;
let toastSequence = 1;
let toasts: Toast[] = [];

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const pushToast = (message: string, type: ToastType = 'info'): void => {
  const id = toastSequence++;
  toasts = [{ id, message, type }, ...toasts].slice(0, 5);
  render();

  window.setTimeout(() => {
    toasts = toasts.filter((toast) => toast.id !== id);
    render();
  }, 3600);
};

const getMe = (table: TableState | null): PlayerState | null => {
  if (!table || !socketClient.socketId) {
    return null;
  }
  return (
    table.players.find((player) => player.id === socketClient.socketId) ?? null
  );
};

const getCurrentPlayer = (table: TableState | null): PlayerState | null => {
  if (!table || table.players.length === 0) {
    return null;
  }
  return table.players[table.currentTurnIndex] ?? null;
};

const getSuitClass = (suit: string): string => {
  return suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black';
};

const renderCardFace = (card: Card, classes = ''): string => {
  return `
    <div class="card-face ${getSuitClass(card.suit)} ${classes}">
      <span class="card-corner top">${card.rank} ${SUIT_SYMBOLS[card.suit]}</span>
      <span class="card-mid">${SUIT_SYMBOLS[card.suit]}</span>
      <span class="card-corner bottom">${card.rank} ${SUIT_SYMBOLS[card.suit]}</span>
    </div>
  `;
};

const renderCardBack = (): string => {
  return '<div class="card-face back"></div>';
};

const renderPlayableCard = (card: Card, disabled: boolean): string => {
  return `
    <button
      type="button"
      class="card-face hand-card ${getSuitClass(card.suit)} ${disabled ? 'locked' : ''}"
      ${disabled ? 'disabled' : ''}
      data-play-suit="${card.suit}"
      data-play-rank="${card.rank}"
    >
      <span class="card-corner top">${card.rank} ${SUIT_SYMBOLS[card.suit]}</span>
      <span class="card-mid">${SUIT_SYMBOLS[card.suit]}</span>
      <span class="card-corner bottom">${card.rank} ${SUIT_SYMBOLS[card.suit]}</span>
    </button>
  `;
};

const rotatePlayersForBottomSeat = (
  players: PlayerState[],
  selfId: string,
): PlayerState[] => {
  const index = players.findIndex((player) => player.id === selfId);
  if (index <= 0) {
    return [...players];
  }
  return [...players.slice(index), ...players.slice(0, index)];
};

const computeSeats = (table: TableState, me: PlayerState | null): Seat[] => {
  const ordered = me
    ? rotatePlayersForBottomSeat(table.players, me.id)
    : [...table.players];
  const count = ordered.length;
  const centerX = 50;
  const centerY = 52;
  const radiusX = 40;
  const radiusY = 34;

  return ordered.map((player, idx) => {
    const angle = ((Math.PI * 2) / Math.max(count, 1)) * idx + Math.PI / 2;
    const x = centerX + radiusX * Math.cos(angle);
    const y = centerY + radiusY * Math.sin(angle);
    const originalIndex = table.players.findIndex((p) => p.id === player.id);

    return {
      player,
      x,
      y,
      isSelf: me?.id === player.id,
      isTurn: originalIndex === table.currentTurnIndex,
      isDealer: originalIndex === table.dealerIndex,
      originalIndex,
    };
  });
};

const renderAuth = (): string => {
  const action = authMode === 'login' ? 'Entrar no jogo' : 'Criar conta';
  const helper = authMode === 'login' ? 'Nao tem conta?' : 'Ja possui conta?';
  const toggle = authMode === 'login' ? 'Registrar' : 'Fazer login';

  return `
    <section class="auth-screen fade-in">
      <div class="auth-neon"></div>
      <form id="authForm" class="auth-panel">
        <p class="auth-kicker">Rifa Arena</p>
        <h1>Entre na mesa</h1>
        <p class="auth-subtitle">Uma mesa unica, cartas na mao e disputa em tempo real.</p>

        <label class="field">
          <span>Usuario</span>
          <input id="usernameInput" minlength="3" maxlength="32" required />
        </label>

        <label class="field">
          <span>Senha</span>
          <input id="passwordInput" type="password" minlength="6" maxlength="64" required />
        </label>

        <button class="btn btn-primary" type="submit">${action}</button>

        <p class="auth-toggle">
          ${helper}
          <button id="toggleAuthMode" class="link-btn" type="button">${toggle}</button>
        </p>
      </form>
    </section>
  `;
};

const renderTable = (): string => {
  const table = state.table;
  const me = getMe(table);
  const currentPlayer = getCurrentPlayer(table);
  const isMyTurn = Boolean(me && currentPlayer && me.id === currentPlayer.id);
  const canPlayCards = Boolean(
    table && me && table.phase === 'PLAYING_CARDS' && isMyTurn,
  );
  const canBet = Boolean(
    table && me && table.phase === 'BETTING_PHASE' && isMyTurn && !me.hasActed,
  );

  const seats = table ? computeSeats(table, me) : [];

  const seatsMarkup = seats.length
    ? seats
        .map((seat) => {
          const status = seat.player.isPlayingRound ? 'Em jogo' : 'Fora da mao';
          return `
            <article
              class="seat ${seat.isTurn ? 'turn' : ''} ${seat.isSelf ? 'self' : ''}"
              style="left:${seat.x}%;top:${seat.y}%"
            >
              <div class="seat-head">
                <strong>${escapeHtml(seat.player.name)}</strong>
                <div class="seat-tags">
                  ${seat.isDealer ? '<span class="tag dealer">D</span>' : ''}
                  ${seat.isTurn ? '<span class="tag turn">Vez</span>' : ''}
                </div>
              </div>
              <p class="seat-line">${status}</p>
              <p class="seat-line">${seat.player.coins} moedas | ${seat.player.tricksWon} vazas</p>
              <div class="seat-cards">
                ${seat.isSelf ? '<span class="you-label">Voce</span>' : renderCardBack()}
                ${seat.isSelf ? '' : renderCardBack()}
                ${seat.isSelf ? '' : renderCardBack()}
              </div>
            </article>
          `;
        })
        .join('')
    : '<p class="table-empty">Conectando na mesa...</p>';

  const trickMarkup = table?.currentTrickCards.length
    ? table.currentTrickCards
        .map((trick) => {
          const owner =
            table.players.find((player) => player.id === trick.playerId)
              ?.name ?? 'Jogador';
          return `
            <div class="trick-card">
              <small>${escapeHtml(owner)}</small>
              ${renderCardFace(trick.card, 'mini')}
            </div>
          `;
        })
        .join('')
    : '<p class="table-empty">Aguardando cartas no centro</p>';

  const handMarkup = me
    ? me.hand.map((card) => renderPlayableCard(card, !canPlayCards)).join('')
    : '<p class="table-empty">Voce ainda nao recebeu cartas.</p>';

  const manilhaMarkup = table?.manilhaCard
    ? renderCardFace(table.manilhaCard)
    : '<div class="slot-empty">--</div>';
  const bottomMarkup = table?.bottomCard
    ? renderCardFace(table.bottomCard)
    : '<div class="slot-empty">--</div>';

  return `
    <section class="game-screen fade-in">
      <div class="table-room">
        <header class="game-hud">
          <div class="hud-left">
            <h1>Rifa Arena</h1>
            <p>${table ? PHASE_LABELS[table.phase] : 'Aguardando mesa'} | Pote: ${table ? table.pot : 0}</p>
          </div>

          <div class="hud-center">
            <button id="startRoundBtn" class="btn btn-gold" type="button" ${
              !state.isConnected ? 'disabled' : ''
            }>
              Iniciar rodada
            </button>
          </div>

          <div class="hud-right">
            <span class="connection ${state.isConnected ? 'online' : 'offline'}">${
              state.isConnected
                ? 'Online'
                : connecting
                  ? 'Conectando'
                  : 'Offline'
            }</span>
            <button id="logoutBtn" class="btn btn-ghost" type="button">Sair</button>
          </div>
        </header>

        <main class="table-core">
          <div class="felt-ring">
            <div class="felt-surface">
              <div class="table-slots">
                <div class="slot-box">
                  <span>Manilha</span>
                  ${manilhaMarkup}
                </div>
                <div class="slot-box">
                  <span>Fundo</span>
                  ${bottomMarkup}
                </div>
              </div>

              <div class="center-trick">${trickMarkup}</div>
              <div class="seat-layer">${seatsMarkup}</div>
            </div>
          </div>

          <section class="action-rail">
            <button type="button" class="btn btn-primary" data-betting-action="PLAY" ${
              canBet ? '' : 'disabled'
            }>Entrar</button>
            <button type="button" class="btn btn-gold" data-betting-action="MACACA" ${
              canBet ? '' : 'disabled'
            }>Macaca</button>
            <button type="button" class="btn btn-danger" data-betting-action="FOLD" ${
              canBet ? '' : 'disabled'
            }>Desistir</button>
          </section>

          <section class="hand-zone">
            <div class="hand-header">
              <p>${escapeHtml(state.username ?? 'Jogador')}</p>
              <small>${
                currentPlayer
                  ? `Turno: ${escapeHtml(currentPlayer.name)}`
                  : 'Sem turno ativo'
              }</small>
            </div>
            <div class="player-hand">${handMarkup}</div>
          </section>
        </main>
      </div>
    </section>
  `;
};

const renderToasts = (): string => {
  if (toasts.length === 0) {
    return '';
  }

  return `
    <section class="toast-stack">
      ${toasts
        .map(
          (toast) => `
            <article class="toast ${toast.type}">${escapeHtml(toast.message)}</article>
          `,
        )
        .join('')}
    </section>
  `;
};

const render = (): void => {
  app.innerHTML = `
    <div class="scene-glow left"></div>
    <div class="scene-glow right"></div>
    ${state.token ? renderTable() : renderAuth()}
    ${renderToasts()}
  `;

  bindEvents();
};

const autoJoinDefaultTable = (): void => {
  if (!state.isConnected || !state.username || hasJoinedTable) {
    return;
  }

  socketClient.joinTable(state.username, DEFAULT_TABLE_ID, (response) => {
    if (response.status === 'erro') {
      pushToast(response.mensagem ?? 'Falha ao sentar na mesa.', 'error');
      return;
    }

    hasJoinedTable = true;
    state.mesaId = DEFAULT_TABLE_ID;
    pushLog('Voce sentou na mesa principal.');
    pushToast('Voce entrou na mesa.', 'success');
    render();
  });
};

const connectSocket = (): void => {
  if (!state.token || connecting || state.isConnected) {
    return;
  }

  connecting = true;
  render();

  socketClient.connect(state.token, {
    onConnect: () => {
      connecting = false;
      state.isConnected = true;
      pushToast('Conectado ao servidor.', 'success');
      autoJoinDefaultTable();
      render();
    },
    onDisconnect: (reason) => {
      connecting = false;
      state.isConnected = false;
      hasJoinedTable = false;
      if (reason !== 'io client disconnect') {
        pushToast(`Conexao encerrada: ${reason}`, 'error');
      }
      render();
    },
    onUnauthorized: () => {
      connecting = false;
      state.isConnected = false;
      hasJoinedTable = false;
      state.table = null;
      clearAuth();
      pushToast('Sessao expirada. Faca login novamente.', 'error');
      render();
    },
    onError: (message) => {
      pushLog(`Erro: ${message}`);
      pushToast(message, 'error');
      render();
    },
    onTableState: (table) => {
      state.table = table;
      hasJoinedTable = true;
      state.mesaId = table.id;
      render();
    },
    onPlayerJoined: (message) => {
      pushLog(message);
      render();
    },
  });
};

const disconnectSocket = (): void => {
  connecting = false;
  state.isConnected = false;
  hasJoinedTable = false;
  socketClient.disconnect();
  render();
};

const onAuthSubmit = async (event: SubmitEvent): Promise<void> => {
  event.preventDefault();

  const form = event.currentTarget as HTMLFormElement;
  const usernameInput = form.querySelector<HTMLInputElement>('#usernameInput');
  const passwordInput = form.querySelector<HTMLInputElement>('#passwordInput');

  if (!usernameInput || !passwordInput) {
    return;
  }

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  try {
    if (authMode === 'register') {
      await register(username, password);
      pushToast('Conta criada com sucesso.', 'success');
    }

    const auth = await login(username, password);
    setAuth(auth.accessToken, username);
    hasJoinedTable = false;
    pushToast('Login realizado. Entrando na mesa...', 'success');
    render();
    connectSocket();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Falha na autenticacao.';
    pushToast(message, 'error');
  }
};

const handleAck = (response: {
  status: 'sucesso' | 'erro';
  mensagem?: string;
}): void => {
  if (response.status === 'erro') {
    pushToast(response.mensagem ?? 'Erro na operacao.', 'error');
    return;
  }

  if (response.mensagem) {
    pushToast(response.mensagem, 'success');
    return;
  }

  pushToast('Acao enviada.', 'success');
};

const bindEvents = (): void => {
  const toggleAuthModeBtn =
    document.querySelector<HTMLButtonElement>('#toggleAuthMode');
  if (toggleAuthModeBtn) {
    toggleAuthModeBtn.addEventListener('click', () => {
      authMode = authMode === 'login' ? 'register' : 'login';
      render();
    });
  }

  const authForm = document.querySelector<HTMLFormElement>('#authForm');
  if (authForm) {
    authForm.addEventListener('submit', (event) => {
      void onAuthSubmit(event);
    });
  }

  const logoutBtn = document.querySelector<HTMLButtonElement>('#logoutBtn');
  logoutBtn?.addEventListener('click', () => {
    disconnectSocket();
    clearAuth();
    state.table = null;
    pushToast('Sessao encerrada.', 'info');
    render();
  });

  const startRoundBtn =
    document.querySelector<HTMLButtonElement>('#startRoundBtn');
  startRoundBtn?.addEventListener('click', () => {
    if (!state.isConnected || !hasJoinedTable) {
      pushToast('Voce precisa estar sentado na mesa.', 'error');
      return;
    }

    socketClient.startGame(DEFAULT_TABLE_ID, (response) => {
      handleAck(response);
      render();
    });
  });

  const bettingButtons = document.querySelectorAll<HTMLButtonElement>(
    '[data-betting-action]',
  );
  bettingButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.bettingAction as BettingAction;
      socketClient.bettingAction(DEFAULT_TABLE_ID, action, (response) => {
        handleAck(response);
      });
    });
  });

  const playableCards =
    document.querySelectorAll<HTMLButtonElement>('[data-play-suit]');
  playableCards.forEach((button) => {
    button.addEventListener('click', () => {
      const suit = button.dataset.playSuit;
      const rank = button.dataset.playRank;
      if (!suit || !rank) {
        return;
      }

      socketClient.playCard(DEFAULT_TABLE_ID, suit, rank, (response) => {
        handleAck(response);
      });
    });
  });
};

render();

if (state.token) {
  pushToast('Sessao restaurada.', 'info');
  connectSocket();
}
