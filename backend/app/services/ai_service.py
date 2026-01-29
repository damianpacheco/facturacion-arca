"""Servicio de IA para análisis de ventas usando Google Gemini."""

import os
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional
import google.generativeai as genai
from sqlalchemy import select, func, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Factura, Cliente, ItemFactura


class AIService:
    """Servicio para generar insights de ventas con IA."""

    def _get_model(self):
        """Obtiene el modelo de Gemini, leyendo la API key dinámicamente."""
        # Leer directamente de env para evitar cache
        api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            return None
        genai.configure(api_key=api_key)
        return genai.GenerativeModel("gemini-1.5-flash-latest")

    async def get_sales_stats(self, db: AsyncSession) -> dict:
        """Obtiene estadísticas de ventas para contexto del AI."""
        today = date.today()
        start_of_month = today.replace(day=1)
        start_of_last_month = (start_of_month - timedelta(days=1)).replace(day=1)
        end_of_last_month = start_of_month - timedelta(days=1)
        start_of_week = today - timedelta(days=today.weekday())

        stats = {}

        # Total de facturas
        result = await db.execute(select(func.count(Factura.id)))
        stats["total_facturas"] = result.scalar() or 0

        # Ventas del mes actual
        result = await db.execute(
            select(func.sum(Factura.total), func.count(Factura.id))
            .where(Factura.fecha >= start_of_month)
            .where(Factura.estado == "autorizada")
        )
        row = result.one()
        stats["ventas_mes"] = float(row[0] or 0)
        stats["facturas_mes"] = row[1] or 0

        # Ventas del mes anterior
        result = await db.execute(
            select(func.sum(Factura.total), func.count(Factura.id))
            .where(Factura.fecha >= start_of_last_month)
            .where(Factura.fecha <= end_of_last_month)
            .where(Factura.estado == "autorizada")
        )
        row = result.one()
        stats["ventas_mes_anterior"] = float(row[0] or 0)
        stats["facturas_mes_anterior"] = row[1] or 0

        # Ventas de la semana
        result = await db.execute(
            select(func.sum(Factura.total), func.count(Factura.id))
            .where(Factura.fecha >= start_of_week)
            .where(Factura.estado == "autorizada")
        )
        row = result.one()
        stats["ventas_semana"] = float(row[0] or 0)
        stats["facturas_semana"] = row[1] or 0

        # Ticket promedio
        if stats["facturas_mes"] > 0:
            stats["ticket_promedio_mes"] = stats["ventas_mes"] / stats["facturas_mes"]
        else:
            stats["ticket_promedio_mes"] = 0

        # Top 5 clientes del mes
        result = await db.execute(
            select(
                Cliente.razon_social,
                func.sum(Factura.total).label("total"),
                func.count(Factura.id).label("cantidad")
            )
            .join(Cliente, Factura.cliente_id == Cliente.id)
            .where(Factura.fecha >= start_of_month)
            .where(Factura.estado == "autorizada")
            .group_by(Cliente.id)
            .order_by(func.sum(Factura.total).desc())
            .limit(5)
        )
        stats["top_clientes"] = [
            {"nombre": row[0], "total": float(row[1]), "cantidad": row[2]}
            for row in result.all()
        ]

        # Top 5 productos/servicios más vendidos del mes
        result = await db.execute(
            select(
                ItemFactura.descripcion,
                func.sum(ItemFactura.cantidad).label("cantidad"),
                func.sum(ItemFactura.subtotal).label("total")
            )
            .join(Factura, ItemFactura.factura_id == Factura.id)
            .where(Factura.fecha >= start_of_month)
            .where(Factura.estado == "autorizada")
            .group_by(ItemFactura.descripcion)
            .order_by(func.sum(ItemFactura.subtotal).desc())
            .limit(5)
        )
        stats["top_productos"] = [
            {"descripcion": row[0], "cantidad": float(row[1]), "total": float(row[2])}
            for row in result.all()
        ]

        # Ventas por día de la semana (últimos 30 días)
        result = await db.execute(
            select(
                extract("dow", Factura.fecha).label("dia"),
                func.sum(Factura.total).label("total"),
                func.count(Factura.id).label("cantidad")
            )
            .where(Factura.fecha >= today - timedelta(days=30))
            .where(Factura.estado == "autorizada")
            .group_by(extract("dow", Factura.fecha))
            .order_by(func.sum(Factura.total).desc())
        )
        dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
        stats["ventas_por_dia"] = [
            {"dia": dias[int(row[0])], "total": float(row[1]), "cantidad": row[2]}
            for row in result.all()
        ]

        # Últimas 5 facturas
        result = await db.execute(
            select(Factura, Cliente.razon_social)
            .join(Cliente, Factura.cliente_id == Cliente.id)
            .order_by(Factura.fecha.desc(), Factura.id.desc())
            .limit(5)
        )
        stats["ultimas_facturas"] = [
            {
                "numero": f.numero_completo,
                "cliente": cliente,
                "total": float(f.total),
                "fecha": f.fecha.isoformat()
            }
            for f, cliente in result.all()
        ]

        return stats

    async def chat(self, question: str, db: AsyncSession) -> str:
        """Procesa una pregunta del usuario y genera una respuesta con contexto de ventas."""
        # Obtener modelo dinámicamente (lee API key en cada request)
        model = self._get_model()
        if not model:
            return "El asistente de IA no está configurado. Agregá tu API key de Google Gemini en la configuración."

        # Obtener estadísticas para contexto
        stats = await self.get_sales_stats(db)

        # Construir el prompt con contexto
        system_prompt = f"""Sos un asistente de análisis de ventas para una aplicación de facturación argentina.
Tu rol es ayudar al usuario a entender cómo van sus ventas y darle recomendaciones útiles.

DATOS ACTUALES DEL NEGOCIO:
- Fecha actual: {date.today().strftime("%d/%m/%Y")}
- Total de facturas emitidas: {stats['total_facturas']}

VENTAS DEL MES ACTUAL:
- Total vendido: ${stats['ventas_mes']:,.2f}
- Cantidad de facturas: {stats['facturas_mes']}
- Ticket promedio: ${stats['ticket_promedio_mes']:,.2f}

VENTAS DEL MES ANTERIOR:
- Total vendido: ${stats['ventas_mes_anterior']:,.2f}
- Cantidad de facturas: {stats['facturas_mes_anterior']}

VENTAS DE ESTA SEMANA:
- Total vendido: ${stats['ventas_semana']:,.2f}
- Cantidad de facturas: {stats['facturas_semana']}

TOP 5 CLIENTES DEL MES:
{chr(10).join([f"- {c['nombre']}: ${c['total']:,.2f} ({c['cantidad']} facturas)" for c in stats['top_clientes']]) or "- No hay datos"}

TOP 5 PRODUCTOS/SERVICIOS MÁS VENDIDOS:
{chr(10).join([f"- {p['descripcion']}: ${p['total']:,.2f} ({p['cantidad']} unidades)" for p in stats['top_productos']]) or "- No hay datos"}

VENTAS POR DÍA DE LA SEMANA (últimos 30 días):
{chr(10).join([f"- {d['dia']}: ${d['total']:,.2f} ({d['cantidad']} facturas)" for d in stats['ventas_por_dia']]) or "- No hay datos"}

ÚLTIMAS 5 FACTURAS:
{chr(10).join([f"- {f['numero']} - {f['cliente']}: ${f['total']:,.2f} ({f['fecha']})" for f in stats['ultimas_facturas']]) or "- No hay facturas"}

INSTRUCCIONES:
- Respondé en español argentino, de forma concisa y útil
- Usá los datos reales proporcionados arriba
- Si no hay suficientes datos, indicalo amablemente
- Dá recomendaciones concretas y accionables cuando sea posible
- Sé breve pero completo (máximo 3-4 párrafos)
- Usá formato amigable, podés usar emojis con moderación
- Los montos están en pesos argentinos (ARS)"""

        try:
            response = model.generate_content(
                f"{system_prompt}\n\nPREGUNTA DEL USUARIO: {question}"
            )
            return response.text
        except Exception as e:
            return f"Hubo un error al procesar tu consulta: {str(e)}"


# Instancia global del servicio
ai_service = AIService()
