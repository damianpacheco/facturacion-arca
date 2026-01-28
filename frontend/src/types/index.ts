// Tipos para Cliente
export interface Cliente {
  id: number
  razon_social: string
  cuit: string
  condicion_iva: string
  domicilio: string | null
  email: string | null
  telefono: string | null
  created_at: string
  updated_at: string
}

export interface ClienteCreate {
  razon_social: string
  cuit: string
  condicion_iva: string
  domicilio?: string
  email?: string
  telefono?: string
}

export interface ClienteList {
  items: Cliente[]
  total: number
}

// Tipos para Factura
export interface ItemFactura {
  id: number
  descripcion: string
  cantidad: number
  precio_unitario: number
  alicuota_iva: number
  subtotal: number
}

export interface ItemFacturaCreate {
  descripcion: string
  cantidad: number
  precio_unitario: number
  alicuota_iva: number
}

export interface Factura {
  id: number
  cliente_id: number
  tipo_comprobante: number
  punto_venta: number
  numero: number
  numero_completo: string
  fecha: string
  cae: string | null
  vencimiento_cae: string | null
  estado: string
  subtotal: number
  iva_21: number
  iva_10_5: number
  iva_27: number
  total: number
  concepto: number
  observaciones: string | null
  created_at: string
}

export interface FacturaDetalle extends Factura {
  cliente: Cliente
  items: ItemFactura[]
}

export interface FacturaCreate {
  cliente_id: number
  tipo_comprobante: number
  concepto: number
  items: ItemFacturaCreate[]
  fecha?: string
  observaciones?: string
}

export interface FacturaList {
  items: Factura[]
  total: number
}

// Tipos para ARCA
export interface UltimoComprobante {
  tipo_comprobante: number
  punto_venta: number
  ultimo_numero: number
}

export interface EstadoARCA {
  estado: string
  modo: string
  cuit: number
  punto_venta: number
  mensaje?: string
}

// Tipos de comprobante
export const TIPOS_COMPROBANTE = [
  { codigo: 1, nombre: 'Factura A', letra: 'A' },
  { codigo: 3, nombre: 'Nota de Crédito A', letra: 'A' },
  { codigo: 6, nombre: 'Factura B', letra: 'B' },
  { codigo: 8, nombre: 'Nota de Crédito B', letra: 'B' },
  { codigo: 11, nombre: 'Factura C', letra: 'C' },
  { codigo: 13, nombre: 'Nota de Crédito C', letra: 'C' },
] as const

// Condiciones IVA
export const CONDICIONES_IVA = [
  'Responsable Inscripto',
  'Monotributista',
  'Exento',
  'Consumidor Final',
  'No Responsable',
] as const

// Alícuotas IVA
export const ALICUOTAS_IVA = [
  { codigo: 3, nombre: '0%', porcentaje: 0 },
  { codigo: 4, nombre: '10.5%', porcentaje: 10.5 },
  { codigo: 5, nombre: '21%', porcentaje: 21 },
  { codigo: 6, nombre: '27%', porcentaje: 27 },
] as const

// Conceptos
export const CONCEPTOS = [
  { codigo: 1, nombre: 'Productos' },
  { codigo: 2, nombre: 'Servicios' },
  { codigo: 3, nombre: 'Productos y Servicios' },
] as const
