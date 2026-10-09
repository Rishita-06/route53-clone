import os

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from .database import Base, SessionLocal, engine
from .routers import auth, records, zone_files, zones
from .seed import seed


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)
    yield


app = FastAPI(title="Route 53 Clone API", version="1.0.0", lifespan=lifespan)

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware, allow_origins=origins, allow_origin_regex=os.getenv("CORS_ORIGIN_REGEX") or None,
    allow_methods=["*"], allow_headers=["*"], expose_headers=["Content-Disposition"],
)


@app.exception_handler(RequestValidationError)
async def validation_handler(_req: Request, exc: RequestValidationError):
    """Flatten pydantic errors into {detail, fields} so the UI can show them per field."""
    fields = {}
    for err in exc.errors():
        loc = [str(p) for p in err["loc"] if p not in ("body", "query", "path")]
        fields[".".join(loc) or "_"] = err["msg"]
    first = next(iter(fields.items()), ("_", "Invalid request"))
    return JSONResponse(status_code=422, content={"detail": f"{first[0]}: {first[1]}" if first[0] != "_" else first[1], "fields": fields})


for r in (auth.router, zones.router, records.router, zone_files.router):
    app.include_router(r)


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok"}
