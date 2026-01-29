import { Routes, Route, Navigate } from 'react-router-dom'
import { useAppContext } from './contexts/AppContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Facturas from './pages/Facturas'
import NuevaFactura from './pages/NuevaFactura'
import Clientes from './pages/Clientes'
import Configuracion from './pages/Configuracion'
import OrdenesTiendaNube from './pages/OrdenesTiendaNube'

function App() {
  const { isEmbedded } = useAppContext()

  // Modo Iframe (dentro de TiendaNube Admin)
  // Solo muestra la página de Órdenes de TiendaNube sin sidebar
  if (isEmbedded) {
    return (
      <div className="app-embedded">
        <Routes>
          <Route path="/" element={<OrdenesTiendaNube />} />
          <Route path="/ordenes-tiendanube" element={<OrdenesTiendaNube />} />
          <Route path="/configuracion" element={<Configuracion />} />
          <Route path="/facturas/nueva" element={<NuevaFactura />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    )
  }

  // Modo Standalone (acceso directo)
  // Layout completo con sidebar
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/facturas" element={<Facturas />} />
        <Route path="/facturas/nueva" element={<NuevaFactura />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/ordenes-tiendanube" element={<OrdenesTiendaNube />} />
        <Route path="/configuracion" element={<Configuracion />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
