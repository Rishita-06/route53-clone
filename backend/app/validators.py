"""Per-record-type value validation (format only; no real DNS behaviour)."""
import ipaddress
import re

_LABEL = re.compile(r"^[A-Za-z0-9_*-]{1,63}$")


def is_hostname(value: str) -> bool:
    v = value.rstrip(".")
    if not v or len(v) > 253:
        return False
    return all(_LABEL.match(label) for label in v.split("."))


def _quote(value: str) -> str:
    v = value.strip()
    if v.startswith('"'):
        if len(v) < 2 or not v.endswith('"'):
            raise ValueError(f"Invalid quoting in '{value}'")
        return v
    return '"' + v.replace('"', '\\"') + '"'


def _int_in(text: str, lo: int, hi: int, label: str) -> None:
    if not text.isdigit() or not (lo <= int(text) <= hi):
        raise ValueError(f"{label} must be a number between {lo} and {hi}")


def validate_value(rtype: str, raw: str) -> str:
    """Return normalised value or raise ValueError with a Route 53 style message."""
    v = raw.strip()
    if not v:
        raise ValueError("Value cannot be empty")

    if rtype == "A":
        try:
            ipaddress.IPv4Address(v)
        except ValueError:
            raise ValueError(f"Invalid IPv4 address: '{v}'") from None
        return v
    if rtype == "AAAA":
        try:
            ipaddress.IPv6Address(v)
        except ValueError:
            raise ValueError(f"Invalid IPv6 address: '{v}'") from None
        return v
    if rtype in ("CNAME", "NS", "PTR"):
        if not is_hostname(v):
            raise ValueError(f"Invalid domain name: '{v}'")
        return v
    if rtype == "MX":
        parts = v.split()
        if len(parts) != 2:
            raise ValueError("MX value must be '<priority> <mail server>', e.g. 10 mail.example.com")
        _int_in(parts[0], 0, 65535, "MX priority")
        if not is_hostname(parts[1]):
            raise ValueError(f"Invalid mail server name: '{parts[1]}'")
        return " ".join(parts)
    if rtype == "SRV":
        parts = v.split()
        if len(parts) != 4:
            raise ValueError("SRV value must be '<priority> <weight> <port> <target>'")
        _int_in(parts[0], 0, 65535, "SRV priority")
        _int_in(parts[1], 0, 65535, "SRV weight")
        _int_in(parts[2], 0, 65535, "SRV port")
        if not is_hostname(parts[3]):
            raise ValueError(f"Invalid SRV target: '{parts[3]}'")
        return " ".join(parts)
    if rtype == "CAA":
        parts = v.split(None, 2)
        if len(parts) != 3:
            raise ValueError('CAA value must be \'<flags> <tag> "<value>"\', e.g. 0 issue "amazon.com"')
        _int_in(parts[0], 0, 255, "CAA flags")
        if parts[1].lower() not in ("issue", "issuewild", "iodef"):
            raise ValueError("CAA tag must be issue, issuewild or iodef")
        return f"{parts[0]} {parts[1].lower()} {_quote(parts[2])}"
    if rtype == "TXT":
        out = _quote(v) if not v.startswith('"') else v
        if len(out) > 4000:
            raise ValueError("TXT value is too long (max 4000 characters)")
        return out
    raise ValueError(f"Unsupported record type: {rtype}")
