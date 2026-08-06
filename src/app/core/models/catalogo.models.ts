export type EstadoDesgaste =
  | 'normal'
  | 'advertencia'
  | 'critico'
  | 'sin-datos';

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
    carbon_id_actual?: string | null;
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

export interface CompanyContext {
    empresaId: string;
    divisionId: string | null;
}

export interface TelemetriaApi {
    id: string;
    sensor_id: string;
    carbon_id: string;

    longitud: number | null;
    desgaste: number | null;
    temperatura: number | null;
    porcentaje_bateria: number | null;

    aceleracion: number | null;
    angulo: number | null;
    vibracion: number | null;

    fecha_medicion: string;
}

export interface MotorDashboardRow {
    motorId: string;
    codigo: string;
    nombre: string;

    promedioLongitud: number | null;
    porcentajeDesgaste: number | null;
    estadoDesgaste: EstadoDesgaste;

    temperaturaMaxima: number | null;
    bateriaMinima: number | null;

    cantidadAlarmas: number;
    alarmasCriticas: number;
    alarmasAdvertencia: number;

    esCritico: boolean;
    tieneAdvertencias: boolean;
}

export type AlarmaSeveridad = | 'Critica' | 'Advertencia';

export type AlarmaEstado = | 'Activa' | 'Resuelta';

export interface AlarmaApi {
    id: string;

    empresa_id: string;
    motor_id: string;
    carbon_id: string;
    sensor_id: string;

    titulo: string;
    descripcion: string;
    tipo: string;

    severidad: AlarmaSeveridad;
    estado: AlarmaEstado;

    valor_detectado: string | null;
    valor_umbral: string | null;

    fecha_creacion: string;
    fecha_resolucion: string | null;

    reconocida_en: string | null;
    reconocida_por: string | null;
}
export interface DashboardHomeData {
    motores: MotorDashboardRow[];

    alarmasRecientes: AlarmaApi[];

    totalAlarmasP1: number;
    totalAlarmasP2: number;

    totalCarbones: number;
    totalCarbonesSincronizados: number;
}
export interface CarbonTelemetriaDetalle {
    carbon: CarbonResponse;

    ultimaTelemetria: TelemetriaApi | null;

    cantidadLecturas: number;

    promedioLongitud: number | null;
    porcentajeDesgaste: number | null;
    estadoDesgaste: EstadoDesgaste;

    temperaturaMaxima: number | null;
    bateriaMinima: number | null;
}

export interface AnilloMotorDetalle {
    anillo: AnilloResponse;
    carbones: CarbonTelemetriaDetalle[];
}

export interface MotorDetalle {
    motor: MotorCatalogo;

    anillos: AnilloMotorDetalle[];

    totalAnillos: number;
    totalCarbones: number;
    carbonesConTelemetria: number;

    promedioLongitud: number | null;
    porcentajeDesgaste: number | null;
    estadoDesgaste: EstadoDesgaste;
    
    temperaturaMaxima: number | null;
    bateriaMinima: number | null;
}
