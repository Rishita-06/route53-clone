from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import SESSION_TTL, get_current_user, get_session, verify_password
from ..database import get_db
from ..models import AuthSession, User, utcnow
from ..schemas import LoginRequest, LoginResponse, UserOut
from ..services import new_session_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(
        select(User).where(User.account_id == body.account_id.strip(), User.username == body.username.strip())
    )
    if not user or not verify_password(user, body.password):
        raise HTTPException(401, "Your authentication information is incorrect. Please try again.")
    sess = AuthSession(token=new_session_token(), user_id=user.id, expires_at=utcnow() + SESSION_TTL)
    db.add(sess)
    db.commit()
    return LoginResponse(token=sess.token, expires_at=sess.expires_at, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/logout", status_code=204)
def logout(sess: AuthSession = Depends(get_session), db: Session = Depends(get_db)):
    db.delete(sess)
    db.commit()
