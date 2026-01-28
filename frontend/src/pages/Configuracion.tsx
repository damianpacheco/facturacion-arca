import { useQuery } from '@tanstack/react-query'
import {
  Title,
  Text,
  Card,
  Box,
  Table,
  Tag,
  Alert,
  Spinner,
} from '@nimbus-ds/components'
import {
  CogIcon,
  FileIcon,
  LockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@nimbus-ds/icons'
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
    <Box display="flex" flexDirection="column" gap="6">
      <Title as="h1">Configuración</Title>

      {/* Estado de conexión ARCA */}
      <Card>
        <Card.Header>
          <Box display="flex" alignItems="center" gap="3">
            <CogIcon size="medium" />
            <Title as="h3">Conexión con ARCA</Title>
          </Box>
        </Card.Header>
        <Card.Body>
          {loadingEstado ? (
            <Box display="flex" alignItems="center" gap="2">
              <Spinner size="small" />
              <Text color="neutral-textLow">Verificando conexión...</Text>
            </Box>
          ) : estadoArca?.estado === 'conectado' ? (
            <Box display="flex" flexDirection="column" gap="4">
              <Box display="flex" alignItems="center" gap="2">
                <CheckCircleIcon size="medium" />
                <Text fontWeight="medium" color="success-textLow">
                  Conectado correctamente
                </Text>
              </Box>

              <Box
                padding="4"
                backgroundColor="neutral-surface"
                borderRadius="2"
                display="flex"
                gap="4"
                flexWrap="wrap"
              >
                <Box flex="1" minWidth="120px">
                  <Text fontSize="caption" color="neutral-textLow">Modo</Text>
                  <Text fontWeight="medium">
                    {estadoArca.modo.charAt(0).toUpperCase() + estadoArca.modo.slice(1)}
                  </Text>
                </Box>
                <Box flex="1" minWidth="120px">
                  <Text fontSize="caption" color="neutral-textLow">CUIT</Text>
                  <Text fontWeight="medium">{estadoArca.cuit}</Text>
                </Box>
                <Box flex="1" minWidth="120px">
                  <Text fontSize="caption" color="neutral-textLow">Punto de Venta</Text>
                  <Text fontWeight="medium">{estadoArca.punto_venta}</Text>
                </Box>
              </Box>
            </Box>
          ) : (
            <Box display="flex" alignItems="center" gap="2">
              <ExclamationCircleIcon size="medium" />
              <Text color="warning-textLow">
                {estadoArca?.mensaje || 'No se pudo conectar con ARCA'}
              </Text>
            </Box>
          )}
        </Card.Body>
      </Card>

      {/* Puntos de Venta */}
      {puntosVenta && (
        <Card>
          <Card.Header>
            <Box display="flex" alignItems="center" gap="3">
              <FileIcon size="medium" />
              <Title as="h3">Puntos de Venta Habilitados</Title>
            </Box>
          </Card.Header>
          <Card.Body padding="none">
            {puntosVenta.puntos_venta?.length ? (
              <Table>
                <Table.Head>
                  <Table.Row>
                    <Table.Cell as="th">Número</Table.Cell>
                    <Table.Cell as="th">Tipo</Table.Cell>
                    <Table.Cell as="th">Estado</Table.Cell>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {(puntosVenta.puntos_venta as Array<{ Nro: number; EmisionTipo: string; Bloqueado: string }>).map((pv) => (
                    <Table.Row key={pv.Nro}>
                      <Table.Cell>
                        <Text fontSize="caption">{String(pv.Nro).padStart(4, '0')}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text>{pv.EmisionTipo}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Tag appearance={pv.Bloqueado === 'N' ? 'success' : 'danger'}>
                          {pv.Bloqueado === 'N' ? 'Activo' : 'Bloqueado'}
                        </Tag>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            ) : (
              <Box padding="4">
                <Text color="neutral-textLow">No hay puntos de venta habilitados</Text>
              </Box>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Información de certificados */}
      <Card>
        <Card.Header>
          <Box display="flex" alignItems="center" gap="3">
            <LockIcon size="medium" />
            <Title as="h3">Certificados Digitales</Title>
          </Box>
        </Card.Header>
        <Card.Body>
          <Box display="flex" flexDirection="column" gap="4">
            <Text>
              {estadoArca?.modo === 'testing' ? (
                <>
                  <Text as="span" fontWeight="medium" color="primary-interactive">
                    Modo Testing:
                  </Text>{' '}
                  Estás usando el CUIT de demostración de ARCA.
                  Las facturas emitidas no tienen validez fiscal.
                </>
              ) : (
                <>
                  <Text as="span" fontWeight="medium" color="success-textLow">
                    Modo Producción:
                  </Text>{' '}
                  Las facturas emitidas tienen validez fiscal.
                </>
              )}
            </Text>

            <Alert appearance="primary" title="Para pasar a producción necesitás:">
              <Box as="ol" display="flex" flexDirection="column" gap="1" paddingLeft="4">
                <li>
                  <Text fontSize="caption">1. Generar un certificado digital desde ARCA</Text>
                </li>
                <li>
                  <Text fontSize="caption">2. Crear una Clave Privada (.key)</Text>
                </li>
                <li>
                  <Text fontSize="caption">3. Colocar ambos archivos en la carpeta backend/certs/</Text>
                </li>
                <li>
                  <Text fontSize="caption">4. Configurar las variables de entorno en .env</Text>
                </li>
              </Box>
            </Alert>
          </Box>
        </Card.Body>
      </Card>

      {/* Tipos de comprobante disponibles */}
      {tiposComprobante && (
        <Card>
          <Card.Header>
            <Box display="flex" alignItems="center" gap="3">
              <CogIcon size="medium" />
              <Title as="h3">Tipos de Comprobante Disponibles</Title>
            </Box>
          </Card.Header>
          <Card.Body>
            <Box display="flex" gap="2" flexWrap="wrap">
              {(tiposComprobante.tipos as Array<{ Id: number; Desc: string }>)
                .filter((t) => [1, 3, 6, 8, 11, 13].includes(t.Id))
                .map((tipo) => (
                  <Box
                    key={tipo.Id}
                    padding="3"
                    backgroundColor="neutral-surface"
                    borderRadius="2"
                    minWidth="150px"
                    flex="1"
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
          </Card.Body>
        </Card>
      )}
    </Box>
  )
}
