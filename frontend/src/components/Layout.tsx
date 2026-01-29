import { Link, useLocation } from 'react-router-dom'
import { Text, Box } from '@nimbus-ds/components'
import {
  HomeIcon,
  FileIcon,
  PlusCircleIcon,
  UserIcon,
  CogIcon,
  StoreIcon,
} from '@nimbus-ds/icons'

interface LayoutProps {
  children: React.ReactNode
}

const navItems = [
  { path: '/', icon: HomeIcon, label: 'Dashboard' },
  { path: '/facturas', icon: FileIcon, label: 'Facturas' },
  { path: '/facturas/nueva', icon: PlusCircleIcon, label: 'Nueva Factura' },
  { path: '/clientes', icon: UserIcon, label: 'Clientes' },
  { path: '/ordenes-tiendanube', icon: StoreIcon, label: 'TiendaNube' },
  { path: '/configuracion', icon: CogIcon, label: 'Configuración' },
]

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="app-sidebar">
        {/* Header */}
        <div className="app-sidebar-header">
          <Box display="flex" alignItems="center" gap="3">
            <Box
              width="40px"
              height="40px"
              borderRadius="2"
              display="flex"
              alignItems="center"
              justifyContent="center"
              backgroundColor="primary-interactive"
            >
              <FileIcon size="medium" />
            </Box>
            <Box>
              <Text color="neutral-background" fontSize="base" fontWeight="bold">
                Facturación
              </Text>
              <Text color="neutral-textDisabled" fontSize="caption">
                Sistema ARCA
              </Text>
            </Box>
          </Box>
        </div>

        {/* Navigation */}
        <nav className="app-sidebar-nav">
          <Box as="ul" display="flex" flexDirection="column" gap="1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path
              const Icon = item.icon

              return (
                <li key={item.path} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  <Link
                    to={item.path}
                    className={`nav-link ${isActive ? 'active' : ''}`}
                  >
                    <Icon size="medium" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </Box>
        </nav>

        {/* Footer */}
        <div className="app-sidebar-footer">
          <Box display="flex" alignItems="center" justifyContent="center" gap="2">
            <Box
              width="8px"
              height="8px"
              borderRadius="full"
              backgroundColor="warning-surface"
            />
            <Text color="neutral-textDisabled" fontSize="caption">
              Modo Testing
            </Text>
          </Box>
        </div>
      </aside>

      {/* Main content */}
      <main className="app-main">
        {children}
      </main>
    </div>
  )
}
