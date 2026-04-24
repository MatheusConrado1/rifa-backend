import { useEffect, useMemo, useRef, useState } from 'react';
import { CardView } from './CardView';
import type { BettingAction, Card, TableState } from '../types';
import type { CSSProperties } from 'react';
import { playSfx } from '../services/audio';

type GameBoardProps = {
  table: TableState;
  meId: string | null;
  warningMessage: string;
  lastBetAction: { playerId: string; action: BettingAction } | null;
  onStartRound: () => void;
  onSetRoundStake: (value: number) => void;
  onSetSpectator: () => void;
  onReturnNextRound: () => void;
  onBetAction: (action: BettingAction) => void;
  onPlayCard: (suit: string, rank: string) => void;
  sendingAction: boolean;
};

type Point = { x: number; y: number };

type FlyingCard = {
  id: string;
  card: Card;
  hidden?: boolean;
  from: Point;
  to: Point;
  durationMs: number;
  flipOnArrival?: boolean;
};

function asViewportPoint(el: HTMLElement | null): Point {
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function GameBoard({
  table,
  meId,
  warningMessage,
  lastBetAction,
  onStartRound,
  onSetRoundStake,
  onSetSpectator,
  onReturnNextRound,
  onBetAction,
  onPlayCard,
  sendingAction,
}: GameBoardProps) {
  const [flyingCards, setFlyingCards] = useState<FlyingCard[]>([]);
  const [isDealing, setIsDealing] = useState(false);
  const [visualMacacaCount, setVisualMacacaCount] = useState(table.macacaCount);
  const deckRef = useRef<HTMLDivElement | null>(null);
  const macacaRef = useRef<HTMLDivElement | null>(null);
  const manilhaRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const trickCenterRef = useRef<HTMLDivElement | null>(null);
  const myHandRef = useRef<HTMLDivElement | null>(null);
  const seatRefs = useRef<Map<string, HTMLLIElement | null>>(new Map());
  const prevTableRef = useRef<TableState | null>(null);
  const prevWarningRef = useRef('');
  const prevPhaseRef = useRef(table.phase);
  const animationTimeoutsRef = useRef<number[]>([]);

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

  const canBet = table.phase === 'BETTING_PHASE' && isMyTurn && !isDealing;
  const canSetStake =
    (table.phase === 'WAITING_PLAYERS' || table.phase === 'ROUND_END') &&
    !sendingAction &&
    !isDealing;
  const mySeatStatus = me?.seatStatus ?? 'SPECTATOR';
  const canTogglePresence = !sendingAction && !isDealing && mySeatStatus !== 'DEAD';
  const canPlayCard =
    table.phase === 'PLAYING_CARDS' &&
    isMyTurn &&
    !table.isResolvingTrick &&
    !isDealing;
  const isGameOver = table.phase === 'GAME_OVER';

  const totalPlayers = Math.max(table.players.length, 1);
  const seatStep = (Math.PI * 2) / totalPlayers;
  const seatRadiusX = totalPlayers <= 3 ? 330 : 378;
  const seatRadiusY = totalPlayers <= 3 ? 238 : 262;
  const meIndex = table.players.findIndex((player) => player.id === meId);
  const focusIndex = meIndex >= 0 ? meIndex : 0;

  const centralMessage =
    table.isResolvingTrick && pendingWinner
      ? `${pendingWinner.name} venceu esta vaza`
      : !table.isResolvingTrick && lastWinner
        ? `Ultima vaza: ${lastWinner.name}`
        : '';

  const alivePlayers = table.players.filter((player) => player.seatStatus !== 'DEAD');
  const potOwner = table.players.find((player) => player.id === table.potOwnerId) ?? null;
  const gameOverTitle =
    alivePlayers.length === 1
      ? `Fim de jogo: ${alivePlayers[0].name} venceu a partida`
      : 'Fim de jogo: restaram 2 jogadores na disputa';

  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  function scheduleCleanup(id: string, durationMs: number) {
    const timeoutId = window.setTimeout(() => {
      setFlyingCards((current) => current.filter((card) => card.id !== id));
    }, durationMs + 60);
    animationTimeoutsRef.current.push(timeoutId);
  }

  function enqueueFlyingCard(card: FlyingCard) {
    setFlyingCards((current) => [...current, card]);
    scheduleCleanup(card.id, card.durationMs);
  }

  function clearAnimationTimeouts() {
    for (const timeoutId of animationTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }
    animationTimeoutsRef.current = [];
  }

  useEffect(() => {
    return () => {
      clearAnimationTimeouts();
    };
  }, []);

  useEffect(() => {
    if (!isDealing) {
      setVisualMacacaCount(table.macacaCount);
    }
  }, [isDealing, table.macacaCount]);

  useEffect(() => {
    const prev = prevTableRef.current;
    if (!prev) {
      prevTableRef.current = table;
      return;
    }

    if (!reducedMotion) {
      const justEnteredBettingPhase =
        prev.phase !== 'BETTING_PHASE' && table.phase === 'BETTING_PHASE';

      if (justEnteredBettingPhase && table.players.length >= 2) {
        let cancelled = false;

        const runDealSequence = async () => {
          setIsDealing(true);
          setVisualMacacaCount(0);

          const dealerIndex = table.dealerIndex;
          const deckPoint = asViewportPoint(deckRef.current);
          const macacaPoint = asViewportPoint(macacaRef.current);
          const delayBetweenCards = 160;
          const flightDuration = 430;
          const revealDuration = 480;
          const rounds = 3;

          const orderFromAfterDealer = Array.from(
            { length: table.players.length },
            (_, idx) => (dealerIndex + 1 + idx) % table.players.length,
          );

          for (let round = 0; round < rounds; round += 1) {
            for (const playerIndex of orderFromAfterDealer) {
              if (cancelled) return;

              const targetPlayer = table.players[playerIndex];
              const seatPoint = asViewportPoint(
                seatRefs.current.get(targetPlayer.id) ?? null,
              );

              if (playerIndex === dealerIndex) {
                const macacaDealId = `deal-macaca-${round}-${Date.now()}`;
                enqueueFlyingCard({
                  id: macacaDealId,
                  card: { rank: 'A', suit: 'spades' },
                  hidden: true,
                  from: deckPoint,
                  to: macacaPoint,
                  durationMs: flightDuration,
                });
                playSfx('deal');
                setVisualMacacaCount((current) => Math.min(current + 1, 3));
                await wait(delayBetweenCards);
              }

              const dealId = `deal-${targetPlayer.id}-${round}-${Date.now()}`;
              enqueueFlyingCard({
                id: dealId,
                card: { rank: 'K', suit: 'clubs' },
                hidden: true,
                from: deckPoint,
                to: seatPoint,
                durationMs: flightDuration,
              });
              playSfx('deal');

              await wait(delayBetweenCards);
            }
          }

          if (cancelled) return;

          const manilhaPoint = asViewportPoint(manilhaRef.current);
          const bottomPoint = asViewportPoint(bottomRef.current);

          enqueueFlyingCard({
            id: `reveal-manilha-${Date.now()}`,
            card: table.manilhaCard ?? { rank: 'Q', suit: 'hearts' },
            hidden: false,
            from: deckPoint,
            to: manilhaPoint,
            durationMs: revealDuration,
            flipOnArrival: true,
          });
          playSfx('round_start');

          await wait(delayBetweenCards);

          enqueueFlyingCard({
            id: `reveal-bottom-${Date.now()}`,
            card: table.bottomCard ?? { rank: '9', suit: 'clubs' },
            hidden: false,
            from: deckPoint,
            to: bottomPoint,
            durationMs: revealDuration,
            flipOnArrival: true,
          });

          await wait(500);
          setVisualMacacaCount(table.macacaCount);
          setIsDealing(false);
        };

        void runDealSequence();

        prevTableRef.current = table;

        return () => {
          cancelled = true;
          setIsDealing(false);
        };
      }

      if (
        table.currentTrickCards.length > prev.currentTrickCards.length &&
        table.currentTrickCards.length > 0
      ) {
        const newCard = table.currentTrickCards[table.currentTrickCards.length - 1];
        const sourcePlayer = table.players.find((p) => p.id === newCard.playerId);

        const fromPoint =
          newCard.playerId === meId
            ? asViewportPoint(myHandRef.current)
            : asViewportPoint(seatRefs.current.get(newCard.playerId) ?? null);
        const toPoint = asViewportPoint(trickCenterRef.current);

        enqueueFlyingCard({
          id: `play-${newCard.playerId}-${newCard.card.suit}-${newCard.card.rank}-${Date.now()}`,
          card: newCard.card,
          from: fromPoint,
          to: toPoint,
          durationMs: 250,
          hidden: sourcePlayer ? false : true,
        });
        playSfx('play');
      }

      if (
        lastBetAction?.action === 'MACACA' &&
        table.phase === 'BETTING_PHASE' &&
        prev.macacaCount > table.macacaCount &&
        lastBetAction.playerId
      ) {
        const fromPoint = asViewportPoint(macacaRef.current);
        const toPoint =
          lastBetAction.playerId === meId
            ? asViewportPoint(myHandRef.current)
            : asViewportPoint(seatRefs.current.get(lastBetAction.playerId) ?? null);

        for (let idx = 0; idx < 3; idx += 1) {
          enqueueFlyingCard({
            id: `macaca-take-${idx}-${Date.now()}`,
            card: { rank: 'A', suit: 'spades' },
            hidden: true,
            from: fromPoint,
            to: toPoint,
            durationMs: 240,
          });
          playSfx('deal');
        }
        setVisualMacacaCount(table.macacaCount);
      }

      if (
        !prev.pendingTrickWinnerId &&
        table.pendingTrickWinnerId &&
        table.isResolvingTrick
      ) {
        playSfx('trick_win');
      }

    }

    prevTableRef.current = table;
  }, [lastBetAction, meId, reducedMotion, table, warningMessage]);

  useEffect(() => {
    if (!reducedMotion && warningMessage && warningMessage !== prevWarningRef.current) {
      playSfx('warning');
    }
    prevWarningRef.current = warningMessage;
  }, [reducedMotion, warningMessage]);

  useEffect(() => {
    if (!reducedMotion && prevPhaseRef.current !== 'GAME_OVER' && table.phase === 'GAME_OVER') {
      playSfx('game_over');
    }
    prevPhaseRef.current = table.phase;
  }, [reducedMotion, table.phase]);

  return (
    <div className="table-layout">
      <section className="poker-table-panel">
        {warningMessage ? <p className="table-warning-banner">{warningMessage}</p> : null}

        <div className="table-stage">
          <div className="felt-table">
            <div className="deck-stack" ref={deckRef} aria-hidden="true">
              <div className="playing-card card-back deck-card" />
              <div className="playing-card card-back deck-card offset-1" />
              <div className="playing-card card-back deck-card offset-2" />
            </div>

            <div className="macaca-stack" ref={macacaRef}>
              <small>Macaca</small>
              <div className="macaca-cards" aria-label="Macaca na mesa">
                {Array.from({ length: Math.max(visualMacacaCount, 0) }, (_, idx) => (
                  <div key={`macaca-${idx}`} className="playing-card card-back seat-card-back macaca-card" />
                ))}
                {visualMacacaCount === 0 ? <span className="muted">vazia</span> : null}
              </div>
            </div>

            <div className="table-center-hud">
              <div className="pot-on-table" aria-live="polite">
                <small>Pote atual</small>
                <strong>{table.pot}</strong>
                <div className="chip-row">
                  <span className="chip">Boca {table.roundStake}</span>
                  {potOwner ? <span className="chip">Dono: {potOwner.name}</span> : null}
                </div>
              </div>

              {centralMessage ? (
                <p className={`winner-banner ${table.isResolvingTrick ? '' : 'subtle'}`}>
                  {centralMessage}
                </p>
              ) : null}

              <div className="trick-center" ref={trickCenterRef}>
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
                <div ref={manilhaRef}>
                  <small>Manilha</small>
                  {table.manilhaCard ? <CardView card={table.manilhaCard} /> : <p>-</p>}
                </div>
                <div ref={bottomRef}>
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
                const isLastWinner =
                  !table.pendingTrickWinnerId && table.lastTrickWinnerId === player.id;

                const relativeIndex = (index - focusIndex + totalPlayers) % totalPlayers;
                const angle = Math.PI / 2 + relativeIndex * seatStep;
                const x = Math.cos(angle) * seatRadiusX;
                const y = Math.sin(angle) * seatRadiusY;
                const adjustedY = y < 0 ? y * 1.03 : y * 0.95;
                const finalY = isMePlayer ? adjustedY - 14 : adjustedY;

                const playerClasses = [
                  'table-seat',
                  isTurn ? 'turn' : '',
                  isPendingWinner ? 'trick-winner' : '',
                  isLastWinner ? 'last-winner' : '',
                  isMePlayer ? 'is-me' : '',
                  player.seatStatus !== 'ACTIVE' ? 'is-inactive' : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                const seatStyle: CSSProperties = {
                  transform: `translate(-50%, -50%) translate(${x}px, ${finalY}px)`,
                };

                return (
                  <li
                    key={player.id}
                    className={playerClasses}
                    style={seatStyle}
                    ref={(el) => {
                      seatRefs.current.set(player.id, el);
                    }}
                  >
                    {isDealer ? <span className="dealer-chip">D</span> : null}

                    <strong>{player.name}</strong>
                    <p>
                      moedas {player.coins} | cartas {player.cardCount} | vazas {player.tricksWon}
                    </p>

                    {!isMePlayer ? (
                      <div className="seat-card-backs" aria-hidden="true">
                        <div className="playing-card card-back seat-card-back" />
                        <div className="playing-card card-back seat-card-back" />
                        <div className="playing-card card-back seat-card-back" />
                      </div>
                    ) : null}

                    <div className="tag-row">
                      {isMePlayer ? <span className="tag">voce</span> : null}
                      {isTurn ? <span className="tag tag-turn">vez</span> : null}
                      {player.lastDecision ? (
                        <span className="tag tag-action">
                          {player.lastDecision === 'PLAY'
                            ? 'jogou'
                            : player.lastDecision === 'FOLD'
                              ? 'desistiu'
                              : 'pegou macaca'}
                        </span>
                      ) : null}
                      {player.seatStatus !== 'ACTIVE' ? (
                        <span className="tag tag-inactive">
                          {player.seatStatus === 'AWAY'
                            ? player.pendingReturn
                              ? 'volta na proxima'
                              : 'away'
                            : player.seatStatus === 'DEAD'
                              ? 'morto'
                              : 'espectando'}
                        </span>
                      ) : null}
                      {isPendingWinner ? <span className="tag tag-winner">venceu vaza</span> : null}
                      {isLastWinner ? <span className="tag tag-last-winner">ultima vaza</span> : null}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="my-hand-near-seat" ref={myHandRef}>
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
            </div>

            {isGameOver ? (
              <div className="game-over-overlay" role="status" aria-live="polite">
                <h3>{gameOverTitle}</h3>
                <p>
                  {alivePlayers.length === 1
                    ? 'A mesa foi encerrada. Volte ao lobby para iniciar uma nova partida.'
                    : 'A mesa começou com mais de dois jogadores e encerrou ao restarem dois vivos.'}
                </p>
              </div>
            ) : null}

            <div className="flying-layer" aria-hidden="true">
              {flyingCards.map((fly) => {
                const style: CSSProperties = {
                  '--from-x': `${fly.from.x}px`,
                  '--from-y': `${fly.from.y}px`,
                  '--to-x': `${fly.to.x}px`,
                  '--to-y': `${fly.to.y}px`,
                  '--duration': `${fly.durationMs}ms`,
                } as CSSProperties;

                return (
                  <div
                    key={fly.id}
                    className={`flying-card ${fly.flipOnArrival ? 'flip-on-arrival' : ''}`}
                    style={style}
                  >
                    <div className="flying-card-face">
                      {fly.hidden ? (
                        <div className="playing-card card-back" />
                      ) : (
                        <CardView card={fly.card} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="action-dock" aria-label="Acoes da rodada">
        <div className="stake-dock">
          {[3, 6, 9, 12].map((value) => (
            <button
              key={value}
              type="button"
              className={`btn btn-ghost ${table.roundStake === value ? 'is-selected' : ''}`}
              onClick={() => onSetRoundStake(value)}
              disabled={!canSetStake}
            >
              Boca {value}
            </button>
          ))}

          {mySeatStatus === 'ACTIVE' ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onSetSpectator}
              disabled={!canTogglePresence}
            >
              Espectar
            </button>
          ) : mySeatStatus === 'AWAY' || mySeatStatus === 'SPECTATOR' ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onReturnNextRound}
              disabled={!canTogglePresence}
            >
              Voltar
            </button>
          ) : null}
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={onStartRound}
          disabled={!canStartRound || sendingAction || isDealing}
        >
          Iniciar rodada
        </button>

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
      </section>
    </div>
  );
}
