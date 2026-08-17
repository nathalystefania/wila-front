import { Injectable, inject } from '@angular/core';
import { Observable, concatMap, forkJoin, from, map, of, toArray } from 'rxjs';
import {
  EmpresaApi,
  DivisionApi,
  AreaApi,
  EquipoApi,
  MotorApi,
  MotorCatalogo,
  SensorApi,
  CreateAnilloRequest,
  AnilloResponse,
  CreateCarbonRequest,
  CarbonResponse,
  AsignacionDraft,
  AnillosDraft,
  CarbonesDraft,
  TelemetriaApi,
  AlarmaApi,
  AlarmaDetalle,
} from '../models/catalogo.models';
import { ApiService } from './api.service';
export interface OnboardingPersistenceData {
  anillos: AnillosDraft[];
  carbones: CarbonesDraft[];
  asignaciones: AsignacionDraft[];
}
export interface OnboardingPersistenceResult {
  anillosCreados: AnilloResponse[];
  carbonesCreados: CarbonResponse[];
  sensoresInstalados: number;
}
@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private api = inject(ApiService);

  getEmpresas(): Observable<EmpresaApi[]> {
    return this.api.get<EmpresaApi[]>('/api/empresas');
  }

  getDivisiones(): Observable<DivisionApi[]> {
    return this.api.get<DivisionApi[]>('/api/divisiones');
  }

  getDivisionesCompletas(): Observable<DivisionApi[]> {
    return this.api.get<DivisionApi[]>('/api/divisiones?solo_completas=true');
  }

  getAreas(): Observable<AreaApi[]> {
    return this.api.get<AreaApi[]>('/api/areas');
  }

  getEquipos(): Observable<EquipoApi[]> {
    return this.api.get<EquipoApi[]>('/api/equipos');
  }

  getMotores(): Observable<MotorApi[]> {
    return this.api.get<MotorApi[]>('/api/motores');
  }

  getSensores(): Observable<SensorApi[]> {
    return this.api.get<SensorApi[]>('/api/sensores');
  }

  saveAnillo(anillo: CreateAnilloRequest): Observable<AnilloResponse> {
    return this.api.post<AnilloResponse>('/api/anillos', anillo);
  }

  saveCarbon(carbon: CreateCarbonRequest): Observable<CarbonResponse> {
    return this.api.post<CarbonResponse>('/api/carbones', carbon);
  }

  instalarSensor(asignacion: { carbon_id: string; sensor_id: string }): Observable<unknown> {
    return this.api.post<unknown>('/api/sensores/instalar', asignacion);
  }

  getDivisionesByEmpresaId(empresaId: string): Observable<DivisionApi[]> {
    if (!empresaId) return of([]);

    return this.getDivisiones().pipe(
      map((divisiones) =>
        divisiones
          .filter((d) => d.empresa_id === empresaId)
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      ),
    );
  }

  getDivisionesConMotoresByEmpresaId(
    empresaId: string,
    soloPendientes = false,
  ): Observable<DivisionApi[]> {
    if (!empresaId) {
      return of([]);
    }

    return forkJoin({
      divisiones: this.getDivisiones(),

      divisionesCompletas: soloPendientes ? this.getDivisionesCompletas() : of([] as DivisionApi[]),

      areas: this.getAreas(),

      equipos: this.getEquipos(),

      motores: this.getMotores(),
    }).pipe(
      map(({ divisiones, divisionesCompletas, areas, equipos, motores }) => {
        const areasById = new Map(areas.map((area) => [area.id, area]));

        const equiposById = new Map(equipos.map((equipo) => [equipo.id, equipo]));

        /*
         * Divisiones que efectivamente tienen
         * motores disponibles.
         */
        const divisionesConMotores = new Set<string>();

        for (const motor of motores) {
          const equipo = equiposById.get(motor.equipo_id);

          if (!equipo) {
            continue;
          }

          const area = areasById.get(equipo.area_id);

          if (!area) {
            continue;
          }

          divisionesConMotores.add(area.division_id);
        }

        /*
         * IDs que backend considera ya
         * completamente configurados.
         */
        const idsDivisionesCompletas = new Set(divisionesCompletas.map((division) => division.id));

        return divisiones
          .filter((division) => {
            /*
             * Primero: debe pertenecer a
             * la empresa elegida.
             */
            if (division.empresa_id !== empresaId) {
              return false;
            }

            /*
             * Segundo: debe tener motores.
             */
            if (!divisionesConMotores.has(division.id)) {
              return false;
            }

            /*
             * Tercero:
             * si estamos en onboarding,
             * excluimos las completas.
             */
            if (soloPendientes && idsDivisionesCompletas.has(division.id)) {
              return false;
            }

            return true;
          })
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      }),
    );
  }

  getMotoresByEmpresaDivision(
    empresaId?: string,
    divisionId?: string,
  ): Observable<MotorCatalogo[]> {
    return this.getMotoresCatalogo().pipe(
      map((motores) =>
        motores.filter((motor) => {
          if (!empresaId) return true;

          if (!divisionId) {
            return motor.empresa_id === empresaId;
          }

          return motor.empresa_id === empresaId && motor.division_id === divisionId;
        }),
      ),
    );
  }

  getMotoresCatalogo(): Observable<(MotorCatalogo & { empresa: string })[]> {
    return forkJoin({
      empresas: this.getEmpresas(),
      divisiones: this.getDivisiones(),
      areas: this.getAreas(),
      equipos: this.getEquipos(),
      motores: this.getMotores(),
    }).pipe(
      map(({ empresas, divisiones, areas, equipos, motores }) => {
        const empresaById = new Map(empresas.map((item) => [item.id, item]));
        const divisionById = new Map(divisiones.map((item) => [item.id, item]));
        const areaById = new Map(areas.map((item) => [item.id, item]));
        const equipoById = new Map(equipos.map((item) => [item.id, item]));

        return motores
          .map((motor) => {
            const equipo = equipoById.get(motor.equipo_id);
            if (!equipo) return null;

            const area = areaById.get(equipo.area_id);
            if (!area) return null;

            const division = divisionById.get(area.division_id);
            if (!division) return null;

            const empresa = empresaById.get(division.empresa_id);
            if (!empresa) return null;

            return {
              id: motor.id,
              codigo: motor.codigo,
              nombre: motor.nombre,
              potencia_kw: motor.potencia_kw,
              tipo_motor: motor.tipo_motor,

              empresa_id: empresa.id,
              empresa_nombre: empresa.nombre,

              division_id: division.id,
              division_nombre: division.nombre,

              area_id: area.id,
              area_nombre: area.nombre,

              equipo_id: equipo.id,
              equipo_nombre: equipo.nombre,
            } satisfies MotorCatalogo;
          })
          .filter((motor): motor is MotorCatalogo & { empresa: string } => motor !== null)
          .sort((a, b) =>
            a.codigo.localeCompare(b.codigo, undefined, { numeric: true, sensitivity: 'base' }),
          );
      }),
    );
  }

  guardarConfiguracionOnboarding(
    data: OnboardingPersistenceData,
  ): Observable<OnboardingPersistenceResult> {
    const anillosCreados: AnilloResponse[] = [];
    const carbonesCreados: CarbonResponse[] = [];
    let sensoresInstalados = 0;

    return from(data.anillos).pipe(
      concatMap((anilloDraft) => {
        const anilloRequest: CreateAnilloRequest = {
          identificador: anilloDraft.identificador,
          motor_id: anilloDraft.motor_id,
        };

        return this.saveAnillo(anilloRequest).pipe(
          concatMap((anilloCreado) => {
            anillosCreados.push(anilloCreado);

            const carbonesDelAnillo = data.carbones.filter(
              (carbon) => carbon.anilloTempId === anilloDraft.tempId,
            );

            return from(carbonesDelAnillo).pipe(
              concatMap((carbonDraft) => {
                const carbonRequest: CreateCarbonRequest = {
                  anillo_id: anilloCreado.id,
                  identificador: carbonDraft.identificador,
                  largo_alarma: carbonDraft.largo_alarma,
                  largo_inicial: carbonDraft.largo_inicial,
                  largo_prealarma: carbonDraft.largo_prealarma,
                  nivel_bateria_aviso: carbonDraft.nivel_bateria_aviso,
                  nivel_bateria_minimo: carbonDraft.nivel_bateria_minimo,
                };

                return this.saveCarbon(carbonRequest).pipe(
                  concatMap((carbonCreado) => {
                    carbonesCreados.push(carbonCreado);

                    const asignacion = data.asignaciones.find(
                      (item) => item.carbonTempId === carbonDraft.tempId,
                    );

                    if (!asignacion || asignacion.sensor_id === '0') {
                      return of(carbonCreado);
                    }

                    const instalacionPayload = {
                      carbon_id: carbonCreado.id,
                      sensor_id: asignacion.sensor_id,
                    };

                    return this.instalarSensor(instalacionPayload).pipe(
                      map(() => {
                        sensoresInstalados++;
                        return carbonCreado;
                      }),
                    );
                  }),
                );
              }),
              toArray(),
            );
          }),
        );
      }),
      toArray(),
      map(() => ({
        anillosCreados,
        carbonesCreados,
        sensoresInstalados,
      })),
    );
  }

  getAnillos(): Observable<AnilloResponse[]> {
    return this.api.get<AnilloResponse[]>('/api/anillos');
  }

  getCarbones(): Observable<CarbonResponse[]> {
    return this.api.get<CarbonResponse[]>('/api/carbones');
  }

  getTelemetria(): Observable<TelemetriaApi[]> {
    return this.api.get<TelemetriaApi[]>('/api/telemetria');
  }

  getTelemetriaByCarbon(carbonId: string): Observable<TelemetriaApi[]> {
    return this.api.get<TelemetriaApi[]>(
      `/api/telemetria?carbon_id=${encodeURIComponent(carbonId)}`,
    );
  }

  getAlarmas(): Observable<AlarmaDetalle[]> {
    return this.api.get<AlarmaDetalle[]>('/api/alarmas').pipe(
      map((alarmas) =>
        alarmas.map((alarma) => ({
          ...alarma,
          severidad: this.normalizarSeveridad(alarma.severidad),
        })),
      ),
    );
  }

  getAlarmasActivas(): Observable<AlarmaDetalle[]> {
    return this.api.get<AlarmaDetalle[]>('/api/alarmas?estado=Activa').pipe(
      map((alarmas) =>
        alarmas.map((alarma) => ({
          ...alarma,
          severidad: this.normalizarSeveridad(alarma.severidad),
        })),
      ),
    );
  }

  private normalizarSeveridad(severidad: string): 'Critica' | 'Advertencia' {
    if (!severidad) {
      return 'Advertencia';
    }

    const valor = severidad
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .toLowerCase();

    switch (valor) {
      case 'critica':
      case 'critico':
        return 'Critica';

      case 'advertencia':
      case 'warning':
        return 'Advertencia';

      default:
        return 'Advertencia';
    }
  }

  reconocerAlarma(alarmaId: string, reconocidaPor: string): Observable<unknown> {
    return this.api.put(`/api/alarmas/${encodeURIComponent(alarmaId)}/reconocer`, {
      reconocida_por: reconocidaPor,
    });
  }

  resolverAlarma(alarmaId: string): Observable<unknown> {
    return this.api.put(`/api/alarmas/${encodeURIComponent(alarmaId)}/resolver`, {});
  }

  getAlarmasDetalle(): Observable<AlarmaDetalle[]> {
    return forkJoin({
      alarmas: this.getAlarmas(),
      carbones: this.getCarbones(),
      anillos: this.getAnillos(),
      sensores: this.getSensores(),
      motores: this.getMotores(),
    }).pipe(
      map(({ alarmas, carbones, anillos, sensores, motores }) => {
        const carbonPorId = new Map(carbones.map((carbon) => [carbon.id, carbon]));

        const anilloPorId = new Map(anillos.map((anillo) => [anillo.id, anillo]));

        const sensorPorId = new Map(sensores.map((sensor) => [sensor.id, sensor]));

        const motorPorId = new Map(motores.map((motor) => [motor.id, motor]));

        return alarmas.map((alarma) => {
          const carbon = carbonPorId.get(alarma.carbon_id);

          const anillo = carbon ? anilloPorId.get(carbon.anillo_id) : undefined;

          const sensor = sensorPorId.get(alarma.sensor_id);

          const motor = motorPorId.get(alarma.motor_id);

          return {
            ...alarma,
            anilloIdentificador: anillo?.identificador ?? null,
            carbonIdentificador: carbon?.identificador ?? null,
            sensorHardwareId: sensor?.id_hardware ?? null,
            motorNombre: motor?.nombre ?? null,
            motorCodigo: motor?.codigo ?? null,
          };
        });
      }),
    );
  }
}
