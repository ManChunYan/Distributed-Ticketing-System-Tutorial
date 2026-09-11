import { ConflictException, Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RedisReservationGate {
  constructor(private readonly redisService: RedisService) {}

  async reserve(params: {
    ticketId: string;
    reservationId: string;
    userId: string;
    expiresAt: Date;
  }) {
    const { ticketId, reservationId, userId, expiresAt } = params;

    const stockKey = `ticket:${ticketId}:stock`;
    const reservationKey = `reservation:${reservationId}`;

    const ttlMs = expiresAt.getTime() - Date.now();

    const lua = `
      local stock = tonumber(redis.call('GET', KEYS[1]))

      if not stock or stock <= 0 then
        return 0
      end

      redis.call('DECR', KEYS[1])

      redis.call(
        'HSET',
        KEYS[2],
        'ticketId', ARGV[1],
        'userId', ARGV[2],
        'expiresAt', ARGV[3],
        'state', 'RESERVED'
      )

      redis.call('PEXPIRE', KEYS[2], ARGV[4])

      return 1
    `;

    const result = await this.redisService
      .getClient()
      .eval(
        lua,
        2,
        stockKey,
        reservationKey,
        ticketId,
        userId,
        expiresAt.toISOString(),
        ttlMs.toString(),
      );

    if (Number(result) !== 1) {
      throw new ConflictException('Ticket sold out');
    }
  }
}
