# Distributed Ticketing System Tutorial

Learn distributed systems by evolving a simple ticketing service through concurrency problems and their solutions.

---

## Project Purpose

This repository is a teaching project built around a ticket-purchasing scenario.
Its goal is to demonstrate concurrency and distributed-system problems step by step,
starting from intentionally simple implementations and evolving them over time.

The focus is on making each problem easy to reproduce, observe, and understand.
Production-grade architecture, abstractions, and code cleanliness are not the primary
focus, so some implementations are intentionally naive for teaching purposes.

---

## Prerequisites

Make sure the following tools are installed:

- Node.js
- pnpm
- Docker
- Docker Compose
- k6 (load testing)

Check your installation:

```bash
node -v
pnpm -v
docker -v
docker compose version
k6 version
```

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

REDIS_HOST=localhost
REDIS_PORT=6379

RESERVATION_STRATEGY=REDIS_GATE

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

## Chapters

### Chapter 1 - Simple Ticketing System

Tag: `0.1.0`

Build a basic ticket-purchasing flow and use concurrent requests to demonstrate
how a naive read-check-write implementation can oversell ticket inventory.

[Read Chapter 1 →](docs/chapter-01-simple-ticketing-system.md)

### Chapter 2 - Database Concurrency Control

Tag: `0.2.0`

Compare pessimistic locking, optimistic locking, and conditional atomic updates, then use an atomic update to prevent overselling under concurrent requests.

[Read Chapter 2 →](docs/chapter-02-database-concurrency-control.md)

### Chapter 3 - Redis Admission Gate & Reservation

Tag: 0.3.0

Introduce Redis as an admission gate to reject sold-out requests before they reach PostgreSQL, while keeping PostgreSQL as the final correctness boundary.

[Read Chapter 3 →](docs/chapter-03-redis-admission-gate-and-reservation.md)
