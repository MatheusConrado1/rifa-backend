import { Deck } from './deck.entity';
import { Player, SeatStatus } from './player.entity';
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
  public roundStake: number = 3;
  public potOwnerId: string | null = null;
  public initialPlayerCount: number = 0;
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

  private canParticipateRound(player: Player): boolean {
    return player.seatStatus === 'ACTIVE';
  }

  private markPlayerDead(player: Player): void {
    player.seatStatus = 'DEAD';
    player.isPlayingRound = false;
    player.hasActed = true;
    player.hand = [];
  }

  private findNextIndex(
    startIndex: number,
    predicate: (player: Player) => boolean,
  ): number {
    if (this.players.length === 0) {
      return -1;
    }

    let nextIndex = (startIndex + 1) % this.players.length;
    const initial = nextIndex;

    do {
      if (predicate(this.players[nextIndex])) {
        return nextIndex;
      }
      nextIndex = (nextIndex + 1) % this.players.length;
    } while (nextIndex !== initial);

    return -1;
  }

  private aliveCount(): number {
    return this.players.filter((p) => p.seatStatus !== 'DEAD').length;
  }

  private activeSeatCount(): number {
    return this.players.filter((p) => this.canParticipateRound(p)).length;
  }

  addPlayer(player: Player): void {
    const existing = this.players.find((p) => p.id === player.id);
    if (existing) {
      existing.socketId = player.socketId;
      existing.name = player.name;
      if (existing.seatStatus !== 'DEAD') {
        existing.seatStatus = 'ACTIVE';
      }
      existing.isPlayingRound = false;
      existing.hasActed = false;
      existing.lastDecision = null;
      return;
    }

    if (this.phase !== GamePhase.WAITING_PLAYERS) {
      throw new Error('O jogo já começou, não é possível entrar agora.');
    }

    this.players.push(player);
    this.initialPlayerCount = Math.max(this.initialPlayerCount, this.players.length);
  }

  startRound(): void {
    if (this.activeSeatCount() < 2) {
      throw new Error('Jogadores insuficientes para iniciar.');
    }

    this.deck = new Deck();

    const dealerCandidate = this.players[this.dealerIndex];
    if (!this.canParticipateRound(dealerCandidate)) {
      const nextDealer = this.findNextIndex(
        this.dealerIndex,
        (player) => this.canParticipateRound(player),
      );
      if (nextDealer === -1) {
        throw new Error('Nenhum jogador ativo disponível para distribuir.');
      }
      this.dealerIndex = nextDealer;
    }

    const dealer = this.players[this.dealerIndex];
    const dealerPayment = dealer.payCoins(this.roundStake);
    this.pot += dealerPayment;
    if (dealerPayment < this.roundStake) {
      this.markPlayerDead(dealer);
    }

    for (const player of this.players) {
      player.lastDecision = null;

      if (player.pendingPenalty > 0) {
        const penaltyToPay = player.pendingPenalty;
        const paidPenalty = player.payCoins(penaltyToPay);
        this.pot += paidPenalty;
        if (paidPenalty < penaltyToPay) {
          this.markPlayerDead(player);
        }
        player.pendingPenalty = 0;
      }
    }

    for (const player of this.players) {
      if (this.canParticipateRound(player)) {
        player.hand = [this.deck.draw(), this.deck.draw(), this.deck.draw()];
        player.hasActed = false;
      } else {
        player.hand = [];
        player.hasActed = true;
      }

      player.isPlayingRound = false;
      player.tricksWon = 0;
    }

    this.macaca = [this.deck.draw(), this.deck.draw(), this.deck.draw()];
    this.manilhaCard = this.deck.draw();
    this.manilha = this.manilhaCard.suit;
    this.bottomCard = this.deck.bottomCard;

    const firstDecisionIndex = this.findNextIndex(
      this.dealerIndex,
      (player) => !player.hasActed,
    );
    this.currentTurnIndex = firstDecisionIndex === -1 ? this.dealerIndex : firstDecisionIndex;
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
      currentPlayer.lastDecision = 'FOLD';
    } else if (action === 'PLAY') {
      currentPlayer.isPlayingRound = true;
      currentPlayer.lastDecision = 'PLAY';
    } else if (action === 'MACACA') {
      if (this.macaca.length === 0) {
        throw new Error('Alguém já pegou a Macaca nesta rodada!');
      }
      currentPlayer.isPlayingRound = true;
      currentPlayer.lastDecision = 'MACACA';

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
      const nextDecisionIndex = this.findNextIndex(
        this.currentTurnIndex,
        (player) => !player.hasActed,
      );
      if (nextDecisionIndex !== -1) {
        this.currentTurnIndex = nextDecisionIndex;
      }
    }
  }

  private setNextActivePlayerTurn(startIndex: number): void {
    const nextIndex = this.findNextIndex(
      startIndex,
      (player) => player.isPlayingRound,
    );
    if (nextIndex !== -1) {
      this.currentTurnIndex = nextIndex;
    }
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
    }

    this.pot -= totalPayout;

    this.prepareNextRound();
  }

  private prepareNextRound(): void {
    const nextDealerIndex = this.findNextIndex(
      this.dealerIndex,
      (player) => this.canParticipateRound(player),
    );

    if (this.initialPlayerCount <= 2) {
      if (this.aliveCount() <= 1) {
        this.phase = GamePhase.GAME_OVER;
        return;
      }
    } else if (this.aliveCount() <= 2) {
      this.phase = GamePhase.GAME_OVER;
      return;
    }

    for (const player of this.players) {
      player.hand = [];
      player.isPlayingRound = false;
      player.hasActed = false;
      player.lastDecision = null;
    }

    if (nextDealerIndex !== -1) {
      this.dealerIndex = nextDealerIndex;
    }

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
      roundStake: this.roundStake,
      potOwnerId: this.potOwnerId,
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
          seatStatus: p.seatStatus,
          lastDecision: p.lastDecision,
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

  setRoundStake(playerId: string, requestedStake: number): void {
    const allowedStakes = [3, 6, 9, 12];

    if (this.phase !== GamePhase.WAITING_PLAYERS && this.phase !== GamePhase.ROUND_END) {
      throw new Error('A boca só pode ser ajustada entre rodadas.');
    }

    if (!allowedStakes.includes(requestedStake)) {
      throw new Error('Valor de boca inválido. Use 3, 6, 9 ou 12.');
    }

    const player = this.players.find((p) => p.id === playerId);
    if (!player) {
      throw new Error('Jogador não encontrado na mesa.');
    }

    if (requestedStake > this.roundStake) {
      if (player.coins < requestedStake) {
        throw new Error(`Você precisa ter pelo menos ${requestedStake} moedas para aumentar a boca.`);
      }
      this.roundStake = requestedStake;
      this.potOwnerId = playerId;
      return;
    }

    if (requestedStake < this.roundStake) {
      if (!this.potOwnerId || this.potOwnerId !== playerId) {
        throw new Error('Somente o dono da boca pode diminuir o valor.');
      }
      this.roundStake = requestedStake;
    }
  }

  setPlayerAway(playerId: string): void {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) {
      return;
    }

    if (player.seatStatus === 'DEAD') {
      player.seatStatus = 'DEAD';
      return;
    }

    player.seatStatus = 'AWAY';
    player.isPlayingRound = false;
    player.hasActed = true;
    player.hand = [];

    if (this.phase === GamePhase.BETTING_PHASE) {
      const pendingPlayer = this.players[this.currentTurnIndex];
      if (pendingPlayer?.id === player.id) {
        const nextDecisionIndex = this.findNextIndex(
          this.currentTurnIndex,
          (candidate) => !candidate.hasActed,
        );
        if (nextDecisionIndex !== -1) {
          this.currentTurnIndex = nextDecisionIndex;
        }
      }
    }
  }
}
