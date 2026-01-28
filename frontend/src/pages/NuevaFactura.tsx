import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { Plus, Trash2, AlertCircle, CheckCircle } from 'lucide-react'
import { getClientes, createFactura, getUltimoComprobante } from '../services/api'
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
      setTimeout(() => navigate('/facturas'), 2000)
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
    <div>
      <h1 className="text-2xl font-bold mb-6">Nueva Factura</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <CheckCircle size={20} />
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna izquierda - Datos del comprobante */}
          <div className="lg:col-span-2 space-y-6">
            {/* Datos básicos */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Datos del Comprobante</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Tipo de Comprobante</label>
                  <select
                    className="input"
                    {...register('tipo_comprobante', { required: true })}
                  >
                    {TIPOS_COMPROBANTE.map((tipo) => (
                      <option key={tipo.codigo} value={tipo.codigo}>
                        {tipo.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Próximo Número</label>
                  <input
                    type="text"
                    className="input bg-gray-50"
                    value={ultimoComprobante ? `0001-${String(ultimoComprobante.ultimo_numero + 1).padStart(8, '0')}` : 'Cargando...'}
                    disabled
                  />
                </div>

                <div>
                  <label className="label">Cliente</label>
                  <select
                    className="input"
                    {...register('cliente_id', { required: 'Seleccione un cliente' })}
                  >
                    <option value="">Seleccionar cliente...</option>
                    {clientes?.items.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.razon_social} ({cliente.cuit})
                      </option>
                    ))}
                  </select>
                  {errors.cliente_id && (
                    <p className="text-red-500 text-sm mt-1">{errors.cliente_id.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">Concepto</label>
                  <select className="input" {...register('concepto')}>
                    {CONCEPTOS.map((concepto) => (
                      <option key={concepto.codigo} value={concepto.codigo}>
                        {concepto.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="card">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Detalle</h2>
                <button
                  type="button"
                  className="btn-secondary flex items-center gap-1 text-sm"
                  onClick={() => append({ descripcion: '', cantidad: 1, precio_unitario: 0, alicuota_iva: 5 })}
                >
                  <Plus size={16} />
                  Agregar ítem
                </button>
              </div>

              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-3 items-start p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <label className="label">Descripción</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="Producto o servicio"
                        {...register(`items.${index}.descripcion`, { required: true })}
                      />
                    </div>
                    <div className="w-24">
                      <label className="label">Cantidad</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="input"
                        {...register(`items.${index}.cantidad`, { required: true, min: 0.01 })}
                      />
                    </div>
                    <div className="w-32">
                      <label className="label">Precio Unit.</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input"
                        {...register(`items.${index}.precio_unitario`, { required: true, min: 0 })}
                      />
                    </div>
                    {discriminaIva && (
                      <div className="w-28">
                        <label className="label">IVA</label>
                        <select className="input" {...register(`items.${index}.alicuota_iva`)}>
                          {ALICUOTAS_IVA.map((alicuota) => (
                            <option key={alicuota.codigo} value={alicuota.codigo}>
                              {alicuota.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="pt-6">
                      <button
                        type="button"
                        className="p-2 text-red-500 hover:bg-red-50 rounded"
                        onClick={() => fields.length > 1 && remove(index)}
                        disabled={fields.length === 1}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Observaciones */}
            <div className="card">
              <label className="label">Observaciones</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Observaciones opcionales..."
                {...register('observaciones')}
              />
            </div>
          </div>

          {/* Columna derecha - Totales */}
          <div>
            <div className="card sticky top-8">
              <h2 className="text-lg font-semibold mb-4">Resumen</h2>

              <div className="space-y-3">
                {discriminaIva && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal Neto</span>
                      <span className="font-medium">
                        ${totales.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">IVA</span>
                      <span className="font-medium">
                        ${totales.iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <hr />
                  </>
                )}
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-primary-600">
                    ${totales.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary w-full mt-6"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? 'Emitiendo...' : 'Emitir Factura'}
              </button>

              <p className="text-xs text-gray-500 text-center mt-4">
                La factura se enviará a ARCA para obtener el CAE
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
