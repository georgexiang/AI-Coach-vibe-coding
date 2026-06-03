import time
from collections.abc import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.engine import URL
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings

settings = get_settings()

POSTGRES_AAD_SCOPE = "https://ossrdbms-aad.database.windows.net/.default"

_postgres_token: str = ""
_postgres_token_expires_at: float = 0.0


def _database_url() -> str | URL:
    if settings.database_auth_mode.lower() != "azure_ad":
        return settings.database_url

    missing = [
        name
        for name, value in {
            "DATABASE_HOST": settings.database_host,
            "DATABASE_NAME": settings.database_name,
            "DATABASE_USER": settings.database_user,
        }.items()
        if not value
    ]
    if missing:
        raise RuntimeError("Azure AD database auth requires these settings: " + ", ".join(missing))

    return URL.create(
        "postgresql+asyncpg",
        username=settings.database_user,
        host=settings.database_host,
        port=settings.database_port,
        database=settings.database_name,
        query={"ssl": settings.database_ssl},
    )


def _get_postgres_aad_token() -> str:
    global _postgres_token, _postgres_token_expires_at

    now = time.time()
    if _postgres_token and now < _postgres_token_expires_at - 300:
        return _postgres_token

    from azure.identity import DefaultAzureCredential

    credential = DefaultAzureCredential(managed_identity_client_id=settings.azure_client_id or None)
    token = credential.get_token(POSTGRES_AAD_SCOPE)
    _postgres_token = token.token
    _postgres_token_expires_at = float(token.expires_on)
    return _postgres_token


database_url = _database_url()
_is_sqlite = str(database_url).startswith("sqlite")
_is_azure_ad_postgres = settings.database_auth_mode.lower() == "azure_ad"

engine = create_async_engine(
    database_url,
    echo=settings.debug,
    # SQLite: allow concurrent access by using a longer busy timeout
    connect_args={"timeout": 30} if _is_sqlite else {},
    pool_recycle=settings.database_pool_recycle_seconds if _is_azure_ad_postgres else -1,
)


# Enable WAL mode for SQLite — allows concurrent reads during writes
if _is_sqlite:

    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragmas(dbapi_conn, _connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.close()


if _is_azure_ad_postgres:

    @event.listens_for(engine.sync_engine, "do_connect")
    def _provide_postgres_aad_token(_dialect, _connection_record, _cargs, cparams):
        cparams["password"] = _get_postgres_aad_token()


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
