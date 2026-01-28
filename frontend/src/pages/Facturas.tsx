import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FileText, Download, Eye, Plus, Search, X } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getFacturas, getFactura, getFacturaPdfUrl } from '../services/api'
import { TIPOS_COMPROBANTE, Factura } from '../types'

export default function Facturas() {
  const [busqueda, setBusqueda] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<number | undefined>()
  const [page, setPage] = useState(0)
  const [selectedFactura, setSelectedFactura] = useState<Factura | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const limit = 20

  const { data, isLoading } = useQuery({
    queryKey: ['facturas', { skip: page * limit, limit, tipo_comprobante: tipoFiltro }],
    queryFn: () => getFacturas({ skip: page * limit, limit, tipo_comprobante: tipoFiltro }),
  })

  const getTipoNombre = (codigo: number) => {
    return TIPOS_COMPROBANTE.find((t) => t.codigo === codigo)?.nombre || 'Desconocido'
  }

  const handleVerDetalle = async (facturaId: number) => {
    setLoadingDetail(true)
    try {
      const detalle = await getFactura(facturaId)
      setSelectedFactura(detalle)
    } catch (error) {
      console.error('Error al cargar detalle:', error)
    } finally {
      setLoadingDetail(false)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Facturas</h1>
        <Link to="/facturas/nueva" className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          Nueva Factura
        </Link>
      </div>

      {/* Filtros */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="label">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                className="input pl-10"
                placeholder="Número de factura..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </div>

          <div className="w-48">
            <label className="label">Tipo</label>
            <select
              className="input"
              value={tipoFiltro || ''}
              onChange={(e) => setTipoFiltro(e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">Todos</option>
              {TIPOS_COMPROBANTE.map((tipo) => (
                <option key={tipo.codigo} value={tipo.codigo}>
                  {tipo.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-500 mt-2">Cargando...</p>
          </div>
        ) : data?.items.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">Tipo</th>
                    <th className="table-header">Número</th>
                    <th className="table-header">Fecha</th>
                    <th className="table-header">CAE</th>
                    <th className="table-header">Total</th>
                    <th className="table-header">Estado</th>
                    <th className="table-header">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.items.map((factura) => (
                    <tr key={factura.id} className="hover:bg-gray-50">
                      <td className="table-cell">
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                          {getTipoNombre(factura.tipo_comprobante)}
                        </span>
                      </td>
                      <td className="table-cell font-mono font-medium">
                        {factura.numero_completo}
                      </td>
                      <td className="table-cell">
                        {format(new Date(factura.fecha), 'dd/MM/yyyy', { locale: es })}
                      </td>
                      <td className="table-cell font-mono text-xs">
                        {factura.cae || '-'}
                      </td>
                      <td className="table-cell font-medium">
                        ${Number(factura.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="table-cell">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          factura.estado === 'autorizada'
                            ? 'bg-green-100 text-green-800'
                            : factura.estado === 'rechazada'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {factura.estado}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex gap-2">
                          <button
                            className="p-1 text-gray-500 hover:text-primary-600"
                            title="Ver detalle"
                            onClick={() => handleVerDetalle(factura.id)}
                          >
                            <Eye size={18} />
                          </button>
                          <a
                            href={getFacturaPdfUrl(factura.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-gray-500 hover:text-primary-600"
                            title="Descargar PDF"
                          >
                            <Download size={18} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500">
                Mostrando {page * limit + 1} - {Math.min((page + 1) * limit, data.total)} de {data.total}
              </p>
              <div className="flex gap-2">
                <button
                  className="btn-secondary"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Anterior
                </button>
                <button
                  className="btn-secondary"
                  disabled={(page + 1) * limit >= data.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <FileText className="mx-auto text-gray-300" size={48} />
            <p className="text-gray-500 mt-4">No hay facturas</p>
            <Link to="/facturas/nueva" className="btn-primary mt-4 inline-flex items-center gap-2">
              <Plus size={20} />
              Crear primera factura
            </Link>
          </div>
        )}
      </div>

      {/* Modal de detalle */}
      {selectedFactura && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-bold">
                {getTipoNombre(selectedFactura.tipo_comprobante)} {selectedFactura.numero_completo}
              </h2>
              <button
                onClick={() => setSelectedFactura(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Información general */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Fecha</p>
                  <p className="font-medium">
                    {format(new Date(selectedFactura.fecha), 'dd/MM/yyyy', { locale: es })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Estado</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    selectedFactura.estado === 'autorizada'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {selectedFactura.estado}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">CAE</p>
                  <p className="font-mono text-sm">{selectedFactura.cae || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Vencimiento CAE</p>
                  <p className="font-medium">
                    {selectedFactura.vencimiento_cae
                      ? format(new Date(selectedFactura.vencimiento_cae), 'dd/MM/yyyy', { locale: es })
                      : '-'}
                  </p>
                </div>
              </div>

              {/* Cliente */}
              {selectedFactura.cliente && (
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500 mb-1">Cliente</p>
                  <p className="font-medium">{selectedFactura.cliente.razon_social}</p>
                  <p className="text-sm text-gray-600">CUIT: {selectedFactura.cliente.cuit}</p>
                  <p className="text-sm text-gray-600">{selectedFactura.cliente.condicion_iva}</p>
                </div>
              )}

              {/* Items */}
              {selectedFactura.items && selectedFactura.items.length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500 mb-2">Detalle</p>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-2">Descripción</th>
                        <th className="text-right p-2">Cant.</th>
                        <th className="text-right p-2">P. Unit.</th>
                        <th className="text-right p-2">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedFactura.items.map((item, index) => (
                        <tr key={index} className="border-t">
                          <td className="p-2">{item.descripcion}</td>
                          <td className="p-2 text-right">{item.cantidad}</td>
                          <td className="p-2 text-right">
                            ${Number(item.precio_unitario).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-2 text-right">
                            ${Number(item.subtotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Totales */}
              <div className="border-t pt-4">
                <div className="flex justify-end">
                  <div className="w-64 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Subtotal:</span>
                      <span>${Number(selectedFactura.subtotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {Number(selectedFactura.iva_21) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">IVA 21%:</span>
                        <span>${Number(selectedFactura.iva_21).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {Number(selectedFactura.iva_10_5) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">IVA 10.5%:</span>
                        <span>${Number(selectedFactura.iva_10_5).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Total:</span>
                      <span>${Number(selectedFactura.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
              <button
                onClick={() => setSelectedFactura(null)}
                className="btn-secondary"
              >
                Cerrar
              </button>
              <a
                href={getFacturaPdfUrl(selectedFactura.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary flex items-center gap-2"
              >
                <Download size={18} />
                Descargar PDF
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loadingDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-600 mt-2">Cargando...</p>
          </div>
        </div>
      )}
    </div>
  )
}
