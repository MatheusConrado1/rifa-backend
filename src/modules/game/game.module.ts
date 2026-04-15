import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GameGateway } from './gateways/game/game.gateway';

@Module({
  imports: [AuthModule],
  providers: [GameGateway],
})
export class GameModule {}
