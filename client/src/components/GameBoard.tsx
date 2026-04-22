import { CardView } from './CardView';
import type { BettingAction, GamePhase, TableState } from '../types';
import type { CSSProperties } from 'react';

type GameBoardProps = {
  table: TableState;
  meId: string | null;
  warningMessage: string;
  onStartRound: () => void;
  onBetAction: (action: BettingAction) => void;
  onPlayCard: (suit: string, rank: string) => void;
  sendingAction: boolean;
};

function phaseLabel(phase: GamePhase): string {
  if (phase === 'WAITING_PLAYERS') return 'Aguardando jogadores';
  if (phase === 'BETTING_PHASE') return 'Fase de apostas';
  if (phase === 'PLAYING_CARDS') return 'Disputa de cartas';
  if (phase === 'ROUND_END') return 'Fim da rodada';
  return 'Jogo encerrado';
}

export function GameBoard({
  table,
  meId,
  warningMessage,
  onStartRound,
  onBetAction,
  onPlayCard,
  sendingAction,
}: GameBoardProps) {
  const me = table.players.find((player) => player.id === meId) ?? null;
  const currentPlayer = table.players[table.currentTurnIndex] ?? null;
  const pendingWinner = table.players.find(
    (player) => player.id === table.pendingTrickWinnerId,
  );
  const lastWinner = table.players.find(
    (player) => player.id === table.lastTrickWinnerId,
  );

  const isMyTurn = me != null && currentPlayer?.id === me.id;
  const canStartRound =
    (table.phase === 'WAITING_PLAYERS' || table.phase === 'ROUND_END') &&
    table.players.length >= 2;

  const canBet = table.phase === 'BETTING_PHASE' && isMyTurn;
  const canPlayCard =
    table.phase === 'PLAYING_CARDS' && isMyTurn && !table.isResolvingTrick;

  const totalPlayers = Math.max(table.players.length, 1);
  const seatStep = (Math.PI * 2) / totalPlayers;
  const seatRadiusX = totalPlayers <= 3 ? 250 : 292;
  const seatRadiusY = totalPlayers <= 3 ? 165 : 190;
  const meIndex = table.players.findIndex((player) => player.id === meId);
  const focusIndex = meIndex >= 0 ? meIndex : 0;

  const centralMessage = table.isResolvingTrick && pendingWinner
    ? `${pendingWinner.name} venceu esta vaza`
    : !table.isResolvingTrick && lastWinner
      ? `Ultima vaza: ${lastWinner.name}`
      : '';

  return (
    <div className="table-layout">
      <section className="panel table-head">
        <div>
          <p className="eyebrow">MESA {table.id}</p>
          <h2>{phaseLabel(table.phase)}</h2>
        </div>
        <div className="chip-row">
          <span className="chip">Pote: {table.pot}</span>
          <span className="chip">Manilha: {table.manilha ?? '-'}</span>
          <span className="chip">Naipe da mesa: {table.service ?? '-'}</span>
        </div>
      </section>

      <section className="panel poker-table-panel">
        {warningMessage ? <p className="table-warning-banner">{warningMessage}</p> : null}

        <div className="table-stage">
          <div className="felt-table">
            <div className="table-center-hud">
              {centralMessage ? (
                <p className={`winner-banner ${table.isResolvingTrick ? '' : 'subtle'}`}>
                  {centralMessage}
                </p>
              ) : null}

              <div className="trick-center">
                {table.currentTrickCards.length === 0 ? (
                  <p className="muted">Aguardando cartas na vaza...</p>
                ) : (
                  table.currentTrickCards.map((played) => {
                    const player = table.players.find((p) => p.id === played.playerId);
                    const isWinningCard =
                      table.pendingTrickWinnerId === played.playerId &&
                      table.pendingTrickWinningCard?.rank === played.card.rank &&
                      table.pendingTrickWinningCard?.suit === played.card.suit;

                    const cardWrapClasses = ['trick-card-wrap', isWinningCard ? 'winning-card' : '']
                      .filter(Boolean)
                      .join(' ');

                    return (
                      <div
                        key={`${played.playerId}-${played.card.suit}-${played.card.rank}`}
                        className={cardWrapClasses}
                      >
                        <CardView card={played.card} />
                        <small>{player?.name ?? played.playerId}</small>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="center-side-cards">
                <div>
                  <small>Manilha</small>
                  {table.manilhaCard ? <CardView card={table.manilhaCard} /> : <p>-</p>}
                </div>
                <div>
                  <small>Fundo</small>
                  {table.bottomCard ? <CardView card={table.bottomCard} /> : <p>-</p>}
                </div>
              </div>
            </div>

            <ul className="seat-ring">
              {table.players.map((player, index) => {
                const isTurn = table.currentTurnIndex === index;
                const isDealer = table.dealerIndex === index;
                const isMePlayer = meId === player.id;
                const isPendingWinner = table.pendingTrickWinnerId === player.id;
                const isLastWinner = !table.pendingTrickWinnerId && table.lastTrickWinnerId === player.id;

                const relativeIndex = (index - focusIndex + totalPlayers) % totalPlayers;
                const angle = (Math.PI / 2) + relativeIndex * seatStep;
                const x = Math.cos(angle) * seatRadiusX;
                const y = Math.sin(angle) * seatRadiusY;

                const playerClasses = [
                  'table-seat',
                  isTurn ? 'turn' : '',
                  isPendingWinner ? 'trick-winner' : '',
                  isLastWinner ? 'last-winner' : '',
                  isMePlayer ? 'is-me' : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                const seatStyle: CSSProperties = {
                  transform: `translate(${x}px, ${y}px)`,
                };

                return (
                  <li key={player.id} className={playerClasses} style={seatStyle}>
                    {isDealer ? <span className="dealer-chip">D</span> : null}

                    <strong>{player.name}</strong>
                    <p>
                      moedas {player.coins} | cartas {player.cardCount} | vazas {player.tricksWon}
                    </p>

                    <div className="tag-row">
                      {isMePlayer ? <span className="tag">voce</span> : null}
                      {isTurn ? <span className="tag tag-turn">vez</span> : null}
                      {isPendingWinner ? <span className="tag tag-winner">venceu vaza</span> : null}
                      {isLastWinner ? <span className="tag tag-last-winner">ultima vaza</span> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      <section className="table-bottom-grid">
        <article className="panel actions-panel">
          <h3>Acoes</h3>

          <button
            type="button"
            className="btn btn-primary"
            onClick={onStartRound}
            disabled={!canStartRound || sendingAction}
          >
            Iniciar rodada
          </button>

          <div className="action-group">
            <p className="muted">Decisao da fase de aposta</p>
            <div className="button-row">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => onBetAction('PLAY')}
                disabled={!canBet || sendingAction}
              >
                Jogar
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => onBetAction('FOLD')}
                disabled={!canBet || sendingAction}
              >
                Desistir
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => onBetAction('MACACA')}
                disabled={!canBet || sendingAction}
              >
                Macaca
              </button>
            </div>
          </div>
        </article>

        <article className="panel my-hand-panel">
          <h3>Minha mao</h3>
          {!me ? (
            <p className="muted">Aguardando estado do jogador...</p>
          ) : me.hand.length === 0 ? (
            <p className="muted">Sem cartas na mao no momento.</p>
          ) : (
            <div className="hand-row">
              {me.hand.map((card) => (
                <CardView
                  key={`${card.suit}-${card.rank}`}
                  card={card}
                  disabled={!canPlayCard || sendingAction}
                  onClick={() => onPlayCard(card.suit, card.rank)}
                />
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
