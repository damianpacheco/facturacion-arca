/**
 * Traductor de errores de AFIP/ARCA a mensajes amigables
 */

interface ErrorTranslation {
  pattern: RegExp
  message: string
  suggestion?: string
}

const ERROR_TRANSLATIONS: ErrorTranslation[] = [
  // Errores de documento
  {
    pattern: /DocNro.*no se encuentra registrado en los padrones/i,
    message: 'El CUIT/DNI no está registrado en AFIP',
    suggestion: 'Verificá que el número esté bien escrito o usá "Consumidor Final" si no tenés el dato.',
  },
  {
    pattern: /DocTipo.*80.*DocNro.*0/i,
    message: 'Falta el CUIT del cliente',
    suggestion: 'Para facturar con CUIT, el cliente debe tener un CUIT válido de 11 dígitos.',
  },
  {
    pattern: /CUIT.*inválido/i,
    message: 'El CUIT ingresado no es válido',
    suggestion: 'El CUIT debe tener 11 dígitos y un dígito verificador correcto.',
  },
  
  // Errores de comprobante
  {
    pattern: /CbteDesde.*debe ser.*siguiente/i,
    message: 'Error en la numeración de factura',
    suggestion: 'Hay un problema de sincronización con AFIP. Intentá de nuevo en unos segundos.',
  },
  {
    pattern: /Factura.*ya.*emitida/i,
    message: 'Esta factura ya fue emitida anteriormente',
    suggestion: 'Revisá el historial de facturas para encontrarla.',
  },
  {
    pattern: /punto de venta.*no habilitado/i,
    message: 'El punto de venta no está habilitado en AFIP',
    suggestion: 'Verificá la configuración del punto de venta en tu cuenta de AFIP.',
  },
  
  // Errores de fecha
  {
    pattern: /fecha.*anterior/i,
    message: 'La fecha de la factura no puede ser anterior a hoy',
    suggestion: 'Las facturas solo pueden emitirse con fecha actual o futura.',
  },
  {
    pattern: /fecha.*vencimiento.*CAE/i,
    message: 'El CAE está vencido',
    suggestion: 'Contactá a soporte técnico para resolver este problema.',
  },
  
  // Errores de conexión con AFIP
  {
    pattern: /timeout|tiempo.*agotado/i,
    message: 'AFIP no respondió a tiempo',
    suggestion: 'El servidor de AFIP está lento. Esperá unos minutos e intentá de nuevo.',
  },
  {
    pattern: /servicio.*no.*disponible|service.*unavailable/i,
    message: 'AFIP está temporalmente fuera de servicio',
    suggestion: 'AFIP tiene mantenimientos frecuentes. Intentá de nuevo en unos minutos.',
  },
  {
    pattern: /certificado.*expirado|certificate.*expired/i,
    message: 'El certificado de facturación venció',
    suggestion: 'Contactá a soporte para renovar el certificado de AFIP.',
  },
  
  // Errores de montos
  {
    pattern: /importe.*no.*coinc/i,
    message: 'Los montos de la factura no coinciden',
    suggestion: 'El subtotal + IVA debe ser igual al total.',
  },
  {
    pattern: /IVA.*incorrecto/i,
    message: 'El cálculo de IVA es incorrecto',
    suggestion: 'Revisá que la alícuota de IVA sea correcta para los productos.',
  },
  
  // Errores de condición IVA
  {
    pattern: /condición.*IVA.*receptor/i,
    message: 'La condición de IVA del cliente no es compatible',
    suggestion: 'Factura A es solo para Responsable Inscripto. Usá Factura B para otros.',
  },
  {
    pattern: /Responsable Inscripto.*requiere.*CUIT/i,
    message: 'Para Factura A necesitás el CUIT del cliente',
    suggestion: 'Los clientes Responsable Inscripto deben tener CUIT de 11 dígitos.',
  },
]

/**
 * Traduce un mensaje de error de AFIP a lenguaje humano
 */
export function translateAfipError(errorMessage: string): { message: string; suggestion?: string } {
  // Buscar coincidencia con los patrones conocidos
  for (const translation of ERROR_TRANSLATIONS) {
    if (translation.pattern.test(errorMessage)) {
      return {
        message: translation.message,
        suggestion: translation.suggestion,
      }
    }
  }
  
  // Si no hay coincidencia, limpiar un poco el mensaje original
  let cleanedMessage = errorMessage
  
  // Remover códigos técnicos comunes
  cleanedMessage = cleanedMessage.replace(/\(\d+\)/g, '') // (10015)
  cleanedMessage = cleanedMessage.replace(/Error:?\s*/gi, '')
  cleanedMessage = cleanedMessage.replace(/Exception:?\s*/gi, '')
  
  // Si el mensaje es muy largo, truncar
  if (cleanedMessage.length > 150) {
    cleanedMessage = cleanedMessage.substring(0, 150) + '...'
  }
  
  return {
    message: cleanedMessage.trim() || 'Ocurrió un error al procesar la factura',
    suggestion: 'Si el problema persiste, contactá a soporte técnico.',
  }
}

/**
 * Verifica si un error es de AFIP (para decidir si traducir)
 */
export function isAfipError(errorMessage: string): boolean {
  const afipIndicators = [
    /afip/i,
    /arca/i,
    /DocTipo/i,
    /DocNro/i,
    /CbteDesde/i,
    /CAE/i,
    /padrones/i,
    /punto de venta/i,
    /factura.*\d{4}-\d{8}/i,
  ]
  
  return afipIndicators.some(pattern => pattern.test(errorMessage))
}
