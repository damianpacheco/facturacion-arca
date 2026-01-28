# Facturación ARCA

Sistema de emisión de facturas electrónicas conectado a ARCA (ex AFIP) Argentina.

## Características

- Emisión de Facturas A, B y C
- Notas de Crédito A, B y C
- Gestión de clientes
- Generación de PDF con código QR según normativa
- Soporte para Responsable Inscripto y Monotributista
- Modo testing sin certificados

## Tecnologías

### Backend
- Python 3.11+
- FastAPI
- SQLAlchemy (async)
- afip.py SDK
- ReportLab (generación PDF)

### Frontend
- React 18 + TypeScript
- Vite
- TailwindCSS
- React Query
- React Hook Form

## Instalación

### Requisitos previos
- Python 3.11+
- Node.js 18+
- npm o yarn

### Backend

```bash
# Crear entorno virtual
cd backend
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Copiar configuración
cp .env.example .env

# Ejecutar servidor
uvicorn app.main:app --reload
```

El backend estará disponible en http://localhost:8000

### Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev
```

El frontend estará disponible en http://localhost:5173

## Configuración

### Variables de entorno (.env)

```env
# Modo testing (sin certificado)
ARCA_CUIT=20409378472
ARCA_PRODUCTION=false

# Modo producción (con certificado)
ARCA_CUIT=tu_cuit_real
ARCA_PRODUCTION=true
ARCA_CERT_PATH=certs/certificado.crt
ARCA_KEY_PATH=certs/clave_privada.key
```

### Datos del emisor

Configurar en `.env`:

```env
EMISOR_RAZON_SOCIAL=Tu Empresa S.A.
EMISOR_DOMICILIO=Av. Principal 123, CABA
EMISOR_CONDICION_IVA=Responsable Inscripto
EMISOR_INGRESOS_BRUTOS=123456789
EMISOR_INICIO_ACTIVIDADES=01/01/2020
```

## Modo Testing

El sistema viene configurado por defecto en modo testing, usando el CUIT de demostración de ARCA: `20409378472`.

### Configuración del Access Token

Para usar el modo testing, necesitás obtener un access_token gratuito:

1. Ir a https://app.afipsdk.com/
2. Crear una cuenta gratuita
3. Generar un Access Token
4. Configurar en `.env`:
   ```env
   ARCA_ACCESS_TOKEN=tu_access_token_aqui
   ```

En este modo:
- No se requiere certificado digital
- Las facturas no tienen validez fiscal
- Ideal para desarrollo y pruebas

## Modo Producción

Para usar el sistema en producción:

1. **Obtener certificado digital:**
   - Ingresar a ARCA con clave fiscal
   - Ir a "Administración de certificados digitales"
   - Generar CSR y descargar certificado

2. **Configurar archivos:**
   - Colocar `certificado.crt` en `backend/certs/`
   - Colocar `clave_privada.key` en `backend/certs/`

3. **Actualizar .env:**
   ```env
   ARCA_CUIT=tu_cuit
   ARCA_PRODUCTION=true
   ```

## API Endpoints

### Clientes
- `GET /api/clientes` - Listar clientes
- `POST /api/clientes` - Crear cliente
- `GET /api/clientes/{id}` - Obtener cliente
- `PUT /api/clientes/{id}` - Actualizar cliente
- `DELETE /api/clientes/{id}` - Eliminar cliente

### Facturas
- `GET /api/facturas` - Listar facturas
- `POST /api/facturas` - Emitir factura
- `GET /api/facturas/{id}` - Obtener factura
- `GET /api/facturas/{id}/pdf` - Descargar PDF

### ARCA
- `GET /api/arca/estado` - Verificar conexión
- `GET /api/arca/ultimo-comprobante` - Último número autorizado
- `GET /api/arca/tipos-comprobante` - Tipos disponibles
- `GET /api/arca/puntos-venta` - Puntos de venta habilitados

## Tipos de Comprobante

| Código | Tipo | Uso |
|--------|------|-----|
| 1 | Factura A | RI a RI |
| 3 | Nota de Crédito A | Anulación Factura A |
| 6 | Factura B | RI a CF/Exento |
| 8 | Nota de Crédito B | Anulación Factura B |
| 11 | Factura C | Monotributista |
| 13 | Nota de Crédito C | Anulación Factura C |

## Documentación API

Con el servidor corriendo, acceder a:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Licencia

MIT
