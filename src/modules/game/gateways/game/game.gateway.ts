import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GamePhase, Table } from '../../entities/table.entity';
import { Player } from '../../entities/player.entity';
import { JwtService } from '@nestjs/jwt';
import { getCorsOrigins } from '../../../../config/cors';

@WebSocketGateway({
  cors: {
    origin: getCorsOrigins(),
    credentials: true,
  },
})
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private activeTables = new Map<string, Table>();
  private readonly TRICK_RESOLUTION_DELAY_MS = 1800;

  constructor(private readonly jwtService: JwtService) {}

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getAuthenticatedUserId(client: Socket): string {
    const payload = client.data.user as
      | { sub?: string; userId?: string }
      | undefined;
    const userId = payload?.sub ?? payload?.userId;
    if (!userId) {
      throw new Error('Não autorizado.');
    }
    return userId;
  }

  private broadcastTableState(table: Table): void {
    for (const player of table.players) {
      this.server.to(player.socketId).emit('estado_atualizado', {
        mesa: table.getSanitizedState(player.id),
      });
    }
  }

  afterInit(server: Server) {
    console.log('Gateway do Jogo Inicializado com sucesso!');
  }

  handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.headers.authorization;
      const authToken =
        typeof client.handshake.auth?.token === 'string'
          ? client.handshake.auth.token
          : undefined;

      const tokenFromHeader =
        authHeader && authHeader.startsWith('Bearer ')
          ? authHeader.replace('Bearer ', '').trim()
          : undefined;

      const token = tokenFromHeader ?? authToken;

      if (!token) {
        throw new Error('Token ausente.');
      }

      const payload = this.jwtService.verify(token);
      client.data.user = payload;

      console.log(`Jogador conectado: ${client.id}`);
    } catch (error) {
      client.emit('error', { message: 'Não autorizado.' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Jogador desconectado: ${client.id}`);

    for (const table of this.activeTables.values()) {
      const player = table.players.find((p) => p.socketId === client.id);
      if (!player) {
        continue;
      }

      table.setPlayerAway(player.id);
      this.broadcastTableState(table);
      break;
    }
  }

  @SubscribeMessage('entrar_na_mesa')
  async handleJoinTable(
    @MessageBody() data: { nome: string; mesaId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.nome || !data?.mesaId) {
      return { status: 'erro', mensagem: 'Payload inválido.' };
    }
    if (!client.data.user) {
      return { status: 'erro', mensagem: 'Não autorizado.' };
    }
    await client.join(data.mesaId);

    let table = this.activeTables.get(data.mesaId);
    if (!table) {
      table = new Table(data.mesaId);
      this.activeTables.set(data.mesaId, table);
      console.log(`🆕 Nova mesa criada: ${data.mesaId}`);
    }

    try {
      const userId = this.getAuthenticatedUserId(client);
      const player = new Player(userId, data.nome, client.id);
      table.addPlayer(player);
      console.log(`👤 ${data.nome} sentou na mesa ${data.mesaId}`);
    } catch (error: any) {
      return { status: 'erro', mensagem: error.message };
    }

    console.log(
      `👤 ${data.nome} (Socket: ${client.id}) entrou na mesa ${data.mesaId}`,
    );

    client.to(data.mesaId).emit('jogador_entrou', {
      mensagem: `${data.nome} sentou na mesa!`,
      jogadorId: this.getAuthenticatedUserId(client),
      jogadoresTotais: table.players.length,
    });

    this.broadcastTableState(table);

    return {
      status: 'sucesso',
      mensagem: `Você entrou na mesa ${data.mesaId}`,
    };
  }

  @SubscribeMessage('iniciar_jogo')
  async handleStartGame(
    @MessageBody() data: { mesaId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{ status: string; mensagem?: string }> {
    if (!data?.mesaId) {
      return { status: 'erro', mensagem: 'Payload inválido.' };
    }
    if (!client.data.user) {
      return { status: 'erro', mensagem: 'Não autorizado.' };
    }
    const table = this.activeTables.get(data.mesaId);

    if (!table) {
      return { status: 'erro', mensagem: 'Mesa não encontrada.' };
    }

    if (table.phase === GamePhase.GAME_OVER) {
      return {
        status: 'erro',
        mensagem: 'O jogo já acabou! A mesa foi encerrada.',
      };
    }

    try {
      table.startRound();
      console.log(`Rodada iniciada na mesa ${data.mesaId}!`);

      for (const player of table.players) {
        this.server.to(player.socketId).emit('rodada_iniciada', {
          mensagem: 'O jogo começou!',
          mesa: table.getSanitizedState(player.id),
        });
      }

      return { status: 'sucesso' };
    } catch (error: any) {
      return { status: 'erro', mensagem: error.message };
    }
  }

  @SubscribeMessage('acao_aposta')
  async handleBettingAction(
    @MessageBody() data: { mesaId: string; acao: 'PLAY' | 'FOLD' | 'MACACA' },
    @ConnectedSocket() client: Socket,
  ): Promise<{ status: string; mensagem?: string }> {
    if (!data?.mesaId || !data?.acao) {
      return { status: 'erro', mensagem: 'Payload inválido.' };
    }
    if (!client.data.user) {
      return { status: 'erro', mensagem: 'Não autorizado.' };
    }
    const table = this.activeTables.get(data.mesaId);
    if (!table) return { status: 'erro', mensagem: 'Mesa não encontrada.' };

    try {
      const userId = this.getAuthenticatedUserId(client);
      table.processBettingAction(userId, data.acao);

      this.server.to(data.mesaId).emit('acao_aposta_processada', {
        playerId: userId,
        acao: data.acao,
      });

      this.broadcastTableState(table);

      return { status: 'sucesso' };
    } catch (error: any) {
      return { status: 'erro', mensagem: error.message };
    }
  }

  @SubscribeMessage('jogar_carta')
  async handlePlayCard(
    @MessageBody() data: { mesaId: string; suit: string; rank: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{ status: string; mensagem?: string }> {
    if (!data?.mesaId || !data?.suit || !data?.rank) {
      return { status: 'erro', mensagem: 'Payload inválido.' };
    }
    if (!client.data.user) {
      return { status: 'erro', mensagem: 'Não autorizado.' };
    }
    const table = this.activeTables.get(data.mesaId);
    if (!table) return { status: 'erro', mensagem: 'Mesa não encontrada.' };

    try {
      const userId = this.getAuthenticatedUserId(client);
      table.playCard(userId, data.suit, data.rank);

      this.broadcastTableState(table);

      if (table.hasPendingTrickResolution()) {
        await this.sleep(this.TRICK_RESOLUTION_DELAY_MS);
        table.resolveCurrentTrick();
        this.broadcastTableState(table);
      }

      return { status: 'sucesso' };
    } catch (error: any) {
      return { status: 'erro', mensagem: error.message };
    }
  }

  @SubscribeMessage('definir_boca')
  async handleSetRoundStake(
    @MessageBody() data: { mesaId: string; valor: number },
    @ConnectedSocket() client: Socket,
  ): Promise<{ status: string; mensagem?: string }> {
    if (!data?.mesaId || typeof data?.valor !== 'number') {
      return { status: 'erro', mensagem: 'Payload inválido.' };
    }
    if (!client.data.user) {
      return { status: 'erro', mensagem: 'Não autorizado.' };
    }

    const table = this.activeTables.get(data.mesaId);
    if (!table) return { status: 'erro', mensagem: 'Mesa não encontrada.' };

    try {
      const userId = this.getAuthenticatedUserId(client);
      table.setRoundStake(userId, data.valor);
      this.broadcastTableState(table);
      return { status: 'sucesso', mensagem: `Boca ajustada para ${table.roundStake}.` };
    } catch (error: any) {
      return { status: 'erro', mensagem: error.message };
    }
  }
}
