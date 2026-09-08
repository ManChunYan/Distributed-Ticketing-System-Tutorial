# Distributed-Ticketing-System-Tutorial

Learn distributed systems by evolving a simple ticketing service through concurrency

---

## Prerequisites

Make sure the following tools are installed:

Node.js
pnpm
Docker
Docker Compose
k6 — used for load testing

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

##Chapter 1 — Simple Ticketing System

tag 0.1.0

Stack: NestJS / PostgreSQL / Docker Compose / k6

Build

Client → NestJS → PostgreSQL

Build a basic ticket purchasing flow:

Read Ticket → Check Stock → Decrease Stock → Create Order

Test

100 Tickets / 1,000 Concurrent Requests

Result

Orders > 100 → Overselling

Problem

The Read → Check → Write flow causes a Race Condition under concurrent requests.

Next

How can the database safely handle concurrent updates?
