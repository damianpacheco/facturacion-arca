import { useQuery } from '@tanstack/react-query'
import { Settings, Server, Key, FileText, AlertCircle, CheckCircle } from 'lucide-react'
import { getEstadoARCA, getPuntosVenta, getTiposComprobante } from '../services/api'

export default function Configuracion() {
  const { data: estadoArca, isLoading: loadingEstado } = useQuery({
    queryKey: ['arca-estado'],
    queryFn: getEstadoARCA,
  })

  const { data: puntosVenta } = useQuery({
    queryKey: ['puntos-venta'],
    queryFn: getPuntosVenta,
    enabled: estadoArca?.estado === 'conectado',
  })

  const { data: tiposComprobante } = useQuery({
    queryKey: ['tipos-comprobante'],
    queryFn: getTiposComprobante,
    enabled: estadoArca?.estado === 'conectado',
  })

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Configuración</h1>

      <div className="grid gap-6">
        {/* Estado de conexión ARCA */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <Server className="text-primary-600" size={24} />
            <h2 className="text-lg font-semibold">Conexión con ARCA</h2>
          </div>

          {loadingEstado ? (
            <div className="flex items-center gap-2 text-gray-500">
              <div className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full"></div>
              Verificando conexión...
            </div>
          ) : estadoArca?.estado === 'conectado' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle size={20} />
                <span className="font-medium">Conectado correctamente</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500">Modo</p>
                  <p className="font-medium capitalize">{estadoArca.modo}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">CUIT</p>
                  <p className="font-medium font-mono">{estadoArca.cuit}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Punto de Venta</p>
                  <p className="font-medium">{estadoArca.punto_venta}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-yellow-600">
              <AlertCircle size={20} />
              <span>{estadoArca?.mensaje || 'No se pudo conectar con ARCA'}</span>
            </div>
          )}
        </div>

        {/* Puntos de Venta */}
        {puntosVenta && (
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="text-primary-600" size={24} />
              <h2 className="text-lg font-semibold">Puntos de Venta Habilitados</h2>
            </div>

            {puntosVenta.puntos_venta?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="table-header">Número</th>
                      <th className="table-header">Tipo</th>
                      <th className="table-header">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(puntosVenta.puntos_venta as Array<{ Nro: number; EmisionTipo: string; Bloqueado: string }>).map((pv) => (
                      <tr key={pv.Nro}>
                        <td className="table-cell font-mono">{String(pv.Nro).padStart(4, '0')}</td>
                        <td className="table-cell">{pv.EmisionTipo}</td>
                        <td className="table-cell">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            pv.Bloqueado === 'N' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {pv.Bloqueado === 'N' ? 'Activo' : 'Bloqueado'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">No hay puntos de venta habilitados</p>
            )}
          </div>
        )}

        {/* Información de certificados */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <Key className="text-primary-600" size={24} />
            <h2 className="text-lg font-semibold">Certificados Digitales</h2>
          </div>

          <div className="space-y-4">
            <p className="text-gray-600">
              {estadoArca?.modo === 'testing' ? (
                <>
                  <span className="font-medium text-blue-600">Modo Testing:</span> Estás usando el CUIT de demostración de ARCA.
                  Las facturas emitidas no tienen validez fiscal.
                </>
              ) : (
                <>
                  <span className="font-medium text-green-600">Modo Producción:</span> Las facturas emitidas tienen validez fiscal.
                </>
              )}
            </p>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-800 mb-2">Para pasar a producción necesitás:</h3>
              <ol className="list-decimal list-inside text-blue-700 space-y-1 text-sm">
                <li>Generar un certificado digital desde ARCA</li>
                <li>Crear una Clave Privada (.key)</li>
                <li>Colocar ambos archivos en la carpeta <code className="bg-blue-100 px-1 rounded">backend/certs/</code></li>
                <li>Configurar las variables de entorno en <code className="bg-blue-100 px-1 rounded">.env</code></li>
              </ol>
            </div>
          </div>
        </div>

        {/* Tipos de comprobante disponibles */}
        {tiposComprobante && (
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <Settings className="text-primary-600" size={24} />
              <h2 className="text-lg font-semibold">Tipos de Comprobante Disponibles</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(tiposComprobante.tipos as Array<{ Id: number; Desc: string }>)
                .filter((t) => [1, 3, 6, 8, 11, 13].includes(t.Id))
                .map((tipo) => (
                  <div key={tipo.Id} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Código {tipo.Id}</p>
                    <p className="font-medium text-sm">{tipo.Desc}</p>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
