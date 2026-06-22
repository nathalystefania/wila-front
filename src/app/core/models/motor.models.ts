export interface MotorDraft {
    codigo: string;
    modelo?: string | null;
    ubicacion?: string | null;
    descripcion?: string | null;

    num_anillos: number;
    carbones_por_anillo: number;

    alto_carbon_mm?: number | null;
    prealarma_mm?: number | null;
    minimo_cambio_mm?: number | null;
    umbral_desgaste_perc?: number | null;
    duracion_estimada_dias?: number | null;
}