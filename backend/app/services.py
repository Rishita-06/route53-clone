"""Business logic shared by routers (record preparation, zone bootstrap)."""
import random
import secrets
import string

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import DnsRecord, HostedZone
from .schemas import RecordIn
from .validators import is_hostname, validate_value


# ---------------------------------------------------------------- zones
def new_zone_id() -> str:
    return "Z" + "".join(random.choices(string.ascii_uppercase + string.digits, k=20))


def normalize_zone_name(name: str) -> str:
    n = name.strip().lower().rstrip(".")
    if not n or not is_hostname(n) or len(n) > 253:
        raise HTTPException(400, f"Invalid domain name: '{name}'")
    return n


def generate_nameservers() -> list[str]:
    tlds = ["org", "co.uk", "net", "com"]
    return [f"ns-{random.randint(64, 2047)}.awsdns-{random.randint(0, 63):02d}.{t}." for t in tlds]


def bootstrap_zone_records(zone: HostedZone) -> list[DnsRecord]:
    """Every Route 53 public zone starts with NS + SOA records."""
    ns = generate_nameservers()
    return [
        DnsRecord(zone_id=zone.id, name=zone.name, type="NS", ttl=172800, values=ns),
        DnsRecord(
            zone_id=zone.id, name=zone.name, type="SOA", ttl=900,
            values=[f"{ns[0]} awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"],
        ),
    ]


def is_protected(zone: HostedZone, rec: DnsRecord) -> bool:
    return rec.name == zone.name and rec.type in ("NS", "SOA")


# -------------------------------------------------------------- records
def normalize_record_name(name: str, zone: HostedZone) -> str:
    n = name.strip().lower().rstrip(".").replace("\\052", "*")
    if n in ("", "@"):
        return zone.name
    if n == zone.name or n.endswith("." + zone.name):
        return n
    return f"{n}.{zone.name}"


def prepare_record(db: Session, zone: HostedZone, p: RecordIn, existing: DnsRecord | None = None) -> dict:
    """Validate a record payload and return column values. Raises HTTPException."""
    name = normalize_record_name(p.name, zone)
    if not is_hostname(name):
        raise HTTPException(400, f"Invalid record name: '{name}'")

    if existing and is_protected(zone, existing) and (name != existing.name or p.type != existing.type):
        raise HTTPException(400, "The name and type of the NS and SOA records of a hosted zone cannot be changed")
    if p.type == "CNAME" and name == zone.name:
        raise HTTPException(400, "A CNAME record is not allowed at the zone apex (root domain)")

    # alias vs standard
    if p.alias_target:
        if p.type not in ("A", "AAAA", "CNAME"):
            raise HTTPException(400, "Alias records are supported for A, AAAA and CNAME types only")
        if not is_hostname(p.alias_target.dns_name):
            raise HTTPException(400, f"Invalid alias target: '{p.alias_target.dns_name}'")
        values, ttl = [], None
        alias = p.alias_target.model_dump()
    else:
        raw = [v for v in (x.strip() for x in p.values) if v]
        if not raw:
            raise HTTPException(400, "At least one value is required")
        if p.type in ("CNAME", "PTR") and len(raw) > 1:
            raise HTTPException(400, f"A {p.type} record can only have a single value")
        try:
            values = [validate_value(p.type, v) for v in raw]
        except ValueError as e:
            raise HTTPException(400, str(e)) from None
        if p.ttl is None:
            raise HTTPException(400, "TTL is required for non-alias records")
        ttl, alias = p.ttl, None

    # routing policy
    if p.routing_policy == "Weighted":
        if p.weight is None:
            raise HTTPException(400, "Weight is required for weighted routing")
        if not p.set_identifier.strip():
            raise HTTPException(400, "Record ID (set identifier) is required for weighted routing")
        weight, set_id = p.weight, p.set_identifier.strip()
    else:
        weight, set_id = None, ""

    # conflicts with sibling records at the same name
    siblings = db.scalars(select(DnsRecord).where(DnsRecord.zone_id == zone.id, DnsRecord.name == name)).all()
    for s in siblings:
        if existing and s.id == existing.id:
            continue
        if s.type == p.type and s.set_identifier == set_id:
            raise HTTPException(
                409, f"Tried to create resource record set [name='{name}.', type='{p.type}'] but it already exists"
            )
        if (p.type == "CNAME") != (s.type == "CNAME"):
            raise HTTPException(
                409,
                f"RRSet of type {p.type} with DNS name {name}. is not permitted as it conflicts with other records "
                f"with the same DNS name (a CNAME cannot coexist with other record types)",
            )
        if s.type == p.type and s.routing_policy != p.routing_policy:
            raise HTTPException(409, "Records with the same name and type must use the same routing policy")

    return dict(
        name=name, type=p.type, ttl=ttl, values=values, alias_target=alias,
        routing_policy=p.routing_policy, set_identifier=set_id, weight=weight,
    )


def new_session_token() -> str:
    return secrets.token_urlsafe(32)
