from collections.abc import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings

settings = get_settings()

_is_sqlite = settings.database_url.startswith("sqlite")

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    # SQLite: allow concurrent access by using a longer busy timeout
    connect_args={"timeout": 30} if _is_sqlite else {},
)


# Enable WAL mode for SQLite — allows concurrent reads during writes
if _is_sqlite:

    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragmas(dbapi_conn, _connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.close()

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
