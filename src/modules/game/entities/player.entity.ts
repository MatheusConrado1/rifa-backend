import { Card } from './card.entity';

const STARTING_COINS = 10;

export class Player {
  public hand: Card[] = [];
  public coins: number = STARTING_COINS;
  public isPlayingRound: boolean = false;
  public hasActed: boolean = false;
  public tricksWon: number = 0;

  constructor(
    public readonly id: string,
    public readonly name: string,
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
