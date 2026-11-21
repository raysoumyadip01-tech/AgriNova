from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, Field

RoleType = Literal["farmer", "transporter", "warehouse", "retailer", "admin"]
PublicRegisterRole = Literal["farmer", "transporter", "warehouse", "retailer"]
ThemeType = Literal["light", "dark", "system"]
FarmerLangType = Literal["en", "bn", "hi", "as", "or", "pa", "mr", "ta", "te", "gu", "kn", "ml"]


class UserResponse(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    role: RoleType
    language_preference: str
    theme_preference: ThemeType
    auth_provider: str
    location: Optional[str] = None
    is_demo: bool
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=32)
    password: str = Field(min_length=8, max_length=128)
    role: PublicRegisterRole = "farmer"
    location: Optional[str] = Field(default="India", max_length=160)
    language_preference: Optional[FarmerLangType] = "en"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class DemoLoginRequest(BaseModel):
    role: RoleType


class GoogleDemoLoginRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=120)
    role: PublicRegisterRole = "farmer"


class OtpRequestDemo(BaseModel):
    phone: str = Field(min_length=6, max_length=32)
    role: PublicRegisterRole = "farmer"


class OtpVerifyDemo(BaseModel):
    phone: str = Field(min_length=6, max_length=32)
    otp_code: str = Field(min_length=6, max_length=6)
    role: PublicRegisterRole = "farmer"
    full_name: Optional[str] = Field(default=None, max_length=120)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    reset_code: str = Field(min_length=6, max_length=16)
    new_password: str = Field(min_length=8, max_length=128)


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    phone: Optional[str] = Field(default=None, max_length=32)
    location: Optional[str] = Field(default=None, max_length=160)
    theme_preference: Optional[ThemeType] = None
    language_preference: Optional[FarmerLangType] = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class DeleteAccountRequest(BaseModel):
    confirmation: Literal["DELETE"]
    password: Optional[str] = None


class SessionResponse(BaseModel):
    id: str
    device_info: str
    ip_address: Optional[str]
    created_at: datetime
    expires_at: datetime
    revoked: bool
    is_current: bool = False

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class RoleUpdateRequest(BaseModel):
    role: RoleType
