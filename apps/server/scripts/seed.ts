import dotenv from 'dotenv';
import path from 'path';
import { Client } from 'pg';

dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});

const EVENT_ID = '00000000-0000-0000-0000-000000000001';
const TICKET_ID = '00000000-0000-0000-0000-000000000002';

async function seed() {
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME ?? 'ticketing',
    password: process.env.DB_PASSWORD ?? 'ticketing',
    database: process.env.DB_DATABASE ?? 'ticketing',
  });

  await client.connect();

  try {
    console.log('Resetting benchmark data...');

    await client.query(`
      TRUNCATE TABLE orders, tickets, events CASCADE;
    `);

    console.log('Creating benchmark event...');

    await client.query(
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

    await client.query(
      `
        INSERT INTO tickets (
          id,
          event_id,
          total,
          remaining
        )
        VALUES ($1, $2, $3, $4);
      `,
      [TICKET_ID, EVENT_ID, 100, 100],
    );

    console.log('');
    console.log('Benchmark seed completed.');
    console.log(`Event ID:  ${EVENT_ID}`);
    console.log(`Ticket ID: ${TICKET_ID}`);
    console.log('Tickets:   100');
    console.log('Remaining: 100');
  } finally {
    await client.end();
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
