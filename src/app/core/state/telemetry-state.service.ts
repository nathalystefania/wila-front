import { Injectable, signal } from '@angular/core';
import { TelemetriaApi } from '@models/catalogo.models';

@Injectable({
  providedIn: 'root',
})
export class TelemetryStateService {
  private readonly _ultimaMedicion = signal<string | null>(null);

  readonly ultimaMedicion = this._ultimaMedicion.asReadonly();

  actualizarDesdeTelemetria(telemetria: TelemetriaApi[]): void {
    if (!telemetria.length) {
      return;
    }

    const ultima = telemetria.reduce((actual, lectura) => {
      if (!actual) {
        return lectura;
      }

      const fechaActual = new Date(actual.fecha_medicion).getTime();

      const fechaNueva = new Date(lectura.fecha_medicion).getTime();

      return fechaNueva > fechaActual ? lectura : actual;
    });

    if (ultima?.fecha_medicion) {
      this._ultimaMedicion.set(ultima.fecha_medicion);
    }
  }

  clear(): void {
    this._ultimaMedicion.set(null);
  }
}
