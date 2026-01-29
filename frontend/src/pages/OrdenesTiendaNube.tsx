/**
 * Página para listar y facturar órdenes de TiendaNube.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, Link } from 'react-router-dom'
import {
  Title,
  Text,
  Card,
  Box,
  Table,
  Tag,
  Button,
  Alert,
  Spinner,
  Select,
  IconButton,
  Modal,
  Label,
} from '@nimbus-ds/components'
import {
  CheckCircleIcon,
  SearchIcon,
  InvoiceIcon,
  RedoIcon,
  StoreIcon,
  EyeIcon,
  DownloadIcon,
  CogIcon,
  PlusCircleIcon,
} from '@nimbus-ds/icons'
import api, { getTiendaNubeInstallUrl, getFacturaPdfUrl } from '../services/api'
import { useAppContext } from '../contexts/AppContext'
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
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('')
  const [invoicedFilter, setInvoicedFilter] = useState<string>('')

  // Modal de facturación
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<TiendaNubeOrder | null>(null)
  const [selectedTipoComprobante, setSelectedTipoComprobante] = useState('6')

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
    // Si tiene CUIT válido (11 dígitos), sugerir Factura A
    // Si no tiene identificación o es inválida, usar Factura B
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

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd MMM yyyy HH:mm', { locale: es })
    } catch {
      return dateStr
    }
  }

  const formatCurrency = (amount: string, currency: string) => {
    return `${currency} ${Number(amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
  }

  const getPaymentStatusTag = (status: string) => {
    switch (status) {
      case 'paid':
        return <Tag appearance="success">Pagada</Tag>
      case 'pending':
        return <Tag appearance="warning">Pendiente</Tag>
      case 'refunded':
        return <Tag appearance="danger">Reembolsada</Tag>
      default:
        return <Tag>{status}</Tag>
    }
  }

  // Si está cargando el estado de conexión
  if (loadingStatus) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="300px">
        <Spinner size="large" />
      </Box>
    )
  }

  // Si no hay tienda conectada
  if (!storeStatus?.connected) {
    return (
      <Box display="flex" flexDirection="column" gap="6">
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Title as="h1">{isEmbedded ? 'Órdenes' : 'Órdenes de TiendaNube'}</Title>
            <Box marginTop="1">
              <Text color="neutral-textLow">
                Conecta tu tienda para facturar órdenes
              </Text>
            </Box>
          </Box>
          {isEmbedded && (
            <Box display="flex" gap="2">
              <Link to="/configuracion">
                <Button appearance="neutral">
                  <CogIcon size="small" />
                  Configuración
                </Button>
              </Link>
              <Link to="/facturas/nueva">
                <Button appearance="primary">
                  <PlusCircleIcon size="small" />
                  Nueva Factura
                </Button>
              </Link>
            </Box>
          )}
        </Box>

        <Card>
          <Card.Body>
            <Box className="empty-state">
              <Box
                className="stat-card-icon"
                backgroundColor="primary-surface"
                marginBottom="4"
              >
                <StoreIcon size="large" />
              </Box>
              <Text fontWeight="bold" fontSize="base">
                Conecta tu tienda de TiendaNube
              </Text>
              <Box marginTop="1">
                <Text color="neutral-textLow" fontSize="caption" textAlign="center">
                  Sincroniza tus órdenes y emití facturas automáticamente
                </Text>
              </Box>
              <Box marginTop="4">
                <Button
                  as="a"
                  href={getTiendaNubeInstallUrl()}
                  appearance="primary"
                >
                  Conectar TiendaNube
                </Button>
              </Box>
            </Box>
          </Card.Body>
        </Card>
      </Box>
    )
  }

  return (
    <Box display="flex" flexDirection="column" gap="6">
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Title as="h1">{isEmbedded ? 'Órdenes' : 'Órdenes de TiendaNube'}</Title>
          <Box marginTop="1" display="flex" alignItems="center" gap="2">
            <Box
              width="8px"
              height="8px"
              borderRadius="full"
              backgroundColor="success-interactive"
            />
            <Text color="neutral-textLow" fontSize="caption">
              {storeStatus.store_name}
            </Text>
          </Box>
        </Box>
        <Box display="flex" gap="2">
          {isEmbedded && (
            <Link to="/configuracion">
              <Button appearance="neutral">
                <CogIcon size="small" />
                Configuración
              </Button>
            </Link>
          )}
          <Button appearance="neutral" onClick={() => refetchOrders()}>
            <RedoIcon size="small" />
            Actualizar
          </Button>
          {isEmbedded && (
            <Link to="/facturas/nueva">
              <Button appearance="primary">
                <PlusCircleIcon size="small" />
                Nueva Factura
              </Button>
            </Link>
          )}
        </Box>
      </Box>

      {justConnected && (
        <Box marginTop="4">
          <Alert appearance="success" title="¡Tienda conectada!">
            Tu tienda de TiendaNube se ha conectado correctamente.
          </Alert>
        </Box>
      )}

      {/* Filtros */}
      <Box marginTop="6">
        <Card>
          <Card.Body>
            <Box display="flex" gap="4" flexWrap="wrap">
              <Box width="200px">
                <Label htmlFor="payment-filter">Estado de pago</Label>
                <Select
                  id="payment-filter"
                  name="payment-filter"
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value)}
                >
                  <Select.Option label="Todos" value="" />
                  <Select.Option label="Pagadas" value="paid" />
                  <Select.Option label="Pendientes" value="pending" />
                  <Select.Option label="Reembolsadas" value="refunded" />
                </Select>
              </Box>
              <Box width="200px">
                <Label htmlFor="invoiced-filter">Facturación</Label>
                <Select
                  id="invoiced-filter"
                  name="invoiced-filter"
                  value={invoicedFilter}
                  onChange={(e) => setInvoicedFilter(e.target.value)}
                >
                  <Select.Option label="Todas" value="" />
                  <Select.Option label="Sin facturar" value="false" />
                  <Select.Option label="Facturadas" value="true" />
                </Select>
              </Box>
            </Box>
          </Card.Body>
        </Card>
      </Box>

      {/* Lista de órdenes */}
      <Box marginTop="4">
        <Card>
          <Card.Body padding="none">
            {loadingOrders ? (
              <Box display="flex" justifyContent="center" padding="8">
                <Spinner size="large" />
              </Box>
            ) : ordersError ? (
              <Box padding="4">
                <Alert appearance="danger" title="Error cargando órdenes">
                  {String(ordersError)}
                </Alert>
              </Box>
            ) : ordersData?.items.length === 0 ? (
              <Box className="empty-state">
                <SearchIcon size="large" className="empty-state-icon" />
                <Box marginTop="2">
                  <Text fontWeight="medium">No se encontraron órdenes</Text>
                </Box>
                <Text color="neutral-textLow" fontSize="caption">
                  Probá ajustando los filtros o esperá nuevas ventas
                </Text>
              </Box>
            ) : (
              <Table>
                <Table.Head>
                  <Table.Row>
                    <Table.Cell as="th">Orden</Table.Cell>
                    <Table.Cell as="th">Fecha</Table.Cell>
                    <Table.Cell as="th">Cliente</Table.Cell>
                    <Table.Cell as="th">Total</Table.Cell>
                    <Table.Cell as="th">Pago</Table.Cell>
                    <Table.Cell as="th">Factura</Table.Cell>
                    <Table.Cell as="th">Acciones</Table.Cell>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {ordersData?.items.map((order) => (
                    <Table.Row key={order.id}>
                      <Table.Cell>
                        <Text fontWeight="bold">#{order.number}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontSize="caption">{formatDate(order.created_at)}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Box>
                          <Text>{order.customer_name || 'Sin nombre'}</Text>
                          {order.customer_identification && (
                            <Text fontSize="caption" color="neutral-textLow">
                              {order.customer_identification}
                            </Text>
                          )}
                        </Box>
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontWeight="bold">
                          {formatCurrency(order.total, order.currency)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>{getPaymentStatusTag(order.payment_status)}</Table.Cell>
                      <Table.Cell>
                        {order.invoiced ? (
                          <Box display="flex" alignItems="center" gap="1">
                            <CheckCircleIcon size="small" />
                            <Text fontSize="caption">{order.factura_numero}</Text>
                          </Box>
                        ) : (
                          <Tag appearance="neutral">Pendiente</Tag>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <Box display="flex" gap="1">
                          {!order.invoiced && (
                            <IconButton
                              source={<InvoiceIcon size="small" />}
                              size="2rem"
                              onClick={() => handleOpenInvoiceModal(order)}
                            />
                          )}
                          {order.factura_id && (
                            <>
                              <a href={`/facturas?id=${order.factura_id}`}>
                                <IconButton
                                  source={<EyeIcon size="small" />}
                                  size="2rem"
                                />
                              </a>
                              <a
                                href={getFacturaPdfUrl(order.factura_id)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <IconButton
                                  source={<DownloadIcon size="small" />}
                                  size="2rem"
                                />
                              </a>
                            </>
                          )}
                        </Box>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            )}
          </Card.Body>
        </Card>
      </Box>

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
            {/* Alerta informativa si no hay identificación */}
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
                {selectedOrder && formatCurrency(selectedOrder.total, selectedOrder.currency)}
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
                  // Si no hay identificación, no permitir Factura A
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
    </Box>
  )
}
