import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Edit2, Trash2, X, Search, Users } from 'lucide-react'
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

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ClienteCreate>()

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
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          Nuevo Cliente
        </button>
      </div>

      {/* Búsqueda */}
      <div className="card mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            className="input pl-10"
            placeholder="Buscar por razón social o CUIT..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="card">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : data?.items.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">Razón Social</th>
                    <th className="table-header">CUIT</th>
                    <th className="table-header">Condición IVA</th>
                    <th className="table-header">Email</th>
                    <th className="table-header">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.items.map((cliente) => (
                    <tr key={cliente.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">{cliente.razon_social}</td>
                      <td className="table-cell font-mono">{formatCuit(cliente.cuit)}</td>
                      <td className="table-cell">
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                          {cliente.condicion_iva}
                        </span>
                      </td>
                      <td className="table-cell text-gray-500">{cliente.email || '-'}</td>
                      <td className="table-cell">
                        <div className="flex gap-2">
                          <button
                            className="p-1 text-gray-500 hover:text-primary-600"
                            onClick={() => openModal(cliente)}
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            className="p-1 text-gray-500 hover:text-red-600"
                            onClick={() => handleDelete(cliente)}
                            title="Eliminar"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500">
                Mostrando {page * limit + 1} - {Math.min((page + 1) * limit, data.total)} de {data.total}
              </p>
              <div className="flex gap-2">
                <button
                  className="btn-secondary"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Anterior
                </button>
                <button
                  className="btn-secondary"
                  disabled={(page + 1) * limit >= data.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <Users className="mx-auto text-gray-300" size={48} />
            <p className="text-gray-500 mt-4">No hay clientes</p>
            <button onClick={() => openModal()} className="btn-primary mt-4">
              Agregar primer cliente
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h2>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
              <div>
                <label className="label">Razón Social *</label>
                <input
                  type="text"
                  className="input"
                  {...register('razon_social', { required: 'Campo requerido' })}
                />
                {errors.razon_social && (
                  <p className="text-red-500 text-sm mt-1">{errors.razon_social.message}</p>
                )}
              </div>

              <div>
                <label className="label">CUIT *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="XX-XXXXXXXX-X"
                  {...register('cuit', {
                    required: 'Campo requerido',
                    pattern: {
                      value: /^[\d-]{11,13}$/,
                      message: 'CUIT inválido',
                    },
                  })}
                  disabled={!!editingCliente}
                />
                {errors.cuit && (
                  <p className="text-red-500 text-sm mt-1">{errors.cuit.message}</p>
                )}
              </div>

              <div>
                <label className="label">Condición IVA *</label>
                <select className="input" {...register('condicion_iva', { required: true })}>
                  {CONDICIONES_IVA.map((cond) => (
                    <option key={cond} value={cond}>
                      {cond}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Domicilio</label>
                <input type="text" className="input" {...register('domicilio')} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" {...register('email')} />
                </div>
                <div>
                  <label className="label">Teléfono</label>
                  <input type="text" className="input" {...register('telefono')} />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn-secondary">
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Guardando...'
                    : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
