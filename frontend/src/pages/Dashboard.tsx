import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Title,
  Text,
  Card,
  Box,
  Alert,
  Table,
  Tag,
  Spinner,
  Button,
} from '@nimbus-ds/components'
import {
  FileIcon,
  UserIcon,
  MoneyIcon,
  PlusCircleIcon,
  ExternalLinkIcon,
} from '@nimbus-ds/icons'
import { getFacturas, getClientes, getEstadoARCA } from '../services/api'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Dashboard() {
  const { data: facturas, isLoading: loadingFacturas } = useQuery({
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
    <Box display="flex" flexDirection="column" gap="6">
      {/* Header */}
      <Box>
        <Title as="h1">Dashboard</Title>
        <Box marginTop="1">
          <Text color="neutral-textLow">
            Bienvenido al sistema de facturación electrónica
          </Text>
        </Box>
      </Box>

      {/* Estado ARCA */}
      <Alert
        appearance={estadoArca?.estado === 'conectado' ? 'success' : 'warning'}
        title={
          estadoArca?.estado === 'conectado'
            ? `Conectado a ARCA (${estadoArca.modo})`
            : estadoArca?.mensaje || 'Verificando conexión con ARCA...'
        }
      >
        {estadoArca?.estado === 'conectado' 
          ? 'Sistema listo para emitir facturas'
          : 'Por favor verifique la configuración'
        }
      </Alert>

      {/* Tarjetas de estadísticas */}
      <Box display="flex" gap="4" flexWrap="wrap">
        <Box flex="1" minWidth="220px">
          <Card>
            <Card.Body>
              <Box display="flex" alignItems="center" gap="4">
                <Box
                  className="stat-card-icon"
                  backgroundColor="primary-surface"
                >
                  <FileIcon size="medium" />
                </Box>
                <Box>
                  <Text fontSize="caption" color="neutral-textLow">
                    Facturas Emitidas
                  </Text>
                  <Box marginTop="1">
                    <Text fontSize="highlight" fontWeight="bold">
                      {facturas?.total || 0}
                    </Text>
                  </Box>
                </Box>
              </Box>
            </Card.Body>
          </Card>
        </Box>

        <Box flex="1" minWidth="220px">
          <Card>
            <Card.Body>
              <Box display="flex" alignItems="center" gap="4">
                <Box
                  className="stat-card-icon"
                  backgroundColor="success-surface"
                >
                  <MoneyIcon size="medium" />
                </Box>
                <Box>
                  <Text fontSize="caption" color="neutral-textLow">
                    Total Facturado
                  </Text>
                  <Box marginTop="1">
                    <Text fontSize="highlight" fontWeight="bold">
                      ${totalMes.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </Text>
                  </Box>
                </Box>
              </Box>
            </Card.Body>
          </Card>
        </Box>

        <Box flex="1" minWidth="220px">
          <Card>
            <Card.Body>
              <Box display="flex" alignItems="center" gap="4">
                <Box
                  className="stat-card-icon"
                  backgroundColor="primary-surface"
                >
                  <UserIcon size="medium" />
                </Box>
                <Box>
                  <Text fontSize="caption" color="neutral-textLow">
                    Clientes Registrados
                  </Text>
                  <Box marginTop="1">
                    <Text fontSize="highlight" fontWeight="bold">
                      {clientes?.total || 0}
                    </Text>
                  </Box>
                </Box>
              </Box>
            </Card.Body>
          </Card>
        </Box>
      </Box>

      {/* Acciones rápidas */}
      <Box display="flex" gap="4" flexWrap="wrap">
        <Box flex="1" minWidth="280px">
          <Link to="/facturas/nueva" style={{ textDecoration: 'none' }}>
            <Card>
              <Card.Body>
                <Box display="flex" alignItems="center" gap="4" className="action-card">
                  <Box
                    className="stat-card-icon action-card-icon"
                    backgroundColor="primary-surface"
                  >
                    <PlusCircleIcon size="large" />
                  </Box>
                  <Box flex="1">
                    <Text fontWeight="bold" fontSize="base">
                      Nueva Factura
                    </Text>
                    <Text color="neutral-textLow" fontSize="caption">
                      Emitir un nuevo comprobante
                    </Text>
                  </Box>
                  <ExternalLinkIcon size="small" />
                </Box>
              </Card.Body>
            </Card>
          </Link>
        </Box>

        <Box flex="1" minWidth="280px">
          <Link to="/clientes" style={{ textDecoration: 'none' }}>
            <Card>
              <Card.Body>
                <Box display="flex" alignItems="center" gap="4" className="action-card">
                  <Box
                    className="stat-card-icon action-card-icon"
                    backgroundColor="primary-surface"
                  >
                    <UserIcon size="large" />
                  </Box>
                  <Box flex="1">
                    <Text fontWeight="bold" fontSize="base">
                      Gestionar Clientes
                    </Text>
                    <Text color="neutral-textLow" fontSize="caption">
                      Agregar o editar clientes
                    </Text>
                  </Box>
                  <ExternalLinkIcon size="small" />
                </Box>
              </Card.Body>
            </Card>
          </Link>
        </Box>
      </Box>

      {/* Últimas facturas */}
      <Card>
        <Card.Header>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Title as="h3">Últimas Facturas</Title>
            <Link to="/facturas">
              <Button appearance="neutral">
                Ver todas
              </Button>
            </Link>
          </Box>
        </Card.Header>
        <Card.Body padding="none">
          {loadingFacturas ? (
            <Box display="flex" justifyContent="center" padding="8">
              <Spinner size="large" />
            </Box>
          ) : facturas?.items.length ? (
            <Table>
              <Table.Head>
                <Table.Row>
                  <Table.Cell as="th">Número</Table.Cell>
                  <Table.Cell as="th">Fecha</Table.Cell>
                  <Table.Cell as="th">Total</Table.Cell>
                  <Table.Cell as="th">Estado</Table.Cell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {facturas.items.map((factura) => (
                  <Table.Row key={factura.id}>
                    <Table.Cell>
                      <Text fontWeight="medium">{factura.numero_completo}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text color="neutral-textLow">
                        {format(new Date(factura.fecha), 'dd/MM/yyyy', { locale: es })}
                      </Text>
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
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          ) : (
            <Box className="empty-state">
              <FileIcon size="large" className="empty-state-icon" />
              <Text color="neutral-textLow">No hay facturas emitidas aún</Text>
              <Box marginTop="4">
                <Link to="/facturas/nueva">
                  <Button appearance="primary">
                    <PlusCircleIcon size="small" />
                    Crear primera factura
                  </Button>
                </Link>
              </Box>
            </Box>
          )}
        </Card.Body>
      </Card>
    </Box>
  )
}
