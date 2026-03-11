from app.database import SessionLocal
from app.models.user import User

if __name__ == '__main__':
    db = SessionLocal()
    try:
        users = db.query(User).limit(10).all()
        print('Users:', len(users))
        for u in users:
            print({'id': str(u.id), 'email': getattr(u,'email',None), 'role': getattr(u,'role',None)})
    finally:
        db.close()
