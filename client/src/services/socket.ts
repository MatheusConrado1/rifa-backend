import { io, type Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config';
import type { ApiAck, BettingAction, TableState } from '../types';

type AckCallback = (response: ApiAck) => void;

export interface GameSocketHandlers {
  onConnect: () => void;
  onDisconnect: (reason: string) => void;
  onUnauthorized: () => void;
  onError: (message: string) => void;
  onTableState: (table: TableState) => void;
  onPlayerJoined: (message: string) => void;
}

export class GameSocketClient {
  private socket: Socket | null = null;

  connect(token: string, handlers: GameSocketHandlers): void {
    this.disconnect();

    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      upgrade: false,
      withCredentials: true,
      auth: {
        token,
      },
      extraHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });

    this.socket.on('connect', handlers.onConnect);
    this.socket.on('disconnect', handlers.onDisconnect);

    this.socket.on('error', (payload: { message?: string } | string) => {
      const message =
        typeof payload === 'string'
          ? payload
          : (payload.message ?? 'Erro desconhecido.');

      if (message.toLowerCase().includes('não autorizado')) {
        handlers.onUnauthorized();
        return;
      }

      handlers.onError(message);
    });

    this.socket.on('rodada_iniciada', (payload: { mesa: TableState }) => {
      handlers.onTableState(payload.mesa);
    });

    this.socket.on('estado_atualizado', (payload: { mesa: TableState }) => {
      handlers.onTableState(payload.mesa);
    });

    this.socket.on('jogador_entrou', (payload: { mensagem?: string }) => {
      handlers.onPlayerJoined(payload.mensagem ?? 'Jogador entrou na mesa.');
    });
  }

  disconnect(): void {
    if (!this.socket) {
      return;
    }
    this.socket.disconnect();
    this.socket = null;
  }

  joinTable(name: string, mesaId: string, cb: AckCallback): void {
    this.emitWithAck('entrar_na_mesa', { nome: name, mesaId }, cb);
  }

  startGame(mesaId: string, cb: AckCallback): void {
    this.emitWithAck('iniciar_jogo', { mesaId }, cb);
  }

  bettingAction(mesaId: string, action: BettingAction, cb: AckCallback): void {
    this.emitWithAck('acao_aposta', { mesaId, acao: action }, cb);
  }

  playCard(mesaId: string, suit: string, rank: string, cb: AckCallback): void {
    this.emitWithAck('jogar_carta', { mesaId, suit, rank }, cb);
  }

  get socketId(): string | undefined {
    return this.socket?.id;
  }

  private emitWithAck(
    event: string,
    payload: Record<string, unknown>,
    cb: AckCallback,
  ): void {
    if (!this.socket || !this.socket.connected) {
      cb({ status: 'erro', mensagem: 'Socket desconectado.' });
      return;
    }

    this.socket.emit(event, payload, (response: ApiAck) => cb(response));
  }
}
