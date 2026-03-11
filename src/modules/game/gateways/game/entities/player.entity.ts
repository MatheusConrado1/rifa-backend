import { Card } from './card.entity';

const STARTING_COINS = 10;

export class Player {
  public hand: Card[] = [];
  public coins: number = STARTING_COINS;
  public isPlayingRound: boolean = false;
  public tricksWon: number = 0;

  constructor(
    public readonly id: string,
    public readonly name: string,
  ) {}

  payCoins(amount: number): void {
    if (this.coins >= amount) {
      this.coins -= amount;
    } else {
      this.coins = 0;
    }
  }
}
