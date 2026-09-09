import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor() {
    this.client = new Redis({
      host: 'localhost',
      port: 6379,
    });
  }

  async ping() {
    return this.client.ping();
  }

  async get(key: string) {
    return this.client.get(key);
  }

  async set(key: string, value: string | number) {
    return this.client.set(key, value);
  }

  async del(key: string) {
    return this.client.del(key);
  }

  getClient() {
    return this.client;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
