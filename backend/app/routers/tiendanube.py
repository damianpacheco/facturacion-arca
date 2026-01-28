"""Router para autenticación OAuth y gestión de TiendaNube."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.config import get_settings
from app.models import get_db, TiendaNubeStore
from app.services.tiendanube_service import TiendaNubeService

settings = get_settings()
router = APIRouter()


class StoreStatusResponse(BaseModel):
    """Respuesta del estado de conexión."""
    connected: bool
    store_id: Optional[str] = None
    store_name: Optional[str] = None
    store_url: Optional[str] = None
    auto_invoice: bool = False
    default_invoice_type: int = 6


class StoreConfigUpdate(BaseModel):
    """Actualización de configuración de tienda."""
    auto_invoice: Optional[bool] = None
    default_invoice_type: Optional[int] = None


@router.get("/install")
async def install_app(db: AsyncSession = Depends(get_db)):
    """
    Inicia el proceso de instalación OAuth.
    Redirige a TiendaNube para autorizar la aplicación.
    """
    if not settings.tn_client_id:
        raise HTTPException(
            status_code=500,
            detail="TiendaNube no está configurado. Configure TN_CLIENT_ID en las variables de entorno."
        )

    redirect_uri = settings.tn_redirect_uri or f"{settings.app_name}/api/tiendanube/callback"
    auth_url = TiendaNubeService.get_authorization_url(redirect_uri)
    
    return RedirectResponse(url=auth_url)


@router.get("/callback")
async def oauth_callback(
    code: str = Query(..., description="Código de autorización de TiendaNube"),
    db: AsyncSession = Depends(get_db),
):
    """
    Callback de OAuth. Recibe el código y obtiene el access token.
    """
    if not code:
        raise HTTPException(status_code=400, detail="Código de autorización no proporcionado")

    service = TiendaNubeService()
    
    try:
        # Intercambiar código por token
        token_data = await service.exchange_code_for_token(code)
        
        access_token = token_data.get("access_token")
        store_id = str(token_data.get("user_id"))
        
        if not access_token or not store_id:
            raise HTTPException(status_code=400, detail="Respuesta inválida de TiendaNube")

        # Obtener información de la tienda
        service.access_token = access_token
        service.store_id = store_id
        store_info = await service.get_store_info()

        # Verificar si la tienda ya existe
        result = await db.execute(
            select(TiendaNubeStore).where(TiendaNubeStore.store_id == store_id)
        )
        existing_store = result.scalar_one_or_none()

        if existing_store:
            # Actualizar token existente
            existing_store.access_token = access_token
            existing_store.store_name = store_info.get("name", {}).get("es", "")
            existing_store.store_url = store_info.get("url_with_protocol", "")
            existing_store.store_email = store_info.get("email", "")
            existing_store.owner_name = store_info.get("contact_name", "")
            existing_store.owner_email = store_info.get("contact_email", "")
            existing_store.is_active = True
        else:
            # Crear nueva tienda
            new_store = TiendaNubeStore(
                store_id=store_id,
                access_token=access_token,
                store_name=store_info.get("name", {}).get("es", ""),
                store_url=store_info.get("url_with_protocol", ""),
                store_email=store_info.get("email", ""),
                owner_name=store_info.get("contact_name", ""),
                owner_email=store_info.get("contact_email", ""),
                auto_invoice=settings.tn_auto_invoice,
                default_invoice_type=settings.tn_default_invoice_type,
            )
            db.add(new_store)

        await db.commit()

        # Registrar webhooks para facturación automática
        try:
            webhook_base_url = settings.tn_redirect_uri.rsplit("/", 2)[0]  # Obtener base URL
            await service.register_webhook("order/paid", f"{webhook_base_url}/api/webhooks/tiendanube")
            await service.register_webhook("order/cancelled", f"{webhook_base_url}/api/webhooks/tiendanube")
        except Exception as webhook_error:
            # Log pero no fallar si no se pueden registrar webhooks
            print(f"Error registrando webhooks: {webhook_error}")

        await service.close()

        # Redirigir de vuelta a la app
        return RedirectResponse(url="/ordenes-tiendanube?connected=true")

    except Exception as e:
        await service.close()
        raise HTTPException(status_code=500, detail=f"Error en OAuth: {str(e)}")


@router.get("/status", response_model=StoreStatusResponse)
async def get_connection_status(db: AsyncSession = Depends(get_db)):
    """
    Verifica si hay una tienda de TiendaNube conectada.
    """
    result = await db.execute(
        select(TiendaNubeStore).where(TiendaNubeStore.is_active == True)
    )
    store = result.scalar_one_or_none()

    if not store:
        return StoreStatusResponse(connected=False)

    return StoreStatusResponse(
        connected=True,
        store_id=store.store_id,
        store_name=store.store_name,
        store_url=store.store_url,
        auto_invoice=store.auto_invoice,
        default_invoice_type=store.default_invoice_type,
    )


@router.put("/config", response_model=StoreStatusResponse)
async def update_store_config(
    config: StoreConfigUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Actualiza la configuración de facturación de la tienda conectada.
    """
    result = await db.execute(
        select(TiendaNubeStore).where(TiendaNubeStore.is_active == True)
    )
    store = result.scalar_one_or_none()

    if not store:
        raise HTTPException(status_code=404, detail="No hay tienda conectada")

    if config.auto_invoice is not None:
        store.auto_invoice = config.auto_invoice
    if config.default_invoice_type is not None:
        store.default_invoice_type = config.default_invoice_type

    await db.commit()
    await db.refresh(store)

    return StoreStatusResponse(
        connected=True,
        store_id=store.store_id,
        store_name=store.store_name,
        store_url=store.store_url,
        auto_invoice=store.auto_invoice,
        default_invoice_type=store.default_invoice_type,
    )


@router.post("/disconnect")
async def disconnect_store(db: AsyncSession = Depends(get_db)):
    """
    Desconecta la tienda de TiendaNube.
    """
    result = await db.execute(
        select(TiendaNubeStore).where(TiendaNubeStore.is_active == True)
    )
    store = result.scalar_one_or_none()

    if not store:
        raise HTTPException(status_code=404, detail="No hay tienda conectada")

    store.is_active = False
    await db.commit()

    return {"message": "Tienda desconectada correctamente"}
