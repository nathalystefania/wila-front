import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, switchMap, timer, exhaustMap } from 'rxjs';

import { CatalogoService } from '@services/catalogo.service';

import {
  AlarmaApi,
  AnilloResponse,
  CarbonResponse,
  MotorCatalogo,
  MotorDashboardRow,
  TelemetriaApi,
} from '@models/catalogo.models';

interface DashboardApiData {
  motores: MotorCatalogo[];
  anillos: AnilloResponse[];
  carbones: CarbonResponse[];
  telemetria: TelemetriaApi[];
  alarmas: AlarmaApi[];
}

type ValorNumerico = number | string | null | undefined;

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly catalogoService = inject(CatalogoService);

  /**
   * Actualiza toda la tabla periódicamente.
   *
   * También vuelve a consultar motores, anillos
   * y carbones, para que una configuración nueva
   * pueda aparecer sin recargar la aplicación.
   */
  getMotoresConfiguradosTiempoReal(
    empresaId: string,
    intervaloMs = 15000,
  ): Observable<MotorDashboardRow[]> {
    return forkJoin({
      motores: this.catalogoService.getMotoresByEmpresaDivision(empresaId),

      anillos: this.catalogoService.getAnillos(),

      carbones: this.catalogoService.getCarbones(),
    }).pipe(
      switchMap((estructura) =>
        timer(0, intervaloMs).pipe(
            exhaustMap(() =>
            forkJoin({
              telemetria: this.catalogoService.getTelemetria(),

              alarmas: this.catalogoService.getAlarmasActivas(),
            }),
          ),

          map((datosDinamicos) =>
            this.construirFilas({
              ...estructura,
              ...datosDinamicos,
            }),
          ),
        ),
      ),
    );
  }

  /**
   * Versión sin polling.
   * Puede servir para pruebas.
   */
  getMotoresConfigurados(empresaId: string): Observable<MotorDashboardRow[]> {
    return forkJoin({
      motores: this.catalogoService.getMotoresByEmpresaDivision(empresaId),

      anillos: this.catalogoService.getAnillos(),

      carbones: this.catalogoService.getCarbones(),

      telemetria: this.catalogoService.getTelemetria(),

      alarmas: this.catalogoService.getAlarmasActivas(),
    }).pipe(map((data) => this.construirFilas(data)));
  }

  private construirFilas(data: DashboardApiData): MotorDashboardRow[] {
    const { motores, anillos, carbones, telemetria, alarmas } = data;

    /*
     * Relación:
     * anillo.id → anillo.motor_id
     */
    const motorIdPorAnilloId = this.crearMotorPorAnillo(anillos);

    /*
     * Relación:
     * carbon.id → motor.id
     *
     * Se obtiene mediante:
     * carbón → anillo → motor.
     */
    const motorIdPorCarbonId = this.crearMotorPorCarbon(carbones, motorIdPorAnilloId);

    /*
     * Agrupa los carbones por motor.
     *
     * También permite detectar qué motores
     * están configurados.
     */
    const carbonIdsPorMotorId = this.agruparCarbonesPorMotor(motorIdPorCarbonId);

    /*
     * Conserva una lectura por carbón:
     * la más reciente.
     */
    const ultimaLecturaPorCarbonId = this.obtenerUltimaLecturaPorCarbon(telemetria);

    /*
     * Solo se muestran motores configurados:
     *
     * motor
     * → al menos un anillo
     * → al menos un carbón.
     */
    const motoresConfigurados = motores.filter((motor) => {
      const motorId = this.normalizarId(motor.id);

      const carbonIds = carbonIdsPorMotorId.get(motorId);

      return Boolean(carbonIds && carbonIds.size > 0);
    });

    return motoresConfigurados
      .map((motor) => {
        const motorId = this.normalizarId(motor.id);

        const carbonIdsMotor = carbonIdsPorMotorId.get(motorId) ?? new Set<string>();

        const lecturasMotor = this.obtenerLecturasMotor(carbonIdsMotor, ultimaLecturaPorCarbonId);

        /*
         * Las alarmas se relacionan por carbón,
         * no solamente por alarma.motor_id.
         *
         * Esto asegura que cada alarma quede
         * asociada al motor dueño del carbón.
         */
        const alarmasMotor = alarmas.filter((alarma) =>
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

          promedioDesgaste: this.calcularPromedio(lecturasMotor.map((lectura) => lectura.desgaste)),

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
}
