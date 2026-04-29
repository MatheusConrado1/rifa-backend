import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(username: string, password: string): Promise<User> {
    const normalized = username.trim().toLowerCase();
    const existing = await this.usersService.findByUsername(normalized);
    if (existing) {
      throw new BadRequestException('Nome de usuário já está em uso.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    return this.usersService.createUser(normalized, passwordHash);
  }

  async validateUser(username: string, password: string): Promise<User> {
    const normalized = username.trim().toLowerCase();
    const user = await this.usersService.findByUsername(normalized);
    if (!user) {
      throw new UnauthorizedException('Usuário ou senha inválidos.');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Usuário ou senha inválidos.');
    }

    return user;
  }

  login(user: User) {
    const payload = { sub: user.id, username: user.username };
    return {
      accessToken: this.jwtService.sign(payload),
      userId: user.id,
      username: user.username,
    };
  }
}
