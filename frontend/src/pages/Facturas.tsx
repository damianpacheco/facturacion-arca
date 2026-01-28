import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Title,
  Text,
  Card,
  Box,
  Table,
  Tag,
  Input,
  Select,
  Button,
  Modal,
  Spinner,
  IconButton,
} from '@nimbus-ds/components'
import {
  FileIcon,
  DownloadIcon,
  EyeIcon,
  PlusCircleIcon,
  SearchIcon,
} from '@nimbus-ds/icons'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getFacturas, getFactura, getFacturaPdfUrl } from '../services/api'
import { TIPOS_COMPROBANTE, FacturaDetalle } from '../types'

export default function Facturas() {
  const [busqueda, setBusqueda] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<string>('')
  const [page, setPage] = useState(0)
  const [selectedFactura, setSelectedFactura] = useState<FacturaDetalle | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const limit = 20

  const { data, isLoading } = useQuery({
    queryKey: ['facturas', { skip: page * limit, limit, tipo_comprobante: tipoFiltro ? Number(tipoFiltro) : undefined }],
    queryFn: () => getFacturas({ skip: page * limit, limit, tipo_comprobante: tipoFiltro ? Number(tipoFiltro) : undefined }),
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
    <Box display="flex" flexDirection="column" gap="6">
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Title as="h1">Facturas</Title>
        <Link to="/facturas/nueva" style={{ textDecoration: 'none' }}>
          <Button appearance="primary">
            <PlusCircleIcon size="small" />
            Nueva Factura
          </Button>
        </Link>
      </Box>

      {/* Filtros */}
      <Card>
        <Card.Body>
          <Box display="flex" gap="4" flexWrap="wrap">
            <Box flex="1" minWidth="200px">
              <Input
                type="text"
                placeholder="Buscar número de factura..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                append={<SearchIcon size="small" />}
              />
            </Box>

            <Box width="200px">
              <Select
                name="tipo"
                id="tipo-filtro"
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value)}
              >
                <Select.Option label="Todos los tipos" value="" />
                {TIPOS_COMPROBANTE.map((tipo) => (
                  <Select.Option key={tipo.codigo} label={tipo.nombre} value={String(tipo.codigo)} />
                ))}
              </Select>
            </Box>
          </Box>
        </Card.Body>
      </Card>

      {/* Tabla */}
      <Card>
        <Card.Body padding="none">
          {isLoading ? (
            <Box display="flex" justifyContent="center" padding="8">
              <Spinner size="large" />
            </Box>
          ) : data?.items.length ? (
            <>
              <Table>
                <Table.Head>
                  <Table.Row>
                    <Table.Cell as="th">Tipo</Table.Cell>
                    <Table.Cell as="th">Número</Table.Cell>
                    <Table.Cell as="th">Fecha</Table.Cell>
                    <Table.Cell as="th">CAE</Table.Cell>
                    <Table.Cell as="th">Total</Table.Cell>
                    <Table.Cell as="th">Estado</Table.Cell>
                    <Table.Cell as="th">Acciones</Table.Cell>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {data.items.map((factura) => (
                    <Table.Row key={factura.id}>
                      <Table.Cell>
                        <Tag appearance="neutral">
                          {getTipoNombre(factura.tipo_comprobante)}
                        </Tag>
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontWeight="medium" fontSize="caption">
                          {factura.numero_completo}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text>
                          {format(new Date(factura.fecha), 'dd/MM/yyyy', { locale: es })}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontSize="caption">{factura.cae || '-'}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontWeight="medium">
                          ${Number(factura.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Tag
                          appearance={
                            factura.estado === 'autorizada'
                              ? 'success'
                              : factura.estado === 'rechazada'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {factura.estado}
                        </Tag>
                      </Table.Cell>
                      <Table.Cell>
                        <Box display="flex" gap="2">
                          <IconButton
                            size="2rem"
                            source={<EyeIcon size="small" />}
                            onClick={() => handleVerDetalle(factura.id)}
                          />
                          <a
                            href={getFacturaPdfUrl(factura.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <IconButton
                              size="2rem"
                              source={<DownloadIcon size="small" />}
                            />
                          </a>
                        </Box>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>

              {/* Paginación */}
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                padding="4"
                borderTopWidth="1"
                borderColor="neutral-surfaceHighlight"
                borderStyle="solid"
              >
                <Text fontSize="caption" color="neutral-textLow">
                  Mostrando {page * limit + 1} - {Math.min((page + 1) * limit, data.total)} de {data.total}
                </Text>
                <Box display="flex" gap="2">
                  <Button
                    appearance="neutral"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    appearance="neutral"
                    disabled={(page + 1) * limit >= data.total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Siguiente
                  </Button>
                </Box>
              </Box>
            </>
          ) : (
            <Box padding="8" display="flex" flexDirection="column" alignItems="center" gap="4">
              <FileIcon size="large" />
              <Text color="neutral-textLow">No hay facturas</Text>
              <Link to="/facturas/nueva" style={{ textDecoration: 'none' }}>
                <Button appearance="primary">
                  <PlusCircleIcon size="small" />
                  Crear primera factura
                </Button>
              </Link>
            </Box>
          )}
        </Card.Body>
      </Card>

      {/* Modal de detalle */}
      {selectedFactura && (
        <Modal open onDismiss={() => setSelectedFactura(null)}>
          <Modal.Header
            title={`${getTipoNombre(selectedFactura.tipo_comprobante)} ${selectedFactura.numero_completo}`}
          />
          <Modal.Body padding="none">
            <Box padding="4" display="flex" flexDirection="column" gap="4">
              {/* Información general */}
              <Box display="flex" gap="4" flexWrap="wrap">
                <Box flex="1" minWidth="150px">
                  <Text fontSize="caption" color="neutral-textLow">Fecha</Text>
                  <Text fontWeight="medium">
                    {format(new Date(selectedFactura.fecha), 'dd/MM/yyyy', { locale: es })}
                  </Text>
                </Box>
                <Box flex="1" minWidth="150px">
                  <Text fontSize="caption" color="neutral-textLow">Estado</Text>
                  <Tag
                    appearance={
                      selectedFactura.estado === 'autorizada' ? 'success' : 'danger'
                    }
                  >
                    {selectedFactura.estado}
                  </Tag>
                </Box>
                <Box flex="1" minWidth="150px">
                  <Text fontSize="caption" color="neutral-textLow">CAE</Text>
                  <Text fontSize="caption">{selectedFactura.cae || '-'}</Text>
                </Box>
                <Box flex="1" minWidth="150px">
                  <Text fontSize="caption" color="neutral-textLow">Vencimiento CAE</Text>
                  <Text fontWeight="medium">
                    {selectedFactura.vencimiento_cae
                      ? format(new Date(selectedFactura.vencimiento_cae), 'dd/MM/yyyy', { locale: es })
                      : '-'}
                  </Text>
                </Box>
              </Box>

              {/* Cliente */}
              {selectedFactura.cliente && (
                <Box
                  borderTopWidth="1"
                  borderColor="neutral-surfaceHighlight"
                  borderStyle="solid"
                  paddingTop="4"
                >
                  <Text fontSize="caption" color="neutral-textLow">Cliente</Text>
                  <Text fontWeight="medium">{selectedFactura.cliente.razon_social}</Text>
                  <Text fontSize="caption">CUIT: {selectedFactura.cliente.cuit}</Text>
                  <Text fontSize="caption">{selectedFactura.cliente.condicion_iva}</Text>
                </Box>
              )}

              {/* Items */}
              {selectedFactura.items && selectedFactura.items.length > 0 && (
                <Box
                  borderTopWidth="1"
                  borderColor="neutral-surfaceHighlight"
                  borderStyle="solid"
                  paddingTop="4"
                >
                  <Box marginBottom="2">
                    <Text fontSize="caption" color="neutral-textLow">
                      Detalle
                    </Text>
                  </Box>
                  <Table>
                    <Table.Head>
                      <Table.Row>
                        <Table.Cell as="th">Descripción</Table.Cell>
                        <Table.Cell as="th">Cant.</Table.Cell>
                        <Table.Cell as="th">P. Unit.</Table.Cell>
                        <Table.Cell as="th">Subtotal</Table.Cell>
                      </Table.Row>
                    </Table.Head>
                    <Table.Body>
                      {selectedFactura.items.map((item, index) => (
                        <Table.Row key={index}>
                          <Table.Cell>
                            <Text>{item.descripcion}</Text>
                          </Table.Cell>
                          <Table.Cell>
                            <Text>{item.cantidad}</Text>
                          </Table.Cell>
                          <Table.Cell>
                            <Text>
                              ${Number(item.precio_unitario).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </Text>
                          </Table.Cell>
                          <Table.Cell>
                            <Text>
                              ${Number(item.subtotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </Text>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table>
                </Box>
              )}

              {/* Totales */}
              <Box
                borderTopWidth="1"
                borderColor="neutral-surfaceHighlight"
                borderStyle="solid"
                paddingTop="4"
              >
                <Box display="flex" justifyContent="flex-end">
                  <Box width="250px" display="flex" flexDirection="column" gap="1">
                    <Box display="flex" justifyContent="space-between">
                      <Text fontSize="caption" color="neutral-textLow">Subtotal:</Text>
                      <Text fontSize="caption">
                        ${Number(selectedFactura.subtotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </Text>
                    </Box>
                    {Number(selectedFactura.iva_21) > 0 && (
                      <Box display="flex" justifyContent="space-between">
                        <Text fontSize="caption" color="neutral-textLow">IVA 21%:</Text>
                        <Text fontSize="caption">
                          ${Number(selectedFactura.iva_21).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </Text>
                      </Box>
                    )}
                    {Number(selectedFactura.iva_10_5) > 0 && (
                      <Box display="flex" justifyContent="space-between">
                        <Text fontSize="caption" color="neutral-textLow">IVA 10.5%:</Text>
                        <Text fontSize="caption">
                          ${Number(selectedFactura.iva_10_5).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </Text>
                      </Box>
                    )}
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      borderTopWidth="1"
                      borderColor="neutral-surfaceHighlight"
                      borderStyle="solid"
                      paddingTop="2"
                    >
                      <Text fontWeight="bold">Total:</Text>
                      <Text fontWeight="bold">
                        ${Number(selectedFactura.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </Text>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Modal.Body>
          <Modal.Footer>
            <Button appearance="neutral" onClick={() => setSelectedFactura(null)}>
              Cerrar
            </Button>
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
          </Modal.Footer>
        </Modal>
      )}

      {/* Loading overlay */}
      {loadingDetail && (
        <Modal open>
          <Modal.Body>
            <Box display="flex" flexDirection="column" alignItems="center" gap="4" padding="4">
              <Spinner size="large" />
              <Text>Cargando...</Text>
            </Box>
          </Modal.Body>
        </Modal>
      )}
    </Box>
  )
}
