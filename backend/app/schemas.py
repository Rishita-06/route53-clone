"""Pydantic request / response models."""
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer

UtcDatetime = Annotated[
    datetime, PlainSerializer(lambda d: d.isoformat() + "Z", return_type=str, when_used="json")
]

RecordType = Literal["A", "AAAA", "CAA", "CNAME", "MX", "NS", "PTR", "SRV", "TXT"]
RoutingPolicy = Literal["Simple", "Weighted"]


# ---- auth -------------------------------------------------------------
class LoginRequest(BaseModel):
    account_id: str = Field(min_length=1, max_length=64)
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    account_id: str
    username: str
    display_name: str


class LoginResponse(BaseModel):
    token: str
    expires_at: UtcDatetime
    user: UserOut


# ---- hosted zones -----------------------------------------------------
class ZoneCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    comment: str = Field(default="", max_length=256)
    is_private: bool = False
    vpc_id: str | None = Field(default=None, max_length=64)
    vpc_region: str | None = Field(default=None, max_length=32)
    tags: dict[str, str] = Field(default_factory=dict)


class ZoneUpdate(BaseModel):
    comment: str | None = Field(default=None, max_length=256)
    tags: dict[str, str] | None = None


class ZoneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    comment: str
    is_private: bool
    vpc_id: str | None
    vpc_region: str | None
    tags: dict[str, str]
    created_by: str
    created_at: UtcDatetime
    record_count: int = 0


class ZonePage(BaseModel):
    items: list[ZoneOut]
    total: int
    page: int
    page_size: int


# ---- records ----------------------------------------------------------
class AliasTarget(BaseModel):
    dns_name: str = Field(min_length=1, max_length=255)
    evaluate_target_health: bool = False
    hosted_zone_id: str | None = None


class RecordIn(BaseModel):
    name: str = Field(default="", max_length=255)
    type: RecordType
    ttl: int | None = Field(default=300, ge=0, le=2147483647)
    values: list[str] = Field(default_factory=list)
    alias_target: AliasTarget | None = None
    routing_policy: RoutingPolicy = "Simple"
    set_identifier: str = Field(default="", max_length=128)
    weight: int | None = Field(default=None, ge=0, le=255)


class RecordOut(BaseModel):
    id: int
    zone_id: str
    name: str
    type: str
    ttl: int | None
    values: list[str]
    alias_target: AliasTarget | None
    routing_policy: str
    set_identifier: str
    weight: int | None
    protected: bool
    created_at: UtcDatetime
    updated_at: UtcDatetime


class RecordPage(BaseModel):
    items: list[RecordOut]
    total: int
    page: int
    page_size: int


class BulkDeleteRequest(BaseModel):
    ids: list[int] = Field(min_length=1)


class ImportRequest(BaseModel):
    content: str = Field(min_length=1)
    overwrite: bool = False


class ImportResult(BaseModel):
    created: int
    updated: int
    skipped: int
    errors: list[str]
