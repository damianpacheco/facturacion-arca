"""Servicio de integración con ARCA (ex AFIP)."""

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional, List, Dict
import os

from afip import Afip

from app.config import get_settings

settings = get_settings()


class ARCAService:
    """
    Servicio para interactuar con los web services de ARCA.

    Maneja la autenticación y emisión de comprobantes electrónicos.
    """

    def __init__(self):
        """Inicializa el servicio de ARCA."""
        self._afip: Optional[Afip] = None

    def _get_afip_instance(self) -> Afip:
        """
        Obtiene o crea la instancia de Afip SDK.

        Returns:
            Instancia configurada de Afip
        """
        if self._afip is None:
            config: Dict[str, Any] = {"CUIT": settings.arca_cuit}

            if settings.arca_production:
                # Verificar que existan los certificados
                cert_path = settings.arca_cert_path
                key_path = settings.arca_key_path

                if not os.path.exists(cert_path):
                    raise FileNotFoundError(
                        f"Certificado no encontrado: {cert_path}"
                    )
                if not os.path.exists(key_path):
                    raise FileNotFoundError(
                        f"Clave privada no encontrada: {key_path}"
                    )

                config["cert"] = cert_path
                config["key"] = key_path
                config["production"] = True
            else:
                # Modo testing: usar access_token de AfipSDK
                if settings.arca_access_token:
                    config["access_token"] = settings.arca_access_token

            self._afip = Afip(config)

        return self._afip

    def get_ultimo_comprobante(
        self, tipo_comprobante: int, punto_venta: Optional[int] = None
    ) -> int:
        """
        Obtiene el último número de comprobante autorizado.

        Args:
            tipo_comprobante: Código del tipo de comprobante
            punto_venta: Punto de venta (usa el configurado si no se especifica)

        Returns:
            Último número de comprobante autorizado
        """
        afip = self._get_afip_instance()
        pv = punto_venta or settings.arca_punto_venta

        factura_electronica = afip.ElectronicBilling
        ultimo = factura_electronica.getLastVoucher(pv, tipo_comprobante)

        return int(ultimo)

    def emitir_factura(
        self,
        tipo_comprobante: int,
        punto_venta: int,
        concepto: int,
        tipo_doc_receptor: int,
        nro_doc_receptor: int,
        condicion_iva_receptor: int,
        importe_total: Decimal,
        importe_neto: Decimal,
        importe_iva: Decimal,
        iva_detalle: List[dict],
        fecha: Optional[date] = None,
        fecha_servicio_desde: Optional[date] = None,
        fecha_servicio_hasta: Optional[date] = None,
        fecha_vencimiento_pago: Optional[date] = None,
    ) -> dict:
        """
        Emite una factura electrónica y obtiene el CAE.

        Args:
            tipo_comprobante: Código del tipo de comprobante
            punto_venta: Punto de venta
            concepto: 1=Productos, 2=Servicios, 3=Productos y Servicios
            tipo_doc_receptor: Tipo de documento del receptor (80=CUIT, 96=DNI, etc.)
            nro_doc_receptor: Número de documento del receptor
            importe_total: Importe total del comprobante
            importe_neto: Importe neto gravado
            importe_iva: Importe total de IVA
            iva_detalle: Lista de detalles de IVA por alícuota
            fecha: Fecha del comprobante (hoy si no se especifica)
            fecha_servicio_desde: Fecha desde para servicios
            fecha_servicio_hasta: Fecha hasta para servicios
            fecha_vencimiento_pago: Fecha de vencimiento del pago

        Returns:
            Diccionario con CAE, vencimiento y número de comprobante
        """
        afip = self._get_afip_instance()
        factura_electronica = afip.ElectronicBilling

        # Obtener próximo número
        ultimo_nro = self.get_ultimo_comprobante(tipo_comprobante, punto_venta)
        nuevo_nro = ultimo_nro + 1

        # Fecha del comprobante
        fecha_comprobante = fecha or date.today()
        fecha_int = int(fecha_comprobante.strftime("%Y%m%d"))

        # Comprobantes tipo C (Monotributistas) no discriminan IVA
        # Tipos C: 11 (Factura C), 12 (Nota Débito C), 13 (Nota Crédito C)
        es_comprobante_c = tipo_comprobante in [11, 12, 13]

        # Construir datos del comprobante
        data = {
            "CantReg": 1,
            "PtoVta": punto_venta,
            "CbteTipo": tipo_comprobante,
            "Concepto": concepto,
            "DocTipo": tipo_doc_receptor,
            "DocNro": nro_doc_receptor,
            "CondicionIVAReceptorId": condicion_iva_receptor,  # RG 5616
            "CbteDesde": nuevo_nro,
            "CbteHasta": nuevo_nro,
            "CbteFch": fecha_int,
            "ImpTotal": float(importe_total),
            "ImpTotConc": 0,  # Importe no gravado
            "ImpNeto": float(importe_total) if es_comprobante_c else float(importe_neto),
            "ImpOpEx": 0,  # Importe exento
            "ImpIVA": 0 if es_comprobante_c else float(importe_iva),  # Facturas C: IVA = 0
            "ImpTrib": 0,  # Otros tributos
            "MonId": "PES",  # Moneda: Pesos argentinos
            "MonCotiz": 1,  # Cotización
        }

        # Agregar IVA detallado solo para comprobantes A y B
        if iva_detalle and tipo_comprobante in [1, 2, 3, 6, 7, 8]:
            data["Iva"] = iva_detalle

        # Agregar fechas de servicio si corresponde
        if concepto in [2, 3]:  # Servicios o Productos y Servicios
            if fecha_servicio_desde:
                data["FchServDesde"] = fecha_servicio_desde.strftime("%Y%m%d")
            if fecha_servicio_hasta:
                data["FchServHasta"] = fecha_servicio_hasta.strftime("%Y%m%d")
            if fecha_vencimiento_pago:
                data["FchVtoPago"] = fecha_vencimiento_pago.strftime("%Y%m%d")

        # Solicitar CAE
        resultado = factura_electronica.createVoucher(data)

        return {
            "cae": resultado["CAE"],
            "vencimiento_cae": resultado["CAEFchVto"],
            "numero": nuevo_nro,
            "resultado": resultado.get("Resultado", "A"),
        }

    def consultar_comprobante(
        self, tipo_comprobante: int, punto_venta: int, numero: int
    ) -> Optional[dict]:
        """
        Consulta un comprobante emitido.

        Args:
            tipo_comprobante: Código del tipo de comprobante
            punto_venta: Punto de venta
            numero: Número del comprobante

        Returns:
            Datos del comprobante o None si no existe
        """
        afip = self._get_afip_instance()
        factura_electronica = afip.ElectronicBilling

        try:
            comprobante = factura_electronica.getVoucherInfo(
                numero, punto_venta, tipo_comprobante
            )
            return comprobante
        except Exception:
            return None

    def get_tipos_comprobante(self) -> List[dict]:
        """
        Obtiene los tipos de comprobante disponibles.

        Returns:
            Lista de tipos de comprobante
        """
        afip = self._get_afip_instance()
        factura_electronica = afip.ElectronicBilling

        tipos = factura_electronica.getVoucherTypes()
        return tipos

    def get_tipos_documento(self) -> List[dict]:
        """
        Obtiene los tipos de documento disponibles.

        Returns:
            Lista de tipos de documento
        """
        afip = self._get_afip_instance()
        factura_electronica = afip.ElectronicBilling

        tipos = factura_electronica.getDocumentTypes()
        return tipos

    def get_alicuotas_iva(self) -> List[dict]:
        """
        Obtiene las alícuotas de IVA disponibles.

        Returns:
            Lista de alícuotas de IVA
        """
        afip = self._get_afip_instance()
        factura_electronica = afip.ElectronicBilling

        alicuotas = factura_electronica.getAliquotTypes()
        return alicuotas

    def get_puntos_venta(self) -> List[dict]:
        """
        Obtiene los puntos de venta habilitados.

        Returns:
            Lista de puntos de venta
        """
        afip = self._get_afip_instance()
        factura_electronica = afip.ElectronicBilling

        puntos = factura_electronica.getSalesPoints()
        return puntos


# Instancia singleton del servicio
arca_service = ARCAService()
