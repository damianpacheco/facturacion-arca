"""Utilidades para manejo de CUIT."""

import re


def validar_cuit(cuit: str) -> bool:
    """
    Valida el formato y dígito verificador del CUIT.

    Args:
        cuit: CUIT a validar (puede tener guiones)

    Returns:
        True si el CUIT es válido, False en caso contrario
    """
    # Eliminar guiones y espacios
    cuit_limpio = re.sub(r"[-\s]", "", cuit)

    if not cuit_limpio.isdigit() or len(cuit_limpio) != 11:
        return False

    # Validar dígito verificador
    multiplicadores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    suma = sum(int(cuit_limpio[i]) * multiplicadores[i] for i in range(10))
    resto = suma % 11

    if resto == 0:
        digito_verificador = 0
    elif resto == 1:
        return False  # CUIT inválido
    else:
        digito_verificador = 11 - resto

    return int(cuit_limpio[10]) == digito_verificador


def formatear_cuit(cuit: str) -> str:
    """
    Formatea un CUIT con guiones (XX-XXXXXXXX-X).

    Args:
        cuit: CUIT sin formato

    Returns:
        CUIT formateado con guiones
    """
    cuit_limpio = re.sub(r"[-\s]", "", cuit)
    if len(cuit_limpio) == 11:
        return f"{cuit_limpio[:2]}-{cuit_limpio[2:10]}-{cuit_limpio[10]}"
    return cuit
