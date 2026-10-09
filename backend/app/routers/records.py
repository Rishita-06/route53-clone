from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import String, case, cast, func, or_, select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import DnsRecord, HostedZone
from ..schemas import BulkDeleteRequest, RecordIn, RecordOut, RecordPage
from ..services import is_protected, prepare_record

router = APIRouter(
    prefix="/api/zones/{zone_id}/records", tags=["dns records"], dependencies=[Depends(get_current_user)]
)


def get_zone_or_404(zone_id: str, db: Session = Depends(get_db)) -> HostedZone:
    zone = db.get(HostedZone, zone_id)
    if not zone:
        raise HTTPException(404, f"No hosted zone found with ID: {zone_id}")
    return zone


def to_out(zone: HostedZone, r: DnsRecord) -> RecordOut:
    return RecordOut(
        id=r.id, zone_id=r.zone_id, name=r.name, type=r.type, ttl=r.ttl, values=r.values,
        alias_target=r.alias_target, routing_policy=r.routing_policy, set_identifier=r.set_identifier,
        weight=r.weight, protected=is_protected(zone, r), created_at=r.created_at, updated_at=r.updated_at,
    )


def get_record_or_404(zone: HostedZone, record_id: int, db: Session) -> DnsRecord:
    rec = db.get(DnsRecord, record_id)
    if not rec or rec.zone_id != zone.id:
        raise HTTPException(404, f"No record found with ID: {record_id}")
    return rec


@router.get("", response_model=RecordPage)
def list_records(
    search: str = "",
    type: str | None = None,
    routing_policy: Literal["Simple", "Weighted"] | None = None,
    alias: bool | None = None,
    sort: Literal["name", "type", "ttl", "routing_policy"] = "name",
    order: Literal["asc", "desc"] = "asc",
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    zone: HostedZone = Depends(get_zone_or_404),
    db: Session = Depends(get_db),
):
    q = select(DnsRecord).where(DnsRecord.zone_id == zone.id)
    if search.strip():
        like = f"%{search.strip().lower()}%"
        q = q.where(or_(
            func.lower(DnsRecord.name).like(like),
            func.lower(DnsRecord.type).like(like),
            func.lower(cast(DnsRecord.values, String)).like(like),
            func.lower(cast(DnsRecord.alias_target, String)).like(like),
            func.lower(DnsRecord.set_identifier).like(like),
        ))
    if type:
        q = q.where(DnsRecord.type == type.upper())
    if routing_policy:
        q = q.where(DnsRecord.routing_policy == routing_policy)
    if alias is not None:
        q = q.where(DnsRecord.alias_target.is_not(None) if alias else DnsRecord.alias_target.is_(None))

    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    col = {"name": DnsRecord.name, "type": DnsRecord.type, "ttl": DnsRecord.ttl,
           "routing_policy": DnsRecord.routing_policy}[sort]
    primary = col.desc() if order == "desc" else col.asc()
    # apex records first when sorting by name, like the Route 53 console
    q = q.order_by(case((DnsRecord.name == zone.name, 0), else_=1), primary, DnsRecord.type, DnsRecord.set_identifier)
    rows = db.scalars(q.limit(page_size).offset((page - 1) * page_size)).all()
    return RecordPage(items=[to_out(zone, r) for r in rows], total=total, page=page, page_size=page_size)


@router.post("", response_model=RecordOut, status_code=201)
def create_record(body: RecordIn, zone: HostedZone = Depends(get_zone_or_404), db: Session = Depends(get_db)):
    rec = DnsRecord(zone_id=zone.id, **prepare_record(db, zone, body))
    db.add(rec)
    db.commit()
    return to_out(zone, rec)


@router.post("/bulk-delete")
def bulk_delete(body: BulkDeleteRequest, zone: HostedZone = Depends(get_zone_or_404), db: Session = Depends(get_db)):
    recs = db.scalars(select(DnsRecord).where(DnsRecord.zone_id == zone.id, DnsRecord.id.in_(body.ids))).all()
    if len(recs) != len(set(body.ids)):
        raise HTTPException(404, "One or more records were not found")
    if any(is_protected(zone, r) for r in recs):
        raise HTTPException(400, "The default NS and SOA records of a hosted zone cannot be deleted")
    for r in recs:
        db.delete(r)
    db.commit()
    return {"deleted": len(recs)}


@router.get("/{record_id}", response_model=RecordOut)
def get_record(record_id: int, zone: HostedZone = Depends(get_zone_or_404), db: Session = Depends(get_db)):
    return to_out(zone, get_record_or_404(zone, record_id, db))


@router.put("/{record_id}", response_model=RecordOut)
def update_record(
    record_id: int, body: RecordIn, zone: HostedZone = Depends(get_zone_or_404), db: Session = Depends(get_db)
):
    rec = get_record_or_404(zone, record_id, db)
    for k, v in prepare_record(db, zone, body, existing=rec).items():
        setattr(rec, k, v)
    db.commit()
    return to_out(zone, rec)


@router.delete("/{record_id}", status_code=204)
def delete_record(record_id: int, zone: HostedZone = Depends(get_zone_or_404), db: Session = Depends(get_db)):
    rec = get_record_or_404(zone, record_id, db)
    if is_protected(zone, rec):
        raise HTTPException(400, "The default NS and SOA records of a hosted zone cannot be deleted")
    db.delete(rec)
    db.commit()
