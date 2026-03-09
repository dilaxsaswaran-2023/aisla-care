from app.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'messages';"))
    columns = [row[0] for row in result]
    print("Current columns in messages table:")
    for col in sorted(columns):
        print(f"  - {col}")
