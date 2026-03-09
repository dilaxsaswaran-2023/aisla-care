# AISLA Care — Python Backend

Python/FastAPI backend with PostgreSQL, mirroring the Node.js/Express/MongoDB backend.

## Prerequisites

- Python 3.10+
- PostgreSQL running locally (or update `DATABASE_URL` in `.env`)

## Setup

```bash
cd backend-py

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Edit .env with your database credentials
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aisla
```

## Create the database

```sql
CREATE DATABASE aisla;
```

## Run

```bash
# Option 1: via run.py
python run.py

# Option 2: via uvicorn directly
uvicorn app.main:socket_app --host 0.0.0.0 --port 5030 --reload
```

The server starts on **port 5030** with:
- All API endpoints under `/api/...`
- Socket.IO on the same port
- Auto-creates tables on startup
- Seeds the super-admin user (`senz@gmail.com` / `password`)

## API Endpoints

| Prefix                | Description           |
|-----------------------|-----------------------|
| `/api/auth`           | Auth (signup, login, refresh, logout, me, complete-invite) |
| `/api/users`          | User CRUD, lists, stats |
| `/api/alerts`         | Alerts + SOS          |
| `/api/devices`        | Device management     |
| `/api/gps`            | GPS locations         |
| `/api/messages`       | Chat messages         |
| `/api/relationships`  | Caregiver/patient/family relationships |
| `/api/reminders`      | Patient reminders     |
| `/api/audit-logs`     | Audit logging         |
| `/api/consent-records`| Consent management    |
| `/api/ai`             | Budii AI chat         |
| `/api/health`         | Health check          |
