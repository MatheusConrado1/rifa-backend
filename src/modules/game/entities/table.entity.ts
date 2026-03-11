import { Deck } from './deck.entity';
import { Player } from './player.entity';
import { Card, Suit } from './card.entity';

export enum GamePhase {
  WAITING_PLAYERS = 'WAITING_PLAYERS',
  BETTING_PHASE = 'BETTING_PHASE',
  PLAYING_CARDS = 'PLAYING_CARDS',
  ROUND_END = 'ROUND_END',
}

export class Table {
  public players: Player[] = [];
  public deck: Deck | null = null;
  public phase: GamePhase = GamePhase.WAITING_PLAYERS;

  public pot: number = 0;
  public readonly ROUND_BASELINE = 3;
  public macaca: Card[] = [];
  public manilha: Suit | null = null;
  public manilhaCard: Card | null = null;
  public bottomCard: Card | null = null;

  public dealerIndex: number = 0;
  public currentTurnIndex: number = 0;

  constructor(public readonly id: string) {}

  addPlayer(player: Player): void {
    if (this.phase !== GamePhase.WAITING_PLAYERS) {
      throw new Error('O jogo já começou, não é possível entrar agora.');
    }
    this.players.push(player);
  }

  startRound(): void {
    if (this.players.length < 2) {
      throw new Error('Jogadores insuficientes para iniciar.');
    }

    this.deck = new Deck();

    // AJUSTAR PARA O DEALER PAGAR
    this.pot += this.ROUND_BASELINE;

    for (const player of this.players) {
      player.hand = [this.deck.draw(), this.deck.draw(), this.deck.draw()];
      player.isPlayingRound = true;
      player.tricksWon = 0;
    }

    this.macaca = [this.deck.draw(), this.deck.draw(), this.deck.draw()];

    this.manilhaCard = this.deck.draw();
    this.manilha = this.manilhaCard.suit;

    this.bottomCard = this.deck.bottomCard;

    this.currentTurnIndex = (this.dealerIndex + 1) % this.players.length;

    this.phase = GamePhase.BETTING_PHASE;
  }

  getSanitizedState(playerId: string) {
    return {
      id: this.id,
      phase: this.phase,
      pot: this.pot,
      manilha: this.manilha,
      manilhaCard: this.manilhaCard,
      bottomCard: this.bottomCard,
      dealerIndex: this.dealerIndex,
      currentTurnIndex: this.currentTurnIndex,
      macacaCount: this.macaca.length,

      players: this.players.map((p) => {
        const isMe = p.id === playerId;
        return {
          id: p.id,
          name: p.name,
          coins: p.coins,
          isPlayingRound: p.isPlayingRound,
          tricksWon: p.tricksWon,
          hand: isMe ? p.hand : [],
          cardCount: p.hand.length,
        };
      }),
    };
  }
}
