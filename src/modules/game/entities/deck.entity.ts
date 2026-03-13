import { Card, Rank, Suit } from './card.entity';

export class Deck {
  private cards: Card[] = [];

  constructor() {
    this.initialize();
    this.shuffle();
  }

  private initialize(): void {
    const suits: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
    const ranks: Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

    for (const suit of suits) {
      for (const rank of ranks) {
        this.cards.push(new Card(suit, rank));
      }
    }
  }

  // Fisher-Yates
  public shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  public draw(): Card {
    const card = this.cards.pop();
    if (!card) {
      throw new Error('Erro fatal: O baralho está vazio!');
    }
    return card;
  }

  public get remainingCards(): number {
    return this.cards.length;
  }

  public get bottomCard(): Card {
    return this.cards[0];
  }
}
