/**
 * Página para listar y facturar órdenes de TiendaNube.
 * Diseño basado en la página de Ventas nativa de TiendaNube.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, Link } from 'react-router-dom'
import {
  Text,
  Box,
  Button,
  Alert,
  Spinner,
  Select,
  Modal,
  Label,
  IconButton,
} from '@nimbus-ds/components'
import {
  CheckCircleIcon,
  SearchIcon,
  RedoIcon,
  StoreIcon,
  EyeIcon,
  DownloadIcon,
  CogIcon,
  PlusCircleIcon,
  InvoiceIcon,
} from '@nimbus-ds/icons'
import api, { getTiendaNubeInstallUrl, getFacturaPdfUrl, getFactura } from '../services/api'
import type { FacturaDetalle } from '../types'
import { useAppContext } from '../contexts/AppContext'
import SalesAssistant from '../components/SalesAssistant'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface TiendaNubeOrder {
  id: number
  number: number
  status: string
  payment_status: string
  total: string
  subtotal: string
  currency: string
  created_at: string
  customer_name: string | null
  customer_email: string | null
  customer_identification: string | null
  invoiced: boolean
  factura_id: number | null
  factura_numero: string | null
}

interface OrderListResponse {
  items: TiendaNubeOrder[]
  total: number
  page: number
  per_page: number
}

interface StoreStatus {
  connected: boolean
  store_id: string | null
  store_name: string | null
  store_url: string | null
  auto_invoice: boolean
  default_invoice_type: number
}

interface InvoiceResponse {
  success: boolean
  factura_id: number | null
  numero_completo: string | null
  cae: string | null
  message: string
}

const TIPO_COMPROBANTE_OPTIONS = [
  { value: '1', label: 'Factura A' },
  { value: '6', label: 'Factura B' },
  { value: '11', label: 'Factura C' },
]

export default function OrdenesTiendaNube() {
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const justConnected = searchParams.get('connected') === 'true'
  const { isEmbedded } = useAppContext()

  // Filtros
  const [paymentStatusFilter] = useState<string>('paid')
  const [invoicedFilter, setInvoicedFilter] = useState<string>('')

  // Modal de facturación
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<TiendaNubeOrder | null>(null)
  const [selectedTipoComprobante, setSelectedTipoComprobante] = useState('6')

  // Modal de ver factura
  const [viewFacturaModalOpen, setViewFacturaModalOpen] = useState(false)
  const [selectedFactura, setSelectedFactura] = useState<FacturaDetalle | null>(null)
  const [loadingFactura, setLoadingFactura] = useState(false)

  // Verificar conexión con TiendaNube
  const { data: storeStatus, isLoading: loadingStatus } = useQuery<StoreStatus>({
    queryKey: ['tiendanube-status'],
    queryFn: async () => {
      const response = await api.get('/tiendanube/status')
      return response.data
    },
  })

  // Obtener órdenes
  const {
    data: ordersData,
    isLoading: loadingOrders,
    error: ordersError,
    refetch: refetchOrders,
  } = useQuery<OrderListResponse>({
    queryKey: ['tiendanube-orders', paymentStatusFilter, invoicedFilter],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (paymentStatusFilter) params.payment_status = paymentStatusFilter
      if (invoicedFilter) params.invoiced = invoicedFilter

      const response = await api.get('/ordenes-tn', { params })
      return response.data
    },
    enabled: storeStatus?.connected === true,
  })

  // Mutación para facturar
  const invoiceMutation = useMutation<InvoiceResponse, Error, { orderId: string; tipoComprobante: number }>({
    mutationFn: async ({ orderId, tipoComprobante }) => {
      const response = await api.post(`/ordenes-tn/${orderId}/facturar`, {
        tipo_comprobante: tipoComprobante,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiendanube-orders'] })
      setInvoiceModalOpen(false)
      setSelectedOrder(null)
    },
  })

  const handleOpenInvoiceModal = (order: TiendaNubeOrder) => {
    setSelectedOrder(order)
    if (order.customer_identification && 
        order.customer_identification.trim() !== '' &&
        order.customer_identification.length === 11) {
      setSelectedTipoComprobante('1')
    } else {
      setSelectedTipoComprobante('6')
    }
    setInvoiceModalOpen(true)
  }

  const handleInvoice = () => {
    if (!selectedOrder) return
    invoiceMutation.mutate({
      orderId: String(selectedOrder.id),
      tipoComprobante: parseInt(selectedTipoComprobante),
    })
  }

  const handleViewFactura = async (facturaId: number) => {
    setLoadingFactura(true)
    setViewFacturaModalOpen(true)
    try {
      const factura = await getFactura(facturaId)
      setSelectedFactura(factura)
    } catch (error) {
      console.error('Error al cargar factura:', error)
    } finally {
      setLoadingFactura(false)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd MMM HH:mm", { locale: es })
    } catch {
      return dateStr
    }
  }

  const formatCurrency = (amount: string) => {
    return `$ ${Number(amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
  }

  // Contar órdenes por estado
  const countByInvoiced = (invoiced: boolean) => {
    return ordersData?.items.filter(o => o.invoiced === invoiced).length || 0
  }

  // Loading
  if (loadingStatus) {
    return (
      <div className="tn-spinner-container">
        <Spinner size="large" />
      </div>
    )
  }

  // Sin tienda conectada
  if (!storeStatus?.connected) {
    return (
      <>
        <header className="tn-page-header">
          <div className="tn-page-header-left">
            <h1 className="tn-page-title">Órdenes</h1>
          </div>
          {isEmbedded && (
            <div className="tn-page-header-right">
              <Link to="/configuracion" className="tn-btn tn-btn-secondary">
                <CogIcon size="small" />
                Configuración
              </Link>
              <Link to="/facturas/nueva" className="tn-btn tn-btn-primary">
                <PlusCircleIcon size="small" />
                Nueva Factura
              </Link>
            </div>
          )}
        </header>

        <div className="tn-page-content">
          <div className="tn-card">
            <div className="tn-empty-state">
              <StoreIcon size={48} className="tn-empty-state-icon" />
              <h3 className="tn-empty-state-title">Conecta tu tienda de TiendaNube</h3>
              <p className="tn-empty-state-text">Sincroniza tus órdenes y emití facturas automáticamente</p>
              <Box marginTop="4">
                <a href={getTiendaNubeInstallUrl()} className="tn-btn tn-btn-primary">
                  Conectar TiendaNube
                </a>
              </Box>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Header */}
      <header className="tn-page-header">
        <div className="tn-page-header-left">
          <div className="tn-page-title-with-count">
            <h1 className="tn-page-title">Órdenes</h1>
            <span className="tn-page-count">{ordersData?.total || 0} órdenes</span>
          </div>
        </div>
        <div className="tn-page-header-right">
          {isEmbedded && (
            <Link to="/configuracion" className="tn-btn tn-btn-secondary">
              <CogIcon size="small" />
              Configuración
            </Link>
          )}
          <button className="tn-btn tn-btn-secondary" onClick={() => refetchOrders()}>
            <RedoIcon size="small" />
            Actualizar
          </button>
          {isEmbedded && (
            <Link to="/facturas/nueva" className="tn-btn tn-btn-primary">
              <PlusCircleIcon size="small" />
              Nueva Factura
            </Link>
          )}
        </div>
      </header>

      {justConnected && (
        <div className="tn-page-content" style={{ paddingBottom: 0 }}>
          <Alert appearance="success" title="¡Tienda conectada!">
            Tu tienda de TiendaNube se ha conectado correctamente.
          </Alert>
        </div>
      )}

      <div className="tn-page-content">
        <div className="tn-table-wrapper">
          {/* Filtros rápidos */}
          <div className="tn-quick-filters">
            <button 
              className={`tn-quick-filter ${invoicedFilter === '' ? 'active' : ''}`}
              onClick={() => setInvoicedFilter('')}
            >
              Todas
            </button>
            <button 
              className={`tn-quick-filter ${invoicedFilter === 'false' ? 'active' : ''}`}
              onClick={() => setInvoicedFilter('false')}
            >
              Sin facturar
              <span className="tn-quick-filter-badge">{countByInvoiced(false)}</span>
            </button>
            <button 
              className={`tn-quick-filter ${invoicedFilter === 'true' ? 'active' : ''}`}
              onClick={() => setInvoicedFilter('true')}
            >
              Facturadas
              <span className="tn-quick-filter-badge">{countByInvoiced(true)}</span>
            </button>
          </div>

          {/* Tabla */}
          {loadingOrders ? (
            <div className="tn-spinner-container">
              <Spinner size="large" />
            </div>
          ) : ordersError ? (
            <Box padding="4">
              <Alert appearance="danger" title="Error cargando órdenes">
                {String(ordersError)}
              </Alert>
            </Box>
          ) : ordersData?.items.length === 0 ? (
            <div className="tn-empty-state">
              <SearchIcon size={48} className="tn-empty-state-icon" />
              <h3 className="tn-empty-state-title">No se encontraron órdenes</h3>
              <p className="tn-empty-state-text">Probá ajustando los filtros o esperá nuevas ventas</p>
            </div>
          ) : (
            <table className="tn-table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Pago</th>
                  <th>Factura</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordersData?.items.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <span className="tn-link" style={{ fontWeight: 600 }}>#{order.number}</span>
                    </td>
                    <td>
                      <Text fontSize="caption" color="neutral-textLow">
                        {formatDate(order.created_at)}
                      </Text>
                    </td>
                    <td>
                      {order.customer_name ? (
                        <span className="tn-link">{order.customer_name}</span>
                      ) : (
                        <Text color="neutral-textLow">No Informado</Text>
                      )}
                    </td>
                    <td>
                      <Text fontWeight="medium">{formatCurrency(order.total)}</Text>
                    </td>
                    <td>
                      {order.payment_status === 'paid' ? (
                        <span className="tn-tag tn-tag-success">
                          <CheckCircleIcon size={12} />
                          Recibido
                        </span>
                      ) : order.payment_status === 'pending' ? (
                        <span className="tn-tag tn-tag-warning">Pendiente</span>
                      ) : (
                        <span className="tn-tag tn-tag-neutral">{order.payment_status}</span>
                      )}
                    </td>
                    <td>
                      {order.invoiced ? (
                        <Box display="flex" alignItems="center" gap="1">
                          <CheckCircleIcon size={14} />
                          <Text fontSize="caption">{order.factura_numero}</Text>
                        </Box>
                      ) : (
                        <span className="tn-tag tn-tag-neutral">Pendiente</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Box display="inline-flex" alignItems="center" gap="1">
                        {!order.invoiced && (
                          <IconButton
                            size="2rem"
                            source={<InvoiceIcon size="small" />}
                            onClick={() => handleOpenInvoiceModal(order)}
                          />
                        )}
                        {order.factura_id && (
                          <>
                            <IconButton
                              size="2rem"
                              source={<EyeIcon size="small" />}
                              onClick={() => handleViewFactura(order.factura_id!)}
                            />
                            <a
                              href={getFacturaPdfUrl(order.factura_id)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <IconButton
                                size="2rem"
                                source={<DownloadIcon size="small" />}
                              />
                            </a>
                          </>
                        )}
                      </Box>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal de facturación */}
      <Modal open={invoiceModalOpen} onDismiss={() => setInvoiceModalOpen(false)}>
        <Modal.Header title={`Facturar Orden #${selectedOrder?.number}`} />
        <Modal.Body>
          {invoiceMutation.error && (
            <Box marginBottom="4">
              <Alert appearance="danger" title="Error al facturar">
                {String(invoiceMutation.error)}
              </Alert>
            </Box>
          )}

          <Box display="flex" flexDirection="column" gap="4">
            {(!selectedOrder?.customer_identification || 
              selectedOrder.customer_identification.trim() === '') && (
              <Alert appearance="primary" title="Facturación a Consumidor Final">
                Esta orden no tiene CUIT/DNI del cliente. Se facturará como{' '}
                <strong>Consumidor Final</strong> con{' '}
                <strong>
                  {selectedTipoComprobante === '6' ? 'Factura B' : 
                   selectedTipoComprobante === '11' ? 'Factura C' : 'Factura B'}
                </strong>.
              </Alert>
            )}

            <Box>
              <Text fontWeight="bold">Cliente:</Text>
              <Text>{selectedOrder?.customer_name || 'Consumidor Final'}</Text>
              {selectedOrder?.customer_identification && 
               selectedOrder.customer_identification.trim() !== '' ? (
                <Text fontSize="caption" color="neutral-textLow">
                  CUIT/DNI: {selectedOrder.customer_identification}
                </Text>
              ) : (
                <Text fontSize="caption" color="neutral-textLow">
                  Sin identificación fiscal
                </Text>
              )}
            </Box>

            <Box>
              <Text fontWeight="bold">Total:</Text>
              <Text>
                {selectedOrder && formatCurrency(selectedOrder.total)}
              </Text>
            </Box>

            <Box>
              <Label htmlFor="tipo-comprobante">Tipo de comprobante</Label>
              <Select
                id="tipo-comprobante"
                name="tipo-comprobante"
                value={selectedTipoComprobante}
                onChange={(e) => setSelectedTipoComprobante(e.target.value)}
              >
                {TIPO_COMPROBANTE_OPTIONS.filter((opt) => {
                  if (!selectedOrder?.customer_identification || 
                      selectedOrder.customer_identification.trim() === '') {
                    return opt.value !== '1'
                  }
                  return true
                }).map((opt) => (
                  <Select.Option key={opt.value} label={opt.label} value={opt.value} />
                ))}
              </Select>
            </Box>

            {selectedOrder?.customer_identification &&
              selectedOrder.customer_identification.trim() !== '' &&
              selectedOrder.customer_identification.length !== 11 &&
              selectedTipoComprobante === '1' && (
                <Alert appearance="warning" title="Atención">
                  El cliente no tiene CUIT válido (11 dígitos). Para Factura A se requiere CUIT.
                </Alert>
              )}
          </Box>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={() => setInvoiceModalOpen(false)}>Cancelar</Button>
          <Button
            appearance="primary"
            onClick={handleInvoice}
            disabled={invoiceMutation.isPending}
          >
            {invoiceMutation.isPending ? <Spinner size="small" /> : 'Facturar'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de ver factura */}
      <Modal 
        open={viewFacturaModalOpen} 
        onDismiss={() => {
          setViewFacturaModalOpen(false)
          setSelectedFactura(null)
        }}
      >
        <Modal.Header title={selectedFactura ? `Factura ${selectedFactura.numero_completo}` : 'Cargando...'} />
        <Modal.Body>
          {loadingFactura ? (
            <Box display="flex" justifyContent="center" padding="4">
              <Spinner size="large" />
            </Box>
          ) : selectedFactura ? (
            <Box display="flex" flexDirection="column" gap="4">
              {/* Info general */}
              <Box display="flex" gap="4" flexWrap="wrap">
                <Box flex="1" minWidth="120px">
                  <Text fontSize="caption" color="neutral-textLow">Fecha</Text>
                  <Text fontWeight="medium">
                    {format(new Date(selectedFactura.fecha), 'dd/MM/yyyy', { locale: es })}
                  </Text>
                </Box>
                <Box flex="1" minWidth="120px">
                  <Text fontSize="caption" color="neutral-textLow">Estado</Text>
                  <span className={`tn-tag ${selectedFactura.estado === 'autorizada' ? 'tn-tag-success' : 'tn-tag-danger'}`}>
                    {selectedFactura.estado}
                  </span>
                </Box>
                <Box flex="1" minWidth="120px">
                  <Text fontSize="caption" color="neutral-textLow">CAE</Text>
                  <Text fontSize="caption">{selectedFactura.cae || '-'}</Text>
                </Box>
              </Box>

              {/* Cliente */}
              {selectedFactura.cliente && (
                <>
                  <hr className="tn-separator" />
                  <Box>
                    <Text fontSize="caption" color="neutral-textLow">Cliente</Text>
                    <Text fontWeight="medium">{selectedFactura.cliente.razon_social}</Text>
                    <Text fontSize="caption">CUIT: {selectedFactura.cliente.cuit}</Text>
                  </Box>
                </>
              )}

              {/* Items */}
              {selectedFactura.items && selectedFactura.items.length > 0 && (
                <>
                  <hr className="tn-separator" />
                  <Box>
                    <Box marginBottom="2">
                      <Text fontSize="caption" color="neutral-textLow">Detalle</Text>
                    </Box>
                    {selectedFactura.items.map((item, index) => (
                      <Box key={index} display="flex" justifyContent="space-between" paddingY="1">
                        <Text fontSize="caption">{item.cantidad}x {item.descripcion}</Text>
                        <Text fontSize="caption" fontWeight="medium">
                          ${Number(item.subtotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </Text>
                      </Box>
                    ))}
                  </Box>
                </>
              )}

              {/* Total */}
              <hr className="tn-separator" />
              <Box display="flex" justifyContent="space-between">
                <Text fontWeight="bold">Total</Text>
                <Text fontWeight="bold">
                  ${Number(selectedFactura.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </Text>
              </Box>
            </Box>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={() => {
            setViewFacturaModalOpen(false)
            setSelectedFactura(null)
          }}>
            Cerrar
          </Button>
          {selectedFactura && (
            <a
              href={getFacturaPdfUrl(selectedFactura.id)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none' }}
            >
              <Button appearance="primary">
                <DownloadIcon size="small" />
                Descargar PDF
              </Button>
            </a>
          )}
        </Modal.Footer>
      </Modal>

      {/* Asistente de ventas con IA (solo en modo iframe) */}
      {isEmbedded && <SalesAssistant />}
    </>
  )
}
