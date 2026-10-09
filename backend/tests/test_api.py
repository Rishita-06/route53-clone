import os, tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402


def client():
    c = TestClient(app)
    c.__enter__()
    tok = c.post("/api/auth/login", json={"account_id": "123456789012", "username": "admin", "password": "admin123"}).json()["token"]
    c.headers["Authorization"] = f"Bearer {tok}"
    return c


def test_auth():
    with TestClient(app) as c:
        assert c.get("/api/zones").status_code == 401
        assert c.post("/api/auth/login", json={"account_id": "1", "username": "x", "password": "y"}).status_code == 401


def test_zone_and_record_crud():
    c = client()
    z = c.post("/api/zones", json={"name": "Test.Org.", "comment": "hi"}).json()
    assert z["name"] == "test.org" and z["record_count"] == 2
    zid = z["id"]
    assert c.get("/api/zones", params={"search": "test.org"}).json()["total"] == 1
    assert c.put(f"/api/zones/{zid}", json={"comment": "new"}).json()["comment"] == "new"

    r = c.post(f"/api/zones/{zid}/records", json={"name": "www", "type": "A", "ttl": 300, "values": ["1.2.3.4"]})
    assert r.status_code == 201 and r.json()["name"] == "www.test.org"
    assert c.post(f"/api/zones/{zid}/records", json={"name": "www", "type": "A", "values": ["1.2.3.5"]}).status_code == 409
    assert c.post(f"/api/zones/{zid}/records", json={"name": "www", "type": "CNAME", "values": ["x.com"]}).status_code == 409
    assert c.post(f"/api/zones/{zid}/records", json={"name": "bad", "type": "A", "values": ["nope"]}).status_code == 400
    rid = r.json()["id"]
    assert c.put(f"/api/zones/{zid}/records/{rid}", json={"name": "www", "type": "A", "ttl": 60, "values": ["9.9.9.9"]}).json()["ttl"] == 60
    assert c.get(f"/api/zones/{zid}/records", params={"search": "9.9.9"}).json()["total"] == 1

    # protected apex NS can't be deleted
    ns = c.get(f"/api/zones/{zid}/records", params={"type": "NS"}).json()["items"][0]
    assert c.delete(f"/api/zones/{zid}/records/{ns['id']}").status_code == 400

    # import / export
    zone_file = "$TTL 300\n@ IN SOA ns1 admin ( 1 2 3 4 5 )\nmail IN A 10.0.0.1\n@ IN MX 10 mail\n"
    res = c.post(f"/api/zones/{zid}/import", json={"content": zone_file}).json()
    assert res["created"] == 2, res
    assert "mail.test.org." in c.get(f"/api/zones/{zid}/export", params={"format": "bind"}).text
    assert c.get(f"/api/zones/{zid}/export", params={"format": "json"}).json()["hosted_zone"]["name"] == "test.org"

    # delete zone needs force when custom records exist
    assert c.delete(f"/api/zones/{zid}").status_code == 400
    assert c.delete(f"/api/zones/{zid}", params={"force": "true"}).status_code == 204
    assert c.get(f"/api/zones/{zid}").status_code == 404


def test_seed_pagination():
    c = client()
    page = c.get("/api/zones", params={"page": 2, "page_size": 5}).json()
    assert page["total"] >= 14 and len(page["items"]) == 5
