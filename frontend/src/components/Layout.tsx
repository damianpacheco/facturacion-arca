import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  PlusCircle,
} from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/facturas', icon: FileText, label: 'Facturas' },
  { path: '/facturas/nueva', icon: PlusCircle, label: 'Nueva Factura' },
  { path: '/clientes', icon: Users, label: 'Clientes' },
  { path: '/configuracion', icon: Settings, label: 'Configuración' },
]

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold">Facturación ARCA</h1>
          <p className="text-gray-400 text-sm mt-1">Sistema de emisión</p>
        </div>

        <nav className="flex-1 px-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path
              const Icon = item.icon

              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-800">
          <p className="text-gray-400 text-xs text-center">
            Modo Testing
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
