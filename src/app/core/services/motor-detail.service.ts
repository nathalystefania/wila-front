import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { CatalogoService } from './catalogo.service';
import {
  AnilloMotorDetalle,
  CarbonResponse,
  CarbonTelemetriaDetalle,
  MotorCatalogo,
  MotorDetalle,
  TelemetriaApi,
} from '../models/catalogo.models';

type ValorNumerico = number | string | null | undefined;

@Injectable({
  providedIn: 'root',
})
export class MotorDetailService {
  private readonly catalogoService = inject(CatalogoService);

  getMotorDetalle(motorId: string): Observable<MotorDetalle | null> {
    const motorIdNormalizado = this.normalizarId(motorId);

    if (!motorIdNormalizado) {
      return of(null);
    }

    /*
     * Primera etapa:
     * obtenemos el motor, sus anillos y sus carbones.
     */
    return forkJoin({
      motores: this.catalogoService.getMotoresCatalogo(),

      anillos: this.catalogoService.getAnillos(),

      carbones: this.catalogoService.getCarbones(),
    }).pipe(
      switchMap(({ motores, anillos, carbones }) => {
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

        /*
         * Si el motor no tiene carbones, devolvemos
         * el detalle estructural sin realizar
         * consultas innecesarias de telemetría.
         */
        if (carbonesMotor.length === 0) {
          return of(this.construirMotorDetalle(motor, anillosMotor, []));
        }

        /*
         * Segunda etapa:
         * una consulta de telemetría por carbón.
         *
         * Esta versión es deliberadamente sencilla
         * para validar el endpoint y los cálculos.
         */
        const consultasTelemetria = carbonesMotor.map((carbon) =>
          this.catalogoService
            .getTelemetriaByCarbon(carbon.id)
            .pipe(map((telemetria) => this.construirCarbonDetalle(carbon, telemetria))),
        );

        return forkJoin(consultasTelemetria).pipe(
          map((carbonesDetalle) =>
            this.construirMotorDetalle(motor, anillosMotor, carbonesDetalle),
          ),
        );
      }),
    );
  }

  private construirCarbonDetalle(
    carbon: CarbonResponse,
    telemetria: TelemetriaApi[],
  ): CarbonTelemetriaDetalle {
    const lecturasOrdenadas = [...telemetria].sort(
      (a, b) => this.obtenerTimestamp(b.fecha_medicion) - this.obtenerTimestamp(a.fecha_medicion),
    );

    const ultimaTelemetria = lecturasOrdenadas[0] ?? null;

    return {
      carbon,
      ultimaTelemetria,

      cantidadLecturas: telemetria.length,

      promedioLongitud: this.calcularPromedio(telemetria.map((lectura) => lectura.longitud)),

      promedioDesgaste: this.calcularPromedio(telemetria.map((lectura) => lectura.desgaste)),

      temperaturaMaxima: this.calcularMaximo(telemetria.map((lectura) => lectura.temperatura)),

      bateriaMinima: this.calcularMinimo(telemetria.map((lectura) => lectura.porcentaje_bateria)),
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

      promedioDesgaste: this.calcularPromedio(lecturasActuales.map((lectura) => lectura.desgaste)),

      temperaturaMaxima: this.calcularMaximo(
        lecturasActuales.map((lectura) => lectura.temperatura),
      ),

      bateriaMinima: this.calcularMinimo(
        lecturasActuales.map((lectura) => lectura.porcentaje_bateria),
      ),
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
}
