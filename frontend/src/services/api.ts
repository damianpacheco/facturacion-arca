import axios from 'axios'
import type {
  Cliente,
  ClienteCreate,
  ClienteList,
  Factura,
  FacturaCreate,
  FacturaDetalle,
  FacturaList,
  UltimoComprobante,
  EstadoARCA,
} from '../types'

// En producción usar la URL del backend en Render, en desarrollo usar proxy local
const API_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor para manejar errores y extraer el mensaje del backend
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Extraer el mensaje de error del backend
    const message = error.response?.data?.detail || error.message || 'Error desconocido'
    return Promise.reject(new Error(message))
  }
)

// ============ CLIENTES ============

export async function getClientes(params?: {
  skip?: number
  limit?: number
  buscar?: string
}): Promise<ClienteList> {
  const response = await api.get<ClienteList>('/clientes', { params })
  return response.data
}

export async function getCliente(id: number): Promise<Cliente> {
  const response = await api.get<Cliente>(`/clientes/${id}`)
  return response.data
}

export async function createCliente(data: ClienteCreate): Promise<Cliente> {
  const response = await api.post<Cliente>('/clientes', data)
  return response.data
}

export async function updateCliente(
  id: number,
  data: Partial<ClienteCreate>
): Promise<Cliente> {
  const response = await api.put<Cliente>(`/clientes/${id}`, data)
  return response.data
}

export async function deleteCliente(id: number): Promise<void> {
  await api.delete(`/clientes/${id}`)
}

// ============ FACTURAS ============

export async function getFacturas(params?: {
  skip?: number
  limit?: number
  cliente_id?: number
  tipo_comprobante?: number
  estado?: string
  fecha_desde?: string
  fecha_hasta?: string
}): Promise<FacturaList> {
  const response = await api.get<FacturaList>('/facturas', { params })
  return response.data
}

export async function getFactura(id: number): Promise<FacturaDetalle> {
  const response = await api.get<FacturaDetalle>(`/facturas/${id}`)
  return response.data
}

export async function createFactura(data: FacturaCreate): Promise<Factura> {
  const response = await api.post<Factura>('/facturas', data)
  return response.data
}

export function getFacturaPdfUrl(id: number): string {
  return `/api/facturas/${id}/pdf`
}

// ============ ARCA ============

export async function getUltimoComprobante(
  tipo_comprobante: number,
  punto_venta?: number
): Promise<UltimoComprobante> {
  const response = await api.get<UltimoComprobante>('/arca/ultimo-comprobante', {
    params: { tipo_comprobante, punto_venta },
  })
  return response.data
}

export async function getEstadoARCA(): Promise<EstadoARCA> {
  const response = await api.get<EstadoARCA>('/arca/estado')
  return response.data
}

export async function getTiposComprobante(): Promise<{ tipos: unknown[] }> {
  const response = await api.get('/arca/tipos-comprobante')
  return response.data
}

export async function getAlicuotasIVA(): Promise<{ alicuotas: unknown[] }> {
  const response = await api.get('/arca/alicuotas-iva')
  return response.data
}

export async function getPuntosVenta(): Promise<{ puntos_venta: unknown[] }> {
  const response = await api.get('/arca/puntos-venta')
  return response.data
}

export default api
