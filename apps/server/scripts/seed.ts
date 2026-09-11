import dotenv from 'dotenv';
import path from 'path';
import { Client } from 'pg';
import Redis from 'ioredis';

dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});

const EVENT_ID = process.env.EVENT_ID ?? '00000000-0000-0000-0000-000000000001';
const TICKET_ID =
  process.env.TICKET_ID ?? '00000000-0000-0000-0000-000000000002';
const TICKET_TOTAL = Number(process.env.TICKET_TOTAL ?? 100);

if (!Number.isInteger(TICKET_TOTAL) || TICKET_TOTAL <= 0) {
  throw new Error('TICKET_TOTAL must be a positive integer');
}

async function seed() {
  // PostgreSQL
  const db = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME ?? 'ticketing',
    password: process.env.DB_PASSWORD ?? 'ticketing',
    database: process.env.DB_DATABASE ?? 'ticketing',
  });

  // Redis
  const redis = new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
  });

  await db.connect();

  try {
    console.log('Resetting benchmark data...');

    await db.query(`
      DO $$
      DECLARE
        table_name text;
      BEGIN
        FOREACH table_name IN ARRAY ARRAY['orders', 'reservations', 'tickets', 'events']
        LOOP
          IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
            EXECUTE format('TRUNCATE TABLE %I CASCADE', table_name);
          END IF;
        END LOOP;
      END
      $$;
    `);

    console.log('Creating benchmark event...');

    await db.query(
      `
        INSERT INTO events (
          id,
          name,
          starts_at
        )
        VALUES ($1, $2, NOW() + INTERVAL '7 days');
      `,
      [EVENT_ID, 'Flash Sale Benchmark Event'],
    );

    console.log('Creating benchmark ticket...');

    await db.query(
      `
        INSERT INTO tickets (
          id,
          event_id,
          total,
          remaining
        )
        VALUES ($1, $2, $3, $4);
      `,
      [TICKET_ID, EVENT_ID, TICKET_TOTAL, TICKET_TOTAL],
    );

    const redisStockKey = `ticket:${TICKET_ID}:stock`;

    const staleKeys = await redis.keys('reservation:*');
    const staleStockKeys = await redis.keys('ticket:*:stock');
    if (staleKeys.length > 0 || staleStockKeys.length > 0) {
      await redis.del(...staleKeys, ...staleStockKeys);
    }

    await redis.set(redisStockKey, TICKET_TOTAL);

    console.log(`Redis stock initialized: ${redisStockKey} = ${TICKET_TOTAL}`);

    console.log('');
    console.log('Benchmark seed completed.');
    console.log(`Event ID:    ${EVENT_ID}`);
    console.log(`Ticket ID:   ${TICKET_ID}`);
    console.log(`Total:       ${TICKET_TOTAL}`);
    console.log(`DB stock:    ${TICKET_TOTAL}`);
    console.log(`Redis stock: ${TICKET_TOTAL}`);
    console.log(`Redis key:   ${redisStockKey}`);
  } finally {
    await Promise.all([db.end(), redis.quit()]);
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
