import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import PasswordResetToken, User, UserSession
from app.schemas import (
    AuthResponse,
    ChangePasswordRequest,
    DeleteAccountRequest,
    DemoLoginRequest,
    ForgotPasswordRequest,
    GoogleDemoLoginRequest,
    LoginRequest,
    OtpRequestDemo,
    OtpVerifyDemo,
    ProfileUpdateRequest,
    RegisterRequest,
    ResetPasswordRequest,
    SessionResponse,
    UserResponse,
)
from app.security import create_access_token, get_current_auth, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# In-memory demo OTP store (explicitly simulated for competition/testing without SMS gateway)
DEMO_OTP_STORE: dict[str, dict[str, str]] = {}


FARMER_ALLOWED_LANGS = {"en", "bn", "hi", "as", "or", "pa", "mr", "ta", "te", "gu", "kn", "ml"}
MULTILINGUAL_ROLES = {"farmer", "transporter"}


def _enforce_role_language(role: str, requested_lang: str | None) -> str:
    # Multilingual support is enabled for Farmers and Transporters.
    if role in MULTILINGUAL_ROLES and requested_lang in FARMER_ALLOWED_LANGS:
        return requested_lang
    return "en"


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")

    phone = payload.phone.strip() if payload.phone else None
    if phone and db.query(User).filter(User.phone == phone).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this phone number already exists.")

    user = User(
        full_name=payload.full_name.strip(),
        email=email,
        phone=phone,
        password_hash=hash_password(payload.password),
        role=payload.role,
        language_preference=_enforce_role_language(payload.role, payload.language_preference),
        theme_preference="system",
        auth_provider="email",
        location=(payload.location or "India").strip(),
        is_demo=False,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token, _ = create_access_token(user, db, request)
    return AuthResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account is currently inactive.")

    token, _ = create_access_token(user, db, request)
    return AuthResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/demo-login", response_model=AuthResponse)
def demo_login(payload: DemoLoginRequest, request: Request, db: Session = Depends(get_db)):
    demo_email = f"{payload.role}@smartfoodchain.ai"
    user = db.query(User).filter(User.email == demo_email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demo account not found.")

    token, _ = create_access_token(user, db, request)
    return AuthResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/google-demo", response_model=AuthResponse)
def google_demo_login(payload: GoogleDemoLoginRequest, request: Request, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            full_name=payload.full_name.strip(),
            email=email,
            password_hash=hash_password(secrets.token_urlsafe(24)),
            role=payload.role,
            language_preference=_enforce_role_language(payload.role, "en"),
            theme_preference="system",
            auth_provider="google_demo",
            location="India",
            is_demo=True,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token, _ = create_access_token(user, db, request)
    return AuthResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/otp/request-demo")
def request_otp_demo(payload: OtpRequestDemo):
    phone = payload.phone.strip()
    code = f"{secrets.randbelow(900000) + 100000}"
    DEMO_OTP_STORE[phone] = {"code": code, "role": payload.role}
    return {
        "simulated": True,
        "message": "Simulated demo OTP generated for testing (no real SMS sent).",
        "demo_otp_code": code,
        "phone": phone,
    }


@router.post("/otp/verify-demo", response_model=AuthResponse)
def verify_otp_demo(payload: OtpVerifyDemo, request: Request, db: Session = Depends(get_db)):
    phone = payload.phone.strip()
    record = DEMO_OTP_STORE.get(phone)
    if not record or record["code"] != payload.otp_code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired demo OTP code.")
    del DEMO_OTP_STORE[phone]

    user = db.query(User).filter(User.phone == phone).first()
    if not user:
        digits = "".join(ch for ch in phone if ch.isdigit()) or "0000"
        user = User(
            full_name=(payload.full_name or f"Mobile {payload.role.title()} ({digits[-4:]})").strip(),
            email=f"otp.{digits[-8:]}@demo.smartfoodchain.ai",
            phone=phone,
            password_hash=hash_password(secrets.token_urlsafe(24)),
            role=payload.role,
            language_preference=_enforce_role_language(payload.role, "en"),
            theme_preference="system",
            auth_provider="otp_demo",
            location="India",
            is_demo=True,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token, _ = create_access_token(user, db, request)
    return AuthResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return {"message": "If an account exists for that email, a reset code has been generated.", "simulated_reset_code": None}

    code = f"{secrets.randbelow(900000) + 100000}"
    reset_entry = PasswordResetToken(
        user_id=user.id,
        reset_code=code,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
        used=False,
    )
    db.add(reset_entry)
    db.commit()
    return {
        "message": "Simulated password reset code generated (valid 15 minutes).",
        "simulated_reset_code": code,
    }


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found.")

    token_row = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.reset_code == payload.reset_code,
            PasswordResetToken.used.is_(False),
        )
        .order_by(PasswordResetToken.expires_at.desc())
        .first()
    )
    if not token_row:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or already used reset code.")

    expires_at = token_row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset code has expired.")

    user.password_hash = hash_password(payload.new_password)
    token_row.used = True
    db.commit()
    return {"message": "Password updated successfully. You can now sign in."}


@router.post("/logout")
def logout(auth_data: tuple[User, str] = Depends(get_current_auth), db: Session = Depends(get_db)):
    user, current_jti = auth_data
    session = db.query(UserSession).filter(UserSession.user_id == user.id, UserSession.token_jti == current_jti).first()
    if session:
        session.revoked = True
        db.commit()
    return {"message": "Signed out and session revoked."}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.put("/profile", response_model=UserResponse)
def update_profile(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip()
    if payload.phone is not None:
        cleaned_phone = payload.phone.strip() or None
        if cleaned_phone and cleaned_phone != current_user.phone:
            exists = db.query(User).filter(User.phone == cleaned_phone, User.id != current_user.id).first()
            if exists:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Phone number already in use.")
        current_user.phone = cleaned_phone
    if payload.location is not None:
        current_user.location = payload.location.strip()
    if payload.theme_preference is not None:
        current_user.theme_preference = payload.theme_preference
    if payload.language_preference is not None:
        if current_user.role not in MULTILINGUAL_ROLES and payload.language_preference != "en":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Multilingual interface options are available strictly for Farmer and Transporter accounts.",
            )
        current_user.language_preference = _enforce_role_language(current_user.role, payload.language_preference)

    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.put("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password changed successfully."}


@router.get("/sessions", response_model=list[SessionResponse])
def list_sessions(auth_data: tuple[User, str] = Depends(get_current_auth), db: Session = Depends(get_db)):
    user, current_jti = auth_data
    sessions = (
        db.query(UserSession)
        .filter(UserSession.user_id == user.id)
        .order_by(UserSession.created_at.desc())
        .all()
    )
    return [
        SessionResponse(
            id=s.id,
            device_info=s.device_info,
            ip_address=s.ip_address,
            created_at=s.created_at,
            expires_at=s.expires_at,
            revoked=s.revoked,
            is_current=(s.token_jti == current_jti),
        )
        for s in sessions
    ]


@router.delete("/sessions/{session_id}")
def revoke_session(
    session_id: str,
    auth_data: tuple[User, str] = Depends(get_current_auth),
    db: Session = Depends(get_db),
):
    user, _ = auth_data
    session = db.query(UserSession).filter(UserSession.id == session_id, UserSession.user_id == user.id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    session.revoked = True
    db.commit()
    return {"message": "Session revoked."}


@router.delete("/account")
def delete_account(
    payload: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.auth_provider == "email" and not current_user.is_demo:
        if not payload.password or not verify_password(payload.password, current_user.password_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password verification failed.")
    db.delete(current_user)
    db.commit()
    return {"message": "Account and associated sessions permanently deleted."}
