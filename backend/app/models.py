import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def new_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=new_uuid)
    full_name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(32), unique=True, index=True, nullable=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(32), nullable=False, default="farmer", index=True)
    language_preference = Column(String(16), nullable=False, default="en")
    theme_preference = Column(String(16), nullable=False, default="system")
    auth_provider = Column(String(32), nullable=False, default="email")
    location = Column(String(160), nullable=True, default="India")
    is_demo = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)

    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(String(36), primary_key=True, default=new_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_jti = Column(String(64), unique=True, index=True, nullable=False)
    device_info = Column(String(200), nullable=False, default="Web Browser")
    ip_address = Column(String(64), nullable=True, default="127.0.0.1")
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, nullable=False, default=False)

    user = relationship("User", back_populates="sessions")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(String(36), primary_key=True, default=new_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reset_code = Column(String(16), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, nullable=False, default=False)

    user = relationship("User", back_populates="reset_tokens")


class Product(Base):
    __tablename__ = "products"

    id = Column(String(64), primary_key=True, default=new_uuid)
    batch_id = Column(String(64), unique=True, nullable=False, index=True)
    farmer_id = Column(String(64), nullable=False, index=True)
    farmer_name = Column(String(120), nullable=False)
    name = Column(String(160), nullable=False)
    category = Column(String(64), nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String(16), nullable=False, default="kg")
    harvest_date = Column(String(32), nullable=False)
    shelf_life_days = Column(Integer, nullable=False, default=14)
    origin = Column(String(160), nullable=False)
    destination = Column(String(160), nullable=False)
    storage_temp_c = Column(Float, nullable=False, default=12.0)
    storage_humidity_pct = Column(Float, nullable=False, default=82.0)
    current_temp_c = Column(Float, nullable=False, default=14.0)
    current_humidity_pct = Column(Float, nullable=False, default=84.0)
    transport_delay_hours = Column(Float, nullable=False, default=0.0)
    risk_score = Column(Integer, nullable=False, default=18)
    risk_level = Column(String(16), nullable=False, default="Low")
    explanations_json = Column(Text, nullable=False, default="[]")
    recommendations_json = Column(Text, nullable=False, default="[]")
    listed_for_sale = Column(Boolean, nullable=False, default=True)
    price_per_unit = Column(Float, nullable=False, default=30.0)
    image_url = Column(Text, nullable=False, default="/src/assets/images/farmer_mobile_harvest_1795105201987.jpg")
    status = Column(String(32), nullable=False, default="Active")
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)


class Shipment(Base):
    __tablename__ = "shipments"

    id = Column(String(64), primary_key=True, default=new_uuid)
    shipment_code = Column(String(64), unique=True, nullable=False, index=True)
    product_id = Column(String(64), nullable=False, index=True)
    product_name = Column(String(160), nullable=False)
    farmer_id = Column(String(64), nullable=False, index=True)
    transporter_id = Column(String(64), nullable=True)
    transporter_name = Column(String(120), nullable=False)
    origin = Column(String(160), nullable=False)
    origin_lat = Column(Float, nullable=False, default=22.9)
    origin_lng = Column(Float, nullable=False, default=88.39)
    destination = Column(String(160), nullable=False)
    dest_lat = Column(Float, nullable=False, default=22.57)
    dest_lng = Column(Float, nullable=False, default=88.36)
    current_lat = Column(Float, nullable=False, default=22.74)
    current_lng = Column(Float, nullable=False, default=88.37)
    status = Column(String(32), nullable=False, default="In Transit")
    current_temp_c = Column(Float, nullable=False, default=14.0)
    current_humidity_pct = Column(Float, nullable=False, default=84.0)
    delay_hours = Column(Float, nullable=False, default=0.0)
    eta_hours = Column(Float, nullable=False, default=4.5)
    risk_level = Column(String(16), nullable=False, default="Low")
    timeline_json = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)


class IotReading(Base):
    __tablename__ = "iot_readings"

    id = Column(String(64), primary_key=True, default=new_uuid)
    shipment_id = Column(String(64), nullable=False, index=True)
    device_id = Column(String(64), nullable=False)
    temperature_c = Column(Float, nullable=False)
    humidity_pct = Column(Float, nullable=False)
    recorded_at = Column(String(64), nullable=False)
    is_simulated = Column(Integer, nullable=False, default=1)


class Redistribution(Base):
    __tablename__ = "redistributions"

    id = Column(String(64), primary_key=True, default=new_uuid)
    product_id = Column(String(64), nullable=False, index=True)
    product_name = Column(String(160), nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String(16), nullable=False, default="kg")
    location = Column(String(160), nullable=False)
    mode = Column(String(16), nullable=False, default="ngo")
    ngo_name = Column(String(160), nullable=False)
    discount_pct = Column(Integer, nullable=False, default=40)
    status = Column(String(32), nullable=False, default="Available")
    requested_by = Column(String(120), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(64), primary_key=True, default=new_uuid)
    user_id = Column(String(64), nullable=True)
    role_target = Column(String(32), nullable=False, default="all")
    title = Column(String(160), nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String(16), nullable=False, default="info")
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)


class Payment(Base):
    __tablename__ = "payments"

    id = Column(String(64), primary_key=True, default=new_uuid)
    farmer_id = Column(String(64), nullable=False, index=True)
    product_name = Column(String(160), nullable=False)
    amount_inr = Column(Float, nullable=False)
    status = Column(String(16), nullable=False, default="Pending")
    buyer_name = Column(String(160), nullable=False)
    created_at = Column(String(64), nullable=False)


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(String(64), primary_key=True, default=new_uuid)
    user_id = Column(String(64), nullable=False, index=True)
    user_name = Column(String(120), nullable=False)
    role = Column(String(32), nullable=False)
    subject = Column(String(160), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String(32), nullable=False, default="Open")
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
