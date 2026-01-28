"""Schemas para Cliente."""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator
import re


def validar_cuit(cuit: str) -> str:
    """Valida el formato y dígito verificador del CUIT."""
    # Eliminar guiones y espacios
    cuit_limpio = re.sub(r"[-\s]", "", cuit)

    if not cuit_limpio.isdigit() or len(cuit_limpio) != 11:
        raise ValueError("CUIT debe tener 11 dígitos")

    # Validar dígito verificador
    multiplicadores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    suma = sum(int(cuit_limpio[i]) * multiplicadores[i] for i in range(10))
    resto = suma % 11
    digito_verificador = 11 - resto if resto != 0 else 0

    if resto == 1 or int(cuit_limpio[10]) != digito_verificador:
        raise ValueError("CUIT inválido: dígito verificador incorrecto")

    return cuit_limpio


class ClienteBase(BaseModel):
    """Schema base para Cliente."""

    razon_social: str = Field(..., min_length=1, max_length=200)
    cuit: str = Field(..., min_length=11, max_length=13)
    condicion_iva: str = Field(..., min_length=1, max_length=50)
    domicilio: Optional[str] = Field(None, max_length=300)
    email: Optional[str] = Field(None, max_length=100)
    telefono: Optional[str] = Field(None, max_length=50)

    @field_validator("cuit")
    @classmethod
    def validar_cuit_format(cls, v: str) -> str:
        return validar_cuit(v)


class ClienteCreate(ClienteBase):
    """Schema para crear un cliente."""

    pass


class ClienteUpdate(BaseModel):
    """Schema para actualizar un cliente."""

    razon_social: Optional[str] = Field(None, min_length=1, max_length=200)
    condicion_iva: Optional[str] = Field(None, min_length=1, max_length=50)
    domicilio: Optional[str] = Field(None, max_length=300)
    email: Optional[str] = Field(None, max_length=100)
    telefono: Optional[str] = Field(None, max_length=50)


class ClienteResponse(ClienteBase):
    """Schema para respuesta de cliente."""

    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ClienteList(BaseModel):
    """Schema para listado de clientes."""

    items: List[ClienteResponse]
    total: int
