from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, not_, or_, select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import DnsRecord, HostedZone
from ..schemas import ZoneCreate, ZoneOut, ZonePage, ZoneUpdate
from ..services import bootstrap_zone_records, new_zone_id, normalize_zone_name

router = APIRouter(prefix="/api/zones", tags=["hosted zones"], dependencies=[Depends(get_current_user)])


def _out(zone: HostedZone, count: int) -> ZoneOut:
    out = ZoneOut.model_validate(zone)
    out.record_count = count
    return out


def _count(db: Session, zone_id: str) -> int:
    return db.scalar(select(func.count()).select_from(DnsRecord).where(DnsRecord.zone_id == zone_id)) or 0


@router.get("", response_model=ZonePage)
def list_zones(
    search: str = "",
    type: Literal["public", "private"] | None = None,
    sort: Literal["name", "type", "created_at", "comment", "record_count", "id"] = "name",
    order: Literal["asc", "desc"] = "asc",
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    counts = (
        select(DnsRecord.zone_id, func.count().label("c")).group_by(DnsRecord.zone_id).subquery()
    )
    count_col = func.coalesce(counts.c.c, 0)
    q = select(HostedZone, count_col.label("record_count")).outerjoin(counts, counts.c.zone_id == HostedZone.id)

    if search.strip():
        like = f"%{search.strip().lower()}%"
        q = q.where(or_(
            func.lower(HostedZone.name).like(like),
            func.lower(HostedZone.comment).like(like),
            func.lower(HostedZone.id).like(like),
        ))
    if type:
        q = q.where(HostedZone.is_private == (type == "private"))

    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    col = {
        "name": HostedZone.name, "type": HostedZone.is_private, "created_at": HostedZone.created_at,
        "comment": HostedZone.comment, "record_count": count_col, "id": HostedZone.id,
    }[sort]
    q = q.order_by(col.desc() if order == "desc" else col.asc(), HostedZone.name)
    rows = db.execute(q.limit(page_size).offset((page - 1) * page_size)).all()
    return ZonePage(items=[_out(z, c) for z, c in rows], total=total, page=page, page_size=page_size)


@router.post("", response_model=ZoneOut, status_code=201)
def create_zone(body: ZoneCreate, db: Session = Depends(get_db)):
    name = normalize_zone_name(body.name)
    if body.is_private and not (body.vpc_id and body.vpc_region):
        raise HTTPException(400, "A VPC region and VPC ID are required for a private hosted zone")
    dup = db.scalar(select(HostedZone).where(HostedZone.name == name, HostedZone.is_private == body.is_private))
    if body.is_private and dup and dup.vpc_id == body.vpc_id:
        raise HTTPException(409, f"A private hosted zone named {name} is already associated with this VPC")
    zone = HostedZone(
        id=new_zone_id(), name=name, comment=body.comment.strip(), is_private=body.is_private,
        vpc_id=body.vpc_id if body.is_private else None, vpc_region=body.vpc_region if body.is_private else None,
        tags=body.tags,
    )
    db.add(zone)
    db.flush()
    db.add_all(bootstrap_zone_records(zone))
    db.commit()
    return _out(zone, 2)


@router.get("/{zone_id}", response_model=ZoneOut)
def get_zone(zone_id: str, db: Session = Depends(get_db)):
    zone = db.get(HostedZone, zone_id)
    if not zone:
        raise HTTPException(404, f"No hosted zone found with ID: {zone_id}")
    return _out(zone, _count(db, zone_id))


@router.put("/{zone_id}", response_model=ZoneOut)
def update_zone(zone_id: str, body: ZoneUpdate, db: Session = Depends(get_db)):
    zone = db.get(HostedZone, zone_id)
    if not zone:
        raise HTTPException(404, f"No hosted zone found with ID: {zone_id}")
    if body.comment is not None:
        zone.comment = body.comment.strip()
    if body.tags is not None:
        zone.tags = body.tags
    db.commit()
    return _out(zone, _count(db, zone_id))


@router.delete("/{zone_id}", status_code=204)
def delete_zone(zone_id: str, force: bool = False, db: Session = Depends(get_db)):
    zone = db.get(HostedZone, zone_id)
    if not zone:
        raise HTTPException(404, f"No hosted zone found with ID: {zone_id}")
    if not force:
        extra = db.scalar(
            select(func.count()).select_from(DnsRecord).where(
                DnsRecord.zone_id == zone_id,
                not_(and_(DnsRecord.name == zone.name, DnsRecord.type.in_(["NS", "SOA"]))),
            )
        )
        if extra:
            raise HTTPException(
                400,
                "The hosted zone contains records other than the default NS and SOA records. "
                "Delete those records first, or confirm deleting all records.",
            )
    db.delete(zone)
    db.commit()
