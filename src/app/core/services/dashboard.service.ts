import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, switchMap, timer, exhaustMap } from 'rxjs';

import { CatalogoService } from '@services/catalogo.service';

import {
  AlarmaApi,
  AnilloResponse,
  CarbonResponse,
  DashboardHomeData,
  EstadoDesgaste,
  MotorCatalogo,
  MotorDashboardRow,
  SensorApi,
  TelemetriaApi,
} from '@models/catalogo.models';

import { POLLING_CONFIG } from '@core/config/polling.config';
import { TelemetryStateService } from '@core/state/telemetry-state.service';

interface DashboardApiData {
  motores: MotorCatalogo[];
  anillos: AnilloResponse[];
  carbones: CarbonResponse[];
  sensores: SensorApi[];
  telemetria: TelemetriaApi[];
  alarmas: AlarmaApi[];
}

interface DesgasteCarbonCalculado {
  porcentaje: number;
  estado: Exclude<EstadoDesgaste, 'sin-datos'>;
}

type ValorNumerico = number | string | null | undefined;

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly catalogoService = inject(CatalogoService);
  private readonly pollingConfig = inject(POLLING_CONFIG);
  private readonly telemetryState = inject(TelemetryStateService);

  /**
   * Actualiza toda la tabla periódicamente.
   *
   * También vuelve a consultar motores, anillos
   * y carbones, para que una configuración nueva
   * pueda aparecer sin recargar la aplicación.
   */
  getDashboardTiempoReal(
    empresaId: string,
    intervaloMs = this.pollingConfig.dashboardMs,
  ): Observable<DashboardHomeData> {
    /*
     * Datos estructurales:
     * se consultan una vez al entrar o cambiar empresa.
     */
    return forkJoin({
      motores: this.catalogoService.getMotoresByEmpresaDivision(empresaId),

      anillos: this.catalogoService.getAnillos(),

      carbones: this.catalogoService.getCarbones(),

      sensores: this.catalogoService.getSensores(),
    }).pipe(
      switchMap((estructura) =>
        timer(0, intervaloMs).pipe(
          /*
           * Evita que un nuevo ciclo comience
           * mientras el anterior sigue activo.
           */
          exhaustMap(() =>
            forkJoin({
              telemetria: this.catalogoService.getTelemetria(),

              alarmas: this.catalogoService.getAlarmasActivas(),
            }),
          ),

          map((datosDinamicos) =>
            this.construirDashboard(empresaId, {
              ...estructura,
              ...datosDinamicos,
            }),
          ),
        ),
      ),
    );
  }

  getDashboard(empresaId: string): Observable<DashboardHomeData> {
    return forkJoin({
      motores: this.catalogoService.getMotoresByEmpresaDivision(empresaId),

      anillos: this.catalogoService.getAnillos(),

      carbones: this.catalogoService.getCarbones(),

      sensores: this.catalogoService.getSensores(),

      telemetria: this.catalogoService.getTelemetria(),

      alarmas: this.catalogoService.getAlarmasActivas(),
    }).pipe(map((data) => this.construirDashboard(empresaId, data)));
  }

  private construirDashboard(empresaId: string, data: DashboardApiData): DashboardHomeData {
    const { motores, anillos, carbones, sensores, telemetria, alarmas } = data;

    this.telemetryState.actualizarDesdeTelemetria(telemetria);

    const motorIdPorAnilloId = this.crearMotorPorAnillo(anillos);

    const motorIdPorCarbonId = this.crearMotorPorCarbon(carbones, motorIdPorAnilloId);

    const carbonIdsPorMotorId = this.agruparCarbonesPorMotor(motorIdPorCarbonId);

    const ultimaLecturaPorCarbonId = this.obtenerUltimaLecturaPorCarbon(telemetria);

    /*
     * Solo motores de la empresa seleccionada
     * que tengan anillos y carbones.
     */
    const motoresConfigurados = motores.filter((motor) => {
      const motorId = this.normalizarId(motor.id);

      const carbonIds = carbonIdsPorMotorId.get(motorId);

      return Boolean(carbonIds && carbonIds.size > 0);
    });

    /*
     * Todos los carbones pertenecientes a los
     * motores configurados de esta empresa.
     */
    const idsCarbonesEmpresa = new Set<string>();

    const carbonPorId = new Map(carbones.map((carbon) => [this.normalizarId(carbon.id), carbon]));

    for (const motor of motoresConfigurados) {
      const motorId = this.normalizarId(motor.id);

      const idsCarbonesMotor = carbonIdsPorMotorId.get(motorId);

      if (!idsCarbonesMotor) {
        continue;
      }

      for (const carbonId of idsCarbonesMotor) {
        idsCarbonesEmpresa.add(carbonId);
      }
    }

    /*
     * Aunque el endpoint traiga alarmas de todas
     * las empresas, conservamos solo las asociadas
     * a los carbones de la empresa seleccionada.
     */
    const alarmasEmpresa = alarmas.filter((alarma) =>
      idsCarbonesEmpresa.has(this.normalizarId(alarma.carbon_id)),
    );

    const totalAlarmasP2 = alarmasEmpresa.filter(
      (alarma) => this.normalizarSeveridad(alarma.severidad) === 'critica',
    ).length;

    const totalAlarmasP1 = alarmasEmpresa.filter(
      (alarma) => this.normalizarSeveridad(alarma.severidad) === 'advertencia',
    ).length;

    const alarmasRecientes = [...alarmasEmpresa]
      .sort(
        (a, b) => this.obtenerTimestamp(b.fecha_creacion) - this.obtenerTimestamp(a.fecha_creacion),
      )
      .slice(0, 10);

    const filasMotores: MotorDashboardRow[] = motoresConfigurados
      .map((motor) => {
        const motorId = this.normalizarId(motor.id);

        const carbonIdsMotor = carbonIdsPorMotorId.get(motorId) ?? new Set<string>();

        const lecturasMotor = this.obtenerLecturasMotor(carbonIdsMotor, ultimaLecturaPorCarbonId);

        const desgastesMotor = lecturasMotor
          .map((lectura) => {
            const carbon = carbonPorId.get(this.normalizarId(lectura.carbon_id));

            if (!carbon) {
              return null;
            }

            return this.calcularDesgasteCarbon(carbon, lectura.longitud);
          })
          .filter((desgaste): desgaste is DesgasteCarbonCalculado => desgaste !== null);

        const porcentajeDesgaste = this.calcularPromedio(
          desgastesMotor.map((desgaste) => desgaste.porcentaje),
        );

        const estadoDesgaste = this.obtenerEstadoDesgasteMotor(desgastesMotor);

        const porcentajesDesgasteMotor = lecturasMotor
          .map((lectura) => {
            const carbon = carbonPorId.get(this.normalizarId(lectura.carbon_id));

            if (!carbon) {
              return null;
            }

            return this.calcularPorcentajeDesgaste(carbon.largo_inicial, lectura.longitud);
          })
          .filter((porcentaje): porcentaje is number => porcentaje !== null);

        const alarmasMotor = alarmasEmpresa.filter((alarma) =>
          carbonIdsMotor.has(this.normalizarId(alarma.carbon_id)),
        );

        const alarmasCriticas = alarmasMotor.filter(
          (alarma) => this.normalizarSeveridad(alarma.severidad) === 'critica',
        ).length;

        const alarmasAdvertencia = alarmasMotor.filter(
          (alarma) => this.normalizarSeveridad(alarma.severidad) === 'advertencia',
        ).length;

        return {
          motorId: motor.id,

          codigo: motor.codigo,

          nombre: motor.nombre,

          promedioLongitud: this.calcularPromedio(lecturasMotor.map((lectura) => lectura.longitud)),

          porcentajeDesgaste,
          estadoDesgaste,

          temperaturaMaxima: this.calcularMaximo(
            lecturasMotor.map((lectura) => lectura.temperatura),
          ),

          bateriaMinima: this.calcularMinimo(
            lecturasMotor.map((lectura) => lectura.porcentaje_bateria),
          ),

          cantidadAlarmas: alarmasMotor.length,

          alarmasCriticas,
          alarmasAdvertencia,

          esCritico: alarmasCriticas > 0,

          tieneAdvertencias: alarmasAdvertencia > 0,
        };
      })
      .sort((a, b) =>
        a.codigo.localeCompare(b.codigo, undefined, {
          numeric: true,
          sensitivity: 'base',
        }),
      );

    const idsCarbonesSincronizados = new Set(
      sensores
        .map((sensor) => this.normalizarId(sensor.carbon_id_actual))
        .filter((carbonId) => Boolean(carbonId) && idsCarbonesEmpresa.has(carbonId)),
    );

    return {
      motores: filasMotores,

      alarmasRecientes,

      totalAlarmasP1,
      totalAlarmasP2,

      totalCarbones: idsCarbonesEmpresa.size,

      totalCarbonesSincronizados: idsCarbonesSincronizados.size,
    };
  }

  private crearMotorPorAnillo(anillos: AnilloResponse[]): Map<string, string> {
    const resultado = new Map<string, string>();

    for (const anillo of anillos) {
      const anilloId = this.normalizarId(anillo.id);

      const motorId = this.normalizarId(anillo.motor_id);

      if (!anilloId || !motorId) {
        continue;
      }

      resultado.set(anilloId, motorId);
    }

    return resultado;
  }

  private crearMotorPorCarbon(
    carbones: CarbonResponse[],
    motorIdPorAnilloId: Map<string, string>,
  ): Map<string, string> {
    const resultado = new Map<string, string>();

    for (const carbon of carbones) {
      const carbonId = this.normalizarId(carbon.id);

      const anilloId = this.normalizarId(carbon.anillo_id);

      const motorId = motorIdPorAnilloId.get(anilloId);

      if (!carbonId || !motorId) {
        continue;
      }

      resultado.set(carbonId, motorId);
    }

    return resultado;
  }

  private agruparCarbonesPorMotor(
    motorIdPorCarbonId: Map<string, string>,
  ): Map<string, Set<string>> {
    const resultado = new Map<string, Set<string>>();

    for (const [carbonId, motorId] of motorIdPorCarbonId) {
      const carbonIds = resultado.get(motorId) ?? new Set<string>();

      carbonIds.add(carbonId);

      resultado.set(motorId, carbonIds);
    }

    return resultado;
  }

  /**
   * Obtiene la última lectura de cada carbón.
   *
   * No retorna una sola lectura global.
   * Retorna como máximo una lectura por carbón.
   */
  private obtenerUltimaLecturaPorCarbon(telemetria: TelemetriaApi[]): Map<string, TelemetriaApi> {
    const resultado = new Map<string, TelemetriaApi>();

    for (const lectura of telemetria) {
      const carbonId = this.normalizarId(lectura.carbon_id);

      if (!carbonId) {
        continue;
      }

      const lecturaAnterior = resultado.get(carbonId);

      if (!lecturaAnterior) {
        resultado.set(carbonId, lectura);

        continue;
      }

      const fechaNueva = this.obtenerTimestamp(lectura.fecha_medicion);

      const fechaAnterior = this.obtenerTimestamp(lecturaAnterior.fecha_medicion);

      if (fechaNueva > fechaAnterior) {
        resultado.set(carbonId, lectura);
      }
    }

    return resultado;
  }

  private obtenerLecturasMotor(
    carbonIdsMotor: Set<string>,
    ultimaLecturaPorCarbonId: Map<string, TelemetriaApi>,
  ): TelemetriaApi[] {
    const resultado: TelemetriaApi[] = [];

    for (const carbonId of carbonIdsMotor) {
      const lectura = ultimaLecturaPorCarbonId.get(carbonId);

      if (lectura) {
        resultado.push(lectura);
      }
    }

    return resultado;
  }

  private calcularPromedio(valores: ValorNumerico[]): number | null {
    const numeros = this.obtenerNumerosValidos(valores);

    if (numeros.length === 0) {
      return null;
    }

    const suma = numeros.reduce((total, numero) => total + numero, 0);

    return suma / numeros.length;
  }

  private calcularMaximo(valores: ValorNumerico[]): number | null {
    const numeros = this.obtenerNumerosValidos(valores);

    if (numeros.length === 0) {
      return null;
    }

    return Math.max(...numeros);
  }

  private calcularMinimo(valores: ValorNumerico[]): number | null {
    const numeros = this.obtenerNumerosValidos(valores);

    if (numeros.length === 0) {
      return null;
    }

    return Math.min(...numeros);
  }

  private obtenerNumerosValidos(valores: ValorNumerico[]): number[] {
    return valores
      .map((valor) => {
        if (valor === null || valor === undefined || valor === '') {
          return null;
        }

        const numero =
          typeof valor === 'number' ? valor : Number(String(valor).trim().replace(',', '.'));

        return Number.isFinite(numero) ? numero : null;
      })
      .filter((valor): valor is number => valor !== null);
  }

  private obtenerTimestamp(fecha: string | null | undefined): number {
    if (!fecha) {
      return 0;
    }

    /*
     * Limita fracciones de segundo demasiado
     * largas para que Date pueda interpretarlas.
     */
    const fechaNormalizada = fecha.replace(/(\.\d{3})\d+/, '$1');

    const timestamp = new Date(fechaNormalizada).getTime();

    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  private normalizarId(valor: unknown): string {
    return String(valor ?? '').trim();
  }

  private normalizarSeveridad(valor: unknown): string {
    return String(valor ?? '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .toLowerCase();
  }

  private calcularPorcentajeDesgaste(
    largoInicial: number | string | null | undefined,
    longitudActual: number | string | null | undefined,
  ): number | null {
    const inicial = this.convertirNumero(largoInicial);

    const actual = this.convertirNumero(longitudActual);

    if (inicial === null || actual === null || inicial <= 0) {
      return null;
    }

    const porcentaje = ((inicial - actual) / inicial) * 100;

    /*
     * Evita valores menores que 0 o mayores
     * que 100 por mediciones anómalas.
     */
    return Math.min(100, Math.max(0, porcentaje));
  }

  private calcularDesgasteCarbon(
    carbon: CarbonResponse,
    longitudActual: number | string | null | undefined,
  ): DesgasteCarbonCalculado | null {
    const largoInicial = this.convertirNumero(carbon.largo_inicial);

    const largoPrealarma = this.convertirNumero(carbon.largo_prealarma);

    const largoAlarma = this.convertirNumero(carbon.largo_alarma);

    const longitud = this.convertirNumero(longitudActual);

    if (largoInicial === null || largoInicial <= 0 || longitud === null) {
      return null;
    }

    const porcentaje = this.limitarPorcentaje(((largoInicial - longitud) / largoInicial) * 100);

    const porcentajeAdvertencia =
      largoPrealarma === null
        ? null
        : this.limitarPorcentaje(((largoInicial - largoPrealarma) / largoInicial) * 100);

    const porcentajeCritico =
      largoAlarma === null
        ? null
        : this.limitarPorcentaje(((largoInicial - largoAlarma) / largoInicial) * 100);

    let estado: DesgasteCarbonCalculado['estado'] = 'normal';

    if (porcentajeCritico !== null && porcentaje >= porcentajeCritico) {
      estado = 'critico';
    } else if (porcentajeAdvertencia !== null && porcentaje >= porcentajeAdvertencia) {
      estado = 'advertencia';
    }

    return {
      porcentaje,
      estado,
    };
  }

  private convertirNumero(valor: number | string | null | undefined): number | null {
    if (valor === null || valor === undefined || valor === '') {
      return null;
    }

    const numero =
      typeof valor === 'number' ? valor : Number(String(valor).trim().replace(',', '.'));

    return Number.isFinite(numero) ? numero : null;
  }

  private limitarPorcentaje(porcentaje: number): number {
    return Math.min(100, Math.max(0, porcentaje));
  }

  private obtenerEstadoDesgasteMotor(desgastes: DesgasteCarbonCalculado[]): EstadoDesgaste {
    if (desgastes.length === 0) {
      return 'sin-datos';
    }

    if (desgastes.some((desgaste) => desgaste.estado === 'critico')) {
      return 'critico';
    }

    if (desgastes.some((desgaste) => desgaste.estado === 'advertencia')) {
      return 'advertencia';
    }

    return 'normal';
  }
}
