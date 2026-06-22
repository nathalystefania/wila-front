export interface EmpresaApi {
    id: string;
    codigo: string;
    nombre: string;
    pais: string;
}

export interface DivisionApi {
    id: string;
    codigo: string;
    empresa_id: string;
    nombre: string;
    region: string;
    tipo_proceso: string;
}

export interface AreaApi {
    id: string;
    codigo: string;
    division_id: string;
    nombre: string;
    etapa: string;
}

export interface EquipoApi {
    id: string;
    codigo: string;
    area_id: string;
    nombre: string;
    tipo: string;
}

export interface MotorApi {
    id: string;
    codigo: string;
    equipo_id: string;
    nombre: string;
    potencia_kw: number;
    tipo_motor: string;
    anillos_rozantes: boolean;
    apto_wms: boolean;
    estado: string;
}

export interface SensorApi {
    id: string;
    id_hardware: string;
    nombre: string;
    estado: string;
    ocupado: boolean;
    carbon_id_actual?: string;
}

export interface MotorCatalogo {
    id: string;
    codigo: string;
    nombre: string;
    potencia_kw: number;
    tipo_motor: string;

    empresa_id: string;
    empresa_nombre: string;

    division_id: string;
    division_nombre: string;

    area_id: string;
    area_nombre: string;

    equipo_id: string;
    equipo_nombre: string;
}