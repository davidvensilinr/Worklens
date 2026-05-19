# WorkLens

**Bias-Free HR Analytics & Accountability Platform**

A secure, full-stack HR workspace that replaces subjective performance reviews with an immutable, algorithmically-driven "Proof-of-Work" system — ensuring every evaluation is backed by verifiable, tamper-proof data.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Security](#security)
- [Deployment](#deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [License](#license)

---

## Overview

WorkLens is an enterprise-grade HR management platform built with a core philosophy: eliminate human bias from employee evaluations. Instead of relying on subjective performance reviews, WorkLens automatically computes performance metrics from documented, verifiable system activities — attendance records, task completion rates, response times, peer verifications, and training certifications.

The platform serves as both an operational HR tool (managing employees, departments, teams, attendance, leaves, documents) and an analytical engine that feeds unbiased data into machine learning models for attrition prediction and workforce planning.

---

## Key Features

### Organization Management
- **Multi-tenant architecture** — Each organization operates in complete data isolation
- **Departments & Teams** — Hierarchical structure with Department Heads and Team Leads
- **Employee Profiles** — Comprehensive profiles with job history, manager assignment tracking, and performance snapshots
- **Role-Based Access Control** — Super Admin, HR Admin, Manager, and Employee roles

### Proof-of-Work Accountability System
- **Immutable Audit Trail** — Every action (task assignment, document submission, verification) is permanently logged
- **Peer Verification Pipeline** — Employee claims (certifications, deliveries) are cross-verified by peers before being accepted
- **Algorithmic Performance Metrics** — Automatically computed from system data:
  - Task completion rates and on-time delivery
  - Average chat response time
  - Meeting attendance and action item completion
  - Document submission timeliness
  - Collaboration and communication scores

### Task & Project Management
- **Projects** with progress tracking
- **Tasks** with priority levels, deadlines, and assignee management
- **Task Escalation System** — Employees can formally escalate blockers; managers track and resolve them
- **Meeting Actions** — Action items assigned during meetings are tracked as first-class tasks

### Real-Time Communication
- **1-on-1 & Group Chat** with WebSocket-powered instant messaging
- **WhatsApp-Style Message Replies** — Quote and reply to specific messages inline
- **File Sharing** — Images, documents, and attachments within chats
- **Voice & Video Calls** — WebRTC-powered peer-to-peer calling

### Video Conferencing
- **Meeting Rooms** — Mesh WebRTC topology for N-to-N video/audio streaming
- **In-Meeting Chat** — Persistent chat sidebar with reply support
- **Screen Sharing** — Share your screen with all meeting participants
- **Meeting Actions** — Assign and track action items directly inside meetings

### Attendance & Leave Management
- **Clock In/Out** with photo verification
- **Automated Late Detection** — Compares clock-in time against configured work schedule
- **Leave Requests** — Multi-type leave system (Annual, Sick, Personal, etc.) with approval workflow
- **HR Warnings** — Automatic alerts for unverified attendance photos (>24h)

### Training & Certifications
- **Training Ledger** — Employees submit certifications for peer review
- **Verification Workflow** — Managers/HR approve or reject submitted certifications
- **Recognitions & Badges** — Peer-to-peer recognition system

### ML & Analytics
- **Performance Snapshot API** — Aggregated metrics for each employee
- **ML Dataset Export** — Structured data export for attrition prediction models
- **Satisfaction Proxy Metrics** — Algorithmically derived job satisfaction scores

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, TypeScript, Wouter, TanStack Query, Recharts, Lucide Icons |
| Backend | Node.js 20, Express 5, Socket.IO, WebRTC |
| Database | PostgreSQL (Drizzle ORM) |
| Authentication | Custom JWT (HS256) + bcrypt password hashing |
| Real-Time | WebSockets (Socket.IO) + WebRTC (Mesh topology) |
| Build System | pnpm workspaces (Monorepo), ESBuild |
| CI/CD | GitHub Actions |
| Deployment | Docker + Render |

---

## Architecture

```
+-------------------------------------------------------------+
|                     WorkLens Monorepo                        |
+-----------------+-------------------+-----------------------+
|   Frontend      |   Backend         |   Shared Libraries    |
|   (workproof)   |   (api-server)    |   (lib/)              |
|                 |                   |                       |
|  React + Vite   |  Express + WS     |  db (Drizzle ORM)     |
|  TanStack Query |  Socket.IO        |  api-zod (Validators) |
|  Wouter Router  |  WebRTC Signaling |  api-client-react     |
|  Recharts       |  Rate Limiting    |  api-spec (OpenAPI)   |
+--------+--------+--------+---------+-----------------------+
         |                 |
         |   HTTPS / WSS   |
         +--------+--------+
                  |
         +--------v--------+
         |   PostgreSQL     |
         |   (Private Net)  |
         +-----------------+
```

---

## Getting Started

### Prerequisites
- **Node.js** >= 20
- **pnpm** >= 8
- **PostgreSQL** database (local or hosted, e.g. Supabase)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/davidvensilinr/Worklens.git
cd Worklens

# 2. Install dependencies
pnpm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your database URL and secrets

# 4. Push the database schema
pnpm --filter @workspace/db run db:push

# 5. Start the backend API server
cd artifacts/api-server
pnpm run dev

# 6. Start the frontend (in a separate terminal)
cd artifacts/workproof
pnpm run dev
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes (prod) | JWT signing secret (min 32 characters) |
| `PORT` | No | API server port (default: 5000) |
| `CORS_ORIGIN` | Yes (prod) | Comma-separated allowed frontend URLs |
| `NODE_ENV` | No | `development` or `production` |

---

## Project Structure

```
Secure-Workspace-Platform/
|-- .github/workflows/        # GitHub Actions CI pipeline
|   +-- ci.yml
|-- artifacts/
|   |-- api-server/           # Express backend
|   |   +-- src/
|   |       |-- lib/          # JWT, audit, env validation, notifications
|   |       |-- middlewares/  # Auth, security headers, input sanitization
|   |       |-- routes/       # 23 REST API route files
|   |       +-- sockets/     # WebSocket & WebRTC signaling
|   +-- workproof/            # React frontend
|       +-- src/
|           |-- components/   # Layout, CallModal, UI components
|           |-- contexts/     # Auth context
|           +-- pages/        # 23 page components
|-- lib/
|   |-- db/                   # Drizzle ORM schemas (19 tables)
|   |-- api-zod/              # Zod validation schemas
|   |-- api-spec/             # OpenAPI specification
|   +-- api-client-react/     # Auto-generated React query hooks
|-- Dockerfile.api-server     # Production Docker image
|-- render.yaml               # Render deployment config
+-- pnpm-workspace.yaml       # Monorepo workspace config
```

---

## Database Schema

WorkLens uses 19 database tables organized into logical domains:

| Domain | Tables |
|---|---|
| Core | `organizations`, `users`, `departments`, `teams` |
| Work Tracking | `projects`, `tasks`, `documents`, `attendance` |
| Communication | `conversations`, `conversation_participants`, `messages` |
| HR Operations | `leaves`, `promotions`, `trainings`, `verifications`, `recognitions` |
| Meetings | `meetings` (with embedded attendees and actions) |
| System | `audit_log`, `notifications`, `manager_history` |

---

## API Endpoints

The API serves 23 route modules under `/api/v1/`:

| Category | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/change-password`, `GET /auth/me` |
| Users | `GET /users`, `POST /users`, `GET /users/:id`, `PATCH /users/:id`, `GET /users/:id/manager-history` |
| Teams | `GET /teams`, `POST /teams`, `PATCH /teams/:id` |
| Departments | Full CRUD |
| Tasks | Full CRUD + escalation (`POST /tasks/:id/escalate`, `POST /tasks/:id/resolve-escalation`) |
| Chat | Conversations CRUD, Messages, File Upload |
| Meetings | CRUD + RSVP (`POST /meetings/:id/respond`) |
| Attendance | Clock in/out, photo verification |
| Leaves | Request, approve/reject, cancel |
| Documents | Upload, submit, verify (approve/reject) |
| ML | Performance snapshots, dataset export |
| Audit | Immutable event log |

---

## Security

WorkLens implements 10 layers of security hardening:

| Layer | Implementation |
|---|---|
| Password Hashing | bcrypt (12 salt rounds) — brute-force resistant |
| JWT Tokens | HS256 with 24-hour expiration + timing-safe verification |
| CORS | Strict origin whitelist (no wildcard) |
| Security Headers | HSTS, X-Frame-Options, X-Content-Type-Options, XSS Protection |
| Rate Limiting | 100 req/min global, 5 attempts/15min on auth endpoints |
| File Uploads | 10MB limit, MIME whitelist, extension blocklist, filename sanitization |
| Input Sanitization | HTML/script tag stripping on all request bodies |
| WebSocket Security | Authenticated connections, message length limits (5000 chars), input validation |
| Body Size Limits | 1MB max JSON payload |
| Environment Validation | Server refuses to start with missing/insecure secrets in production |

---

## Deployment

### Render (Recommended)

The project includes a `render.yaml` infrastructure-as-code file for one-click deployment:

1. Connect your GitHub repository to [Render](https://render.com).
2. Render auto-detects `render.yaml` and creates:
   - PostgreSQL database (private network only)
   - API server (Docker-based)
   - Frontend static site
3. Environment variables are auto-configured (including a generated `SESSION_SECRET`).

### Docker

```bash
# Build the API server image
docker build -f Dockerfile.api-server -t worklens-api .

# Run with environment variables
docker run -p 3000:3000 \
  -e DATABASE_URL=your_postgres_url \
  -e SESSION_SECRET=your_secret \
  -e NODE_ENV=production \
  -e CORS_ORIGIN=https://your-frontend.com \
  worklens-api
```

---

## CI/CD Pipeline

Every push to `main` triggers the GitHub Actions workflow (`.github/workflows/ci.yml`):

1. Installs dependencies with `pnpm install --frozen-lockfile`
2. Runs full TypeScript type checking across the monorepo
3. Builds all libraries and applications
4. If any step fails, the pipeline blocks deployment

---

## License

This project is licensed under the MIT License.

---

Built with security-first principles for bias-free HR analytics.
