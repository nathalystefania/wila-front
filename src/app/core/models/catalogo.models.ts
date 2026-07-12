export interface AnilloResponse {
    id: string;
    identificador: string;
    motor_id: string;
}

export interface CarbonResponse {
    anillo_id: string;
    id: string;
    identificador: string;
    largo_alarma: number;
    largo_inicial: number;
    largo_prealarma: number;
    nivel_bateria_aviso: number;
    nivel_bateria_minimo: number;
}

export interface CreateAnilloRequest {
  identificador: string;
  motor_id: string;
}

export interface CreateCarbonRequest {
  anillo_id: string;
  identificador: string;
  largo_alarma: number;
  largo_inicial: number;
  largo_prealarma: number;
  nivel_bateria_aviso: number;
  nivel_bateria_minimo: number;
}

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

export interface EmpresaCatalogo {
    id: string;
    codigo: string;
    nombre: string;
    pais: string;
}

export interface EmpresaSelectionDraft {
    empresaId: string;
    divisionId: string | null;
}

export interface AnillosDraft {
  tempId: string;
  identificador: string;
  motor_id: string;
}

export interface CarbonesDraft {
  tempId: string;
  anilloTempId: string;
  identificador: string;
  largo_alarma: number;
  largo_inicial: number;
  largo_prealarma: number;
  nivel_bateria_aviso: number;
  nivel_bateria_minimo: number;
}

export interface AsignacionDraft {
  carbonTempId: string;
  sensor_id: string;
}