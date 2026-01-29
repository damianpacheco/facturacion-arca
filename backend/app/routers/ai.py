"""Router para endpoints de IA/Asistente de ventas."""

from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import get_db
from app.services.ai_service import ai_service

router = APIRouter()


class ChatRequest(BaseModel):
    """Request para el endpoint de chat."""
    message: str


class ChatResponse(BaseModel):
    """Response del endpoint de chat."""
    response: str


@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """Envía un mensaje al asistente de ventas y obtiene una respuesta."""
    response = await ai_service.chat(request.message, db)
    return ChatResponse(response=response)


@router.get("/stats")
async def get_sales_stats(
    db: AsyncSession = Depends(get_db),
):
    """Obtiene estadísticas de ventas (útil para debugging)."""
    stats = await ai_service.get_sales_stats(db)
    return stats
