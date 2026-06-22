import { Injectable } from '@angular/core';
import { of } from 'rxjs';
import { CreatePlantaResponse, PlantaDraft, Planta } from '../models/planta.models';

const MOCK_PLANTA: Planta = {
    id: 1,
    nombre: 'Planta Demo',
    empresaId: 'empresa-1',
    divisionId: 'division-1',
    areaId: 'area-1',
    email_notificaciones: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
};

@Injectable({ providedIn: 'root' })
export class PlantasService {

    getUserPlantas() {
        return of([MOCK_PLANTA]);
    }

    createPlanta(_body: PlantaDraft) {
        return of<CreatePlantaResponse>({ id: 1 });
    }

    updatePlanta(_id: number, _body: PlantaDraft) {
        return of(MOCK_PLANTA);
    }
}