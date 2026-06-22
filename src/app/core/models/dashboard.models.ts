export interface DashboardMotor {
  motor_id: string;
  motor: string;
  division: string;
  area: string;
  potencia_kW: number;
  estado: 'normal' | 'warning' | 'critical';
  desgaste_pct: number;
  temperatura_c: number;
  bateria_pct: number;
  alarmas: string[];
}

export interface DashboardKpis {
  total: number;
  normal: number;
  warning: number;
  critical: number;
}

export interface AlertaReciente {
  motor_id: string;
  motor: string;
  area: string;
  division: string;
  estado: 'normal' | 'warning' | 'critical';
  alarma: string;
}