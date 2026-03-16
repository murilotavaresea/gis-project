import os

import psycopg2
from psycopg2.extras import RealDictCursor
from sqlalchemy import create_engine


def _normalize_database_url(database_url):
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql://", 1)
    return database_url


def _build_database_url_from_parts():
    user = os.getenv("DB_USER")
    password = os.getenv("DB_PASSWORD")
    host = os.getenv("DB_HOST")
    port = os.getenv("DB_PORT", "5432")
    database = os.getenv("DB_NAME")

    missing = [
        env_name
        for env_name, env_value in {
            "DB_USER": user,
            "DB_PASSWORD": password,
            "DB_HOST": host,
            "DB_NAME": database,
        }.items()
        if not env_value
    ]

    if missing:
        missing_list = ", ".join(missing)
        raise RuntimeError(
            "Configuracao de banco incompleta. Defina DATABASE_URL "
            f"ou as variaveis {missing_list}."
        )

    return f"postgresql://{user}:{password}@{host}:{port}/{database}"


def get_database_url():
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return _normalize_database_url(database_url)

    return _build_database_url_from_parts()


def get_db_connection():
    database_url = get_database_url()
    connect_kwargs = {"cursor_factory": RealDictCursor}

    ssl_mode = os.getenv("PGSSLMODE")
    if ssl_mode and "sslmode=" not in database_url:
        connect_kwargs["sslmode"] = ssl_mode

    return psycopg2.connect(database_url, **connect_kwargs)


def get_sqlalchemy_engine():
    return create_engine(get_database_url(), pool_pre_ping=True)
