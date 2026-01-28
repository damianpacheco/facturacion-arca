"""Router para endpoints de consulta a ARCA."""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from app.config import get_settings
from app.schemas.factura import UltimoComprobanteResponse
from app.services.arca_service import arca_service

router = APIRouter()
settings = get_settings()


@router.get("/ultimo-comprobante", response_model=UltimoComprobanteResponse)
async def obtener_ultimo_comprobante(
    tipo_comprobante: int = Query(..., description="Código del tipo de comprobante"),
    punto_venta: Optional[int] = Query(None, description="Punto de venta"),
):
    """Consulta el último número de comprobante autorizado en ARCA."""
    try:
        pv = punto_venta or settings.arca_punto_venta
        ultimo = arca_service.get_ultimo_comprobante(tipo_comprobante, pv)

        return UltimoComprobanteResponse(
            tipo_comprobante=tipo_comprobante,
            punto_venta=pv,
            ultimo_numero=ultimo,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al consultar ARCA: {str(e)}",
        )


@router.get("/tipos-comprobante")
async def obtener_tipos_comprobante():
    """Obtiene los tipos de comprobante disponibles."""
    try:
        tipos = arca_service.get_tipos_comprobante()
        return {"tipos": tipos}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al consultar ARCA: {str(e)}",
        )


@router.get("/tipos-documento")
async def obtener_tipos_documento():
    """Obtiene los tipos de documento disponibles."""
    try:
        tipos = arca_service.get_tipos_documento()
        return {"tipos": tipos}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al consultar ARCA: {str(e)}",
        )


@router.get("/alicuotas-iva")
async def obtener_alicuotas_iva():
    """Obtiene las alícuotas de IVA disponibles."""
    try:
        alicuotas = arca_service.get_alicuotas_iva()
        return {"alicuotas": alicuotas}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al consultar ARCA: {str(e)}",
        )


@router.get("/puntos-venta")
async def obtener_puntos_venta():
    """Obtiene los puntos de venta habilitados."""
    try:
        puntos = arca_service.get_puntos_venta()
        return {"puntos_venta": puntos}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al consultar ARCA: {str(e)}",
        )


@router.get("/consultar-comprobante")
async def consultar_comprobante(
    tipo_comprobante: int = Query(..., description="Código del tipo de comprobante"),
    punto_venta: int = Query(..., description="Punto de venta"),
    numero: int = Query(..., description="Número del comprobante"),
):
    """Consulta un comprobante emitido en ARCA."""
    try:
        comprobante = arca_service.consultar_comprobante(
            tipo_comprobante, punto_venta, numero
        )

        if not comprobante:
            raise HTTPException(
                status_code=404,
                detail="Comprobante no encontrado",
            )

        return {"comprobante": comprobante}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al consultar ARCA: {str(e)}",
        )


@router.get("/estado")
async def verificar_estado():
    """Verifica el estado de conexión con ARCA."""
    try:
        # Intentar una operación simple para verificar conexión
        arca_service.get_tipos_comprobante()
        return {
            "estado": "conectado",
            "modo": "producción" if settings.arca_production else "testing",
            "cuit": settings.arca_cuit,
            "punto_venta": settings.arca_punto_venta,
        }
    except Exception as e:
        return {
            "estado": "error",
            "mensaje": str(e),
            "modo": "producción" if settings.arca_production else "testing",
        }
