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

interface NavSection {
  title?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: { path: string; icon: React.FC<any>; label: string }[]
}

const navSections: NavSection[] = [
  {
    items: [
      { path: '/', icon: HomeIcon, label: 'Inicio' },
    ]
  },
  {
    title: 'Facturación',
    items: [
      { path: '/facturas', icon: FileIcon, label: 'Facturas' },
      { path: '/facturas/nueva', icon: PlusCircleIcon, label: 'Nueva Factura' },
      { path: '/clientes', icon: UserIcon, label: 'Clientes' },
    ]
  },
  {
    title: 'Integraciones',
    items: [
      { path: '/ordenes-tiendanube', icon: StoreIcon, label: 'TiendaNube' },
    ]
  },
]

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="app-sidebar">
        {/* Header - Logo */}
        <div className="app-sidebar-header">
          <Link to="/" style={{ textDecoration: 'none' }}>
            <Box display="flex" alignItems="center" gap="2">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="#0059d5"/>
                <path d="M8 10h16v2H8zm0 5h12v2H8zm0 5h14v2H8z" fill="white"/>
              </svg>
              <Text color="neutral-background" fontSize="highlight" fontWeight="bold">
                FactuCheco
              </Text>
            </Box>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="app-sidebar-nav">
          {navSections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="nav-section">
              {section.title && (
                <div className="nav-section-title">
                  {section.title}
                </div>
              )}
              <ul className="nav-list">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.path
                  const Icon = item.icon

                  return (
                    <li key={item.path}>
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
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer - Configuración */}
        <div className="app-sidebar-footer">
          <Link
            to="/configuracion"
            className={`nav-link ${location.pathname === '/configuracion' ? 'active' : ''}`}
          >
            <CogIcon size="medium" />
            <span>Configuración</span>
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="app-main">
        {children}
      </main>
    </div>
  )
}
