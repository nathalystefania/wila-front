import { Injectable } from '@angular/core';
import { of } from 'rxjs';
import { EmpresaSelectionDraft } from '../models/catalogo.models';

export interface CreateEmpresaResponse {
    id: number;
}

@Injectable({ providedIn: 'root' })
export class EmpresasService {

    createEmpresa(_body: EmpresaSelectionDraft) {
        return of<CreateEmpresaResponse>({ id: 1 });
    }

}