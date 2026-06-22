import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of } from 'rxjs';
import { EmpresaApi, DivisionApi, AreaApi, EquipoApi, MotorApi, MotorCatalogo } from '../models/catalogo.models';
import { ApiService } from './api.service';


@Injectable({ providedIn: 'root' })
export class CatalogoService {
    private api = inject(ApiService);

    getEmpresas(): Observable<EmpresaApi[]> {
        return this.api.get<EmpresaApi[]>('/api/empresas');
    }

    getDivisiones(): Observable<DivisionApi[]> {
        return this.api.get<DivisionApi[]>('/api/divisiones');
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

    getDivisionesByEmpresaId(
        empresaId: string
    ): Observable<DivisionApi[]> {
        if (!empresaId) return of([]);

        return this.getDivisiones().pipe(
            map(divisiones =>
                divisiones
                    .filter(d => d.empresa_id === empresaId)
                    .sort((a, b) =>
                        a.nombre.localeCompare(b.nombre, 'es')
                    )
            )
        );
    }

    getDivisionesConMotoresByEmpresaId(
        empresaId: string
    ): Observable<DivisionApi[]> {
        if (!empresaId) return of([]);

        return forkJoin({
            divisiones: this.getDivisiones(),
            areas: this.getAreas(),
            equipos: this.getEquipos(),
            motores: this.getMotores(),
        }).pipe(
            map(({ divisiones, areas, equipos, motores }) => {
                const areasById = new Map(
                    areas.map(a => [a.id, a])
                );

                const equiposById = new Map(
                    equipos.map(e => [e.id, e])
                );

                const divisionesConMotores = new Set<string>();

                motores.forEach(motor => {
                    const equipo = equiposById.get(motor.equipo_id);
                    if (!equipo) return;

                    const area = areasById.get(equipo.area_id);
                    if (!area) return;

                    divisionesConMotores.add(area.division_id);
                });

                return divisiones
                    .filter(
                        d =>
                            d.empresa_id === empresaId &&
                            divisionesConMotores.has(d.id)
                    )
                    .sort((a, b) =>
                        a.nombre.localeCompare(b.nombre, 'es')
                    );
            })
        );
    }

    getMotoresByEmpresaDivision(
        empresaId?: string,
        divisionId?: string
    ): Observable<MotorCatalogo[]> {
        return this.getMotoresCatalogo().pipe(
            map(motores =>
                motores.filter(motor => {
                    if (!empresaId) return true;

                    if (!divisionId) {
                        return motor.empresa_id === empresaId;
                    }

                    return (
                        motor.empresa_id === empresaId &&
                        motor.division_id === divisionId
                    );
                })
            )
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
                const empresaById = new Map(empresas.map(item => [item.id, item]));
                const divisionById = new Map(divisiones.map(item => [item.id, item]));
                const areaById = new Map(areas.map(item => [item.id, item]));
                const equipoById = new Map(equipos.map(item => [item.id, item]));

                return motores
                    .map(motor => {
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
                    .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true, sensitivity: 'base' }));
            })
        );
    }
}
