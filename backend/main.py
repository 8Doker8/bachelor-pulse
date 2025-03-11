from fastapi import FastAPI, HTTPException, status, Depends, Header
from pydantic import BaseModel
import psycopg2
import psycopg2.extras
import jwt
import bcrypt
from datetime import datetime, timedelta
from fastapi.middleware.cors import CORSMiddleware
import os
import json
from typing import Optional

import uvicorn
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection settings
DB_HOST = os.getenv("DB_HOST", "postgres")
DB_NAME = os.getenv("DB_NAME", "authdb")
DB_USER = os.getenv("DB_USER", "authuser")
DB_PASSWORD = os.getenv("DB_PASSWORD", "authpassword")


def get_db_conn():
    return psycopg2.connect(
        host=DB_HOST,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )


# JWT settings
SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 1 day


# Pydantic models
class UserRegister(BaseModel):
    username: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    profile: Optional[dict] = None


class CompleteRegistration(BaseModel):
    first_name: str
    last_name: str
    age: int
    gender: str
    diagnosis: str
    medicine: str
    recommended_activities: list[str]


# Create JWT token from a user_id (stored as string in payload)
def create_jwt_token(user_id: int):
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token


# IMPORTANT: Define verify_jwt_token BEFORE using it in endpoints.
def verify_jwt_token(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid auth scheme"
        )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # Return the user_id as an int
        return int(payload["sub"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )


# -----------------------------
# Endpoints
# -----------------------------


@app.post("/register")
def register(user: UserRegister):
    hashed_password = bcrypt.hashpw(user.password.encode("utf-8"), bcrypt.gensalt())
    conn = get_db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "INSERT INTO users (username, password_hash) VALUES (%s, %s) RETURNING id;",
                (user.username, hashed_password),
            )
            result = cur.fetchone()
            if result is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Registration failed",
                )
            user_id = result["id"]
            conn.commit()
    except psycopg2.IntegrityError:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists"
        )
    finally:
        conn.close()
    token = create_jwt_token(user_id)
    print(f"[DEBUG] Registered user {user_id} with token: {token}")
    return {
        "message": "User registered successfully",
        "user_id": user_id,
        "access_token": token,
    }


@app.post("/login", response_model=Token)
def login(user: UserLogin):
    conn = get_db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(
                "SELECT id, password_hash FROM users WHERE username = %s",
                (user.username,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid username or password",
                )
            stored_hash = row["password_hash"]
            if isinstance(stored_hash, memoryview):
                stored_hash = stored_hash.tobytes()
            if not bcrypt.checkpw(user.password.encode("utf-8"), stored_hash):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid username or password",
                )
            user_id = row["id"]
            token = create_jwt_token(user_id)
            # Fetch user profile if exists
            cur.execute("SELECT * FROM user_profiles WHERE user_id = %s;", (user_id,))
            profile_row = cur.fetchone()
            profile = dict(profile_row) if profile_row else None
            print(f"[DEBUG] Login: Issued token for user {user_id}: {token}")
            return {"access_token": token, "token_type": "bearer", "profile": profile}
    finally:
        conn.close()


@app.post("/complete_registration")
def complete_registration(
    data: CompleteRegistration, user_id: int = Depends(verify_jwt_token)
):
    conn = get_db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO user_profiles 
                (user_id, first_name, last_name, age, gender, diagnosis, medicine, recommended_activities)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    user_id,
                    data.first_name,
                    data.last_name,
                    data.age,
                    data.gender,
                    data.diagnosis,
                    data.medicine,
                    json.dumps(data.recommended_activities),
                ),
            )
            conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
    return {"message": "Registration complete"}


@app.get("/profile")
def get_profile(user_id: int = Depends(verify_jwt_token)):
    conn = get_db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM user_profiles WHERE user_id = %s;", (user_id,))
            profile = cur.fetchone()
            if not profile:
                raise HTTPException(status_code=404, detail="Profile not found")
            if profile.get("treatment_streak") is None:
                profile["treatment_streak"] = 0
            return {"profile": profile}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.get("/events")
def get_events(user_id: int = Depends(verify_jwt_token)):
    conn = get_db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM events WHERE user_id = %s ORDER BY event_date, event_time;",
                (user_id,),
            )
            rows = cur.fetchall()
            return {"events": rows or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


class MedicationLog(BaseModel):
    medication: str
    time: str  # e.g., "08:00 AM"


@app.post("/medication_log")
def log_medication(med: MedicationLog, user_id: int = Depends(verify_jwt_token)):
    from datetime import date

    conn = get_db_conn()
    try:
        with conn.cursor() as cur:
            event_date = date.today()
            cur.execute(
                """
                INSERT INTO events (user_id, title, event_date, event_time)
                VALUES (%s, %s, %s, %s) RETURNING id;
                """,
                (user_id, f"Medication taken: {med.medication}", event_date, med.time),
            )
            result = cur.fetchone()
            conn.commit()
            return {"message": "Medication logged", "event_id": result[0]}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


class LogEvent(BaseModel):
    title: str
    event_date: str  # ISO date e.g. "2025-03-10"
    event_time: str  # e.g. "08:00 AM"


@app.post("/log_event")
def log_event(event: LogEvent, user_id: int = Depends(verify_jwt_token)):
    conn = get_db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO events (user_id, title, event_date, event_time)
                VALUES (%s, %s, %s, %s) RETURNING id;
                """,
                (user_id, event.title, event.event_date, event.event_time),
            )
            result = cur.fetchone()
            conn.commit()
            return {"message": "Event logged", "event_id": result[0]}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.get("/protected")
def protected_route(user_id: int = Depends(verify_jwt_token)):
    return {"message": "Protected resource accessed.", "user_id": user_id}


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
