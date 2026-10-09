"""BIND zone file import / export helpers."""
import re

TOKEN = re.compile(r'"(?:[^"\\]|\\.)*"|[^\s"]+')
TTL_RE = re.compile(r"^\d+[smhdw]?$", re.I)
UNITS = {"s": 1, "m": 60, "h": 3600, "d": 86400, "w": 604800}
SUPPORTED = {"A", "AAAA", "CAA", "CNAME", "MX", "NS", "PTR", "SRV", "TXT", "SOA"}


def fqdn(value: str) -> str:
    return value if value.endswith(".") else value + "."


def _ttl(token: str) -> int:
    if token[-1].lower() in UNITS:
        return int(token[:-1]) * UNITS[token[-1].lower()]
    return int(token)


# ------------------------------------------------------------------ export
def _export_value(rtype: str, value: str) -> str:
    if rtype in ("CNAME", "NS", "PTR"):
        return fqdn(value)
    if rtype == "MX":
        prio, host = value.split(None, 1)
        return f"{prio} {fqdn(host)}"
    if rtype == "SRV":
        a, b, c, host = value.split(None, 3)
        return f"{a} {b} {c} {fqdn(host)}"
    return value


def export_bind(zone_name: str, records: list) -> str:
    lines = [f"$ORIGIN {fqdn(zone_name)}", "$TTL 300", ""]
    for r in records:
        owner = fqdn(r.name)
        if r.alias_target:
            lines.append(f"; ALIAS {owner} {r.type} -> {r.alias_target['dns_name']}")
            continue
        for value in r.values:
            lines.append(f"{owner}\t{r.ttl}\tIN\t{r.type}\t{_export_value(r.type, value)}")
    return "\n".join(lines) + "\n"


# ------------------------------------------------------------------ import
def _strip_comment_and_parens(line: str) -> tuple[str, int]:
    """Drop ';' comments and ()-grouping chars outside quotes; return net paren depth change."""
    out, in_q, esc, depth = [], False, False, 0
    for ch in line:
        if esc:
            out.append(ch)
            esc = False
            continue
        if ch == "\\":
            out.append(ch)
            esc = True
            continue
        if ch == '"':
            in_q = not in_q
        elif not in_q:
            if ch == ";":
                break
            if ch == "(":
                depth += 1
                out.append(" ")
                continue
            if ch == ")":
                depth -= 1
                out.append(" ")
                continue
        out.append(ch)
    return "".join(out), depth


def parse_bind(text: str, origin: str) -> tuple[list[dict], list[str]]:
    """Parse a BIND zone file into [{name, type, ttl, values}] plus error strings."""
    origin = origin.rstrip(".").lower()
    errors: list[str] = []

    entries: list[tuple[bool, str]] = []
    buf, blank, depth = None, False, 0
    for raw in text.splitlines():
        cleaned, delta = _strip_comment_and_parens(raw.rstrip())
        if buf is None:
            if not cleaned.strip():
                continue
            blank = cleaned[0] in " \t"
            buf = ""
        buf += " " + cleaned
        depth += delta
        if depth <= 0:
            entries.append((blank, buf.strip()))
            buf, depth = None, 0
    if buf:
        entries.append((blank, buf.strip()))

    def absname(tok: str) -> str:
        if tok == "@":
            return origin
        if tok.endswith("."):
            return tok[:-1].lower()
        return f"{tok}.{origin}".lower()

    def target(tok: str) -> str:
        return origin if tok == "@" else (tok[:-1] if tok.endswith(".") else f"{tok}.{origin}")

    default_ttl, last_name = 300, origin
    grouped: dict[tuple[str, str], dict] = {}

    for blank_owner, body in entries:
        tokens = TOKEN.findall(body)
        if not tokens:
            continue
        head = tokens[0].upper()
        try:
            if head == "$ORIGIN":
                origin = tokens[1].rstrip(".").lower()
                continue
            if head == "$TTL":
                default_ttl = _ttl(tokens[1])
                continue
            if head.startswith("$"):
                errors.append(f"Unsupported directive {tokens[0]}")
                continue

            i = 0
            if blank_owner:
                name = last_name
            else:
                name, i = absname(tokens[0]), 1
                last_name = name
            ttl = None
            while i < len(tokens):
                t = tokens[i]
                if t.upper() in ("IN", "CH", "HS"):
                    i += 1
                elif TTL_RE.match(t):
                    ttl, i = _ttl(t), i + 1
                else:
                    break
            rtype, rdata = tokens[i].upper(), tokens[i + 1:]
            if rtype not in SUPPORTED:
                errors.append(f"{name}: unsupported record type {rtype}")
                continue

            if rtype in ("CNAME", "NS", "PTR"):
                value = target(rdata[0])
            elif rtype == "MX":
                value = f"{rdata[0]} {target(rdata[1])}"
            elif rtype == "SRV":
                value = f"{rdata[0]} {rdata[1]} {rdata[2]} {target(rdata[3])}"
            elif rtype == "CAA":
                value = f"{rdata[0]} {rdata[1]} {' '.join(rdata[2:])}"
            else:  # A, AAAA, TXT, SOA
                value = " ".join(rdata)

            g = grouped.setdefault((name, rtype), {"name": name, "type": rtype, "ttl": ttl or default_ttl, "values": []})
            g["values"].append(value)
        except (IndexError, ValueError):
            errors.append(f"Could not parse line: {body[:80]}")
    return list(grouped.values()), errors
