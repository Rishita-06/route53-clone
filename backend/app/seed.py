"""Demo data: one IAM-style user and a handful of zones with realistic records."""
import random

from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import make_user
from .models import DnsRecord, HostedZone, User, utcnow
from .services import bootstrap_zone_records, new_zone_id

DEMO_ACCOUNT, DEMO_USER, DEMO_PASSWORD = "123456789012", "admin", "admin123"

PUBLIC_ZONES = [
    ("example.com", "Primary company website"), ("acme-corp.io", "Acme production"),
    ("shopfront.store", "E-commerce storefront"), ("blog.dev", "Engineering blog"),
    ("mail-relay.net", "Mail infrastructure"), ("cdn-assets.org", "Static assets / CDN"),
    ("staging.example.com", "Staging environment"), ("api.acme-corp.io", "Public API"),
    ("docs.example.org", ""), ("status-page.co", "Status page"), ("internal-tools.dev", "Admin tools"),
]
PRIVATE_ZONES = [("corp.internal", "Corporate private zone"), ("db.vpc.local", "Database discovery"),
                 ("svc.cluster.local", "Kubernetes services")]


def _rec(zid, name, rtype, values, ttl=300, **kw):
    return DnsRecord(zone_id=zid, name=name, type=rtype, values=values, ttl=ttl, **kw)


def seed(db: Session) -> None:
    if db.scalar(select(User).limit(1)):
        return
    db.add(make_user(DEMO_ACCOUNT, DEMO_USER, DEMO_PASSWORD, "Admin"))
    rng = random.Random(7)
    zones = [(n, c, False) for n, c in PUBLIC_ZONES] + [(n, c, True) for n, c in PRIVATE_ZONES]
    for i, (name, comment, private) in enumerate(zones):
        z = HostedZone(
            id=new_zone_id(), name=name, comment=comment, is_private=private,
            vpc_id="vpc-0a1b2c3d4e5f60718" if private else None, vpc_region="us-east-1" if private else None,
            tags={"Environment": "production" if i % 2 == 0 else "staging"},
            created_at=utcnow().replace(microsecond=0) - __import__("datetime").timedelta(days=rng.randint(1, 400)),
        )
        db.add(z)
        db.flush()
        db.add_all(bootstrap_zone_records(z))
        if i < 3 or private:
            ip = f"192.0.2.{rng.randint(10, 250)}"
            db.add_all([
                _rec(z.id, name, "A", [ip]),
                _rec(z.id, f"www.{name}", "CNAME", [name]),
                _rec(z.id, f"api.{name}", "A", [f"198.51.100.{rng.randint(1, 250)}"], 60),
            ])
        if i < 2:
            db.add_all([
                _rec(z.id, name, "MX", ["10 mail1." + name, "20 mail2." + name], 3600),
                _rec(z.id, name, "TXT", ['"v=spf1 include:_spf.google.com ~all"'], 300),
                _rec(z.id, f"_dmarc.{name}", "TXT", ['"v=DMARC1; p=quarantine; rua=mailto:dmarc@' + name + '"'], 300),
                _rec(z.id, name, "AAAA", ["2001:db8:85a3::8a2e:370:7334"]),
                _rec(z.id, name, "CAA", ['0 issue "amazon.com"', '0 issuewild ";"'], 3600),
                _rec(z.id, f"_sip._tcp.{name}", "SRV", ["10 60 5060 sip." + name], 300),
                _rec(z.id, f"host-1.{name}", "PTR", ["host." + name], 300),
                _rec(z.id, f"shop.{name}", "A", ["192.0.2.50"], routing_policy="Weighted", set_identifier="blue", weight=70),
                _rec(z.id, f"shop.{name}", "A", ["192.0.2.51"], routing_policy="Weighted", set_identifier="green", weight=30),
                _rec(z.id, f"cdn.{name}", "A", [], ttl=None,
                     alias_target={"dns_name": "d111111abcdef8.cloudfront.net", "evaluate_target_health": False, "hosted_zone_id": "Z2FDTNDATAQYW2"}),
            ])
    db.commit()
