export interface PlantaDraft {
  empresaId: string;
  divisionId: string | null;
}

export interface Planta {
    id: number;
    nombre: string;
    empresaId: string;
    divisionId: string | null;
    areaId: string | null;
    email_notificaciones?: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreatePlantaResponse {
    id: number;
}