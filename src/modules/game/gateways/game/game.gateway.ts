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

@WebSocketGateway({
  cors: {
    origin: [
      'https://127.0.0.1:5500',
      'https://localhost:5500',
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      'http://127.0.0.1:4173',
      'http://localhost:4173',
    ],
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

  private broadcastTableState(table: Table): void {
    for (const player of table.players) {
      this.server.to(player.id).emit('estado_atualizado', {
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
      const player = new Player(client.id, data.nome);
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
      jogadorId: client.id,
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
        this.server.to(player.id).emit('rodada_iniciada', {
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
      table.processBettingAction(client.id, data.acao);

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
      table.playCard(client.id, data.suit, data.rank);

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
}
