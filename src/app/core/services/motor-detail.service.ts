import { Injectable, inject } from '@angular/core';
import { Observable, catchError, exhaustMap, forkJoin, map, of, switchMap, timer } from 'rxjs';
import { CatalogoService } from './catalogo.service';
import {
  AnilloMotorDetalle,
  EstadoBateria,
  CarbonResponse,
  CarbonTelemetriaDetalle,
  EstadoDesgaste,
  MotorCatalogo,
  MotorDetalle,
  TelemetriaApi,
  SensorApi,
} from '../models/catalogo.models';
import { POLLING_CONFIG } from '@core/config/polling.config';
import { TelemetryStateService } from '@core/state/telemetry-state.service';

type ValorNumerico = number | string | null | undefined;

interface DesgasteCalculado {
  porcentaje: number;
  estado: Exclude<EstadoDesgaste, 'sin-datos'>;
}

@Injectable({
  providedIn: 'root',
})
export class MotorDetailService {
  private readonly catalogoService = inject(CatalogoService);
  private readonly pollingConfig = inject(POLLING_CONFIG);
  private readonly telemetryState = inject(TelemetryStateService);

  // getMotorDetalle(motorId: string): Observable<MotorDetalle | null> {
  //   const motorIdNormalizado = this.normalizarId(motorId);

  //   if (!motorIdNormalizado) {
  //     return of(null);
  //   }

  //   /*
  //    * Primera etapa:
  //    * obtenemos el motor, sus anillos y sus carbones.
  //    */
  //   return forkJoin({
  //     motores: this.catalogoService.getMotoresCatalogo(),

  //     anillos: this.catalogoService.getAnillos(),

  //     carbones: this.catalogoService.getCarbones(),
  //   }).pipe(
  //     switchMap(({ motores, anillos, carbones }) => {
  //       const motor = motores.find((item) => this.normalizarId(item.id) === motorIdNormalizado);

  //       if (!motor) {
  //         return of(null);
  //       }

  //       const anillosMotor = anillos.filter(
  //         (anillo) => this.normalizarId(anillo.motor_id) === motorIdNormalizado,
  //       );

  //       const idsAnillosMotor = new Set(anillosMotor.map((anillo) => this.normalizarId(anillo.id)));

  //       const carbonesMotor = carbones.filter((carbon) =>
  //         idsAnillosMotor.has(this.normalizarId(carbon.anillo_id)),
  //       );

  //       /*
  //        * Si el motor no tiene carbones, devolvemos
  //        * el detalle estructural sin realizar
  //        * consultas innecesarias de telemetría.
  //        */
  //       if (carbonesMotor.length === 0) {
  //         return of(this.construirMotorDetalle(motor, anillosMotor, []));
  //       }

  //       /*
  //        * Segunda etapa:
  //        * una consulta de telemetría por carbón.
  //        *
  //        * Esta versión es deliberadamente sencilla
  //        * para validar el endpoint y los cálculos.
  //        */
  //       const consultasTelemetria = carbonesMotor.map((carbon) =>
  //         this.catalogoService
  //           .getTelemetriaByCarbon(carbon.id)
  //           .pipe(map((telemetria) => this.construirCarbonDetalle(carbon, telemetria))),
  //       );

  //       return forkJoin(consultasTelemetria).pipe(
  //         map((carbonesDetalle) =>
  //           this.construirMotorDetalle(motor, anillosMotor, carbonesDetalle),
  //         ),
  //       );
  //     }),
  //   );
  // }

  getMotorDetalleTiempoReal(
    motorId: string,
    intervaloMs = this.pollingConfig.motorDetailMs,
  ): Observable<MotorDetalle | null> {
    const motorIdNormalizado = this.normalizarId(motorId);

    if (!motorIdNormalizado) {
      return of(null);
    }

    /*
     * Estructura estática:
     * se consulta una sola vez.
     */
    return forkJoin({
      motores: this.catalogoService.getMotoresCatalogo(),

      anillos: this.catalogoService.getAnillos(),

      carbones: this.catalogoService.getCarbones(),

      sensores: this.catalogoService.getSensores(),
    }).pipe(
      switchMap(({ motores, anillos, carbones, sensores }) => {
        const motor = motores.find((item) => this.normalizarId(item.id) === motorIdNormalizado);

        if (!motor) {
          return of(null);
        }

        const anillosMotor = anillos.filter(
          (anillo) => this.normalizarId(anillo.motor_id) === motorIdNormalizado,
        );

        const idsAnillosMotor = new Set(anillosMotor.map((anillo) => this.normalizarId(anillo.id)));

        const carbonesMotor = carbones.filter((carbon) =>
          idsAnillosMotor.has(this.normalizarId(carbon.anillo_id)),
        );

        const sensorPorCarbonId = new Map(
          sensores
            .filter((sensor) => sensor.carbon_id_actual)
            .map((sensor) => [this.normalizarId(sensor.carbon_id_actual), sensor]),
        );

        const idsCarbonesMotor = new Set(
          carbonesMotor.map((carbon) => this.normalizarId(carbon.id)),
        );

        let ultimaTelemetriaValida: TelemetriaApi[] = [];

        /*
         * Datos dinámicos:
         * una sola petición por ciclo.
         */
        return timer(0, intervaloMs).pipe(
          exhaustMap(() =>
            this.catalogoService.getTelemetria().pipe(
              map((telemetria) => {
                ultimaTelemetriaValida = telemetria;

                return telemetria;
              }),

              catchError((error) => {
                console.error('Error temporal actualizando telemetría', error);

                return of(ultimaTelemetriaValida);
              }),
            ),
          ),

          map((telemetria) => {
            const telemetriaMotor = telemetria.filter((lectura) =>
              idsCarbonesMotor.has(this.normalizarId(lectura.carbon_id)),
            );

            this.telemetryState.actualizarDesdeTelemetria(telemetriaMotor);

            const ultimaPorCarbon = this.obtenerUltimaLecturaPorCarbon(telemetriaMotor);

            const carbonesDetalle = carbonesMotor.map((carbon) => {
              const ultima = ultimaPorCarbon.get(this.normalizarId(carbon.id)) ?? null;

              const sensor = sensorPorCarbonId.get(this.normalizarId(carbon.id)) ?? null;

              return this.construirCarbonDetalleDesdeUltima(carbon, sensor, ultima);
            });

            return this.construirMotorDetalle(motor, anillosMotor, carbonesDetalle);
          }),
        );
      }),
    );
  }

  private obtenerUltimaLecturaPorCarbon(telemetria: TelemetriaApi[]): Map<string, TelemetriaApi> {
    const resultado = new Map<string, TelemetriaApi>();

    for (const lectura of telemetria) {
      const carbonId = this.normalizarId(lectura.carbon_id);

      if (!carbonId) {
        continue;
      }

      const anterior = resultado.get(carbonId);

      if (
        !anterior ||
        this.obtenerTimestamp(lectura.fecha_medicion) >
          this.obtenerTimestamp(anterior.fecha_medicion)
      ) {
        resultado.set(carbonId, lectura);
      }
    }

    return resultado;
  }

  // private construirCarbonDetalle(
  //   carbon: CarbonResponse,
  //   telemetria: TelemetriaApi[],
  // ): CarbonTelemetriaDetalle {
  //   const lecturasOrdenadas = [...telemetria].sort(
  //     (a, b) => this.obtenerTimestamp(b.fecha_medicion) - this.obtenerTimestamp(a.fecha_medicion),
  //   );

  //   const ultimaTelemetria = lecturasOrdenadas[0] ?? null;

  //   const desgasteActual = this.calcularDesgasteCarbon(carbon, ultimaTelemetria?.longitud);

  //   const estadoBateria = this.obtenerEstadoBateria(carbon, ultimaTelemetria?.porcentaje_bateria);

  //   return {
  //     carbon,
  //     ultimaTelemetria,

  //     cantidadLecturas: telemetria.length,

  //     promedioLongitud: this.calcularPromedio(telemetria.map((lectura) => lectura.longitud)),

  //     porcentajeDesgaste: desgasteActual?.porcentaje ?? null,

  //     estadoDesgaste: desgasteActual?.estado ?? 'sin-datos',

  //     temperaturaMaxima: this.calcularMaximo(telemetria.map((lectura) => lectura.temperatura)),

  //     bateriaMinima: this.calcularMinimo(telemetria.map((lectura) => lectura.porcentaje_bateria)),

  //     estadoBateria,
  //   };
  // }

  private construirCarbonDetalleDesdeUltima(
    carbon: CarbonResponse,
    sensor: SensorApi | null,
    ultimaTelemetria: TelemetriaApi | null,
  ): CarbonTelemetriaDetalle {
    // const desgasteActual = this.calcularDesgasteCarbon(carbon, ultimaTelemetria?.longitud);
    const desgasteActual = this.calcularDesgasteCarbon(carbon, ultimaTelemetria?.desgaste);

    const estadoBateria = this.obtenerEstadoBateria(carbon, ultimaTelemetria?.porcentaje_bateria);

    return {
      carbon,
      sensor,
      ultimaTelemetria,

      promedioLongitud: this.convertirNumero(ultimaTelemetria?.longitud),

      porcentajeDesgaste: desgasteActual?.porcentaje ?? null,

      estadoDesgaste: desgasteActual?.estado ?? 'sin-datos',

      temperaturaMaxima: this.convertirNumero(ultimaTelemetria?.temperatura),

      bateriaMinima: this.convertirNumero(ultimaTelemetria?.porcentaje_bateria),

      estadoBateria,
    };
  }

  private construirMotorDetalle(
    motor: MotorCatalogo,
    anillosMotor: Array<{
      id: string;
      identificador: string;
      motor_id: string;
    }>,
    carbonesDetalle: CarbonTelemetriaDetalle[],
  ): MotorDetalle {
    const anillos: AnilloMotorDetalle[] = anillosMotor.map((anillo) => ({
      anillo,

      carbones: carbonesDetalle.filter(
        (item) => this.normalizarId(item.carbon.anillo_id) === this.normalizarId(anillo.id),
      ),
    }));

    const lecturasActuales = carbonesDetalle
      .map((item) => item.ultimaTelemetria)
      .filter((lectura): lectura is TelemetriaApi => lectura !== null);

    const desgastesActuales = carbonesDetalle
      .filter((item) => item.porcentajeDesgaste !== null)
      .map((item) => ({
        porcentaje: item.porcentajeDesgaste as number,

        estado: item.estadoDesgaste,
      }));

    const porcentajeDesgaste = this.calcularPromedio(
      desgastesActuales.map((desgaste) => desgaste.porcentaje),
    );

    const estadoDesgaste = this.obtenerEstadoDesgasteMotor(desgastesActuales);

    const carbonesConBateria = carbonesDetalle.filter(
      (item) =>
        item.ultimaTelemetria?.porcentaje_bateria !== null &&
        item.ultimaTelemetria?.porcentaje_bateria !== undefined,
    );

    const carbonConMenorBateria = carbonesConBateria.reduce<CarbonTelemetriaDetalle | null>(
      (menor, actual) => {
        if (!menor) {
          return actual;
        }

        const bateriaMenor = this.convertirNumero(menor.ultimaTelemetria?.porcentaje_bateria);

        const bateriaActual = this.convertirNumero(actual.ultimaTelemetria?.porcentaje_bateria);

        if (bateriaActual === null) {
          return menor;
        }

        if (bateriaMenor === null || bateriaActual < bateriaMenor) {
          return actual;
        }

        return menor;
      },
      null,
    );

    const bateriaMinima = carbonConMenorBateria
      ? this.convertirNumero(carbonConMenorBateria.ultimaTelemetria?.porcentaje_bateria)
      : null;

    const estadoBateria = carbonConMenorBateria?.estadoBateria ?? 'sin-datos';

    return {
      motor,
      anillos,

      totalAnillos: anillos.length,

      totalCarbones: carbonesDetalle.length,

      carbonesConTelemetria: carbonesDetalle.filter((item) => item.ultimaTelemetria !== null)
        .length,

      /*
       * Estos cálculos usan la última lectura
       * de cada carbón, igual que la tabla principal.
       */
      promedioLongitud: this.calcularPromedio(lecturasActuales.map((lectura) => lectura.longitud)),

      porcentajeDesgaste,
      estadoDesgaste,

      temperaturaMaxima: this.calcularMaximo(
        lecturasActuales.map((lectura) => lectura.temperatura),
      ),

      bateriaMinima,
      estadoBateria,
    };
  }

  private calcularPromedio(valores: ValorNumerico[]): number | null {
    const numeros = this.obtenerNumerosValidos(valores);

    if (numeros.length === 0) {
      return null;
    }

    return numeros.reduce((total, valor) => total + valor, 0) / numeros.length;
  }

  private calcularMaximo(valores: ValorNumerico[]): number | null {
    const numeros = this.obtenerNumerosValidos(valores);

    return numeros.length ? Math.max(...numeros) : null;
  }

  private calcularMinimo(valores: ValorNumerico[]): number | null {
    const numeros = this.obtenerNumerosValidos(valores);

    return numeros.length ? Math.min(...numeros) : null;
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

    const normalizada = fecha.replace(/(\.\d{3})\d+/, '$1');

    const timestamp = new Date(normalizada).getTime();

    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  private normalizarId(valor: unknown): string {
    return String(valor ?? '').trim();
  }

  // private calcularDesgasteCarbon(
  //   carbon: CarbonResponse,
  //   desgasteActual: ValorNumerico,
  // ): DesgasteCalculado | null {
  //   const largoInicial = this.convertirNumero(carbon.largo_inicial);

  //   const largoPrealarma = this.convertirNumero(carbon.largo_prealarma);

  //   const largoAlarma = this.convertirNumero(carbon.largo_alarma);

  //   const desgaste = this.convertirNumero(desgasteActual);

  //   if (largoInicial === null || largoInicial <= 0 || desgaste === null) {
  //     return null;
  //   }

  //   /*
  //    * Una medición negativa significa que
  //    * la lectura actual supera el largo inicial.
  //    *
  //    * Para desgaste físico mostramos 0,
  //    * pero no perdemos el valor original
  //    * entregado por telemetría.
  //    */
  //   const porcentaje = this.limitarPorcentaje((desgaste / largoInicial) * 100);

  //   const porcentajeAdvertencia =
  //     largoPrealarma === null
  //       ? null
  //       : this.limitarPorcentaje(((largoInicial - largoPrealarma) / largoInicial) * 100);

  //   const porcentajeCritico =
  //     largoAlarma === null
  //       ? null
  //       : this.limitarPorcentaje(((largoInicial - largoAlarma) / largoInicial) * 100);

  //   let estado: DesgasteCalculado['estado'] = 'normal';

  //   if (porcentajeCritico !== null && porcentaje >= porcentajeCritico) {
  //     estado = 'critico';
  //   } else if (porcentajeAdvertencia !== null && porcentaje >= porcentajeAdvertencia) {
  //     estado = 'advertencia';
  //   }

  //   return {
  //     porcentaje,
  //     estado,
  //   };
  // }

  private calcularDesgasteCarbon(
    carbon: CarbonResponse,
    desgasteActual: ValorNumerico,
  ): DesgasteCalculado | null {
    const largoInicial = this.convertirNumero(carbon.largo_inicial);

    const largoPrealarma = this.convertirNumero(carbon.largo_prealarma);

    const largoAlarma = this.convertirNumero(carbon.largo_alarma);

    // const desgaste = this.convertirNumero(desgasteActual);
    const desgasteOriginal = this.convertirNumero(desgasteActual);

    if (largoInicial === null || largoInicial <= 0 || desgasteOriginal === null) {
      return null;
    }

    /*
     * PARCHE TEMPORAL:
     * el simulador/backend está entregando
     * desgaste con signo negativo.
     */
    const desgaste = Math.abs(desgasteOriginal);

    if (largoInicial === null || largoInicial <= 0 || desgaste === null) {
      return null;
    }

    /*
     * PARCHE TEMPORAL:
     * mientras backend no tenga la fórmula definitiva,
     * usamos telemetria.desgaste como mm desgastados
     * respecto al largo inicial del carbón.
     */
    // const porcentaje = this.limitarPorcentaje((Math.abs(desgaste) / largoInicial) * 100);
    const porcentaje = this.limitarPorcentaje((desgaste / largoInicial) * 100);

    /*
     * Convertimos los umbrales de largo
     * a porcentaje de desgaste.
     */
    const porcentajeAdvertencia =
      largoPrealarma === null
        ? null
        : this.limitarPorcentaje(((largoInicial - largoPrealarma) / largoInicial) * 100);

    const porcentajeCritico =
      largoAlarma === null
        ? null
        : this.limitarPorcentaje(((largoInicial - largoAlarma) / largoInicial) * 100);

    let estado: DesgasteCalculado['estado'] = 'normal';

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

  private obtenerEstadoDesgasteMotor(
    desgastes: Array<{
      porcentaje: number;
      estado: EstadoDesgaste;
    }>,
  ): EstadoDesgaste {
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

  private convertirNumero(valor: ValorNumerico): number | null {
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

  private obtenerEstadoBateria(
    carbon: CarbonResponse,
    porcentajeBateria: ValorNumerico,
  ): EstadoBateria {
    const bateria = this.convertirNumero(porcentajeBateria);

    const aviso = this.convertirNumero(carbon.nivel_bateria_aviso);

    const minimo = this.convertirNumero(carbon.nivel_bateria_minimo);

    if (bateria === null) {
      return 'sin-datos';
    }

    if (minimo !== null && bateria <= minimo) {
      return 'critico';
    }

    if (aviso !== null && bateria <= aviso) {
      return 'advertencia';
    }

    return 'normal';
  }
}
