"""Bonus: import BIND zone files, export zones as JSON / BIND."""
import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..bind import export_bind, parse_bind
from ..database import get_db
from ..models import DnsRecord, HostedZone
from ..schemas import ImportRequest, ImportResult, RecordIn, ZoneOut
from ..services import is_protected, prepare_record
from .records import get_zone_or_404, to_out

router = APIRouter(prefix="/api/zones/{zone_id}", tags=["import / export"], dependencies=[Depends(get_current_user)])


def _sorted_records(db: Session, zone: HostedZone) -> list[DnsRecord]:
    recs = db.scalars(select(DnsRecord).where(DnsRecord.zone_id == zone.id)).all()
    return sorted(recs, key=lambda r: (r.name != zone.name, r.name, r.type))


@router.get("/export")
def export_zone(
    format: Literal["json", "bind"] = "json", zone: HostedZone = Depends(get_zone_or_404), db: Session = Depends(get_db)
):
    recs = _sorted_records(db, zone)
    if format == "bind":
        body, media, ext = export_bind(zone.name, recs), "text/plain", "zone"
    else:
        payload = {
            "hosted_zone": json.loads(ZoneOut.model_validate(zone).model_dump_json()),
            "records": [json.loads(to_out(zone, r).model_dump_json()) for r in recs],
        }
        body, media, ext = json.dumps(payload, indent=2), "application/json", "json"
    return Response(
        body, media_type=media, headers={"Content-Disposition": f'attachment; filename="{zone.name}.{ext}"'}
    )


@router.post("/import", response_model=ImportResult)
def import_zone(body: ImportRequest, zone: HostedZone = Depends(get_zone_or_404), db: Session = Depends(get_db)):
    parsed, errors = parse_bind(body.content, zone.name)
    created = updated = skipped = 0
    for item in parsed:
        if item["type"] == "SOA" or (item["type"] == "NS" and item["name"] == zone.name):
            skipped += 1
            continue
        if item["name"] != zone.name and not item["name"].endswith("." + zone.name):
            errors.append(f"{item['name']}: outside of zone {zone.name}")
            continue
        try:
            payload = RecordIn(name=item["name"], type=item["type"], ttl=item["ttl"], values=item["values"])
            existing = db.scalar(select(DnsRecord).where(
                DnsRecord.zone_id == zone.id, DnsRecord.name == item["name"],
                DnsRecord.type == item["type"], DnsRecord.set_identifier == "",
            ))
            if existing and not body.overwrite:
                skipped += 1
                continue
            fields = prepare_record(db, zone, payload, existing=existing)
            if existing:
                if is_protected(zone, existing):
                    skipped += 1
                    continue
                for k, v in fields.items():
                    setattr(existing, k, v)
                updated += 1
            else:
                db.add(DnsRecord(zone_id=zone.id, **fields))
                db.flush()
                created += 1
        except HTTPException as e:
            errors.append(f"{item['name']} {item['type']}: {e.detail}")
        except ValueError as e:
            errors.append(f"{item['name']} {item['type']}: {e}")
    db.commit()
    return ImportResult(created=created, updated=updated, skipped=skipped, errors=errors)
