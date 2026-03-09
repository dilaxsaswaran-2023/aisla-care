from app.database import engine
from sqlalchemy import text
from datetime import datetime

with engine.connect() as conn:
    columns_to_add = [
        ("status", "VARCHAR DEFAULT 'sent'"),
        ("read_at", "TIMESTAMP"),
        ("is_deleted", "BOOLEAN DEFAULT FALSE"),
        ("created_at", f"TIMESTAMP DEFAULT '{datetime.utcnow()}'"),
        ("updated_at", f"TIMESTAMP DEFAULT '{datetime.utcnow()}'"),
    ]
    
    for col_name, col_type in columns_to_add:
        try:
            conn.execute(text(f"ALTER TABLE messages ADD COLUMN {col_name} {col_type};"))
            print(f'Added {col_name} column')
        except Exception as e:
            print(f'{col_name}: {e}')
    
    conn.commit()

