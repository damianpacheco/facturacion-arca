import { useQuery } from '@tanstack/react-query'
import { FileText, Users, DollarSign, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getFacturas, getClientes, getEstadoARCA } from '../services/api'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Dashboard() {
  const { data: facturas } = useQuery({
    queryKey: ['facturas', { limit: 5 }],
    queryFn: () => getFacturas({ limit: 5 }),
  })

  const { data: clientes } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => getClientes({ limit: 1 }),
  })

  const { data: estadoArca } = useQuery({
    queryKey: ['arca-estado'],
    queryFn: getEstadoARCA,
  })

  // Calcular total del mes
  const totalMes = facturas?.items
    .filter((f) => f.estado === 'autorizada')
    .reduce((sum, f) => sum + Number(f.total), 0) || 0

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Estado ARCA */}
      <div className={`mb-6 p-4 rounded-lg ${
        estadoArca?.estado === 'conectado' 
          ? 'bg-green-50 border border-green-200' 
          : 'bg-yellow-50 border border-yellow-200'
      }`}>
        <div className="flex items-center gap-2">
          {estadoArca?.estado === 'conectado' ? (
            <>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-green-700 font-medium">
                Conectado a ARCA ({estadoArca.modo})
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="text-yellow-600" size={20} />
              <span className="text-yellow-700 font-medium">
                {estadoArca?.mensaje || 'Verificando conexión con ARCA...'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Facturas Emitidas</p>
              <p className="text-2xl font-bold">{facturas?.total || 0}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Total Facturado</p>
              <p className="text-2xl font-bold">
                ${totalMes.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Users className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Clientes</p>
              <p className="text-2xl font-bold">{clientes?.total || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Link
          to="/facturas/nueva"
          className="card hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <div className="p-4 bg-primary-100 rounded-lg">
            <FileText className="text-primary-600" size={32} />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Nueva Factura</h3>
            <p className="text-gray-500">Emitir un nuevo comprobante</p>
          </div>
        </Link>

        <Link
          to="/clientes"
          className="card hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <div className="p-4 bg-purple-100 rounded-lg">
            <Users className="text-purple-600" size={32} />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Gestionar Clientes</h3>
            <p className="text-gray-500">Agregar o editar clientes</p>
          </div>
        </Link>
      </div>

      {/* Últimas facturas */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Últimas Facturas</h2>
          <Link to="/facturas" className="text-primary-600 hover:underline text-sm">
            Ver todas
          </Link>
        </div>

        {facturas?.items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Número</th>
                  <th className="table-header">Fecha</th>
                  <th className="table-header">Total</th>
                  <th className="table-header">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {facturas.items.map((factura) => (
                  <tr key={factura.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">
                      {factura.numero_completo}
                    </td>
                    <td className="table-cell">
                      {format(new Date(factura.fecha), 'dd/MM/yyyy', { locale: es })}
                    </td>
                    <td className="table-cell">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            No hay facturas emitidas aún
          </p>
        )}
      </div>
    </div>
  )
}
