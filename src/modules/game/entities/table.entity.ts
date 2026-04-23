import { Deck } from './deck.entity';
import { Player } from './player.entity';
import { Card, Suit } from './card.entity';

export enum GamePhase {
  WAITING_PLAYERS = 'WAITING_PLAYERS',
  BETTING_PHASE = 'BETTING_PHASE',
  PLAYING_CARDS = 'PLAYING_CARDS',
  ROUND_END = 'ROUND_END',
  GAME_OVER = 'GAME_OVER',
}

export type BettingAction = 'PLAY' | 'FOLD' | 'MACACA';

const RankValues: Record<string, number> = {
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

export class Table {
  public players: Player[] = [];
  public deck: Deck | null = null;
  public phase: GamePhase = GamePhase.WAITING_PLAYERS;

  public pot: number = 0;
  public contestedPot: number = 0;
  public readonly ROUND_BASELINE = 3;
  public macaca: Card[] = [];
  public manilha: Suit | null = null;
  public manilhaCard: Card | null = null;
  public service: Suit | null = null;
  public bottomCard: Card | null = null;

  public dealerIndex: number = 0;
  public currentTurnIndex: number = 0;

  public currentTrickCards: { playerId: string; card: Card }[] = [];
  public tricksPlayed: number = 0;
  public isResolvingTrick: boolean = false;
  public pendingTrickWinnerId: string | null = null;
  public pendingTrickWinningCard: Card | null = null;
  public lastTrickWinnerId: string | null = null;

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

    const dealer = this.players[this.dealerIndex];
    const dealerPayment = dealer.payCoins(this.ROUND_BASELINE);
    this.pot += dealerPayment;

    for (const player of this.players) {
      if (player.pendingPenalty > 0) {
        this.pot += player.payCoins(player.pendingPenalty);
        player.pendingPenalty = 0;
      }
    }

    for (const player of this.players) {
      player.hand = [this.deck.draw(), this.deck.draw(), this.deck.draw()];
      player.isPlayingRound = false;
      player.hasActed = false;
      player.tricksWon = 0;
    }

    this.macaca = [this.deck.draw(), this.deck.draw(), this.deck.draw()];
    this.manilhaCard = this.deck.draw();
    this.manilha = this.manilhaCard.suit;
    this.bottomCard = this.deck.bottomCard;

    this.currentTurnIndex = (this.dealerIndex + 1) % this.players.length;
    this.isResolvingTrick = false;
    this.pendingTrickWinnerId = null;
    this.pendingTrickWinningCard = null;
    this.lastTrickWinnerId = null;
    this.phase = GamePhase.BETTING_PHASE;
  }

  processBettingAction(playerId: string, action: BettingAction): void {
    if (this.phase !== GamePhase.BETTING_PHASE) {
      throw new Error('Não estamos na fase de apostas.');
    }

    const currentPlayer = this.players[this.currentTurnIndex];

    if (currentPlayer.id !== playerId) {
      throw new Error('Calma, ainda não é a sua vez de decidir.');
    }
    if (currentPlayer.hasActed) {
      throw new Error('Você já tomou sua decisão nesta rodada.');
    }

    if (action === 'FOLD') {
      currentPlayer.isPlayingRound = false;
    } else if (action === 'PLAY') {
      if (!currentPlayer.hasPaid) {
        const payment = currentPlayer.payCoins(this.ROUND_BASELINE);
        this.pot += payment;
      }
      currentPlayer.isPlayingRound = true;
    } else if (action === 'MACACA') {
      if (this.macaca.length === 0) {
        throw new Error('Alguém já pegou a Macaca nesta rodada!');
      }
      if (!currentPlayer.hasPaid) {
        const payment = currentPlayer.payCoins(this.ROUND_BASELINE);
        this.pot += payment;
      }
      currentPlayer.isPlayingRound = true;

      currentPlayer.hand = [...this.macaca];
      this.macaca = [];
    }

    currentPlayer.hasActed = true;

    const allPlayersActed = this.players.every((p) => p.hasActed);

    if (allPlayersActed) {
      const activePlayers = this.players.filter((p) => p.isPlayingRound);

      if (activePlayers.length === 0) {
        const dealer = this.players[this.dealerIndex];
        dealer.coins += this.pot;
        this.pot = 0;
        this.prepareNextRound();
      } else if (activePlayers.length === 1) {
        const winner = activePlayers[0];
        winner.coins += this.pot;
        this.pot = 0;
        this.prepareNextRound();
      } else {
        this.phase = GamePhase.PLAYING_CARDS;
        this.contestedPot = this.pot;
        this.setNextActivePlayerTurn(this.dealerIndex);
      }
    } else {
      this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
    }
  }

  private setNextActivePlayerTurn(startIndex: number): void {
    let nextIndex = (startIndex + 1) % this.players.length;

    while (!this.players[nextIndex].isPlayingRound) {
      nextIndex = (nextIndex + 1) % this.players.length;
    }
    this.currentTurnIndex = nextIndex;
  }

  private getCardPower(card: Card): number {
    const basePower = RankValues[card.rank];
    const isManilha = card.suit === this.manilha;
    const isService = card.suit === this.service;

    return isManilha ? basePower + 100 : isService ? basePower + 50 : basePower;
  }

  playCard(playerId: string, suit: string, rank: string): void {
    if (this.phase !== GamePhase.PLAYING_CARDS) {
      throw new Error('Não estamos na fase de jogar cartas.');
    }
    if (this.isResolvingTrick) {
      throw new Error('Aguarde, estamos resolvendo a vaza atual.');
    }

    const currentPlayer = this.players[this.currentTurnIndex];
    if (currentPlayer.id !== playerId) {
      throw new Error('Não é a sua vez de jogar.');
    }

    const cardIndex = currentPlayer.hand.findIndex(
      (c) => c.suit === suit && c.rank === rank,
    );
    if (cardIndex === -1) {
      throw new Error('Você não tem essa carta na mão.');
    }

    const cardToPlay = currentPlayer.hand[cardIndex];
    const activePlayersCount = this.players.filter(
      (p) => p.isPlayingRound,
    ).length;

    // Trunfo para 3
    if (activePlayersCount >= 3 && this.tricksPlayed === 0) {
      const hasManilha = currentPlayer.hand.some(
        (c) => c.suit === this.manilha,
      );

      if (hasManilha && cardToPlay.suit !== this.manilha) {
        throw new Error(
          `Trunfo para 3! Você é obrigado a jogar um trunfo (${this.manilha}).`,
        );
      }
    }

    // Obrigação de Servir
    if (this.currentTrickCards.length > 0) {
      const hasServiceOrManilha = currentPlayer.hand.some(
        (c) => c.suit === this.service || c.suit === this.manilha,
      );
      if (hasServiceOrManilha) {
        const isValidPlay =
          cardToPlay.suit === this.service || cardToPlay.suit === this.manilha;
        if (!isValidPlay) {
          throw new Error(
            `Obrigação de servir! Você deve jogar uma carta de ${this.service} (naipe da mesa) ou ${this.manilha} (manilha).`,
          );
        }
      }
    }

    const [playedCard] = currentPlayer.hand.splice(cardIndex, 1);
    // Naipe da mesa
    if (this.currentTrickCards.length === 0) {
      this.service = playedCard.suit;
      this.lastTrickWinnerId = null;
    }
    this.currentTrickCards.push({
      playerId: currentPlayer.id,
      card: playedCard,
    });

    if (this.currentTrickCards.length === activePlayersCount) {
      this.evaluateTrickPreview();
    } else {
      this.setNextActivePlayerTurn(this.currentTurnIndex);
    }
  }

  private evaluateTrickPreview(): void {
    let winningPlayerId = '';
    let maxPower = -1;
    let winningCard: Card | null = null;

    for (const trick of this.currentTrickCards) {
      const power = this.getCardPower(trick.card);
      // DEPOIS AJUSTAR CASO DE DESEMPATE
      if (power > maxPower) {
        maxPower = power;
        winningPlayerId = trick.playerId;
        winningCard = trick.card;
      }
    }

    this.isResolvingTrick = true;
    this.pendingTrickWinnerId = winningPlayerId;
    this.pendingTrickWinningCard = winningCard;
  }

  hasPendingTrickResolution(): boolean {
    return this.isResolvingTrick;
  }

  resolveCurrentTrick(): void {
    if (!this.isResolvingTrick || !this.pendingTrickWinnerId) {
      return;
    }

    const winner = this.players.find((p) => p.id === this.pendingTrickWinnerId);
    if (winner) {
      winner.tricksWon += 1;
    }

    const winnerId = this.pendingTrickWinnerId;
    const winnerIndex = this.players.findIndex((p) => p.id === winnerId);

    this.currentTrickCards = [];
    this.service = null;
    this.tricksPlayed += 1;
    this.isResolvingTrick = false;
    this.lastTrickWinnerId = winnerId;
    this.pendingTrickWinnerId = null;
    this.pendingTrickWinningCard = null;

    if (this.tricksPlayed === 3) {
      this.endRound();
    } else if (winnerIndex >= 0) {
      this.currentTurnIndex = winnerIndex;
    }
  }

  private endRound(): void {
    const activePlayers = this.players.filter((p) => p.isPlayingRound);

    for (const player of activePlayers) {
      if (player.tricksWon === 0) {
        player.pendingPenalty = this.contestedPot;
      }
    }

    const coinPerTrick = Math.floor(this.pot / 3);
    let totalPayout = 0;

    for (const player of activePlayers) {
      if (player.tricksWon > 0) {
        const payout = player.tricksWon * coinPerTrick;
        player.coins += payout;
        totalPayout += payout;
      }
      player.hasPaid = false;
    }

    this.pot -= totalPayout;

    this.prepareNextRound();
  }

  private prepareNextRound(): void {
    let nextDealerIndex = (this.dealerIndex + 1) % this.players.length;

    const survivingCount = this.players.filter((p) => p.coins > 0).length;
    if (survivingCount > 1) {
      while (this.players[nextDealerIndex].coins <= 0) {
        nextDealerIndex = (nextDealerIndex + 1) % this.players.length;
      }
    }

    const nextDealerId = this.players[nextDealerIndex].id;

    this.players = this.players.filter((p) => p.coins > 0);

    if (this.players.length === 1) {
      this.phase = GamePhase.GAME_OVER;
      return;
    } else if (this.players.length === 0) {
      this.phase = GamePhase.GAME_OVER;
      return;
    }

    this.dealerIndex = this.players.findIndex((p) => p.id === nextDealerId);

    this.currentTrickCards = [];
    this.tricksPlayed = 0;
    this.contestedPot = 0;
    this.macaca = [];
    this.manilha = null;
    this.manilhaCard = null;
    this.bottomCard = null;
    this.service = null;
    this.isResolvingTrick = false;
    this.pendingTrickWinnerId = null;
    this.pendingTrickWinningCard = null;
    this.lastTrickWinnerId = null;

    this.phase = GamePhase.ROUND_END;
  }

  getSanitizedState(playerId: string) {
    return {
      id: this.id,
      phase: this.phase,
      pot: this.pot,
      manilha: this.manilha,
      service: this.service,
      currentTrickCards: this.currentTrickCards,
      isResolvingTrick: this.isResolvingTrick,
      pendingTrickWinnerId: this.pendingTrickWinnerId,
      pendingTrickWinningCard: this.pendingTrickWinningCard,
      lastTrickWinnerId: this.lastTrickWinnerId,
      manilhaCard: this.manilhaCard,
      bottomCard: this.bottomCard,
      macacaCount: this.macaca.length,
      dealerIndex: this.dealerIndex,
      currentTurnIndex: this.currentTurnIndex,

      players: this.players.map((p) => {
        const isMe = p.id === playerId;
        return {
          id: p.id,
          name: p.name,
          coins: p.coins,
          isPlayingRound: p.isPlayingRound,
          hasActed: p.hasActed,
          pendingPenalty: p.pendingPenalty,
          tricksWon: p.tricksWon,
          hand: isMe ? p.hand : [],
          cardCount: p.hand.length,
        };
      }),
    };
  }
}
