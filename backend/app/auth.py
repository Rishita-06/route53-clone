"""Mock authentication: salted PBKDF2 passwords + opaque session tokens in SQLite."""
import hashlib
import hmac
import secrets
from datetime import timedelta

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .database import get_db
from .models import AuthSession, User, utcnow

SESSION_TTL = timedelta(days=7)


def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000).hex()


def make_user(account_id: str, username: str, password: str, display_name: str = "") -> User:
    salt = secrets.token_hex(8)
    return User(
        account_id=account_id, username=username, display_name=display_name or username,
        password_salt=salt, password_hash=hash_password(password, salt),
    )


def verify_password(user: User, password: str) -> bool:
    return hmac.compare_digest(user.password_hash, hash_password(password, user.password_salt))


def _extract_token(authorization: str | None) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return None


def get_session(
    authorization: str | None = Header(default=None), db: Session = Depends(get_db)
) -> AuthSession:
    token = _extract_token(authorization)
    sess = db.get(AuthSession, token) if token else None
    if not sess or sess.expires_at < utcnow():
        if sess:
            db.delete(sess)
            db.commit()
        raise HTTPException(401, "Not authenticated or session expired")
    return sess


def get_current_user(sess: AuthSession = Depends(get_session)) -> User:
    return sess.user
