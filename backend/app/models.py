"""SQLAlchemy ORM models."""
from datetime import datetime, timezone

from sqlalchemy import (JSON, Boolean, DateTime, ForeignKey, Index, Integer,
                        String, UniqueConstraint)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    """Naive UTC timestamp (SQLite has no tz support)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[str] = mapped_column(String(12))
    username: Mapped[str] = mapped_column(String(64))
    display_name: Mapped[str] = mapped_column(String(128), default="")
    password_salt: Mapped[str] = mapped_column(String(32))
    password_hash: Mapped[str] = mapped_column(String(128))

    __table_args__ = (UniqueConstraint("account_id", "username"),)


class AuthSession(Base):
    __tablename__ = "sessions"

    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)

    user: Mapped[User] = relationship()


class HostedZone(Base):
    __tablename__ = "hosted_zones"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    comment: Mapped[str] = mapped_column(String(256), default="")
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    vpc_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    vpc_region: Mapped[str | None] = mapped_column(String(32), nullable=True)
    tags: Mapped[dict] = mapped_column(JSON, default=dict)
    created_by: Mapped[str] = mapped_column(String(64), default="Route 53")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    records: Mapped[list["DnsRecord"]] = relationship(
        back_populates="zone", cascade="all, delete-orphan", passive_deletes=True
    )


class DnsRecord(Base):
    __tablename__ = "dns_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    zone_id: Mapped[str] = mapped_column(ForeignKey("hosted_zones.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    type: Mapped[str] = mapped_column(String(8))
    ttl: Mapped[int | None] = mapped_column(Integer, nullable=True)
    values: Mapped[list] = mapped_column(JSON, default=list)
    alias_target: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    routing_policy: Mapped[str] = mapped_column(String(16), default="Simple")
    set_identifier: Mapped[str] = mapped_column(String(128), default="")
    weight: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    zone: Mapped[HostedZone] = relationship(back_populates="records")

    __table_args__ = (
        UniqueConstraint("zone_id", "name", "type", "set_identifier", name="uq_record_identity"),
        Index("ix_records_zone_name", "zone_id", "name"),
    )
