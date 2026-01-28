"""Configuración de la aplicación usando Pydantic Settings."""

from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configuración principal de la aplicación."""

    # App
    app_name: str = "Facturación ARCA"
    debug: bool = False
    secret_key: str = "change-me-in-production"

    # Database
    database_url: str = "sqlite+aiosqlite:///./facturacion.db"

    # ARCA Configuration
    arca_cuit: int = 20409378472  # CUIT de testing por defecto
    arca_production: bool = False
    arca_access_token: str = ""  # Token de https://app.afipsdk.com/ para testing
    arca_cert_path: str = "certs/certificado.crt"
    arca_key_path: str = "certs/clave_privada.key"
    arca_punto_venta: int = 1

    # Datos del emisor
    emisor_razon_social: str = ""
    emisor_domicilio: str = ""
    emisor_condicion_iva: str = "Responsable Inscripto"
    emisor_ingresos_brutos: str = ""
    emisor_inicio_actividades: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """Obtiene la configuración cacheada."""
    return Settings()
