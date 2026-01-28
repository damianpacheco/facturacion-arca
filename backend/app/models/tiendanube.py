"""Modelo para almacenar tiendas conectadas de TiendaNube."""

from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship

from .base import Base

if TYPE_CHECKING:
    from .factura import Factura


class TiendaNubeStore(Base):
    """Modelo para almacenar datos de tiendas conectadas de TiendaNube."""

    __tablename__ = "tiendanube_stores"

    id: int = Column(Integer, primary_key=True, index=True)
    
    # Datos de la tienda en TiendaNube
    store_id: str = Column(String(50), unique=True, nullable=False, index=True)
    access_token: str = Column(Text, nullable=False)
    
    # Información de la tienda
    store_name: str = Column(String(255), nullable=True)
    store_url: str = Column(String(500), nullable=True)
    store_email: str = Column(String(255), nullable=True)
    
    # Datos del comerciante
    owner_name: str = Column(String(255), nullable=True)
    owner_email: str = Column(String(255), nullable=True)
    
    # Configuración de facturación
    auto_invoice: bool = Column(Boolean, default=False)
    default_invoice_type: int = Column(Integer, default=6)  # Factura B
    
    # Estado
    is_active: bool = Column(Boolean, default=True)
    
    # Timestamps
    created_at: datetime = Column(DateTime, default=datetime.utcnow)
    updated_at: datetime = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_sync_at: Optional[datetime] = Column(DateTime, nullable=True)

    def __repr__(self) -> str:
        return f"<TiendaNubeStore {self.store_name} ({self.store_id})>"


class TiendaNubeOrder(Base):
    """Modelo para trackear órdenes de TiendaNube y sus facturas."""

    __tablename__ = "tiendanube_orders"

    id: int = Column(Integer, primary_key=True, index=True)
    
    # Referencia a la tienda
    store_id: str = Column(String(50), nullable=False, index=True)
    
    # Datos de la orden en TiendaNube
    order_id: str = Column(String(50), nullable=False, index=True)
    order_number: int = Column(Integer, nullable=True)
    
    # Estado de facturación
    invoiced: bool = Column(Boolean, default=False)
    factura_id: Optional[int] = Column(Integer, nullable=True)  # FK a nuestra factura
    
    # Datos de la orden
    order_total: str = Column(String(50), nullable=True)
    order_status: str = Column(String(50), nullable=True)
    payment_status: str = Column(String(50), nullable=True)
    customer_name: str = Column(String(255), nullable=True)
    customer_email: str = Column(String(255), nullable=True)
    customer_identification: str = Column(String(50), nullable=True)
    
    # Timestamps
    order_created_at: Optional[datetime] = Column(DateTime, nullable=True)
    invoiced_at: Optional[datetime] = Column(DateTime, nullable=True)
    created_at: datetime = Column(DateTime, default=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<TiendaNubeOrder {self.order_number} - Store {self.store_id}>"
