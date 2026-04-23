export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';

export type Rank = '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export type BettingAction = 'PLAY' | 'FOLD' | 'MACACA';

export type GamePhase =
  | 'WAITING_PLAYERS'
  | 'BETTING_PHASE'
  | 'PLAYING_CARDS'
  | 'ROUND_END'
  | 'GAME_OVER';

export type Card = {
  suit: Suit;
  rank: Rank;
};

export type PlayerState = {
  id: string;
  name: string;
  coins: number;
  isPlayingRound: boolean;
  hasActed: boolean;
  pendingPenalty: number;
  tricksWon: number;
  hand: Card[];
  cardCount: number;
};

export type TrickCard = {
  playerId: string;
  card: Card;
};

export type TableState = {
  id: string;
  phase: GamePhase;
  pot: number;
  manilha: Suit | null;
  service: Suit | null;
  currentTrickCards: TrickCard[];
  isResolvingTrick: boolean;
  pendingTrickWinnerId: string | null;
  pendingTrickWinningCard: Card | null;
  lastTrickWinnerId: string | null;
  manilhaCard: Card | null;
  bottomCard: Card | null;
  macacaCount: number;
  dealerIndex: number;
  currentTurnIndex: number;
  players: PlayerState[];
};

export type AuthResponse = {
  accessToken: string;
};
