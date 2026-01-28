"""Modelos de Factura e Items."""

from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, DateTime, Date, Numeric, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .cliente import Cliente


class TipoComprobante(int, Enum):
    """Tipos de comprobante según ARCA."""

    FACTURA_A = 1
    NOTA_DEBITO_A = 2
    NOTA_CREDITO_A = 3
    FACTURA_B = 6
    NOTA_DEBITO_B = 7
    NOTA_CREDITO_B = 8
    FACTURA_C = 11
    NOTA_DEBITO_C = 12
    NOTA_CREDITO_C = 13


class EstadoFactura(str, Enum):
    """Estados posibles de una factura."""

    PENDIENTE = "pendiente"
    AUTORIZADA = "autorizada"
    RECHAZADA = "rechazada"
    ANULADA = "anulada"


class Factura(Base):
    """Modelo para almacenar facturas emitidas."""

    __tablename__ = "facturas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"), nullable=False)

    # Datos del comprobante
    tipo_comprobante: Mapped[int] = mapped_column(Integer, nullable=False)
    punto_venta: Mapped[int] = mapped_column(Integer, nullable=False)
    numero: Mapped[int] = mapped_column(Integer, nullable=False)
    fecha: Mapped[date] = mapped_column(Date, nullable=False)

    # Datos de ARCA
    cae: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    vencimiento_cae: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    estado: Mapped[str] = mapped_column(
        String(20), default=EstadoFactura.PENDIENTE.value
    )

    # Montos
    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(precision=12, scale=2), default=Decimal("0.00")
    )
    iva_21: Mapped[Decimal] = mapped_column(
        Numeric(precision=12, scale=2), default=Decimal("0.00")
    )
    iva_10_5: Mapped[Decimal] = mapped_column(
        Numeric(precision=12, scale=2), default=Decimal("0.00")
    )
    iva_27: Mapped[Decimal] = mapped_column(
        Numeric(precision=12, scale=2), default=Decimal("0.00")
    )
    total: Mapped[Decimal] = mapped_column(
        Numeric(precision=12, scale=2), default=Decimal("0.00")
    )

    # Concepto (1=Productos, 2=Servicios, 3=Productos y Servicios)
    concepto: Mapped[int] = mapped_column(Integer, default=1)

    # Observaciones
    observaciones: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relaciones
    cliente: Mapped["Cliente"] = relationship(back_populates="facturas")
    items: Mapped[List["ItemFactura"]] = relationship(
        back_populates="factura", lazy="selectin", cascade="all, delete-orphan"
    )

    @property
    def numero_completo(self) -> str:
        """Retorna el número completo del comprobante (PV-Nro)."""
        return f"{self.punto_venta:04d}-{self.numero:08d}"

    def __repr__(self) -> str:
        return f"<Factura {self.numero_completo} - {self.estado}>"


class ItemFactura(Base):
    """Modelo para items/líneas de una factura."""

    __tablename__ = "items_factura"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    factura_id: Mapped[int] = mapped_column(
        ForeignKey("facturas.id", ondelete="CASCADE"), nullable=False
    )

    descripcion: Mapped[str] = mapped_column(String(300), nullable=False)
    cantidad: Mapped[Decimal] = mapped_column(
        Numeric(precision=10, scale=2), default=Decimal("1.00")
    )
    precio_unitario: Mapped[Decimal] = mapped_column(
        Numeric(precision=12, scale=2), nullable=False
    )
    # Alícuota IVA: 0=No gravado, 3=0%, 4=10.5%, 5=21%, 6=27%
    alicuota_iva: Mapped[int] = mapped_column(Integer, default=5)
    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(precision=12, scale=2), nullable=False
    )

    # Relación con factura
    factura: Mapped["Factura"] = relationship(back_populates="items")

    def __repr__(self) -> str:
        return f"<ItemFactura {self.descripcion[:30]}>"
