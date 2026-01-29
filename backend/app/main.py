"""Punto de entrada principal de la aplicación FastAPI."""

import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import get_settings
from app.models import Base, engine
from app.routers import clientes, facturas, arca, tiendanube, ordenes_tn, webhooks, ai

settings = get_settings()

# Directorio del frontend estático
STATIC_DIR = Path(__file__).parent.parent / "static"


async def run_migrations(conn):
    """Ejecuta migraciones de base de datos."""
    from sqlalchemy import text, inspect
    
    inspector = inspect(conn)
    
    # Verificar si la tabla tiendanube_orders existe y agregarle columnas nuevas
    if 'tiendanube_orders' in inspector.get_table_names():
        existing_columns = [col['name'] for col in inspector.get_columns('tiendanube_orders')]
        
        # Agregar columnas de override de cliente si no existen
        new_columns = [
            ('customer_override_name', 'VARCHAR(255)'),
            ('customer_override_cuit', 'VARCHAR(20)'),
            ('customer_override_condicion_iva', 'VARCHAR(50)'),
        ]
        
        for col_name, col_type in new_columns:
            if col_name not in existing_columns:
                try:
                    conn.execute(text(f'ALTER TABLE tiendanube_orders ADD COLUMN {col_name} {col_type}'))
                except Exception:
                    pass  # La columna ya existe o hubo otro error


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Maneja el ciclo de vida de la aplicación."""
    # Startup: crear tablas y ejecutar migraciones
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(run_migrations)
    yield
    # Shutdown: cerrar conexiones
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    description="API para emisión de facturas electrónicas conectada a ARCA Argentina",
    version="1.0.0",
    lifespan=lifespan,
)

# Configurar CORS
allowed_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
]
# Agregar URL de frontend en producción (Vercel)
if os.getenv("FRONTEND_URL"):
    allowed_origins.append(os.getenv("FRONTEND_URL"))
# Permitir cualquier subdominio de vercel.app en producción
if not settings.debug:
    allowed_origins.append("https://*.vercel.app")
# Permitir TiendaNube Admin (para apps integradas)
allowed_origins.append("https://www.tiendanube.com")
allowed_origins.append("https://*.mitiendanube.com")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.(vercel\.app|mitiendanube\.com|tiendanube\.com)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar routers
app.include_router(clientes.router, prefix="/api/clientes", tags=["Clientes"])
app.include_router(facturas.router, prefix="/api/facturas", tags=["Facturas"])
app.include_router(arca.router, prefix="/api/arca", tags=["ARCA"])
app.include_router(tiendanube.router, prefix="/api/tiendanube", tags=["TiendaNube"])
app.include_router(ordenes_tn.router, prefix="/api/ordenes-tn", tags=["Órdenes TiendaNube"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["Webhooks"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI Assistant"])

# Servir frontend estático en producción
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")


@app.get("/")
async def root():
    """Endpoint raíz."""
    return {
        "app": settings.app_name,
        "version": "1.0.0",
        "docs": "/docs",
        "arca_mode": "producción" if settings.arca_production else "testing",
    }


@app.get("/health")
async def health_check():
    """Verifica el estado de la aplicación."""
    return {"status": "healthy"}


# Servir el frontend para rutas no-API (SPA catch-all)
@app.get("/{full_path:path}")
async def serve_frontend(request: Request, full_path: str):
    """Sirve el frontend para rutas que no son de la API."""
    # Si es una ruta de API, dejar que FastAPI maneje el 404
    if full_path.startswith("api/"):
        return {"detail": "Not Found"}
    
    # Servir index.html para rutas del frontend (SPA)
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    
    # Si no hay frontend, mostrar info de la API
    return {
        "app": settings.app_name,
        "version": "1.0.0",
        "docs": "/docs",
        "arca_mode": "producción" if settings.arca_production else "testing",
    }
