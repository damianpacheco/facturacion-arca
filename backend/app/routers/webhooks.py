"""Router para recibir webhooks de TiendaNube."""

from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.config import get_settings
from app.models import get_db, TiendaNubeStore, TiendaNubeOrder, Cliente, Factura, ItemFactura
from app.services.tiendanube_service import TiendaNubeService, map_order_to_invoice_data
from app.services.arca_service import ARCAService

settings = get_settings()
router = APIRouter()


class WebhookPayload(BaseModel):
    """Payload de webhook de TiendaNube."""
    store_id: str
    event: str
    id: Optional[str] = None


async def process_order_paid(store_id: str, order_id: str, db: AsyncSession):
    """Procesa un webhook de orden pagada - factura automáticamente si está habilitado."""
    
    # Buscar la tienda
    result = await db.execute(
        select(TiendaNubeStore).where(
            TiendaNubeStore.store_id == store_id,
            TiendaNubeStore.is_active == True
        )
    )
    store = result.scalar_one_or_none()
    
    if not store:
        print(f"Webhook: Tienda {store_id} no encontrada o no activa")
        return

    # Verificar si facturación automática está habilitada
    if not store.auto_invoice:
        print(f"Webhook: Facturación automática deshabilitada para tienda {store_id}")
        return

    # Verificar si la orden ya está facturada
    result = await db.execute(
        select(TiendaNubeOrder).where(
            TiendaNubeOrder.store_id == store_id,
            TiendaNubeOrder.order_id == order_id
        )
    )
    existing_order = result.scalar_one_or_none()
    
    if existing_order and existing_order.invoiced:
        print(f"Webhook: Orden {order_id} ya facturada")
        return

    # Obtener datos de la orden
    service = TiendaNubeService(
        access_token=store.access_token,
        store_id=store.store_id
    )
    
    try:
        order = await service.get_order(order_id)
        await service.close()

        # Mapear datos
        invoice_data = map_order_to_invoice_data(order)
        
        # Determinar tipo de comprobante
        tipo_comprobante = store.default_invoice_type
        if invoice_data["cliente"]["condicion_iva"] == "Responsable Inscripto":
            tipo_comprobante = 1  # Factura A

        # Buscar o crear cliente
        cliente_data = invoice_data["cliente"]
        cuit = cliente_data.get("cuit", "").replace("-", "")
        
        if cuit:
            result = await db.execute(
                select(Cliente).where(Cliente.cuit == cuit)
            )
            cliente = result.scalar_one_or_none()
        else:
            cliente = None

        if not cliente:
            cliente = Cliente(
                razon_social=cliente_data["razon_social"],
                cuit=cuit or "00000000000",
                condicion_iva=cliente_data["condicion_iva"],
                domicilio=cliente_data.get("domicilio", ""),
                email=cliente_data.get("email", ""),
                telefono=cliente_data.get("telefono", ""),
            )
            db.add(cliente)
            await db.flush()

        # Emitir factura en ARCA
        arca_service = ARCAService()
        
        subtotal = sum(
            item["cantidad"] * item["precio_unitario"] 
            for item in invoice_data["items"]
        )
        
        if tipo_comprobante in [1, 2, 3, 6, 7, 8]:
            iva_21 = subtotal * 0.21
            total = subtotal + iva_21
            iva_detalle = [{"Id": 5, "BaseImp": float(subtotal), "Importe": float(iva_21)}]
        else:
            iva_21 = 0
            total = subtotal
            iva_detalle = []

        if cliente_data["condicion_iva"] == "Responsable Inscripto":
            tipo_doc = 80
            nro_doc = int(cuit) if cuit else 0
        elif cuit and len(cuit) == 11:
            tipo_doc = 80
            nro_doc = int(cuit)
        else:
            tipo_doc = 99
            nro_doc = 0

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
            concepto=1,
            tipo_doc_receptor=tipo_doc,
            nro_doc_receptor=nro_doc,
            condicion_iva_receptor=condicion_iva_receptor,
            importe_total=total,
            importe_neto=subtotal,
            importe_iva=iva_21,
            iva_detalle=iva_detalle,
        )

        # Crear factura
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
            observaciones=f"Orden TiendaNube #{order.get('number')} (auto)",
        )
        db.add(factura)
        await db.flush()

        # Crear items
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

        # Registrar orden
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
        print(f"Webhook: Orden {order_id} facturada automáticamente - Factura {factura.numero_completo}")

    except Exception as e:
        await service.close()
        print(f"Webhook: Error facturando orden {order_id}: {str(e)}")


@router.post("/tiendanube")
async def receive_tiendanube_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Recibe webhooks de TiendaNube.
    
    Eventos manejados:
    - order/paid: Factura automáticamente si está habilitado
    - order/cancelled: Registra la cancelación (nota de crédito pendiente)
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    store_id = str(body.get("store_id", ""))
    event = body.get("event", "")
    order_id = str(body.get("id", ""))

    print(f"Webhook recibido: {event} - Store: {store_id} - Order: {order_id}")

    if event == "order/paid" and order_id:
        # Procesar en background para responder rápido
        background_tasks.add_task(process_order_paid, store_id, order_id, db)
        return {"status": "processing"}

    elif event == "order/cancelled" and order_id:
        # Por ahora solo registramos, nota de crédito sería una mejora futura
        print(f"Orden {order_id} cancelada - Nota de crédito pendiente de implementar")
        return {"status": "logged"}

    return {"status": "ignored", "event": event}
