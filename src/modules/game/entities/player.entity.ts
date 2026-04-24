import { Card } from './card.entity';

const STARTING_COINS = 10;

export type SeatStatus = 'ACTIVE' | 'DEAD' | 'AWAY' | 'SPECTATOR';
export type RoundDecision = 'PLAY' | 'FOLD' | 'MACACA' | null;

export class Player {
  public hand: Card[] = [];
  public coins: number = STARTING_COINS;
  public isPlayingRound: boolean = false;
  public hasActed: boolean = false;
  public tricksWon: number = 0;
  public seatStatus: SeatStatus = 'ACTIVE';
  public lastDecision: RoundDecision = null;

  public pendingPenalty: number = 0;

  constructor(
    public readonly id: string,
    public name: string,
    public socketId: string,
  ) {}

  payCoins(amount: number): number {
    if (this.coins >= amount) {
      this.coins -= amount;
      return amount;
    } else {
      const allInAmount = this.coins;
      this.coins = 0;
      return allInAmount;
    }
  }
}
