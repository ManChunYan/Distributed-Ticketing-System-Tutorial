# Ticketing Server

NestJS API for the distributed ticketing tutorial.

## Local development

```bash
cp .env.example .env
pnpm install
docker compose up -d
pnpm run start:dev
```

The API listens on `http://localhost:3000` by default. The application creates
the TypeORM schema automatically for this tutorial.

## Benchmark

Seed the database after the server has started:

```bash
pnpm run seed
pnpm run load:test
```

The load test sends 1,000 purchase requests against the seeded ticket. Chapter
1 intentionally keeps the read/check/write race condition so overselling can
be observed. Do not use this implementation for a production checkout flow.

## Verification

```bash
pnpm run build
pnpm test
```

## API surface

- `POST /events` creates an event.
- `POST /events/:eventId/tickets` creates ticket inventory.
- `POST /tickets/:ticketId/purchase` purchases one ticket.
- `GET /orders/:id` retrieves an order.
