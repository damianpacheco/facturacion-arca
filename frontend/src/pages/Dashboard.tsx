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
} from '@nimbus-ds/components'
import { FileIcon, UserIcon, MoneyIcon, PlusCircleIcon } from '@nimbus-ds/icons'
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
      <Title as="h1">Dashboard</Title>

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
        <Box flex="1" minWidth="200px">
          <Card>
            <Card.Body>
              <Box display="flex" alignItems="center" gap="4">
                <Box
                  padding="3"
                  backgroundColor="primary-surface"
                  borderRadius="2"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <FileIcon size="medium" />
                </Box>
                <Box>
                  <Text fontSize="caption" color="neutral-textLow">
                    Facturas Emitidas
                  </Text>
                  <Title as="h2">{facturas?.total || 0}</Title>
                </Box>
              </Box>
            </Card.Body>
          </Card>
        </Box>

        <Box flex="1" minWidth="200px">
          <Card>
            <Card.Body>
              <Box display="flex" alignItems="center" gap="4">
                <Box
                  padding="3"
                  backgroundColor="success-surface"
                  borderRadius="2"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <MoneyIcon size="medium" />
                </Box>
                <Box>
                  <Text fontSize="caption" color="neutral-textLow">
                    Total Facturado
                  </Text>
                  <Title as="h2">
                    ${totalMes.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </Title>
                </Box>
              </Box>
            </Card.Body>
          </Card>
        </Box>

        <Box flex="1" minWidth="200px">
          <Card>
            <Card.Body>
              <Box display="flex" alignItems="center" gap="4">
                <Box
                  padding="3"
                  backgroundColor="primary-surface"
                  borderRadius="2"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <UserIcon size="medium" />
                </Box>
                <Box>
                  <Text fontSize="caption" color="neutral-textLow">
                    Clientes
                  </Text>
                  <Title as="h2">{clientes?.total || 0}</Title>
                </Box>
              </Box>
            </Card.Body>
          </Card>
        </Box>
      </Box>

      {/* Acciones rápidas */}
      <Box display="flex" gap="4" flexWrap="wrap">
        <Box flex="1" minWidth="250px">
          <Link to="/facturas/nueva" style={{ textDecoration: 'none' }}>
            <Card>
              <Card.Body>
                <Box display="flex" alignItems="center" gap="4">
                  <Box
                    padding="4"
                    backgroundColor="primary-surface"
                    borderRadius="2"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <PlusCircleIcon size="large" />
                  </Box>
                  <Box>
                    <Text fontWeight="bold" fontSize="base">
                      Nueva Factura
                    </Text>
                    <Text color="neutral-textLow" fontSize="caption">
                      Emitir un nuevo comprobante
                    </Text>
                  </Box>
                </Box>
              </Card.Body>
            </Card>
          </Link>
        </Box>

        <Box flex="1" minWidth="250px">
          <Link to="/clientes" style={{ textDecoration: 'none' }}>
            <Card>
              <Card.Body>
                <Box display="flex" alignItems="center" gap="4">
                  <Box
                    padding="4"
                    backgroundColor="primary-surface"
                    borderRadius="2"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <UserIcon size="large" />
                  </Box>
                  <Box>
                    <Text fontWeight="bold" fontSize="base">
                      Gestionar Clientes
                    </Text>
                    <Text color="neutral-textLow" fontSize="caption">
                      Agregar o editar clientes
                    </Text>
                  </Box>
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
            <Link to="/facturas" style={{ textDecoration: 'none' }}>
              <Text color="primary-interactive" fontSize="caption">
                Ver todas
              </Text>
            </Link>
          </Box>
        </Card.Header>
        <Card.Body>
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
                      <Text>
                        {format(new Date(factura.fecha), 'dd/MM/yyyy', { locale: es })}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text>
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
            <Box padding="8" display="flex" justifyContent="center">
              <Text color="neutral-textLow">No hay facturas emitidas aún</Text>
            </Box>
          )}
        </Card.Body>
      </Card>
    </Box>
  )
}
