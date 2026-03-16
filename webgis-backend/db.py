import os

import psycopg2
from psycopg2.extras import RealDictCursor
from sqlalchemy import create_engine


def _normalize_database_url(database_url):
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql://", 1)
    return database_url


def get_database_url():
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return _normalize_database_url(database_url)

    user = os.getenv("DB_USER", "postgres")
    password = os.getenv("DB_PASSWORD", "687456")
    host = os.getenv("DB_HOST", "localhost")
    port = os.getenv("DB_PORT", "5432")
    database = os.getenv("DB_NAME", "webgis")
    return f"postgresql://{user}:{password}@{host}:{port}/{database}"


def get_db_connection():
    database_url = get_database_url()
    connect_kwargs = {"cursor_factory": RealDictCursor}

    ssl_mode = os.getenv("PGSSLMODE")
    if ssl_mode and "sslmode=" not in database_url:
        connect_kwargs["sslmode"] = ssl_mode

    return psycopg2.connect(database_url, **connect_kwargs)


def get_sqlalchemy_engine():
    return create_engine(get_database_url(), pool_pre_ping=True)
