import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import {
  Title,
  Text,
  Card,
  Box,
  Input,
  Select,
  Textarea,
  Button,
  Alert,
  Label,
  IconButton,
} from '@nimbus-ds/components'
import { PlusCircleIcon, TrashIcon } from '@nimbus-ds/icons'
import { getClientes, createFactura, getUltimoComprobante } from '../services/api'
import { useAppContext } from '../contexts/AppContext'
import { TIPOS_COMPROBANTE, ALICUOTAS_IVA, CONCEPTOS, type FacturaCreate } from '../types'

interface FormData {
  cliente_id: number
  tipo_comprobante: number
  concepto: number
  observaciones: string
  items: {
    descripcion: string
    cantidad: number
    precio_unitario: number
    alicuota_iva: number
  }[]
}

export default function NuevaFactura() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isEmbedded } = useAppContext()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      tipo_comprobante: 6, // Factura B por defecto
      concepto: 1,
      items: [{ descripcion: '', cantidad: 1, precio_unitario: 0, alicuota_iva: 5 }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  })

  const { data: clientes } = useQuery({
    queryKey: ['clientes', { limit: 100 }],
    queryFn: () => getClientes({ limit: 100 }),
  })

  const tipoComprobante = watch('tipo_comprobante')

  const { data: ultimoComprobante } = useQuery({
    queryKey: ['ultimo-comprobante', tipoComprobante],
    queryFn: () => getUltimoComprobante(tipoComprobante),
    enabled: !!tipoComprobante,
  })

  const mutation = useMutation({
    mutationFn: createFactura,
    onSuccess: (data) => {
      setSuccess(`Factura ${data.numero_completo} emitida correctamente. CAE: ${data.cae}`)
      queryClient.invalidateQueries({ queryKey: ['facturas'] })
      // En modo embedded, volver a las órdenes; en standalone, ir a facturas
      setTimeout(() => navigate(isEmbedded ? '/' : '/facturas'), 2000)
    },
    onError: (err: Error) => {
      setError(err.message || 'Error al emitir la factura')
    },
  })

  const items = watch('items')

  // Calcular totales
  const calcularTotales = () => {
    let subtotal = 0
    let iva = 0

    items.forEach((item) => {
      const itemSubtotal = (item.cantidad || 0) * (item.precio_unitario || 0)
      subtotal += itemSubtotal

      const alicuota = ALICUOTAS_IVA.find((a) => a.codigo === item.alicuota_iva)
      if (alicuota) {
        iva += itemSubtotal * (alicuota.porcentaje / 100)
      }
    })

    return { subtotal, iva, total: subtotal + iva }
  }

  const totales = calcularTotales()

  const onSubmit = (data: FormData) => {
    setError(null)
    setSuccess(null)

    const facturaData: FacturaCreate = {
      cliente_id: Number(data.cliente_id),
      tipo_comprobante: Number(data.tipo_comprobante),
      concepto: Number(data.concepto),
      observaciones: data.observaciones || undefined,
      items: data.items.map((item) => ({
        descripcion: item.descripcion,
        cantidad: Number(item.cantidad),
        precio_unitario: Number(item.precio_unitario),
        alicuota_iva: Number(item.alicuota_iva),
      })),
    }

    mutation.mutate(facturaData)
  }

  // Determinar si discrimina IVA
  const discriminaIva = [1, 2, 3, 6, 7, 8].includes(Number(tipoComprobante))

  return (
    <>
      <header className="tn-page-header">
        <div className="tn-page-header-left">
          {isEmbedded && (
            <Link to="/" className="tn-back-button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Volver
            </Link>
          )}
          <h1 className="tn-page-title">Nueva Factura</h1>
        </div>
      </header>

      <div className="tn-page-content">
      <Box display="flex" flexDirection="column" gap="6">

      {error && (
        <Alert appearance="danger" title="Error" onRemove={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert appearance="success" title="Éxito" onRemove={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <Box display="flex" gap="6" flexDirection={{ xs: 'column', lg: 'row' }}>
          {/* Columna izquierda - Datos del comprobante */}
          <Box flex="2" display="flex" flexDirection="column" gap="6">
            {/* Datos básicos */}
            <Card>
              <Card.Header>
                <Title as="h3">Datos del Comprobante</Title>
              </Card.Header>
              <Card.Body>
                <Box display="flex" flexWrap="wrap" gap="4">
                  <Box flex="1" minWidth="200px">
                    <Label htmlFor="tipo_comprobante">Tipo de Comprobante</Label>
                    <Controller
                      name="tipo_comprobante"
                      control={control}
                      render={({ field }) => (
                        <Select
                          id="tipo_comprobante"
                          name={field.name}
                          value={String(field.value)}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        >
                          {TIPOS_COMPROBANTE.map((tipo) => (
                            <Select.Option key={tipo.codigo} label={tipo.nombre} value={String(tipo.codigo)} />
                          ))}
                        </Select>
                      )}
                    />
                  </Box>

                  <Box flex="1" minWidth="200px">
                    <Label htmlFor="proximo_numero">Próximo Número</Label>
                    <Input
                      id="proximo_numero"
                      type="text"
                      value={ultimoComprobante ? `0001-${String(ultimoComprobante.ultimo_numero + 1).padStart(8, '0')}` : 'Cargando...'}
                      disabled
                    />
                  </Box>

                  <Box flex="1" minWidth="200px">
                    <Label htmlFor="cliente_id">Cliente</Label>
                    <Controller
                      name="cliente_id"
                      control={control}
                      rules={{ required: 'Seleccione un cliente' }}
                      render={({ field }) => (
                        <Select
                          id="cliente_id"
                          name={field.name}
                          value={String(field.value || '')}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : '')}
                          appearance={errors.cliente_id ? 'danger' : undefined}
                        >
                          <Select.Option label="Seleccionar cliente..." value="" />
                          {clientes?.items.map((cliente) => (
                            <Select.Option key={cliente.id} label={`${cliente.razon_social} (${cliente.cuit})`} value={String(cliente.id)} />
                          ))}
                        </Select>
                      )}
                    />
                    {errors.cliente_id && (
                      <Text fontSize="caption" color="danger-textLow">
                        {errors.cliente_id.message}
                      </Text>
                    )}
                  </Box>

                  <Box flex="1" minWidth="200px">
                    <Label htmlFor="concepto">Concepto</Label>
                    <Controller
                      name="concepto"
                      control={control}
                      render={({ field }) => (
                        <Select
                          id="concepto"
                          name={field.name}
                          value={String(field.value)}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        >
                          {CONCEPTOS.map((concepto) => (
                            <Select.Option key={concepto.codigo} label={concepto.nombre} value={String(concepto.codigo)} />
                          ))}
                        </Select>
                      )}
                    />
                  </Box>
                </Box>
              </Card.Body>
            </Card>

            {/* Items */}
            <Card>
              <Card.Header>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Title as="h3">Detalle</Title>
                  <Button
                    type="button"
                    appearance="neutral"
                    onClick={() => append({ descripcion: '', cantidad: 1, precio_unitario: 0, alicuota_iva: 5 })}
                  >
                    <PlusCircleIcon size="small" />
                    Agregar ítem
                  </Button>
                </Box>
              </Card.Header>
              <Card.Body>
                <Box display="flex" flexDirection="column" gap="4">
                  {fields.map((field, index) => (
                    <Box
                      key={field.id}
                      padding="4"
                      backgroundColor="neutral-surface"
                      borderRadius="2"
                      display="flex"
                      gap="3"
                      alignItems="flex-start"
                      flexWrap="wrap"
                    >
                      <Box flex="1" minWidth="200px">
                        <Label htmlFor={`items.${index}.descripcion`}>Descripción</Label>
                        <Input
                          id={`items.${index}.descripcion`}
                          type="text"
                          placeholder="Producto o servicio"
                          {...register(`items.${index}.descripcion`, { required: true })}
                        />
                      </Box>
                      <Box width="100px">
                        <Label htmlFor={`items.${index}.cantidad`}>Cantidad</Label>
                        <Input
                          id={`items.${index}.cantidad`}
                          type="number"
                          step="0.01"
                          min="0.01"
                          {...register(`items.${index}.cantidad`, { required: true, min: 0.01 })}
                        />
                      </Box>
                      <Box width="120px">
                        <Label htmlFor={`items.${index}.precio_unitario`}>Precio Unit.</Label>
                        <Input
                          id={`items.${index}.precio_unitario`}
                          type="number"
                          step="0.01"
                          min="0"
                          {...register(`items.${index}.precio_unitario`, { required: true, min: 0 })}
                        />
                      </Box>
                      {discriminaIva && (
                        <Box width="120px">
                          <Label htmlFor={`items.${index}.alicuota_iva`}>IVA</Label>
                          <Controller
                            name={`items.${index}.alicuota_iva`}
                            control={control}
                            render={({ field: ivaField }) => (
                              <Select
                                id={`items.${index}.alicuota_iva`}
                                name={ivaField.name}
                                value={String(ivaField.value)}
                                onChange={(e) => ivaField.onChange(Number(e.target.value))}
                              >
                                {ALICUOTAS_IVA.map((alicuota) => (
                                  <Select.Option key={alicuota.codigo} label={alicuota.nombre} value={String(alicuota.codigo)} />
                                ))}
                              </Select>
                            )}
                          />
                        </Box>
                      )}
                      <Box paddingTop="6">
                        <IconButton
                          size="2rem"
                          source={<TrashIcon size="small" />}
                          onClick={() => fields.length > 1 && remove(index)}
                          disabled={fields.length === 1}
                        />
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Card.Body>
            </Card>

            {/* Observaciones */}
            <Card>
              <Card.Body>
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  placeholder="Observaciones opcionales..."
                  lines={3}
                  {...register('observaciones')}
                />
              </Card.Body>
            </Card>
          </Box>

          {/* Columna derecha - Totales */}
          <Box flex="1" minWidth="280px">
            <Card>
              <Card.Header>
                <Title as="h3">Resumen</Title>
              </Card.Header>
              <Card.Body>
                <Box display="flex" flexDirection="column" gap="3">
                  {discriminaIva && (
                    <>
                      <Box display="flex" justifyContent="space-between">
                        <Text color="neutral-textLow">Subtotal Neto</Text>
                        <Text fontWeight="medium">
                          ${totales.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </Text>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Text color="neutral-textLow">IVA</Text>
                        <Text fontWeight="medium">
                          ${totales.iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </Text>
                      </Box>
                      <Box
                        borderTopWidth="1"
                        borderColor="neutral-surfaceHighlight"
                        borderStyle="solid"
                        paddingTop="3"
                      />
                    </>
                  )}
                  <Box display="flex" justifyContent="space-between">
                    <Text fontWeight="bold" fontSize="highlight">Total</Text>
                    <Text fontWeight="bold" fontSize="highlight" color="primary-interactive">
                      ${totales.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </Text>
                  </Box>
                </Box>

                <Box marginTop="6">
                  <Button
                    type="submit"
                    appearance="primary"
                    disabled={mutation.isPending}
                  >
                    {mutation.isPending ? 'Emitiendo...' : 'Emitir Factura'}
                  </Button>
                </Box>

                <Box marginTop="4">
                  <Text fontSize="caption" color="neutral-textLow" textAlign="center">
                    La factura se enviará a ARCA para obtener el CAE
                  </Text>
                </Box>
              </Card.Body>
            </Card>
          </Box>
        </Box>
      </form>
    </Box>
      </div>
    </>
  )
}
