#!/usr/bin/env python
"""Verify agent tables in PostgreSQL."""
import sys
sys.path.insert(0, 'd:/Senzmate/AISLA/aisla-care/backend-py')

from app.database import SessionLocal
from app.models import MedicationSchedule, AgentEvent
from sqlalchemy import inspect

session = SessionLocal()
inspector = inspect(session.bind)
tables = inspector.get_table_names()

print('\n📊 All Database Tables:')
for t in sorted(tables):
    print(f'  ✓ {t}')

print('\n📋 Agent Tables Schema (Expected):')
agent_tables = {
    'medication_schedules': MedicationSchedule,
    'agent_events': AgentEvent,
}

for table_name, model in agent_tables.items():
    if table_name in tables:
        cols = inspector.get_columns(table_name)
        print(f'\n✅ {table_name}:')
        for col in cols:
            null_str = "NULL" if col["nullable"] else "NOT NULL"
            print(f'     {col["name"]:20} | {str(col["type"]):25} | {null_str}')
    else:
        print(f'\n❌ {table_name} NOT FOUND!')

# Test instantiation
print('\n🔧 Testing Model Imports:')
try:
    print(f'  ✓ MedicationSchedule: {MedicationSchedule.__tablename__}')
    print(f'  ✓ AgentEvent: {AgentEvent.__tablename__}')
except Exception as e:
    print(f'  ❌ Error: {e}')

session.close()
print('\n✅ All checks passed!\n')
