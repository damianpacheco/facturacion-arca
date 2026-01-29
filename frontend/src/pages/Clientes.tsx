import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
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
  Label,
} from '@nimbus-ds/components'
import {
  PlusCircleIcon,
  PencilIcon,
  TrashIcon,
  SearchIcon,
  UserIcon,
} from '@nimbus-ds/icons'
import { getClientes, createCliente, updateCliente, deleteCliente } from '../services/api'
import { CONDICIONES_IVA, type ClienteCreate, type Cliente } from '../types'

export default function Clientes() {
  const queryClient = useQueryClient()
  const [busqueda, setBusqueda] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [page, setPage] = useState(0)
  const limit = 20

  const { data, isLoading } = useQuery({
    queryKey: ['clientes', { skip: page * limit, limit, buscar: busqueda || undefined }],
    queryFn: () => getClientes({ skip: page * limit, limit, buscar: busqueda || undefined }),
  })

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<ClienteCreate>()

  const createMutation = useMutation({
    mutationFn: createCliente,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      closeModal()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ClienteCreate> }) =>
      updateCliente(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCliente,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
    },
  })

  const openModal = (cliente?: Cliente) => {
    if (cliente) {
      setEditingCliente(cliente)
      reset({
        razon_social: cliente.razon_social,
        cuit: cliente.cuit,
        condicion_iva: cliente.condicion_iva,
        domicilio: cliente.domicilio || '',
        email: cliente.email || '',
        telefono: cliente.telefono || '',
      })
    } else {
      setEditingCliente(null)
      reset({
        razon_social: '',
        cuit: '',
        condicion_iva: 'Consumidor Final',
        domicilio: '',
        email: '',
        telefono: '',
      })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingCliente(null)
    reset()
  }

  const onSubmit = (data: ClienteCreate) => {
    if (editingCliente) {
      updateMutation.mutate({ id: editingCliente.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleDelete = (cliente: Cliente) => {
    if (confirm(`¿Eliminar cliente "${cliente.razon_social}"?`)) {
      deleteMutation.mutate(cliente.id)
    }
  }

  const formatCuit = (cuit: string) => {
    const clean = cuit.replace(/\D/g, '')
    if (clean.length === 11) {
      return `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`
    }
    return cuit
  }

  return (
    <Box display="flex" flexDirection="column" gap="6">
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Title as="h1">Clientes</Title>
          <Box marginTop="1">
            <Text color="neutral-textLow">
              Administra tu cartera de clientes
            </Text>
          </Box>
        </Box>
        <Button appearance="primary" onClick={() => openModal()}>
          <PlusCircleIcon size="small" />
          Nuevo Cliente
        </Button>
      </Box>

      {/* Búsqueda */}
      <Card>
        <Card.Body>
          <Box maxWidth="400px">
            <Input
              type="text"
              placeholder="Buscar por razón social o CUIT..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              append={<SearchIcon size="small" />}
            />
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
                    <Table.Cell as="th">Razón Social</Table.Cell>
                    <Table.Cell as="th">CUIT</Table.Cell>
                    <Table.Cell as="th">Condición IVA</Table.Cell>
                    <Table.Cell as="th">Email</Table.Cell>
                    <Table.Cell as="th">Acciones</Table.Cell>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {data.items.map((cliente) => (
                    <Table.Row key={cliente.id}>
                      <Table.Cell>
                        <Text fontWeight="medium">{cliente.razon_social}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontSize="caption">{formatCuit(cliente.cuit)}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Tag appearance="neutral">{cliente.condicion_iva}</Tag>
                      </Table.Cell>
                      <Table.Cell>
                        <Text color="neutral-textLow">{cliente.email || '-'}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Box display="flex" gap="2">
                          <IconButton
                            size="2rem"
                            source={<PencilIcon size="small" />}
                            onClick={() => openModal(cliente)}
                          />
                          <IconButton
                            size="2rem"
                            source={<TrashIcon size="small" />}
                            onClick={() => handleDelete(cliente)}
                          />
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
            <Box className="empty-state">
              <UserIcon size="large" className="empty-state-icon" />
              <Box marginTop="2">
                <Text fontWeight="medium">No hay clientes</Text>
              </Box>
              <Text color="neutral-textLow" fontSize="caption">
                Agrega clientes para facturar más rápido
              </Text>
              <Box marginTop="4">
                <Button appearance="primary" onClick={() => openModal()}>
                  <PlusCircleIcon size="small" />
                  Agregar primer cliente
                </Button>
              </Box>
            </Box>
          )}
        </Card.Body>
      </Card>

      {/* Modal */}
      {showModal && (
        <Modal open onDismiss={closeModal}>
          <Modal.Header
            title={editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
          />
          <Modal.Body>
            <form id="cliente-form" onSubmit={handleSubmit(onSubmit)}>
              <Box display="flex" flexDirection="column" gap="4">
                <Box>
                  <Label htmlFor="razon_social">Razón Social *</Label>
                  <Input
                    id="razon_social"
                    type="text"
                    {...register('razon_social', { required: 'Campo requerido' })}
                    appearance={errors.razon_social ? 'danger' : undefined}
                  />
                  {errors.razon_social && (
                    <Text fontSize="caption" color="danger-textLow">
                      {errors.razon_social.message}
                    </Text>
                  )}
                </Box>

                <Box>
                  <Label htmlFor="cuit">CUIT *</Label>
                  <Input
                    id="cuit"
                    type="text"
                    placeholder="XX-XXXXXXXX-X"
                    {...register('cuit', {
                      required: 'Campo requerido',
                      pattern: {
                        value: /^[\d-]{11,13}$/,
                        message: 'CUIT inválido',
                      },
                    })}
                    disabled={!!editingCliente}
                    appearance={errors.cuit ? 'danger' : undefined}
                  />
                  {errors.cuit && (
                    <Text fontSize="caption" color="danger-textLow">
                      {errors.cuit.message}
                    </Text>
                  )}
                </Box>

                <Box>
                  <Label htmlFor="condicion_iva">Condición IVA *</Label>
                  <Controller
                    name="condicion_iva"
                    control={control}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <Select
                        id="condicion_iva"
                        name={field.name}
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                      >
                        {CONDICIONES_IVA.map((cond) => (
                          <Select.Option key={cond} label={cond} value={cond} />
                        ))}
                      </Select>
                    )}
                  />
                </Box>

                <Box>
                  <Label htmlFor="domicilio">Domicilio</Label>
                  <Input
                    id="domicilio"
                    type="text"
                    {...register('domicilio')}
                  />
                </Box>

                <Box display="flex" gap="4">
                  <Box flex="1">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      {...register('email')}
                    />
                  </Box>
                  <Box flex="1">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      type="text"
                      {...register('telefono')}
                    />
                  </Box>
                </Box>
              </Box>
            </form>
          </Modal.Body>
          <Modal.Footer>
            <Button appearance="neutral" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="cliente-form"
              appearance="primary"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Guardando...'
                : 'Guardar'}
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </Box>
  )
}
