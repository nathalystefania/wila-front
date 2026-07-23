import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, switchMap, timer, } from 'rxjs';
import { CatalogoService } from '@services/catalogo.service';
import { AlarmaApi, AnilloResponse, CarbonResponse, DashboardHomeData, MotorCatalogo, MotorDashboardRow, SensorApi, TelemetriaApi } from '@models/catalogo.models';

interface DashboardStructureData {
    motores: MotorCatalogo[];
    anillos: AnilloResponse[];
    carbones: CarbonResponse[];
    sensores: SensorApi[];
}

interface DashboardDynamicData {
    telemetria: TelemetriaApi[];
    alarmas: AlarmaApi[];
}
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
            }) =>
                this.construirDashboard(
                    empresaId,
                    {
                        motores,
                        anillos,
                        carbones,
                        sensores,
                    },
                    {
                        telemetria,
                        alarmas,
                    }
                )
            )
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
            const sensorId =
                this.normalizarId(
                    lectura.sensor_id
                );

            if (!sensorId) {
                continue;
            }

            const lecturaActual =
                ultimaPorSensor.get(
                    sensorId
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
                    sensorId,
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

    private normalizarId(
        valor: unknown
    ): string {
        return String(
            valor ?? ''
        ).trim();
    }

    getDashboardTiempoReal(
        empresaId: string,
        intervaloMs = 5000
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
        }).pipe(
            switchMap(estructura =>
                timer(0, intervaloMs).pipe(
                    switchMap(() =>
                        forkJoin({
                            telemetria:
                                this.catalogoService
                                    .getTelemetria(),

                            alarmas:
                                this.catalogoService
                                    .getAlarmas(),
                        })
                    ),

                    map(datosDinamicos =>
                        this.construirDashboard(
                            empresaId,
                            estructura,
                            datosDinamicos
                        )
                    )
                )
            )
        );
    }

    private construirDashboard(
        empresaId: string,
        estructura: DashboardStructureData,
        datosDinamicos: DashboardDynamicData
    ): DashboardHomeData {
        const {
            motores,
            anillos,
            carbones,
            sensores,
        } = estructura;

        const {
            telemetria,
            alarmas,
        } = datosDinamicos;

        const ultimaTelemetria =
            this.obtenerUltimaLecturaPorSensor(
                telemetria
            );

        const alarmasEmpresa =
            alarmas.filter(
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

        const carbonActualPorSensor =
            new Map<string, string>();

        for (const sensor of sensores) {
            const sensorId =
                this.normalizarId(
                    sensor.id
                );

            const carbonId =
                this.normalizarId(
                    sensor.carbon_id_actual
                );

            if (!sensorId || !carbonId) {
                continue;
            }

            carbonActualPorSensor.set(
                sensorId,
                carbonId
            );
        }
        
        const motorTelemetria = motores.find(
            motor =>
                this.normalizarId(motor.id) ===
                '65de7e60-f141-48f9-b7aa-9134541abba9'
        );

        console.log(
            'Motor 25 dentro de motores cargados:',
            motorTelemetria
        );

        const motoresDashboard:
            MotorDashboardRow[] =
            motores.map(motor => {
                const alarmasMotor =
                    alarmasActivasEmpresa.filter(
                        alarma =>
                            alarma.motor_id === motor.id
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
                                    this.normalizarId(
                                        anillo.motor_id
                                    ) ===
                                    this.normalizarId(
                                        motor.id
                                    )
                            )
                            .map(anillo =>
                                this.normalizarId(
                                    anillo.id
                                )
                            )
                    );

                const idsCarbonesMotor =
                    new Set(
                        carbones
                            .filter(
                                carbon =>
                                    idsAnillosMotor.has(
                                        this.normalizarId(
                                            carbon.anillo_id
                                        )
                                    )
                            )
                            .map(
                                carbon => this.normalizarId(
                                    carbon.id
                                )
                            )
                    );

                idsCarbonesMotor.forEach(
                    carbonId =>
                        idsCarbonesEmpresa.add(
                            carbonId
                        )
                );

                const telemetriaMotor =
                    ultimaTelemetria.filter(
                        lectura => {
                            const sensorId =
                                this.normalizarId(
                                    lectura.sensor_id
                                );

                            const carbonActualId =
                                carbonActualPorSensor.get(
                                    sensorId
                                );

                            return (
                                carbonActualId !== undefined &&
                                idsCarbonesMotor.has(
                                    carbonActualId
                                )
                            );
                        }
                    );
                
                console.log(
                    'Relación telemetría motor',
                    {
                        motor: motor.nombre,

                        idsCarbonesMotor:
                            Array.from(
                                idsCarbonesMotor
                            ),

                        lecturas:
                            ultimaTelemetria.map(
                                lectura => ({
                                    sensorId:
                                        lectura.sensor_id,

                                    carbonTelemetria:
                                        lectura.carbon_id,

                                    carbonActualSensor:
                                        carbonActualPorSensor.get(
                                            this.normalizarId(
                                                lectura.sensor_id
                                            )
                                        ),
                                })
                            ),

                        telemetriaMotor,
                    }
                );
            
                //
                // console.log('Motor', motor.nombre, {
                //     idsCarbonesMotor: Array.from(
                //         idsCarbonesMotor
                //     ),

                //     ultimaTelemetria,

                //     telemetriaMotor,

                //     valores: telemetriaMotor.map(
                //         lectura => ({
                //             carbonId: lectura.carbon_id,

                //             longitud: lectura.longitud,
                //             tipoLongitud:
                //                 typeof lectura.longitud,

                //             desgaste: lectura.desgaste,
                //             tipoDesgaste:
                //                 typeof lectura.desgaste,

                //             temperatura:
                //                 lectura.temperatura,
                //             tipoTemperatura:
                //                 typeof lectura.temperatura,

                //             bateria:
                //                 lectura.porcentaje_bateria,
                //             tipoBateria:
                //                 typeof lectura
                //                     .porcentaje_bateria,
                //         })
                //     ),
                // });
                //

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
            ).filter(
                carbonId =>
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
    }
}