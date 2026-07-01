"""Bootstrap PostgreSQL roles for Managed Identity database access.

Run this as the configured PostgreSQL Microsoft Entra admin, not as the
application runtime identity.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

from azure.core.exceptions import ClientAuthenticationError
from azure.identity import DefaultAzureCredential

POSTGRES_SCOPE = "https://ossrdbms-aad.database.windows.net/.default"
POSTGRES_RESOURCE = "https://ossrdbms-aad.database.windows.net"


def _args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create/grant the backend Managed Identity role in Azure PostgreSQL.",
    )
    parser.add_argument("--host", default=os.getenv("DATABASE_HOST"), required=False)
    parser.add_argument("--database", default=os.getenv("DATABASE_NAME", "ai_coach"))
    parser.add_argument("--admin-user", default=os.getenv("POSTGRES_ENTRA_ADMIN_USER"))
    parser.add_argument("--backend-user", default=os.getenv("DATABASE_USER"))
    parser.add_argument("--backend-object-id", default=os.getenv("DATABASE_USER_OBJECT_ID"))
    parser.add_argument(
        "--backend-object-type",
        default=os.getenv("DATABASE_USER_OBJECT_TYPE", "service"),
    )
    parser.add_argument("--admin-token", default=os.getenv("POSTGRES_ENTRA_ADMIN_TOKEN"))
    parser.add_argument("--schema", default=os.getenv("DATABASE_SCHEMA", "public"))
    parser.add_argument("--port", type=int, default=int(os.getenv("DATABASE_PORT", "5432")))
    return parser.parse_args()


def _require(value: str | None, name: str) -> str:
    if value:
        return value
    raise SystemExit(f"{name} is required")


def _get_postgres_token(admin_token: str | None = None) -> str:
    """Get a PostgreSQL Entra token, falling back to Azure CLI for local deploys."""
    if admin_token:
        return admin_token

    credential = DefaultAzureCredential()
    try:
        return credential.get_token(POSTGRES_SCOPE).token
    except ClientAuthenticationError as exc:
        print(
            "DefaultAzureCredential could not get a PostgreSQL token; falling back to Azure CLI.",
            file=sys.stderr,
        )
        print(str(exc).splitlines()[0], file=sys.stderr)

    result = subprocess.run(
        [
            "az",
            "account",
            "get-access-token",
            "--resource",
            POSTGRES_RESOURCE,
            "--output",
            "json",
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        raise SystemExit("Azure CLI could not get a PostgreSQL access token.")

    try:
        token = json.loads(result.stdout)["accessToken"]
    except (json.JSONDecodeError, KeyError) as exc:
        raise SystemExit("Azure CLI returned an invalid access token response.") from exc

    if not token:
        raise SystemExit("Azure CLI returned an empty PostgreSQL access token.")
    return token


def main() -> int:
    args = _args()
    host = _require(args.host, "--host/DATABASE_HOST")
    admin_user = _require(args.admin_user, "--admin-user/POSTGRES_ENTRA_ADMIN_USER")
    backend_user = _require(args.backend_user, "--backend-user/DATABASE_USER")
    backend_object_id = _require(
        args.backend_object_id,
        "--backend-object-id/DATABASE_USER_OBJECT_ID",
    )

    try:
        import psycopg2
        from psycopg2 import sql
    except ImportError:
        print("psycopg2 is required. Install backend with the [postgresql] extra.", file=sys.stderr)
        return 1

    token = _get_postgres_token(args.admin_token)

    admin_conn = psycopg2.connect(
        host=host,
        port=args.port,
        dbname="postgres",
        user=admin_user,
        password=token,
        sslmode="require",
    )
    admin_conn.autocommit = True

    with admin_conn, admin_conn.cursor() as cur:
        cur.execute(
            "select 1 from pg_roles where rolname = %s",
            (backend_user,),
        )
        role_exists = cur.fetchone() is not None
        if not role_exists:
            cur.execute(
                "select * from pgaadauth_create_principal_with_oid(%s, %s, %s, false, false)",
                (backend_user, backend_object_id, args.backend_object_type),
            )

    target_conn = psycopg2.connect(
        host=host,
        port=args.port,
        dbname=args.database,
        user=admin_user,
        password=token,
        sslmode="require",
    )
    target_conn.autocommit = True

    with target_conn, target_conn.cursor() as cur:
        cur.execute(
            sql.SQL("grant connect on database {} to {}").format(
                sql.Identifier(args.database),
                sql.Identifier(backend_user),
            )
        )
        cur.execute(
            sql.SQL("grant usage, create on schema {} to {}").format(
                sql.Identifier(args.schema),
                sql.Identifier(backend_user),
            )
        )
        cur.execute(
            sql.SQL("grant select, insert, update, delete on all tables in schema {} to {}").format(
                sql.Identifier(args.schema),
                sql.Identifier(backend_user),
            )
        )
        cur.execute(
            sql.SQL("grant usage, select, update on all sequences in schema {} to {}").format(
                sql.Identifier(args.schema),
                sql.Identifier(backend_user),
            )
        )

    print(f"Bootstrapped PostgreSQL Entra role '{backend_user}' on {host}/{args.database}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
