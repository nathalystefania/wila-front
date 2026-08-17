import { CarbonResponse, EstadoDesgaste } from '@models/catalogo.models';

export type WearNumericValue = number | string | null | undefined;

export interface WearCalculation {
  porcentaje: number;

  estado: Exclude<EstadoDesgaste, 'sin-datos'>;

  desgasteMm: number;

  porcentajeAdvertencia: number | null;

  porcentajeCritico: number | null;
}

/**
 * Calcula el porcentaje de desgaste de un carbón
 * y su estado respecto a los umbrales configurados.
 *
 * IMPORTANTE:
 * PARCHE TEMPORAL mientras backend no tenga
 * la fórmula definitiva entregada por cliente.
 *
 * Actualmente telemetria.desgaste llega con
 * signo negativo desde el entorno simulado,
 * por lo que usamos Math.abs().
 */
export function calcularDesgasteCarbon(
  carbon: CarbonResponse,
  desgasteActual: WearNumericValue,
): WearCalculation | null {
  const largoInicial = convertirNumero(carbon.largo_inicial);

  const largoPrealarma = convertirNumero(carbon.largo_prealarma);

  const largoAlarma = convertirNumero(carbon.largo_alarma);

  const desgasteOriginal = convertirNumero(desgasteActual);

  if (largoInicial === null || largoInicial <= 0 || desgasteOriginal === null) {
    return null;
  }

  /*
   * TODO:
   * Eliminar Math.abs() cuando backend
   * implemente la fórmula definitiva.
   */
  const desgasteMm = Math.abs(desgasteOriginal);

  const porcentaje = limitarPorcentaje((desgasteMm / largoInicial) * 100);

  const porcentajeAdvertencia =
    largoPrealarma === null
      ? null
      : limitarPorcentaje(((largoInicial - largoPrealarma) / largoInicial) * 100);

  const porcentajeCritico =
    largoAlarma === null
      ? null
      : limitarPorcentaje(((largoInicial - largoAlarma) / largoInicial) * 100);

  let estado: WearCalculation['estado'] = 'normal';

  if (porcentajeCritico !== null && porcentaje >= porcentajeCritico) {
    estado = 'critico';
  } else if (porcentajeAdvertencia !== null && porcentaje >= porcentajeAdvertencia) {
    estado = 'advertencia';
  }

  return {
    porcentaje,
    estado,
    desgasteMm,
    porcentajeAdvertencia,
    porcentajeCritico,
  };
}

/**
 * Obtiene el peor estado de desgaste
 * dentro de un conjunto de carbones.
 */
export function obtenerEstadoDesgaste(
  desgastes: Array<{
    estado: EstadoDesgaste;
  }>,
): EstadoDesgaste {
  if (!desgastes.length) {
    return 'sin-datos';
  }

  if (desgastes.some((desgaste) => desgaste.estado === 'critico')) {
    return 'critico';
  }

  if (desgastes.some((desgaste) => desgaste.estado === 'advertencia')) {
    return 'advertencia';
  }

  if (desgastes.some((desgaste) => desgaste.estado === 'normal')) {
    return 'normal';
  }

  return 'sin-datos';
}

function convertirNumero(valor: WearNumericValue): number | null {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }

  const numero = typeof valor === 'number' ? valor : Number(String(valor).trim().replace(',', '.'));

  return Number.isFinite(numero) ? numero : null;
}

function limitarPorcentaje(porcentaje: number): number {
  return Math.min(100, Math.max(0, porcentaje));
}
