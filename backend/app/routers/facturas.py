"""Router para endpoints de Facturas."""

from datetime import date
from decimal import Decimal
from typing import Optional, Dict, List
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.models import get_db, Factura, ItemFactura, Cliente
from app.models.factura import EstadoFactura
from app.schemas import FacturaCreate, FacturaResponse, FacturaList, FacturaDetalle
from app.services.arca_service import arca_service
from app.services.pdf_service import PDFService

router = APIRouter()
settings = get_settings()


# Mapeo de alícuotas IVA a códigos ARCA y porcentajes
ALICUOTAS_IVA = {
    0: {"codigo": 3, "porcentaje": Decimal("0")},      # No gravado
    3: {"codigo": 3, "porcentaje": Decimal("0")},      # 0%
    4: {"codigo": 4, "porcentaje": Decimal("10.5")},   # 10.5%
    5: {"codigo": 5, "porcentaje": Decimal("21")},     # 21%
    6: {"codigo": 6, "porcentaje": Decimal("27")},     # 27%
}

# Mapeo de condición IVA a códigos ARCA (RG 5616)
CONDICION_IVA_ARCA = {
    "Responsable Inscripto": 1,
    "Monotributista": 6,
    "Exento": 4,
    "Consumidor Final": 5,
    "No Responsable": 7,
}


def calcular_totales(items: List[dict]) -> dict:
    """Calcula los totales de una factura a partir de sus items."""
    subtotal = Decimal("0")
    iva_21 = Decimal("0")
    iva_10_5 = Decimal("0")
    iva_27 = Decimal("0")
    iva_detalle = []

    # Agrupar por alícuota
    iva_por_alicuota: Dict[int, dict] = {}

    for item in items:
        cantidad = Decimal(str(item["cantidad"]))
        precio = Decimal(str(item["precio_unitario"]))
        alicuota = item.get("alicuota_iva", 5)

        item_subtotal = cantidad * precio
        subtotal += item_subtotal

        if alicuota in ALICUOTAS_IVA:
            porcentaje = ALICUOTAS_IVA[alicuota]["porcentaje"]
            iva_item = item_subtotal * porcentaje / Decimal("100")

            if alicuota not in iva_por_alicuota:
                iva_por_alicuota[alicuota] = {
                    "base": Decimal("0"),
                    "importe": Decimal("0"),
                }
            iva_por_alicuota[alicuota]["base"] += item_subtotal
            iva_por_alicuota[alicuota]["importe"] += iva_item

            if alicuota == 5:  # 21%
                iva_21 += iva_item
            elif alicuota == 4:  # 10.5%
                iva_10_5 += iva_item
            elif alicuota == 6:  # 27%
                iva_27 += iva_item

    # Construir detalle IVA para ARCA
    for alicuota_id, valores in iva_por_alicuota.items():
        if valores["importe"] > 0:
            iva_detalle.append({
                "Id": ALICUOTAS_IVA[alicuota_id]["codigo"],
                "BaseImp": float(valores["base"]),
                "Importe": float(valores["importe"]),
            })

    total_iva = iva_21 + iva_10_5 + iva_27
    total = subtotal + total_iva

    return {
        "subtotal": subtotal,
        "iva_21": iva_21,
        "iva_10_5": iva_10_5,
        "iva_27": iva_27,
        "total": total,
        "iva_detalle": iva_detalle,
    }


@router.get("", response_model=FacturaList)
async def listar_facturas(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    cliente_id: Optional[int] = Query(None),
    tipo_comprobante: Optional[int] = Query(None),
    estado: Optional[str] = Query(None),
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Lista facturas con filtros opcionales."""
    query = select(Factura)

    if cliente_id:
        query = query.where(Factura.cliente_id == cliente_id)
    if tipo_comprobante:
        query = query.where(Factura.tipo_comprobante == tipo_comprobante)
    if estado:
        query = query.where(Factura.estado == estado)
    if fecha_desde:
        query = query.where(Factura.fecha >= fecha_desde)
    if fecha_hasta:
        query = query.where(Factura.fecha <= fecha_hasta)

    # Contar total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Obtener resultados paginados
    query = query.offset(skip).limit(limit).order_by(Factura.fecha.desc(), Factura.id.desc())
    result = await db.execute(query)
    facturas = result.scalars().all()

    return FacturaList(items=list(facturas), total=total)


@router.get("/{factura_id}", response_model=FacturaDetalle)
async def obtener_factura(
    factura_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Obtiene el detalle completo de una factura."""
    try:
        result = await db.execute(
            select(Factura)
            .options(selectinload(Factura.cliente), selectinload(Factura.items))
            .where(Factura.id == factura_id)
        )
        factura = result.scalar_one_or_none()

        if not factura:
            raise HTTPException(status_code=404, detail="Factura no encontrada")

        # Verificar que el cliente existe
        if not factura.cliente:
            raise HTTPException(
                status_code=500, 
                detail=f"Error: La factura {factura_id} no tiene cliente asociado"
            )

        return factura
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error obteniendo factura {factura_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error al obtener factura: {str(e)}")


@router.post("", response_model=FacturaResponse, status_code=201)
async def crear_factura(
    factura_data: FacturaCreate,
    db: AsyncSession = Depends(get_db),
):
    """Crea y emite una nueva factura electrónica."""
    # Verificar que existe el cliente
    result = await db.execute(
        select(Cliente).where(Cliente.id == factura_data.cliente_id)
    )
    cliente = result.scalar_one_or_none()

    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    # Validar compatibilidad tipo comprobante con condición IVA del cliente
    # Facturas A (1, 2, 3): Solo para Responsable Inscripto
    # Facturas B (6, 7, 8): Para Consumidor Final, Exento, No Responsable, Monotributista
    # Facturas C (11, 12, 13): Para cualquier cliente (emitidas por Monotributistas)
    comprobantes_a = [1, 2, 3]  # Factura A, ND A, NC A
    comprobantes_b = [6, 7, 8]  # Factura B, ND B, NC B
    
    if factura_data.tipo_comprobante in comprobantes_a:
        if cliente.condicion_iva != "Responsable Inscripto":
            raise HTTPException(
                status_code=400,
                detail=f"Factura A solo puede emitirse a clientes Responsable Inscripto. "
                       f"El cliente '{cliente.razon_social}' es '{cliente.condicion_iva}'. "
                       f"Use Factura B para este cliente."
            )
    elif factura_data.tipo_comprobante in comprobantes_b:
        if cliente.condicion_iva == "Responsable Inscripto":
            raise HTTPException(
                status_code=400,
                detail=f"Factura B no puede emitirse a clientes Responsable Inscripto. "
                       f"Use Factura A para el cliente '{cliente.razon_social}'."
            )

    # Calcular totales
    items_dict = [item.model_dump() for item in factura_data.items]
    totales = calcular_totales(items_dict)

    # Determinar tipo de documento del receptor
    # 80 = CUIT, 96 = DNI, 99 = Consumidor Final
    if cliente.condicion_iva == "Consumidor Final":
        tipo_doc = 99 if totales["total"] < 23265 else 96  # Límite para CF sin identificar
        nro_doc = 0 if tipo_doc == 99 else int(cliente.cuit)
    else:
        tipo_doc = 80  # CUIT
        nro_doc = int(cliente.cuit)

    # Obtener condición IVA del receptor para ARCA (RG 5616)
    condicion_iva_receptor = CONDICION_IVA_ARCA.get(cliente.condicion_iva, 5)

    # Emitir factura en ARCA
    try:
        resultado_arca = arca_service.emitir_factura(
            tipo_comprobante=factura_data.tipo_comprobante,
            punto_venta=settings.arca_punto_venta,
            concepto=factura_data.concepto,
            tipo_doc_receptor=tipo_doc,
            nro_doc_receptor=nro_doc,
            condicion_iva_receptor=condicion_iva_receptor,
            importe_total=totales["total"],
            importe_neto=totales["subtotal"],
            importe_iva=totales["iva_21"] + totales["iva_10_5"] + totales["iva_27"],
            iva_detalle=totales["iva_detalle"],
            fecha=factura_data.fecha,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al emitir factura en ARCA: {str(e)}",
        )

    # Crear factura en base de datos
    factura = Factura(
        cliente_id=factura_data.cliente_id,
        tipo_comprobante=factura_data.tipo_comprobante,
        punto_venta=settings.arca_punto_venta,
        numero=resultado_arca["numero"],
        fecha=factura_data.fecha or date.today(),
        cae=resultado_arca["cae"],
        vencimiento_cae=date.fromisoformat(resultado_arca["vencimiento_cae"]),
        estado=EstadoFactura.AUTORIZADA.value,
        subtotal=totales["subtotal"],
        iva_21=totales["iva_21"],
        iva_10_5=totales["iva_10_5"],
        iva_27=totales["iva_27"],
        total=totales["total"],
        concepto=factura_data.concepto,
        observaciones=factura_data.observaciones,
    )
    db.add(factura)
    await db.flush()

    # Crear items
    for item_data in factura_data.items:
        cantidad = Decimal(str(item_data.cantidad))
        precio = Decimal(str(item_data.precio_unitario))

        item = ItemFactura(
            factura_id=factura.id,
            descripcion=item_data.descripcion,
            cantidad=cantidad,
            precio_unitario=precio,
            alicuota_iva=item_data.alicuota_iva,
            subtotal=cantidad * precio,
        )
        db.add(item)

    await db.flush()
    await db.refresh(factura)

    return factura


@router.get("/{factura_id}/pdf")
async def descargar_pdf(
    factura_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Genera y descarga el PDF de una factura."""
    result = await db.execute(
        select(Factura)
        .options(selectinload(Factura.cliente), selectinload(Factura.items))
        .where(Factura.id == factura_id)
    )
    factura = result.scalar_one_or_none()

    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    # Generar PDF
    pdf_service = PDFService()
    pdf_buffer = pdf_service.generar_factura_pdf(factura)

    filename = f"factura_{factura.numero_completo.replace('-', '_')}.pdf"

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )
