"""Modelo de Cliente."""

from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .factura import Factura


class Cliente(Base):
    """Modelo para almacenar clientes."""

    __tablename__ = "clientes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    razon_social: Mapped[str] = mapped_column(String(200), nullable=False)
    cuit: Mapped[str] = mapped_column(String(13), nullable=False, index=True)
    condicion_iva: Mapped[str] = mapped_column(String(50), nullable=False)
    domicilio: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    telefono: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relación con facturas
    facturas: Mapped[List["Factura"]] = relationship(
        back_populates="cliente", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Cliente {self.razon_social} ({self.cuit})>"
