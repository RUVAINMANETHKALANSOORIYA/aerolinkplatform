import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]

def load_service_app(service_name: str):
    """Safely loads a service module without side-effects for other tests."""
    service_dir = ROOT_DIR / "services" / service_name
    service_path = str(service_dir)

    for module_name in ("main", "models", "database"):
        sys.modules.pop(module_name, None)

    sys.path.insert(0, service_path)
    try:
        # Dynamically import
        import importlib
        database = importlib.import_module("database")
        
        # Disable create_all for testing if it's not a DB service
        # or if we are mocking dynamodb
        if hasattr(database, "use_dynamodb"):
            # If dynamodb is used, no engine needed
            pass

        main = importlib.import_module("main")
        
    finally:
        if sys.path and sys.path[0] == service_path:
            sys.path.pop(0)

    from fastapi.testclient import TestClient
    client = TestClient(main.app)
    return client, main, database
