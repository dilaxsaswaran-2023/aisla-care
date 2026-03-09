# Alembic Migrations

This directory contains database migration files for the AISLA Care backend.

## Migration Files

### 2026_03_09_1545-1a2b3c4d_add_messaging_features.py
**Purpose**: Add messaging feature enhancements to the database schema

**Changes**:
- Adds `file_url` column to messages table (for audio/image files)
- Adds `file_metadata` JSON column to messages table (duration, size, format info)
- Adds `status` enum column to messages table (sent, delivered, read)
- Adds `read_at` timestamp column to messages table
- Creates new `conversations` table for managing conversation metadata
  - Participants array (UUIDs)
  - Last message reference
  - Last activity timestamp
  - Unread counts per user

## Running Migrations

To apply migrations:
```bash
alembic upgrade head
```

To rollback migrations:
```bash
alembic downgrade -1
```

To create new migration:
```bash
alembic revision --autogenerate -m "Description of changes"
```

## Migration History

All migration files will be tracked here with their purpose and changes.
