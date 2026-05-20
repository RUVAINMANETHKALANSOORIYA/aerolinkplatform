from importlib import import_module
import sys
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


ROOT_DIR = Path(__file__).resolve().parents[1]


def load_service_app(service_name: str):
    service_dir = ROOT_DIR / "services" / service_name
    service_path = str(service_dir)

    for module_name in ("main", "models", "database"):
        sys.modules.pop(module_name, None)

    sys.path.insert(0, service_path)
    try:
        database = import_module("database")
        test_engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        test_session_local = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=test_engine,
        )
        database.engine = test_engine
        database.SessionLocal = test_session_local

        models = import_module("models")
        main = import_module("main")
    finally:
        if sys.path and sys.path[0] == service_path:
            sys.path.pop(0)

    models.Base.metadata.create_all(bind=database.engine)
    client = TestClient(main.app)
    return client, main, models, database, test_session_local


def unique_name(prefix: str) -> str:
    return f"{prefix}_{__import__('uuid').uuid4().hex[:8]}"
