# Distributed Ticketing System Tutorial

Learn distributed systems by evolving a simple ticketing service through concurrency

---

## Prerequisites

Make sure the following tools are installed:

- Node.js
- pnpm
- Docker
- Docker Compose
- k6 (load testing)

Check your installation:

node -v
pnpm -v
docker -v
docker compose version
k6 version

---

## Setup

### 1. Install Dependencies

Go to the server application:

```bash
cd apps/server
```

Install dependencies:

```bash
pnpm install
```

### 2. Configure Environment Variables

Create:

```text
apps/server/.env
```

Add:

```env
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=ticketing
DB_PASSWORD=ticketing
DB_DATABASE=ticketing

BASE_URL=http://localhost:3000
EVENT_ID=00000000-0000-0000-0000-000000000001
TICKET_ID=00000000-0000-0000-0000-000000000002
TICKET_TOTAL=100
LOAD_VUS=100
LOAD_ITERATIONS=1000
```

### 3. Start PostgreSQL

Start the infrastructure:

```bash
docker compose up -d
```

### 4. Start the Server

```bash
cd apps/server
pnpm run start:dev
```

The API will be available at:

```text
http://localhost:3000
```

---

### Chapter 1 - Simple Ticketing System

Tag: `0.1.0`

Stack: NestJS / PostgreSQL / Docker Compose / k6

Build

Client -> NestJS -> PostgreSQL

Build a basic ticket purchasing flow:

Read Ticket -> Check Stock -> Decrease Stock -> Create Order

Example:

```text
========== Overselling Result ==========
Initial tickets:      100
Created orders:       1000
Remaining stock:      81

OVERSELLING DETECTED
Oversold orders:      900
========================================

```

### Run the benchmark

From `apps/server`:

```bash
cp .env.example .env
pnpm install
docker compose up -d
pnpm run start:dev
```

In another terminal, after the server has created the database tables:

```bash
pnpm run seed
```

The seed script creates one event with ticket id
`00000000-0000-0000-0000-000000000002` and 100 available tickets.

Run the load test from `apps/server`:

```bash
pnpm run load:test
```

The benchmark intentionally uses a non-transactional read/check/write flow.
It demonstrates the race condition described in this chapter and is not a
production-safe purchasing implementation.

Test

100 Tickets / 1,000 Requests (100 virtual users)

Result

Orders > 100 -> Overselling

Problem

The Read -> Check -> Write flow causes a race condition under concurrent requests.

Next

How can the database safely handle concurrent updates?
