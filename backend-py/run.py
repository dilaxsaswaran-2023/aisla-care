"""
AISLA Care Backend — Python / FastAPI / PostgreSQL

Start with:
    uvicorn app.main:socket_app --host 0.0.0.0 --port 5030 --reload
"""
import uvicorn
from app.config import get_settings

if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run(
        "app.main:socket_app",
        host="0.0.0.0",
        port=settings.port,
        reload=True,
    )
