"""Servicio para generación de PDFs de facturas."""

import io
import json
import base64
from datetime import date
from decimal import Decimal

import qrcode
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
    Image,
)
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

from app.config import get_settings
from app.models.factura import Factura, TipoComprobante

settings = get_settings()

# Nombres de tipos de comprobante
TIPOS_COMPROBANTE = {
    1: "FACTURA A",
    2: "NOTA DE DÉBITO A",
    3: "NOTA DE CRÉDITO A",
    6: "FACTURA B",
    7: "NOTA DE DÉBITO B",
    8: "NOTA DE CRÉDITO B",
    11: "FACTURA C",
    12: "NOTA DE DÉBITO C",
    13: "NOTA DE CRÉDITO C",
}

# Letras de comprobante
LETRAS_COMPROBANTE = {
    1: "A", 2: "A", 3: "A",
    6: "B", 7: "B", 8: "B",
    11: "C", 12: "C", 13: "C",
}


class PDFService:
    """Servicio para generar PDFs de facturas según normativa ARCA."""

    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_styles()

    def _setup_styles(self):
        """Configura estilos personalizados."""
        self.styles.add(ParagraphStyle(
            name="TituloFactura",
            fontSize=16,
            fontName="Helvetica-Bold",
            alignment=TA_CENTER,
        ))
        self.styles.add(ParagraphStyle(
            name="LetraComprobante",
            fontSize=24,
            fontName="Helvetica-Bold",
            alignment=TA_CENTER,
        ))
        self.styles.add(ParagraphStyle(
            name="DatosEmisor",
            fontSize=9,
            fontName="Helvetica",
            alignment=TA_LEFT,
        ))
        self.styles.add(ParagraphStyle(
            name="DatosReceptor",
            fontSize=9,
            fontName="Helvetica",
            alignment=TA_LEFT,
        ))
        self.styles.add(ParagraphStyle(
            name="TotalFactura",
            fontSize=12,
            fontName="Helvetica-Bold",
            alignment=TA_RIGHT,
        ))

    def _generar_qr_arca(self, factura: Factura) -> io.BytesIO:
        """
        Genera el código QR según normativa ARCA (RG 4291).

        El QR debe contener un JSON con los datos del comprobante.
        """
        # Datos para el QR según normativa
        datos_qr = {
            "ver": 1,
            "fecha": factura.fecha.strftime("%Y-%m-%d"),
            "cuit": settings.arca_cuit,
            "ptoVta": factura.punto_venta,
            "tipoCmp": factura.tipo_comprobante,
            "nroCmp": factura.numero,
            "importe": float(factura.total),
            "moneda": "PES",
            "ctz": 1,
            "tipoDocRec": 80 if factura.cliente.condicion_iva != "Consumidor Final" else 99,
            "nroDocRec": int(factura.cliente.cuit) if factura.cliente.cuit else 0,
            "tipoCodAut": "E",  # CAE
            "codAut": int(factura.cae) if factura.cae else 0,
        }

        # Codificar en Base64
        json_str = json.dumps(datos_qr, separators=(",", ":"))
        base64_data = base64.b64encode(json_str.encode()).decode()

        # URL del QR (según normativa ARCA)
        url_qr = f"https://www.afip.gob.ar/fe/qr/?p={base64_data}"

        # Generar QR
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=3,
            border=2,
        )
        qr.add_data(url_qr)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)

        return buffer

    def _formatear_cuit(self, cuit: str) -> str:
        """Formatea CUIT con guiones."""
        cuit = str(cuit).replace("-", "")
        if len(cuit) == 11:
            return f"{cuit[:2]}-{cuit[2:10]}-{cuit[10]}"
        return cuit

    def _formatear_moneda(self, valor: Decimal) -> str:
        """Formatea un valor como moneda."""
        return f"$ {valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    def generar_factura_pdf(self, factura: Factura) -> io.BytesIO:
        """
        Genera el PDF de una factura.

        Args:
            factura: Objeto Factura con datos completos

        Returns:
            Buffer con el PDF generado
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=15 * mm,
            leftMargin=15 * mm,
            topMargin=15 * mm,
            bottomMargin=15 * mm,
        )

        elements = []
        width = A4[0] - 30 * mm  # Ancho disponible

        # === ENCABEZADO ===
        tipo_nombre = TIPOS_COMPROBANTE.get(factura.tipo_comprobante, "COMPROBANTE")
        letra = LETRAS_COMPROBANTE.get(factura.tipo_comprobante, "X")

        # Tabla de encabezado (Emisor | Letra | Datos Comprobante)
        # Datos del emisor (izquierda)
        emisor_text = f"""
        <b>{settings.emisor_razon_social or 'RAZÓN SOCIAL'}</b><br/>
        {settings.emisor_domicilio or 'Domicilio'}<br/>
        CUIT: {self._formatear_cuit(str(settings.arca_cuit))}<br/>
        {settings.emisor_condicion_iva}<br/>
        IIBB: {settings.emisor_ingresos_brutos or '-'}<br/>
        Inicio Act.: {settings.emisor_inicio_actividades or '-'}
        """
        emisor_para = Paragraph(emisor_text, self.styles["DatosEmisor"])

        # Letra del comprobante (centro)
        letra_para = Paragraph(f"<b>{letra}</b>", self.styles["LetraComprobante"])

        # Datos del comprobante (derecha)
        comprobante_text = f"""
        <b>{tipo_nombre}</b><br/>
        N° {factura.numero_completo}<br/>
        Fecha: {factura.fecha.strftime('%d/%m/%Y')}<br/>
        CAE: {factura.cae or '-'}<br/>
        Vto. CAE: {factura.vencimiento_cae.strftime('%d/%m/%Y') if factura.vencimiento_cae else '-'}
        """
        comprobante_para = Paragraph(comprobante_text, self.styles["DatosEmisor"])

        header_table = Table(
            [[emisor_para, letra_para, comprobante_para]],
            colWidths=[width * 0.4, width * 0.2, width * 0.4],
        )
        header_table.setStyle(TableStyle([
            ("ALIGN", (0, 0), (0, 0), "LEFT"),
            ("ALIGN", (1, 0), (1, 0), "CENTER"),
            ("ALIGN", (2, 0), (2, 0), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOX", (0, 0), (-1, -1), 1, colors.black),
            ("BOX", (1, 0), (1, 0), 1, colors.black),
            ("BACKGROUND", (1, 0), (1, 0), colors.lightgrey),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 10 * mm))

        # === DATOS DEL RECEPTOR ===
        receptor_text = f"""
        <b>DATOS DEL RECEPTOR</b><br/>
        Razón Social: {factura.cliente.razon_social}<br/>
        CUIT: {self._formatear_cuit(factura.cliente.cuit)}<br/>
        Condición IVA: {factura.cliente.condicion_iva}<br/>
        Domicilio: {factura.cliente.domicilio or '-'}
        """
        receptor_para = Paragraph(receptor_text, self.styles["DatosReceptor"])

        receptor_table = Table([[receptor_para]], colWidths=[width])
        receptor_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 1, colors.black),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        elements.append(receptor_table)
        elements.append(Spacer(1, 10 * mm))

        # === DETALLE DE ITEMS ===
        # Encabezados
        items_data = [["Descripción", "Cant.", "P. Unit.", "IVA %", "Subtotal"]]

        # Alícuotas IVA
        alicuotas_map = {0: "N/G", 3: "0%", 4: "10.5%", 5: "21%", 6: "27%"}

        for item in factura.items:
            items_data.append([
                item.descripcion[:50],
                f"{item.cantidad:.2f}",
                self._formatear_moneda(item.precio_unitario),
                alicuotas_map.get(item.alicuota_iva, "-"),
                self._formatear_moneda(item.subtotal),
            ])

        items_table = Table(
            items_data,
            colWidths=[width * 0.4, width * 0.1, width * 0.2, width * 0.1, width * 0.2],
        )
        items_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
            ("ALIGN", (0, 1), (0, -1), "LEFT"),
            ("BOX", (0, 0), (-1, -1), 1, colors.black),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.black),
            ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ]))
        elements.append(items_table)
        elements.append(Spacer(1, 10 * mm))

        # === TOTALES ===
        # Discriminar IVA solo para facturas A y B
        discrimina_iva = factura.tipo_comprobante in [1, 2, 3, 6, 7, 8]

        totales_data = []
        if discrimina_iva:
            totales_data.append(["Subtotal Neto:", self._formatear_moneda(factura.subtotal)])
            if factura.iva_10_5 > 0:
                totales_data.append(["IVA 10.5%:", self._formatear_moneda(factura.iva_10_5)])
            if factura.iva_21 > 0:
                totales_data.append(["IVA 21%:", self._formatear_moneda(factura.iva_21)])
            if factura.iva_27 > 0:
                totales_data.append(["IVA 27%:", self._formatear_moneda(factura.iva_27)])

        totales_data.append(["TOTAL:", self._formatear_moneda(factura.total)])

        totales_table = Table(
            totales_data,
            colWidths=[width * 0.7, width * 0.3],
        )
        totales_table.setStyle(TableStyle([
            ("ALIGN", (0, 0), (0, -1), "RIGHT"),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("FONTSIZE", (0, -1), (-1, -1), 12),
            ("LINEABOVE", (0, -1), (-1, -1), 1, colors.black),
        ]))
        elements.append(totales_table)
        elements.append(Spacer(1, 10 * mm))

        # === CÓDIGO QR ===
        qr_buffer = self._generar_qr_arca(factura)
        qr_image = Image(qr_buffer, width=30 * mm, height=30 * mm)

        # Texto del CAE
        cae_text = f"""
        <b>CAE:</b> {factura.cae or '-'}<br/>
        <b>Vencimiento:</b> {factura.vencimiento_cae.strftime('%d/%m/%Y') if factura.vencimiento_cae else '-'}
        """
        cae_para = Paragraph(cae_text, self.styles["DatosEmisor"])

        footer_table = Table(
            [[qr_image, cae_para]],
            colWidths=[35 * mm, width - 35 * mm],
        )
        footer_table.setStyle(TableStyle([
            ("ALIGN", (0, 0), (0, 0), "LEFT"),
            ("ALIGN", (1, 0), (1, 0), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        elements.append(footer_table)

        # === OBSERVACIONES ===
        if factura.observaciones:
            elements.append(Spacer(1, 5 * mm))
            obs_text = f"<b>Observaciones:</b> {factura.observaciones}"
            elements.append(Paragraph(obs_text, self.styles["DatosEmisor"]))

        # Generar PDF
        doc.build(elements)
        buffer.seek(0)

        return buffer
