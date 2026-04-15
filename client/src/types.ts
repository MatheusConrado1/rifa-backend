export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
export type Rank = '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export type BettingAction = 'PLAY' | 'FOLD' | 'MACACA';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export interface TrickCard {
  playerId: string;
  card: Card;
}

export interface PlayerState {
  id: string;
  name: string;
  coins: number;
  isPlayingRound: boolean;
  hasActed: boolean;
  pendingPenalty: number;
  tricksWon: number;
  hand: Card[];
  cardCount: number;
}

export type GamePhase =
  | 'WAITING_PLAYERS'
  | 'BETTING_PHASE'
  | 'PLAYING_CARDS'
  | 'ROUND_END'
  | 'GAME_OVER';

export interface TableState {
  id: string;
  phase: GamePhase;
  pot: number;
  manilha: Suit | null;
  service: Suit | null;
  currentTrickCards: TrickCard[];
  manilhaCard: Card | null;
  bottomCard: Card | null;
  dealerIndex: number;
  currentTurnIndex: number;
  players: PlayerState[];
}

export interface ApiAck {
  status: 'sucesso' | 'erro';
  mensagem?: string;
}

export interface AuthResponse {
  accessToken: string;
}
