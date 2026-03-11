export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';

export type Rank = '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export class Card {
  constructor(
    public readonly suit: Suit,
    public readonly rank: Rank,
  ) {}

  get imageFilename(): string {
    return `${this.suit}_${this.rank}.png`;
  }
}
