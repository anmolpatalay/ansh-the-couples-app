from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pymongo.errors import OperationFailure

from app.config import settings
from app.database import close_db, connect_db
from app.routers import auth, calendar, home, pairing, photos, users

app = FastAPI(title="ANSH", version="1.0.0")

origins = settings.cors_origin_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(OperationFailure)
async def atlas_permission_error(_request: Request, exc: OperationFailure):
    return JSONResponse(
        status_code=503,
        content={
            "detail": (
                "MongoDB Atlas user cannot read/write database 'ansh'. "
                "In Atlas → Security → Database Access, edit user Ansh, "
                "set Built-in Role to 'Read and write to any database', save, wait a minute, then try again."
            )
        },
    )


@app.on_event("startup")
async def startup():
    await connect_db()


@app.on_event("shutdown")
async def shutdown():
    await close_db()


@app.get("/api/health")
async def health():
    return {"ok": True, "app": "ANSH"}


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(pairing.router)
app.include_router(calendar.router)
app.include_router(photos.router)
app.include_router(home.router)

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@app.get("/{full_path:path}")
async def spa(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")
    candidate = (STATIC_DIR / full_path).resolve()
    if STATIC_DIR.resolve() in candidate.parents and candidate.is_file():
        return FileResponse(candidate)
    index = STATIC_DIR / "index.html"
    if index.is_file():
        return FileResponse(index)
    return {"app": "ANSH", "hint": "Frontend is not built yet. Run the Vite frontend or docker compose."}
