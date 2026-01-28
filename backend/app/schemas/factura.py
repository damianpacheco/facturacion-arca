"""Schemas para Factura."""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator

from app.models.factura import TipoComprobante, EstadoFactura
from .cliente import ClienteResponse


class ItemFacturaBase(BaseModel):
    """Schema base para item de factura."""

    descripcion: str = Field(..., min_length=1, max_length=300)
    cantidad: Decimal = Field(default=Decimal("1.00"), gt=0)
    precio_unitario: Decimal = Field(..., ge=0)
    alicuota_iva: int = Field(default=5, ge=0, le=6)


class ItemFacturaCreate(ItemFacturaBase):
    """Schema para crear item de factura."""

    pass


class ItemFacturaResponse(ItemFacturaBase):
    """Schema para respuesta de item de factura."""

    id: int
    subtotal: Decimal

    class Config:
        from_attributes = True


class FacturaBase(BaseModel):
    """Schema base para Factura."""

    cliente_id: int
    tipo_comprobante: int = Field(..., ge=1, le=13)
    concepto: int = Field(default=1, ge=1, le=3)
    observaciones: Optional[str] = Field(None, max_length=500)

    @field_validator("tipo_comprobante")
    @classmethod
    def validar_tipo(cls, v: int) -> int:
        tipos_validos = [t.value for t in TipoComprobante]
        if v not in tipos_validos:
            raise ValueError(f"Tipo de comprobante inválido. Válidos: {tipos_validos}")
        return v


class FacturaCreate(FacturaBase):
    """Schema para crear una factura."""

    items: List[ItemFacturaCreate] = Field(..., min_length=1)
    fecha: Optional[date] = None  # Si es None, usa fecha actual


class FacturaResponse(BaseModel):
    """Schema para respuesta de factura."""

    id: int
    cliente_id: int
    tipo_comprobante: int
    punto_venta: int
    numero: int
    numero_completo: str
    fecha: date
    cae: Optional[str]
    vencimiento_cae: Optional[date]
    estado: str
    subtotal: Decimal
    iva_21: Decimal
    iva_10_5: Decimal
    iva_27: Decimal
    total: Decimal
    concepto: int
    observaciones: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class FacturaDetalle(FacturaResponse):
    """Schema para detalle completo de factura."""

    cliente: ClienteResponse
    items: List[ItemFacturaResponse]


class FacturaList(BaseModel):
    """Schema para listado de facturas."""

    items: List[FacturaResponse]
    total: int


class UltimoComprobanteResponse(BaseModel):
    """Schema para respuesta de último comprobante."""

    tipo_comprobante: int
    punto_venta: int
    ultimo_numero: int


class CAEResponse(BaseModel):
    """Schema para respuesta de solicitud de CAE."""

    cae: str
    vencimiento_cae: str
    numero: int
    resultado: str
