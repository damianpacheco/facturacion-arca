"""Router para endpoints de Clientes."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import get_db, Cliente
from app.schemas import ClienteCreate, ClienteUpdate, ClienteResponse, ClienteList

router = APIRouter()


@router.get("", response_model=ClienteList)
async def listar_clientes(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    buscar: Optional[str] = Query(None, description="Buscar por razón social o CUIT"),
    db: AsyncSession = Depends(get_db),
):
    """Lista todos los clientes con paginación y búsqueda opcional."""
    query = select(Cliente)

    if buscar:
        buscar_pattern = f"%{buscar}%"
        query = query.where(
            (Cliente.razon_social.ilike(buscar_pattern))
            | (Cliente.cuit.ilike(buscar_pattern))
        )

    # Contar total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Obtener resultados paginados
    query = query.offset(skip).limit(limit).order_by(Cliente.razon_social)
    result = await db.execute(query)
    clientes = result.scalars().all()

    return ClienteList(items=list(clientes), total=total)


@router.get("/{cliente_id}", response_model=ClienteResponse)
async def obtener_cliente(
    cliente_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Obtiene un cliente por su ID."""
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = result.scalar_one_or_none()

    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    return cliente


@router.post("", response_model=ClienteResponse, status_code=201)
async def crear_cliente(
    cliente_data: ClienteCreate,
    db: AsyncSession = Depends(get_db),
):
    """Crea un nuevo cliente."""
    # Verificar si ya existe un cliente con ese CUIT
    result = await db.execute(
        select(Cliente).where(Cliente.cuit == cliente_data.cuit)
    )
    existente = result.scalar_one_or_none()

    if existente:
        raise HTTPException(
            status_code=400,
            detail=f"Ya existe un cliente con CUIT {cliente_data.cuit}",
        )

    cliente = Cliente(**cliente_data.model_dump())
    db.add(cliente)
    await db.flush()
    await db.refresh(cliente)

    return cliente


@router.put("/{cliente_id}", response_model=ClienteResponse)
async def actualizar_cliente(
    cliente_id: int,
    cliente_data: ClienteUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Actualiza un cliente existente."""
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = result.scalar_one_or_none()

    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    # Actualizar solo los campos proporcionados
    update_data = cliente_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(cliente, field, value)

    await db.flush()
    await db.refresh(cliente)

    return cliente


@router.delete("/{cliente_id}", status_code=204)
async def eliminar_cliente(
    cliente_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Elimina un cliente."""
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = result.scalar_one_or_none()

    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    # Verificar si tiene facturas asociadas
    if cliente.facturas:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar un cliente con facturas asociadas",
        )

    await db.delete(cliente)
