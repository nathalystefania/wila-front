import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { CatalogoService } from '@services/catalogo.service';
import { DashboardHomeData, MotorDashboardRow, SensorApi, TelemetriaApi } from '@models/catalogo.models';

@Injectable({ providedIn: 'root', })
export class DashboardService {
    private readonly catalogoService =
        inject(CatalogoService);

    getMotoresDashboard(
        empresaId: string
    ): Observable<DashboardHomeData> {
        return forkJoin({
            motores:
                this.catalogoService
                    .getMotoresByEmpresaDivision(
                        empresaId,
                        ''
                    ),

            anillos:
                this.catalogoService.getAnillos(),

            carbones:
                this.catalogoService.getCarbones(),

            sensores:
                this.catalogoService.getSensores(),

            telemetria:
                this.catalogoService.getTelemetria(),

            alarmas:
                this.catalogoService.getAlarmas(),
        }).pipe(
            map(({
                motores,
                anillos,
                carbones,
                sensores,
                telemetria,
                alarmas,
            }) => {
                const ultimaTelemetria =
                    this.obtenerUltimaLecturaPorSensor(
                        telemetria
                    );

                const alarmasEmpresa = alarmas.filter(
                    alarma =>
                        alarma.empresa_id === empresaId
                );

                const alarmasActivasEmpresa =
                    alarmasEmpresa.filter(
                        alarma =>
                            alarma.estado === 'Activa'
                    );

                const alarmasRecientes =
                    [...alarmasEmpresa]
                        .sort(
                            (a, b) =>
                                this.toTimestamp(
                                    b.fecha_creacion
                                ) -
                                this.toTimestamp(
                                    a.fecha_creacion
                                )
                        )
                        .slice(0, 10);

                const idsCarbonesSincronizados =
                    this.obtenerIdsCarbonesSincronizados(
                        sensores
                    );

                const idsCarbonesEmpresa =
                    new Set<string>();

                const motoresDashboard: MotorDashboardRow[] =
                    motores.map(motor => {
                        const alarmasMotor =
                            alarmasActivasEmpresa.filter(
                                alarma => alarma.motor_id === motor.id
                            );

                        const alarmasCriticas =
                            alarmasMotor.filter(
                                alarma =>
                                    alarma.severidad ===
                                    'Critica'
                            ).length;

                        const alarmasAdvertencia =
                            alarmasMotor.filter(
                                alarma =>
                                    alarma.severidad ===
                                    'Advertencia'
                            ).length;

                        const idsAnillosMotor =
                            new Set(
                                anillos
                                    .filter(
                                        anillo =>
                                            anillo.motor_id ===
                                            motor.id
                                    )
                                    .map(anillo => anillo.id)
                            );

                        const idsCarbonesMotor =
                            new Set(
                                carbones
                                    .filter(carbon =>
                                        idsAnillosMotor.has(
                                            carbon.anillo_id
                                        )
                                    )
                                    .map(carbon => carbon.id)
                            );

                        
                        idsCarbonesMotor.forEach(
                            carbonId =>
                                idsCarbonesEmpresa.add(
                                    carbonId
                                )
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
                                        lectura =>
                                            lectura.longitud
                                    )
                                ),

                            promedioDesgaste:
                                this.calcularPromedio(
                                    telemetriaMotor.map(
                                        lectura =>
                                            lectura.desgaste
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
                                            lectura
                                                .porcentaje_bateria
                                    )
                                ),

                            cantidadAlarmas:
                                alarmasMotor.length,

                            alarmasCriticas,
                            alarmasAdvertencia,

                            esCritico:
                                alarmasCriticas > 0,

                            tieneAdvertencias:
                                alarmasAdvertencia > 0,
                        };
                    });

                const totalCarbones =
                    idsCarbonesEmpresa.size;

                const totalCarbonesSincronizados =
                    Array.from(
                        idsCarbonesEmpresa
                    ).filter(carbonId =>
                        idsCarbonesSincronizados.has(
                            carbonId
                        )
                    ).length;

                return {
                    motores: motoresDashboard,
                    totalCarbones,
                    totalCarbonesSincronizados,
                    alarmasRecientes,
                };
            })
        );
    }

    private obtenerIdsCarbonesSincronizados(
        sensores: SensorApi[]
    ): Set<string> {
        return new Set(
            sensores
                .map(
                    sensor =>
                        sensor.carbon_id_actual
                )
                .filter(
                    (
                        carbonId
                    ): carbonId is string =>
                        carbonId !== null &&
                        carbonId !== undefined &&
                        carbonId.trim() !== '' &&
                        carbonId.trim() !== '0'
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
                ultimaPorSensor.get(
                    lectura.sensor_id
                );

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
            this.obtenerNumerosValidos(
                valores
            );

        if (numeros.length === 0) {
            return null;
        }

        const total = numeros.reduce(
            (
                acumulado,
                valor
            ) => acumulado + valor,
            0
        );

        return total / numeros.length;
    }

    private calcularMaximo(
        valores: Array<number | null>
    ): number | null {
        const numeros =
            this.obtenerNumerosValidos(
                valores
            );

        return numeros.length
            ? Math.max(...numeros)
            : null;
    }

    private calcularMinimo(
        valores: Array<number | null>
    ): number | null {
        const numeros =
            this.obtenerNumerosValidos(
                valores
            );

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

    private toTimestamp(
        fecha: string
    ): number {
        const normalizada =
            fecha.replace(
                /(\.\d{3})\d+/,
                '$1'
            );

        const timestamp =
            new Date(
                normalizada
            ).getTime();

        return Number.isFinite(timestamp)
            ? timestamp
            : 0;
    }
}