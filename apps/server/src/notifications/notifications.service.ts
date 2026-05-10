import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BandMember } from '../bands/band-member.entity';

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string | number | boolean | null>;
};

type ExpoPushMessage = PushPayload & {
  to: string;
  sound: 'default';
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(BandMember)
    private readonly membersRepository: Repository<BandMember>,
  ) {}

  async notifyBandMembers(
    bandId: string,
    payload: PushPayload,
    options: { excludeUserId?: string } = {},
  ) {
    const members = await this.membersRepository.find({
      where: { band: { id: bandId } },
      relations: ['user'],
    });
    const tokens = members
      .filter((member) => member.user.id !== options.excludeUserId)
      .map((member) => member.user.expoPushToken)
      .filter((token): token is string => this.isExpoPushToken(token));

    if (tokens.length === 0) {
      return { sent: 0 };
    }

    const messages = tokens.map<ExpoPushMessage>((token) => ({
      to: token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data,
    }));

    for (const chunk of this.chunk(messages, 100)) {
      await this.sendExpoPushChunk(chunk);
    }

    return { sent: tokens.length };
  }

  private isExpoPushToken(token?: string | null): token is string {
    return Boolean(
      token &&
      (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')),
    );
  }

  private chunk<T>(items: T[], size: number) {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }
    return chunks;
  }

  private async sendExpoPushChunk(messages: ExpoPushMessage[]) {
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(`Expo push failed: ${response.status} ${text}`);
      }
    } catch (error) {
      this.logger.warn(`Expo push request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
