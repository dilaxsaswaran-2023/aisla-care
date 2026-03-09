from app.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE messages ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;"))
        print('Added is_deleted column')
        conn.commit()
    except Exception as e:
        print(f'Error: {e}')
        conn.rollback()
