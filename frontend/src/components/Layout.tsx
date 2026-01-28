import { Link, useLocation } from 'react-router-dom'
import { Text, Box } from '@nimbus-ds/components'
import {
  HomeIcon,
  FileIcon,
  PlusCircleIcon,
  UserIcon,
  CogIcon,
} from '@nimbus-ds/icons'

interface LayoutProps {
  children: React.ReactNode
}

const navItems = [
  { path: '/', icon: HomeIcon, label: 'Dashboard' },
  { path: '/facturas', icon: FileIcon, label: 'Facturas' },
  { path: '/facturas/nueva', icon: PlusCircleIcon, label: 'Nueva Factura' },
  { path: '/clientes', icon: UserIcon, label: 'Clientes' },
  { path: '/configuracion', icon: CogIcon, label: 'Configuración' },
]

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="app-sidebar">
        <Box padding="4" marginBottom="4">
          <Text color="neutral-background" fontSize="highlight" fontWeight="bold">
            Facturación ARCA
          </Text>
          <Text color="neutral-textDisabled" fontSize="caption">
            Sistema de emisión
          </Text>
        </Box>

        <nav>
          <Box as="ul" display="flex" flexDirection="column" gap="1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path
              const Icon = item.icon

              return (
                <li key={item.path} style={{ listStyle: 'none' }}>
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

        <Box
          position="absolute"
          bottom="0"
          left="0"
          right="0"
          padding="4"
          borderColor="neutral-surfaceHighlight"
          borderStyle="solid"
          borderTopWidth="1"
        >
          <Text color="neutral-textDisabled" fontSize="caption" textAlign="center">
            Modo Testing
          </Text>
        </Box>
      </aside>

      {/* Main content */}
      <main className="app-main">
        {children}
      </main>
    </div>
  )
}
