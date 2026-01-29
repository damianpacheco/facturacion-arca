"""Servicio para interactuar con la API de TiendaNube."""

from typing import Optional, List, Dict, Any
import httpx
from datetime import datetime

from app.config import get_settings

settings = get_settings()

# URLs de TiendaNube
TN_AUTH_URL = "https://www.tiendanube.com/apps/{app_id}/authorize"
TN_TOKEN_URL = "https://www.tiendanube.com/apps/authorize/token"
TN_API_BASE = "https://api.tiendanube.com/v1"  # Fallback for older endpoints
TN_API_V2 = "https://api.tiendanube.com"  # New versioned API


class TiendaNubeService:
    """Servicio para manejar la integración con TiendaNube."""

    def __init__(self, access_token: Optional[str] = None, store_id: Optional[str] = None):
        self.access_token = access_token
        self.store_id = store_id
        self.client = httpx.AsyncClient(timeout=30.0)

    async def close(self):
        """Cierra el cliente HTTP."""
        await self.client.aclose()

    def _get_headers(self) -> Dict[str, str]:
        """Obtiene los headers para las peticiones a la API."""
        return {
            "Authentication": f"bearer {self.access_token}",
            "User-Agent": "FacturacionARCA (facturacion@arca.com)",
            "Content-Type": "application/json",
        }

    @staticmethod
    def get_authorization_url(redirect_uri: str) -> str:
        """Genera la URL de autorización para OAuth."""
        return (
            f"https://www.tiendanube.com/apps/{settings.tn_client_id}/authorize"
            f"?redirect_uri={redirect_uri}"
        )

    async def exchange_code_for_token(self, code: str) -> Dict[str, Any]:
        """Intercambia el código de autorización por un access token."""
        data = {
            "client_id": settings.tn_client_id,
            "client_secret": settings.tn_client_secret,
            "grant_type": "authorization_code",
            "code": code,
        }

        response = await self.client.post(TN_TOKEN_URL, data=data)
        response.raise_for_status()
        return response.json()

    async def get_store_info(self) -> Dict[str, Any]:
        """Obtiene información de la tienda conectada."""
        url = f"{TN_API_BASE}/{self.store_id}/store"
        response = await self.client.get(url, headers=self._get_headers())
        response.raise_for_status()
        return response.json()

    async def get_orders(
        self,
        status: Optional[str] = None,
        payment_status: Optional[str] = None,
        page: int = 1,
        per_page: int = 50,
        created_at_min: Optional[str] = None,
        created_at_max: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Obtiene las órdenes de la tienda."""
        # Probar primero con la API v1, si falla usar lista vacía
        url = f"{TN_API_BASE}/{self.store_id}/orders"
        
        params: Dict[str, Any] = {
            "page": page,
            "per_page": per_page,
        }
        
        if status:
            params["status"] = status
        if payment_status:
            params["payment_status"] = payment_status
        if created_at_min:
            params["created_at_min"] = created_at_min
        if created_at_max:
            params["created_at_max"] = created_at_max

        try:
            response = await self.client.get(url, headers=self._get_headers(), params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            # Si es 404, la tienda puede no tener órdenes o el endpoint no está disponible
            if e.response.status_code == 404:
                print(f"TiendaNube: Endpoint de órdenes no disponible o tienda sin órdenes")
                return []
            raise

    async def get_order(self, order_id: str) -> Dict[str, Any]:
        """Obtiene el detalle de una orden específica."""
        url = f"{TN_API_BASE}/{self.store_id}/orders/{order_id}"
        response = await self.client.get(url, headers=self._get_headers())
        response.raise_for_status()
        return response.json()

    async def get_customer(self, customer_id: str) -> Dict[str, Any]:
        """Obtiene información de un cliente."""
        url = f"{TN_API_BASE}/{self.store_id}/customers/{customer_id}"
        response = await self.client.get(url, headers=self._get_headers())
        response.raise_for_status()
        return response.json()

    async def register_webhook(self, event: str, url: str) -> Dict[str, Any]:
        """Registra un webhook para un evento específico."""
        webhook_url = f"{TN_API_BASE}/{self.store_id}/webhooks"
        data = {
            "event": event,
            "url": url,
        }
        response = await self.client.post(
            webhook_url, 
            headers=self._get_headers(), 
            json=data
        )
        response.raise_for_status()
        return response.json()

    async def get_webhooks(self) -> List[Dict[str, Any]]:
        """Lista los webhooks registrados."""
        url = f"{TN_API_BASE}/{self.store_id}/webhooks"
        response = await self.client.get(url, headers=self._get_headers())
        response.raise_for_status()
        return response.json()

    async def delete_webhook(self, webhook_id: str) -> None:
        """Elimina un webhook."""
        url = f"{TN_API_BASE}/{self.store_id}/webhooks/{webhook_id}"
        response = await self.client.delete(url, headers=self._get_headers())
        response.raise_for_status()


def map_order_to_invoice_data(order: Dict[str, Any]) -> Dict[str, Any]:
    """Mapea una orden de TiendaNube a datos de factura."""
    # Extraer datos del cliente
    customer = order.get("customer") or {}
    billing_data = {
        "razon_social": order.get("billing_name") or customer.get("name") or "Consumidor Final",
        "cuit": order.get("contact_identification") or customer.get("identification") or "",
        "domicilio": order.get("billing_address") or "",
        "email": order.get("contact_email") or customer.get("email") or "",
        "telefono": order.get("contact_phone") or customer.get("phone") or "",
    }

    # Determinar condición IVA basado en si pide Factura A
    billing_customer_type = order.get("billing_customer_type")
    if billing_customer_type == "company" and order.get("billing_document_type") == "cuit":
        condicion_iva = "Responsable Inscripto"
    else:
        condicion_iva = "Consumidor Final"

    # Mapear productos
    items = []
    for product in order.get("products", []):
        items.append({
            "descripcion": product.get("name", "Producto"),
            "cantidad": float(product.get("quantity", 1)),
            "precio_unitario": float(product.get("price", 0)),
            "alicuota_iva": 5,  # 21% por defecto
        })

    return {
        "cliente": {
            **billing_data,
            "condicion_iva": condicion_iva,
        },
        "items": items,
        "total": float(order.get("total", 0)),
        "subtotal": float(order.get("subtotal", 0)),
        "order_id": str(order.get("id")),
        "order_number": order.get("number"),
    }
