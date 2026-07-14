import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { CatalogoService } from '@services/catalogo.service';
import { MotorDashboardRow, TelemetriaApi } from '@models/catalogo.models';

@Injectable({ providedIn: 'root', })
export class DashboardService {
    private readonly catalogoService =
        inject(CatalogoService);

    getMotoresDashboard(
        empresaId: string
    ): Observable<MotorDashboardRow[]> {
        return forkJoin({
            motores: this.catalogoService
                .getMotoresByEmpresaDivision(
                    empresaId,
                    ''
                ),
            anillos: this.catalogoService.getAnillos(),
            carbones: this.catalogoService.getCarbones(),
            telemetria: this.catalogoService.getTelemetria(),
            alarmas: this.catalogoService.getAlarmasActivas(),
        }).pipe(
            map(
                ({
                    motores,
                    anillos,
                    carbones,
                    telemetria,
                    alarmas,
                }) => {
                    const ultimaTelemetria =
                        this.obtenerUltimaLecturaPorSensor(
                            telemetria
                        );

                    return motores.map(motor => {

                        const alarmasMotor = alarmas.filter(
                            alarma => alarma.motor_id === motor.id
                        );

                        const alarmasCriticas = alarmasMotor.filter(
                            alarma => alarma.severidad === 'Critica'
                        ).length;

                        const alarmasAdvertencia = alarmasMotor.filter(
                            alarma => alarma.severidad === 'Advertencia'
                        ).length;

                        const idsAnillosMotor = new Set(
                            anillos
                                .filter(
                                    anillo =>
                                        anillo.motor_id === motor.id
                                )
                                .map(anillo => anillo.id)
                        );

                        const idsCarbonesMotor = new Set(
                            carbones
                                .filter(carbon =>
                                    idsAnillosMotor.has(
                                        carbon.anillo_id
                                    )
                                )
                                .map(carbon => carbon.id)
                        );

                        const telemetriaMotor =
                            ultimaTelemetria.filter(
                                lectura =>
                                    idsCarbonesMotor.has(
                                        lectura.carbon_id
                                    )
                            );

                        return {
                            motorId: motor.id,
                            codigo: motor.codigo,
                            nombre: motor.nombre,

                            promedioLongitud:
                                this.calcularPromedio(
                                    telemetriaMotor.map(
                                        lectura => lectura.longitud
                                    )
                                ),

                            promedioDesgaste:
                                this.calcularPromedio(
                                    telemetriaMotor.map(
                                        lectura => lectura.desgaste
                                    )
                                ),

                            temperaturaMaxima:
                                this.calcularMaximo(
                                    telemetriaMotor.map(
                                        lectura =>
                                            lectura.temperatura
                                    )
                                ),

                            bateriaMinima:
                                this.calcularMinimo(
                                    telemetriaMotor.map(
                                        lectura =>
                                            lectura.porcentaje_bateria
                                    )
                                ),

                            cantidadAlarmas: alarmasMotor.length,
                            alarmasCriticas,
                            alarmasAdvertencia,

                            esCritico: alarmasCriticas > 0,
                            tieneAdvertencias: alarmasAdvertencia > 0,
                        };
                    });
                }
            )
        );
    }

    private obtenerUltimaLecturaPorSensor(
        telemetria: TelemetriaApi[]
    ): TelemetriaApi[] {
        const ultimaPorSensor =
            new Map<string, TelemetriaApi>();

        for (const lectura of telemetria) {
            const lecturaActual =
                ultimaPorSensor.get(lectura.sensor_id);

            if (
                !lecturaActual ||
                this.toTimestamp(
                    lectura.fecha_medicion
                ) >
                this.toTimestamp(
                    lecturaActual.fecha_medicion
                )
            ) {
                ultimaPorSensor.set(
                    lectura.sensor_id,
                    lectura
                );
            }
        }

        return Array.from(
            ultimaPorSensor.values()
        );
    }

    private calcularPromedio(
        valores: Array<number | null>
    ): number | null {
        const numeros =
            this.obtenerNumerosValidos(valores);

        if (numeros.length === 0) {
            return null;
        }

        const total = numeros.reduce(
            (acumulado, valor) =>
                acumulado + valor,
            0
        );

        return total / numeros.length;
    }

    private calcularMaximo(
        valores: Array<number | null>
    ): number | null {
        const numeros =
            this.obtenerNumerosValidos(valores);

        return numeros.length
            ? Math.max(...numeros)
            : null;
    }

    private calcularMinimo(
        valores: Array<number | null>
    ): number | null {
        const numeros =
            this.obtenerNumerosValidos(valores);

        return numeros.length
            ? Math.min(...numeros)
            : null;
    }

    private obtenerNumerosValidos(
        valores: Array<number | null>
    ): number[] {
        return valores.filter(
            (valor): valor is number =>
                typeof valor === 'number' &&
                Number.isFinite(valor)
        );
    }

    private toTimestamp(fecha: string): number {
        const normalizada = fecha.replace(
            /(\.\d{3})\d+/,
            '$1'
        );

        const timestamp =
            new Date(normalizada).getTime();

        return Number.isFinite(timestamp)
            ? timestamp
            : 0;
    }
}