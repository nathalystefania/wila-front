import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

export interface SensorData {
    deveui: string;
    fecha: string;
    fcnt: number;
    bat: number;
    ax: number;
    ay: number;
    az: number;
    gx: number;
    gy: number;
    gz: number;
    tilt_f: number;
    tilt_s: number;
}

const MOCK_DISPOSITIVOS: SensorData[] = [
    { deveui: 'AA:BB:CC:DD:EE:01', fecha: '2024-01-01T10:00:00Z', fcnt: 10, bat: 90, ax: 0.1, ay: 0.2, az: 9.8, gx: 0, gy: 0, gz: 0, tilt_f: 1.5, tilt_s: 1.5 },
    { deveui: 'AA:BB:CC:DD:EE:02', fecha: '2024-01-01T10:05:00Z', fcnt: 20, bat: 85, ax: 0.0, ay: 0.1, az: 9.7, gx: 0, gy: 0, gz: 0, tilt_f: 2.0, tilt_s: 2.0 },
];

@Injectable({ providedIn: 'root' })
export class SensoresService {

    asignarSensor(_carbonId: number, deveui: string): Observable<SensorData> {
        const mock = MOCK_DISPOSITIVOS.find(d => d.deveui === deveui) ?? MOCK_DISPOSITIVOS[0];
        return of(mock);
    }

    getDispositivosDetectados(): Observable<SensorData[]> {
        return of(MOCK_DISPOSITIVOS);
    }
}
