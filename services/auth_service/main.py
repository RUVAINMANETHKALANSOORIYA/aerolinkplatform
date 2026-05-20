from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import models, database
import sys
from pathlib import Path

# Import observability utilities (works both locally and in Docker)
services_dir = Path(__file__).parent.parent
if str(services_dir) not in sys.path:
    sys.path.insert(0, str(services_dir))
from shared_observability import RequestIDMiddleware, get_metrics, HealthChecker, setup_structured_logging

models.Base.metadata.create_all(bind=database.engine)

# ── JWT CONFIG ──────────────────────────────────────────────────────────────
SECRET_KEY = "aerolink-super-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# ── SETUP ───────────────────────────────────────────────────────────────────
app = FastAPI(title="AeroLink Auth Service")
SERVICE_NAME = "auth_service"
app.add_middleware(RequestIDMiddleware, service_name=SERVICE_NAME)
logger = setup_structured_logging(SERVICE_NAME)
health_checker = HealthChecker(SERVICE_NAME)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")


# ── HELPERS ─────────────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── ROUTES ──────────────────────────────────────────────────────────────────
@app.get("/")
def read_root():
    return {"message": "AeroLink Auth Service is Online"}

@app.get("/health")
def health(db: Session = Depends(database.get_db)):
    try:
        db_status = health_checker.check_database(db)
    except Exception as e:
        db_status = f"error: {str(e)}"
    return health_checker.get_health_status(db_status=db_status, rabbitmq_status="not_configured")

@app.get("/metrics")
def metrics_endpoint():
    return get_metrics(SERVICE_NAME)


@app.post("/register", status_code=201)
def register(username: str, password: str, role: str = "passenger",
             db: Session = Depends(database.get_db)):
    """
    Register a new user.
    Roles: passenger | staff | admin
    """
    if role not in ("passenger", "staff", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role. Choose: passenger, staff, admin")

    existing = db.query(models.User).filter(models.User.username == username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    user = models.User(
        username=username,
        hashed_password=hash_password(password),
        role=role
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "User registered successfully", "username": user.username, "role": user.role}


@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(),
          db: Session = Depends(database.get_db)):
    """
    Login and receive a JWT Bearer token.
    Use the token in the Authorization header of protected endpoints.
    """
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token({"sub": user.username, "role": user.role})
    return {"access_token": token, "token_type": "bearer", "role": user.role}


@app.get("/verify")
def verify_token(token: str = Depends(oauth2_scheme)):
    """
    Verify a JWT token. Called by other services to validate requests.
    Returns the username and role embedded in the token.
    """
    payload = decode_token(token)
    return {
        "valid": True,
        "username": payload.get("sub"),
        "role": payload.get("role")
    }


@app.get("/users/me")
def get_me(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    """
    Get the current authenticated user's profile.
    """
    payload = decode_token(token)
    username = payload.get("sub")
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": user.id, "username": user.username, "role": user.role}
