# ==============================================================================
# DATABASE CONNECTION (PostgreSQL)
#
# Connection string comes from the DATABASE_URL env var, falling back to the
# same local default used by the old migrations-reference/seed_db.py script:
#     postgresql://postgres:postgres@localhost:5432/waste_carbon_db
#
# Set ENABLE_POSTGIS=true only if the `postgis` extension package is already
# installed on your Postgres server (e.g. `apt install postgresql-16-postgis-3`,
# or a managed provider that ships it). It is OFF by default so this reconnects
# cleanly against a completely vanilla Postgres install. When on, it adds a
# `geog` Geography(Point) column to generators/facilities for future spatial
# queries (ST_DWithin, nearest-facility, etc.) — the app's own distance math
# still uses plain lat/lng + haversine either way, so nothing else depends on it.
# ==============================================================================
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/waste_carbon_db"
)
ENABLE_POSTGIS = os.getenv("ENABLE_POSTGIS", "false").lower() == "true"

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def init_db():
    """
    Idempotent startup hook: optionally enables PostGIS, then creates any
    tables that don't exist yet. Safe to call on every app startup — it will
    never drop or overwrite existing tables/rows.
    """
    if ENABLE_POSTGIS:
        try:
            with engine.begin() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        except Exception as e:
            print(
                f"WARNING: Could not enable PostGIS extension ({e}). "
                f"Continuing without the geog column — set ENABLE_POSTGIS=false "
                f"to silence this, or install the postgis extension package."
            )

    import models  # noqa: F401 — ensures models are registered on Base first
    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency for endpoints that want a request-scoped session directly."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_connection():
    """Checks the database connection and returns connection metadata."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {
            "connected": True,
            "database": engine.url.database or "waste_carbon_db",
            "dialect": engine.dialect.name
        }
    except Exception as e:
        return {
            "connected": False,
            "error": str(e)
        }
