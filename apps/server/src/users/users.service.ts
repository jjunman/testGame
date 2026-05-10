import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  create(data: Partial<User>) {
    return this.usersRepository.save(this.usersRepository.create(data));
  }

  findByEmail(email: string) {
    return this.usersRepository.findOne({ where: { email } });
  }

  findById(id: string) {
    return this.usersRepository.findOne({ where: { id } });
  }

  async savePushToken(userId: string, token: string, platform?: string | null) {
    const user = await this.findById(userId);
    if (!user) {
      return null;
    }

    user.expoPushToken = token;
    user.pushPlatform = platform ?? null;
    return this.usersRepository.save(user);
  }
}
