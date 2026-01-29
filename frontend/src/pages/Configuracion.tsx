import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Text,
  Box,
  Tag,
  Alert,
  Spinner,
  Button,
  Toggle,
  Select,
  Label,
} from '@nimbus-ds/components'
import {
  ChevronLeftIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExternalLinkIcon,
} from '@nimbus-ds/icons'
import api, { getEstadoARCA, getPuntosVenta, getTiposComprobante, getTiendaNubeInstallUrl } from '../services/api'
import { useAppContext } from '../contexts/AppContext'

interface StoreStatus {
  connected: boolean
  store_id: string | null
  store_name: string | null
  store_url: string | null
  auto_invoice: boolean
  default_invoice_type: number
}

const TIPO_COMPROBANTE_OPTIONS = [
  { value: '1', label: 'Factura A' },
  { value: '6', label: 'Factura B' },
  { value: '11', label: 'Factura C' },
]

export default function Configuracion() {
  const queryClient = useQueryClient()
  const { isEmbedded } = useAppContext()

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

  // TiendaNube queries
  const { data: tnStatus, isLoading: loadingTn } = useQuery<StoreStatus>({
    queryKey: ['tiendanube-status'],
    queryFn: async () => {
      const response = await api.get('/tiendanube/status')
      return response.data
    },
  })

  const updateTnConfig = useMutation({
    mutationFn: async (config: { auto_invoice?: boolean; default_invoice_type?: number }) => {
      const response = await api.put('/tiendanube/config', config)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiendanube-status'] })
    },
  })

  const disconnectTn = useMutation({
    mutationFn: async () => {
      const response = await api.post('/tiendanube/disconnect')
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiendanube-status'] })
    },
  })

  const handleAutoInvoiceChange = (checked: boolean) => {
    updateTnConfig.mutate({ auto_invoice: checked })
  }

  const handleDefaultTypeChange = (value: string) => {
    updateTnConfig.mutate({ default_invoice_type: parseInt(value) })
  }

  return (
    <>
      {/* Header */}
      <header className="tn-page-header">
        <div className="tn-page-header-left">
          {isEmbedded && (
            <Link to="/" className="tn-back-button">
              <ChevronLeftIcon size={16} />
              Volver
            </Link>
          )}
          <h1 className="tn-page-title">Configuración</h1>
        </div>
      </header>

      <div className="tn-page-content">
        {/* Conexión ARCA */}
        <div className="tn-form-section">
          <h3 className="tn-form-section-title">Conexión con ARCA</h3>
          
          {loadingEstado ? (
            <Box display="flex" alignItems="center" gap="2">
              <Spinner size="small" />
              <Text color="neutral-textLow">Verificando conexión...</Text>
            </Box>
          ) : estadoArca?.estado === 'conectado' ? (
            <Box display="flex" flexDirection="column" gap="4">
              <Box display="flex" alignItems="center" gap="2">
                <CheckCircleIcon size={16} />
                <Text fontWeight="medium" color="success-textLow">
                  Conectado correctamente
                </Text>
              </Box>

              <Box display="flex" gap="6" flexWrap="wrap">
                <Box>
                  <Text fontSize="caption" color="neutral-textLow">Modo</Text>
                  <Text fontWeight="medium">
                    {estadoArca.modo.charAt(0).toUpperCase() + estadoArca.modo.slice(1)}
                  </Text>
                </Box>
                <Box>
                  <Text fontSize="caption" color="neutral-textLow">CUIT</Text>
                  <Text fontWeight="medium">{estadoArca.cuit}</Text>
                </Box>
                <Box>
                  <Text fontSize="caption" color="neutral-textLow">Punto de Venta</Text>
                  <Text fontWeight="medium">{estadoArca.punto_venta}</Text>
                </Box>
              </Box>
            </Box>
          ) : (
            <Box display="flex" alignItems="center" gap="2">
              <ExclamationCircleIcon size={16} />
              <Text color="warning-textLow">
                {estadoArca?.mensaje || 'No se pudo conectar con ARCA'}
              </Text>
            </Box>
          )}
        </div>

        {/* Integración TiendaNube */}
        <div className="tn-form-section">
          <h3 className="tn-form-section-title">Integración TiendaNube</h3>
          
          {loadingTn ? (
            <Box display="flex" alignItems="center" gap="2">
              <Spinner size="small" />
              <Text color="neutral-textLow">Verificando conexión...</Text>
            </Box>
          ) : tnStatus?.connected ? (
            <Box display="flex" flexDirection="column" gap="4">
              <Box display="flex" alignItems="center" gap="2">
                <CheckCircleIcon size={16} />
                <Text fontWeight="medium" color="success-textLow">
                  Tienda conectada
                </Text>
              </Box>

              <Box display="flex" gap="6" flexWrap="wrap">
                <Box>
                  <Text fontSize="caption" color="neutral-textLow">Tienda</Text>
                  <Text fontWeight="medium">{tnStatus.store_name}</Text>
                </Box>
                <Box>
                  <Text fontSize="caption" color="neutral-textLow">URL</Text>
                  <Box display="flex" alignItems="center" gap="1">
                    <Text fontWeight="medium">{tnStatus.store_url}</Text>
                    <a href={tnStatus.store_url || ''} target="_blank" rel="noopener noreferrer">
                      <ExternalLinkIcon size={14} />
                    </a>
                  </Box>
                </Box>
              </Box>

              {/* Configuración de facturación */}
              <hr className="tn-separator" />
              <Box display="flex" alignItems="center" justifyContent="space-between" marginBottom="4">
                <Box>
                  <Text fontWeight="medium">Facturación automática</Text>
                  <Text fontSize="caption" color="neutral-textLow">
                    Emitir factura automáticamente cuando se paga una orden
                  </Text>
                </Box>
                <Toggle
                  name="auto-invoice"
                  checked={tnStatus.auto_invoice}
                  onChange={(e) => handleAutoInvoiceChange(e.target.checked)}
                  disabled={updateTnConfig.isPending}
                />
              </Box>

              <Box>
                <Label htmlFor="default-type">Tipo de comprobante por defecto</Label>
                <Box width="200px" marginTop="1">
                  <Select
                    id="default-type"
                    name="default-type"
                    value={String(tnStatus.default_invoice_type)}
                    onChange={(e) => handleDefaultTypeChange(e.target.value)}
                    disabled={updateTnConfig.isPending}
                  >
                    {TIPO_COMPROBANTE_OPTIONS.map((opt) => (
                      <Select.Option key={opt.value} label={opt.label} value={opt.value} />
                    ))}
                  </Select>
                </Box>
                <Box marginTop="1">
                  <Text fontSize="caption" color="neutral-textLow">
                    Si el cliente tiene CUIT, se usará Factura A automáticamente
                  </Text>
                </Box>
              </Box>

              {/* Botón desconectar */}
              <hr className="tn-separator" />
              <Button
                appearance="danger"
                onClick={() => disconnectTn.mutate()}
                disabled={disconnectTn.isPending}
              >
                {disconnectTn.isPending ? <Spinner size="small" /> : 'Desconectar tienda'}
              </Button>
            </Box>
          ) : (
            <Box display="flex" flexDirection="column" gap="3">
              <Box display="flex" alignItems="center" gap="2">
                <ExclamationCircleIcon size={16} />
                <Text color="neutral-textLow">
                  No hay tienda de TiendaNube conectada
                </Text>
              </Box>
              <Box>
                <a href={getTiendaNubeInstallUrl()} className="tn-btn tn-btn-primary">
                  Conectar TiendaNube
                </a>
              </Box>
              <Text fontSize="caption" color="neutral-textLow">
                Conecta tu tienda para facturar órdenes automáticamente
              </Text>
            </Box>
          )}
        </div>

        {/* Puntos de Venta */}
        {puntosVenta && puntosVenta.puntos_venta?.length > 0 && (
          <div className="tn-form-section">
            <h3 className="tn-form-section-title">Puntos de Venta Habilitados</h3>
            <Box display="flex" flexDirection="column" gap="2">
              {(puntosVenta.puntos_venta as Array<{ Nro: number; EmisionTipo: string; Bloqueado: string }>).map((pv) => (
                <Box 
                  key={pv.Nro} 
                  display="flex" 
                  justifyContent="space-between" 
                  alignItems="center"
                  padding="3"
                  backgroundColor="neutral-surface"
                  borderRadius="2"
                >
                  <Box>
                    <Text fontWeight="medium">{String(pv.Nro).padStart(4, '0')}</Text>
                    <Text fontSize="caption" color="neutral-textLow">{pv.EmisionTipo}</Text>
                  </Box>
                  <Tag appearance={pv.Bloqueado === 'N' ? 'success' : 'danger'}>
                    {pv.Bloqueado === 'N' ? 'Activo' : 'Bloqueado'}
                  </Tag>
                </Box>
              ))}
            </Box>
          </div>
        )}

        {/* Certificados */}
        <div className="tn-form-section">
          <h3 className="tn-form-section-title">Certificados Digitales</h3>
          
          <Box marginBottom="4">
            {estadoArca?.modo === 'testing' ? (
              <Text>
                <Text as="span" fontWeight="medium" color="primary-interactive">
                  Modo Testing:
                </Text>{' '}
                Estás usando el CUIT de demostración de ARCA.
                Las facturas emitidas no tienen validez fiscal.
              </Text>
            ) : (
              <Text>
                <Text as="span" fontWeight="medium" color="success-textLow">
                  Modo Producción:
                </Text>{' '}
                Las facturas emitidas tienen validez fiscal.
              </Text>
            )}
          </Box>

          <Alert appearance="primary" title="Para pasar a producción necesitás:">
            <Box display="flex" flexDirection="column" gap="1">
              <Text fontSize="caption">1. Generar un certificado digital desde ARCA</Text>
              <Text fontSize="caption">2. Crear una Clave Privada (.key)</Text>
              <Text fontSize="caption">3. Colocar ambos archivos en la carpeta backend/certs/</Text>
              <Text fontSize="caption">4. Configurar las variables de entorno en .env</Text>
            </Box>
          </Alert>
        </div>

        {/* Tipos de comprobante */}
        {tiposComprobante && (
          <div className="tn-form-section">
            <h3 className="tn-form-section-title">Tipos de Comprobante Disponibles</h3>
            <Box display="flex" gap="2" flexWrap="wrap">
              {(tiposComprobante.tipos as Array<{ Id: number; Desc: string }>)
                .filter((t) => [1, 3, 6, 8, 11, 13].includes(t.Id))
                .map((tipo) => (
                  <Box
                    key={tipo.Id}
                    padding="3"
                    backgroundColor="neutral-surface"
                    borderRadius="2"
                    minWidth="140px"
                  >
                    <Text fontSize="caption" color="neutral-textLow">
                      Código {tipo.Id}
                    </Text>
                    <Text fontWeight="medium" fontSize="caption">
                      {tipo.Desc}
                    </Text>
                  </Box>
                ))}
            </Box>
          </div>
        )}
      </div>
    </>
  )
}
