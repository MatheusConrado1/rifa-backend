import { CardView } from './CardView';
import type { BettingAction, GamePhase, TableState } from '../types';

type GameBoardProps = {
  table: TableState;
  meId: string | null;
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
  onStartRound,
  onBetAction,
  onPlayCard,
  sendingAction,
}: GameBoardProps) {
  const me = table.players.find((player) => player.id === meId) ?? null;
  const currentPlayer = table.players[table.currentTurnIndex] ?? null;

  const isMyTurn = me != null && currentPlayer?.id === me.id;
  const canStartRound =
    (table.phase === 'WAITING_PLAYERS' || table.phase === 'ROUND_END') &&
    table.players.length >= 2;

  const canBet = table.phase === 'BETTING_PHASE' && isMyTurn;
  const canPlayCard = table.phase === 'PLAYING_CARDS' && isMyTurn;

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

      <section className="table-grid">
        <article className="panel players-panel">
          <h3>Jogadores</h3>
          <ul className="players-list">
            {table.players.map((player, index) => {
              const isTurn = table.currentTurnIndex === index;
              const isDealer = table.dealerIndex === index;
              const isMePlayer = meId === player.id;

              return (
                <li key={player.id} className={isTurn ? 'turn' : ''}>
                  <div>
                    <strong>{player.name}</strong>
                    <p>
                      moedas {player.coins} | cartas {player.cardCount} | vazas {player.tricksWon}
                    </p>
                  </div>
                  <div className="tag-row">
                    {isMePlayer ? <span className="tag">voce</span> : null}
                    {isDealer ? <span className="tag">dealer</span> : null}
                    {isTurn ? <span className="tag tag-turn">vez</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </article>

        <article className="panel trick-panel">
          <h3>Cartas na mesa</h3>
          <div className="trick-row">
            {table.currentTrickCards.length === 0 ? (
              <p className="muted">Nenhuma carta jogada nesta vaza.</p>
            ) : (
              table.currentTrickCards.map((played) => {
                const player = table.players.find((p) => p.id === played.playerId);
                return (
                  <div key={`${played.playerId}-${played.card.suit}-${played.card.rank}`}>
                    <CardView card={played.card} />
                    <small>{player?.name ?? played.playerId}</small>
                  </div>
                );
              })
            )}
          </div>

          <div className="info-row">
            <div>
              <small>Manilha aberta</small>
              {table.manilhaCard ? <CardView card={table.manilhaCard} /> : <p>-</p>}
            </div>
            <div>
              <small>Fundo do deck</small>
              {table.bottomCard ? <CardView card={table.bottomCard} /> : <p>-</p>}
            </div>
          </div>
        </article>

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
      </section>

      <section className="panel my-hand-panel">
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
      </section>
    </div>
  );
}
