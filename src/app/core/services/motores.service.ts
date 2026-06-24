// import { Injectable } from '@angular/core';
// import { of } from 'rxjs';
// import { MotorConfiguracionDraft } from '../models/catalogo.models';

// export interface CreateMotorResponse {
//   success?: boolean;
//   motor_id?: number;
//   id?: number; // Respuesta real del servidor
// }

// export interface Anillo {
//   id: number;
//   motor_id: number;
//   numero_anillo: number;
//   carbones: Carbon[];
// }

// export interface Carbon {
//   id: number;
//   anillo_id: number;
//   numero_carbon: number;
//   deveui_actual?: string | null;
// }

// export interface CreateCarbonBody {
//   numero_carbon: number;
//   medida_inicial_mm: number;
//   umbral_alerta_perc: number;
//   duracion_estimada_dias: number;
// }

// export interface Motor extends MotorConfiguracionDraft {
//   id: string;
// }

// export interface CreateMotoresResponse {
//   success: boolean;
//   motores_creados: number;
// }

// const MOCK_MOTORES: Motor[] = [
//     { id: 1, codigo: 'SAG-01', modelo: 'WEG W22', ubicacion: 'Sector A', descripcion: null, num_anillos: 2, carbones_por_anillo: 4, alto_carbon_mm: 60, prealarma_mm: 30, minimo_cambio_mm: 15, umbral_desgaste_perc: 50, duracion_estimada_dias: 180 },
//     { id: 2, codigo: 'SAG-02', modelo: 'Siemens 1LA', ubicacion: 'Sector B', descripcion: null, num_anillos: 2, carbones_por_anillo: 4, alto_carbon_mm: 60, prealarma_mm: 30, minimo_cambio_mm: 15, umbral_desgaste_perc: 50, duracion_estimada_dias: 180 },
//     { id: 3, codigo: 'BOL-01', modelo: 'ABB M2AA', ubicacion: 'Sector C', descripcion: null, num_anillos: 3, carbones_por_anillo: 6, alto_carbon_mm: 55, prealarma_mm: 25, minimo_cambio_mm: 12, umbral_desgaste_perc: 45, duracion_estimada_dias: 150 },
// ];

// const MOCK_ANILLOS: Anillo[] = [
//     { id: 1, motor_id: 1, numero_anillo: 1, carbones: [] },
//     { id: 2, motor_id: 1, numero_anillo: 2, carbones: [] },
//     { id: 3, motor_id: 2, numero_anillo: 1, carbones: [] },
//     { id: 4, motor_id: 2, numero_anillo: 2, carbones: [] },
// ];

// const MOCK_CARBONES: Carbon[] = [
//     { id: 1, anillo_id: 1, numero_carbon: 1, deveui_actual: null },
//     { id: 2, anillo_id: 1, numero_carbon: 2, deveui_actual: null },
//     { id: 3, anillo_id: 1, numero_carbon: 3, deveui_actual: null },
//     { id: 4, anillo_id: 1, numero_carbon: 4, deveui_actual: null },
// ];

// let mockMotorIdCounter = 10;
// let mockAnilloIdCounter = 10;
// let mockCarbonIdCounter = 10;

// @Injectable({ providedIn: 'root' })
// export class MotoresService {

//     createMotor(_empresaId: number, motor: MotorConfiguracionDraft) {
//         return of<CreateMotorResponse>({ id: ++mockMotorIdCounter });
//     }

//     async checkMotoresExist(_empresaId: number): Promise<boolean> {
//         return true;
//     }

//     async createMotores(_empresaId: number, motores: MotorConfiguracionDraft[]) {
//         return motores.map((_, i) => ({ id: i + 1 }));
//     }

//     getAnillosByMotor(motorId: number) {
//         return of(MOCK_ANILLOS.filter(a => a.motor_id === motorId));
//     }

//     deleteAnillo(_anilloId: number) {
//         return of<void>(undefined);
//     }

//     createAnillo(motorId: number, numeroAnillo: number) {
//         return of<Anillo>({ id: ++mockAnilloIdCounter, motor_id: motorId, numero_anillo: numeroAnillo, carbones: [] });
//     }

//     async createAnillosForMotor(motorId: number, numAnillos: number): Promise<Anillo[]> {
//         return Array.from({ length: numAnillos }, (_, i) => ({
//             id: ++mockAnilloIdCounter, motor_id: motorId, numero_anillo: i + 1, carbones: []
//         }));
//     }

//     getCarbonesByAnillo(anilloId: number) {
//         return of(MOCK_CARBONES.filter(c => c.anillo_id === anilloId));
//     }

//     createCarbon(anilloId: number, body: CreateCarbonBody) {
//         return of<Carbon>({ id: ++mockCarbonIdCounter, anillo_id: anilloId, numero_carbon: body.numero_carbon, deveui_actual: null });
//     }

//     deleteCarbon(_carbonId: number) {
//         return of<void>(undefined);
//     }

//     async createCarbonesForAnillo(anillo: Anillo, cantidadCarbones: number, _motorDraft: MotorConfiguracionDraft): Promise<number[]> {
//         return Array.from({ length: cantidadCarbones }, (_, i) => ++mockCarbonIdCounter);
//     }

//     getMotoresByEmpresa(_empresaId: number) {
//         return of(MOCK_MOTORES);
//     }

//     getMotorById(motorId: number) {
//         return of(MOCK_MOTORES.find(m => m.id === motorId) ?? MOCK_MOTORES[0]);
//     }

//     updateMotor(_motorId: number, motor: MotorConfiguracionDraft) {
//         return of<Motor>({ id: _motorId, ...motor });
//     }

//     deleteMotor(_motorId: number) {
//         return of<void>(undefined);
//     }

//     async deleteMotorChildren(_motorId: number): Promise<void> {
//         // mock: no-op
//     }

//     async deleteMotorCompletely(_motorId: number): Promise<void> {
//         // mock: no-op
//     }

//     async createOrUpdateMotores(_empresaId: number, motores: MotorConfiguracionDraft[], existingIds: number[] = []): Promise<number[]> {
//         return motores.map((_, i) => existingIds[i] ?? (i + 1));
//     }
// }