"""Router para gestión de órdenes de TiendaNube."""

from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.config import get_settings
from app.models import get_db, TiendaNubeStore, TiendaNubeOrder, Cliente, Factura, ItemFactura
from app.services.tiendanube_service import TiendaNubeService, map_order_to_invoice_data
from app.services.arca_service import ARCAService

settings = get_settings()
router = APIRouter()


class OrderProduct(BaseModel):
    """Producto de una orden."""
    id: int
    name: str
    quantity: str
    price: str
    product_id: int


class OrderCustomer(BaseModel):
    """Cliente de una orden."""
    id: int
    name: str
    email: str
    identification: Optional[str] = None


class OrderResponse(BaseModel):
    """Respuesta de orden de TiendaNube."""
    id: int
    number: int
    status: str
    payment_status: str
    total: str
    subtotal: str
    currency: str
    created_at: str
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_identification: Optional[str] = None
    invoiced: bool = False
    factura_id: Optional[int] = None
    factura_numero: Optional[str] = None


class OrderListResponse(BaseModel):
    """Lista de órdenes."""
    items: List[OrderResponse]
    total: int
    page: int
    per_page: int


class InvoiceOrderRequest(BaseModel):
    """Request para facturar una orden."""
    tipo_comprobante: Optional[int] = None  # Si no se especifica, usa el default


class InvoiceOrderResponse(BaseModel):
    """Respuesta de facturación de orden."""
    success: bool
    factura_id: Optional[int] = None
    numero_completo: Optional[str] = None
    cae: Optional[str] = None
    message: str


async def get_active_store(db: AsyncSession) -> TiendaNubeStore:
    """Obtiene la tienda activa o lanza error."""
    result = await db.execute(
        select(TiendaNubeStore).where(TiendaNubeStore.is_active == True)
    )
    store = result.scalar_one_or_none()
    
    if not store:
        raise HTTPException(
            status_code=404,
            detail="No hay tienda de TiendaNube conectada"
        )
    
    return store


@router.get("", response_model=OrderListResponse)
async def list_orders(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    status: Optional[str] = Query(None, description="open, closed, cancelled"),
    payment_status: Optional[str] = Query(None, description="pending, paid, refunded"),
    invoiced: Optional[bool] = Query(None, description="Filtrar por facturadas/no facturadas"),
    db: AsyncSession = Depends(get_db),
):
    """
    Lista las órdenes de la tienda conectada de TiendaNube.
    """
    store = await get_active_store(db)
    
    service = TiendaNubeService(
        access_token=store.access_token,
        store_id=store.store_id
    )
    
    try:
        orders = await service.get_orders(
            status=status,
            payment_status=payment_status,
            page=page,
            per_page=per_page,
        )
        await service.close()

        # Verificar cuáles ya están facturadas
        order_ids = [str(o.get("id")) for o in orders]
        result = await db.execute(
            select(TiendaNubeOrder).where(
                TiendaNubeOrder.store_id == store.store_id,
                TiendaNubeOrder.order_id.in_(order_ids)
            )
        )
        invoiced_orders = {o.order_id: o for o in result.scalars().all()}

        # Construir respuesta
        items = []
        for order in orders:
            order_id = str(order.get("id"))
            tn_order = invoiced_orders.get(order_id)
            
            customer = order.get("customer", {})
            
            # Filtrar por estado de facturación si se especifica
            is_invoiced = tn_order.invoiced if tn_order else False
            if invoiced is not None and is_invoiced != invoiced:
                continue
            
            # Obtener número de factura si existe
            factura_numero = None
            if tn_order and tn_order.factura_id:
                factura_result = await db.execute(
                    select(Factura).where(Factura.id == tn_order.factura_id)
                )
                factura = factura_result.scalar_one_or_none()
                if factura:
                    factura_numero = factura.numero_completo

            items.append(OrderResponse(
                id=order.get("id"),
                number=order.get("number"),
                status=order.get("status", "unknown"),
                payment_status=order.get("payment_status", "unknown"),
                total=str(order.get("total", "0")),
                subtotal=str(order.get("subtotal", "0")),
                currency=order.get("currency", "ARS"),
                created_at=order.get("created_at", ""),
                customer_name=order.get("contact_name") or (customer.get("name") if customer else None),
                customer_email=order.get("contact_email") or (customer.get("email") if customer else None),
                customer_identification=order.get("contact_identification") or (customer.get("identification") if customer else None),
                invoiced=is_invoiced,
                factura_id=tn_order.factura_id if tn_order else None,
                factura_numero=factura_numero,
            ))

        return OrderListResponse(
            items=items,
            total=len(items),
            page=page,
            per_page=per_page,
        )

    except Exception as e:
        await service.close()
        raise HTTPException(status_code=500, detail=f"Error obteniendo órdenes: {str(e)}")


@router.get("/{order_id}")
async def get_order_detail(
    order_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Obtiene el detalle de una orden específica.
    """
    store = await get_active_store(db)
    
    service = TiendaNubeService(
        access_token=store.access_token,
        store_id=store.store_id
    )
    
    try:
        order = await service.get_order(order_id)
        await service.close()

        # Verificar si está facturada
        result = await db.execute(
            select(TiendaNubeOrder).where(
                TiendaNubeOrder.store_id == store.store_id,
                TiendaNubeOrder.order_id == order_id
            )
        )
        tn_order = result.scalar_one_or_none()

        return {
            **order,
            "invoiced": tn_order.invoiced if tn_order else False,
            "factura_id": tn_order.factura_id if tn_order else None,
        }

    except Exception as e:
        await service.close()
        raise HTTPException(status_code=500, detail=f"Error obteniendo orden: {str(e)}")


@router.post("/{order_id}/facturar", response_model=InvoiceOrderResponse)
async def invoice_order(
    order_id: str,
    request: InvoiceOrderRequest = InvoiceOrderRequest(),
    db: AsyncSession = Depends(get_db),
):
    """
    Factura una orden de TiendaNube en ARCA.
    """
    store = await get_active_store(db)
    
    # Verificar si ya está facturada
    result = await db.execute(
        select(TiendaNubeOrder).where(
            TiendaNubeOrder.store_id == store.store_id,
            TiendaNubeOrder.order_id == order_id
        )
    )
    existing_order = result.scalar_one_or_none()
    
    if existing_order and existing_order.invoiced:
        return InvoiceOrderResponse(
            success=False,
            factura_id=existing_order.factura_id,
            message="Esta orden ya fue facturada"
        )

    service = TiendaNubeService(
        access_token=store.access_token,
        store_id=store.store_id
    )
    
    try:
        # Obtener datos de la orden
        order = await service.get_order(order_id)
        await service.close()

        # Mapear datos de la orden a factura
        invoice_data = map_order_to_invoice_data(order)
        
        # Determinar tipo de comprobante
        tipo_comprobante = request.tipo_comprobante or store.default_invoice_type
        
        # Si el cliente es Responsable Inscripto, usar Factura A
        if invoice_data["cliente"]["condicion_iva"] == "Responsable Inscripto":
            tipo_comprobante = 1  # Factura A

        # Buscar o crear cliente
        cliente_data = invoice_data["cliente"]
        cuit = (cliente_data.get("cuit") or "").replace("-", "")
        
        if cuit:
            result = await db.execute(
                select(Cliente).where(Cliente.cuit == cuit)
            )
            cliente = result.scalar_one_or_none()
        else:
            cliente = None

        if not cliente:
            # Crear nuevo cliente
            cliente = Cliente(
                razon_social=cliente_data["razon_social"],
                cuit=cuit or "00000000000",  # CUIT genérico para Consumidor Final
                condicion_iva=cliente_data["condicion_iva"],
                domicilio=cliente_data.get("domicilio", ""),
                email=cliente_data.get("email", ""),
                telefono=cliente_data.get("telefono", ""),
            )
            db.add(cliente)
            await db.flush()

        # Emitir factura en ARCA
        arca_service = ARCAService()
        
        # Calcular totales
        subtotal = sum(
            item["cantidad"] * item["precio_unitario"] 
            for item in invoice_data["items"]
        )
        
        # Calcular IVA (solo para Facturas A y B)
        if tipo_comprobante in [1, 2, 3, 6, 7, 8]:
            iva_21 = subtotal * 0.21
            total = subtotal + iva_21
            iva_detalle = [{"Id": 5, "BaseImp": float(subtotal), "Importe": float(iva_21)}]
        else:
            iva_21 = 0
            total = subtotal
            iva_detalle = []

        # Determinar tipo de documento del receptor
        if cliente_data["condicion_iva"] == "Responsable Inscripto":
            tipo_doc = 80  # CUIT
            nro_doc = int(cuit) if cuit else 0
        elif cuit and len(cuit) == 11:
            tipo_doc = 80  # CUIT
            nro_doc = int(cuit)
        else:
            tipo_doc = 99  # Sin identificar
            nro_doc = 0

        # Mapear condición IVA
        condicion_iva_map = {
            "Responsable Inscripto": 1,
            "Monotributista": 6,
            "Exento": 4,
            "Consumidor Final": 5,
            "No Responsable": 7,
        }
        condicion_iva_receptor = condicion_iva_map.get(cliente_data["condicion_iva"], 5)

        resultado_arca = arca_service.emitir_factura(
            tipo_comprobante=tipo_comprobante,
            punto_venta=settings.arca_punto_venta,
            concepto=1,  # Productos
            tipo_doc_receptor=tipo_doc,
            nro_doc_receptor=nro_doc,
            condicion_iva_receptor=condicion_iva_receptor,
            importe_total=total,
            importe_neto=subtotal,
            importe_iva=iva_21,
            iva_detalle=iva_detalle,
        )

        # Crear factura en nuestra base de datos
        factura = Factura(
            cliente_id=cliente.id,
            tipo_comprobante=tipo_comprobante,
            punto_venta=settings.arca_punto_venta,
            numero=resultado_arca["numero"],
            fecha=datetime.now().date(),
            cae=resultado_arca["cae"],
            vencimiento_cae=datetime.fromisoformat(resultado_arca["vencimiento_cae"]).date(),
            estado="autorizada",
            subtotal=subtotal,
            iva_21=iva_21,
            iva_10_5=0,
            iva_27=0,
            total=total,
            concepto=1,
            observaciones=f"Orden TiendaNube #{order.get('number')}",
        )
        db.add(factura)
        await db.flush()

        # Crear items de factura
        for item in invoice_data["items"]:
            item_factura = ItemFactura(
                factura_id=factura.id,
                descripcion=item["descripcion"],
                cantidad=item["cantidad"],
                precio_unitario=item["precio_unitario"],
                alicuota_iva=item["alicuota_iva"],
                subtotal=item["cantidad"] * item["precio_unitario"],
            )
            db.add(item_factura)

        # Registrar/actualizar orden en nuestra base de datos
        if existing_order:
            existing_order.invoiced = True
            existing_order.factura_id = factura.id
            existing_order.invoiced_at = datetime.utcnow()
        else:
            tn_order = TiendaNubeOrder(
                store_id=store.store_id,
                order_id=order_id,
                order_number=order.get("number"),
                invoiced=True,
                factura_id=factura.id,
                order_total=str(order.get("total")),
                order_status=order.get("status"),
                payment_status=order.get("payment_status"),
                customer_name=cliente_data["razon_social"],
                customer_email=cliente_data.get("email"),
                customer_identification=cuit,
                invoiced_at=datetime.utcnow(),
            )
            db.add(tn_order)

        await db.commit()

        return InvoiceOrderResponse(
            success=True,
            factura_id=factura.id,
            numero_completo=factura.numero_completo,
            cae=resultado_arca["cae"],
            message="Factura emitida correctamente"
        )

    except Exception as e:
        await service.close()
        raise HTTPException(status_code=500, detail=f"Error facturando orden: {str(e)}")
