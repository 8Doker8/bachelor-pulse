# auth_service/main.py
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

app = FastAPI()

# Enable CORS (adjust for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection settings from environment variables
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
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 1 day for testing


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


class CompleteRegistration(BaseModel):
    first_name: str
    last_name: str
    age: int
    gender: str
    diagnosis: str
    medicine: str
    recommended_activities: list[str]


def create_jwt_token(user_id: int):
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}  # Store user_id as a string
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token


def update_treatment_streak(user_id: int):
    """Update the treatment streak based on the time difference between now and the last login."""
    conn = get_db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT treatment_streak, last_login FROM user_profiles WHERE user_id = %s;",
                (user_id,),
            )
            row = cur.fetchone()
            now = datetime.utcnow()
            if row:
                current_streak, last_login = row
                # If there is no last_login value, initialize the streak to 1
                if last_login is None:
                    new_streak = 1
                else:
                    # Calculate the whole-day difference between now and last_login
                    diff_days = (now - last_login).days
                    if diff_days == 1:
                        new_streak = (current_streak or 0) + 1
                    elif diff_days > 1:
                        new_streak = 1
                    else:
                        # Same day login; do not update the streak
                        new_streak = current_streak
                cur.execute(
                    "UPDATE user_profiles SET treatment_streak = %s, last_login = %s WHERE user_id = %s",
                    (new_streak, now, user_id),
                )
                conn.commit()
            else:
                # Optional: You can create a profile row here if it doesn't exist.
                print(
                    f"[DEBUG] No profile found for user {user_id} when updating streak."
                )
    except Exception as e:
        conn.rollback()
        print(f"Error updating treatment streak: {e}")
    finally:
        conn.close()


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
            # Update treatment streak on login
            update_treatment_streak(user_id)
            token = create_jwt_token(user_id)
            print(f"[DEBUG] Login: Issued token for user {user_id}: {token}")
            return {"access_token": token, "token_type": "bearer"}
    finally:
        conn.close()


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
        print(f"[DEBUG] Verifying token: {token}")
        print(f"[DEBUG] Using SECRET_KEY: {SECRET_KEY}")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        print(f"[DEBUG] Decoded payload: {payload}")
        return int(payload["sub"])
    except jwt.ExpiredSignatureError as e:
        print(f"[DEBUG] Token expired: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired"
        )
    except jwt.InvalidTokenError as e:
        print(f"[DEBUG] Invalid token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )


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
                # Return a default profile object if not found
                profile = {
                    "first_name": "User",
                    "last_name": "",
                    "treatment_streak": 0,
                    "last_login": None,
                }
            else:
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


@app.get("/protected")
def protected_route(user_id: int = Depends(verify_jwt_token)):
    return {"message": "Protected resource accessed.", "user_id": user_id}


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
