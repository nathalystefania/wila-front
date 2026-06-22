import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

import { CatalogoService } from '@services/catalogo.service';
import { MotorCatalogo } from '@models/catalogo.models';
import { DashboardMotor, DashboardKpis, AlertaReciente } from '@models/dashboard.models';

@Component({
  selector: 'app-dashboard-home',
  imports: [CommonModule, MatButtonModule],
  templateUrl: './dashboard-home.html',
  styleUrl: './dashboard-home.scss',
})
export class DashboardHome {
  private catalogoService = inject(CatalogoService);

  motores: DashboardMotor[] = [];
  kpis: DashboardKpis = { total: 0, normal: 0, warning: 0, critical: 0 };
  alertas: AlertaReciente[] = [];

  constructor() {
    this.catalogoService.getMotoresCatalogo().subscribe({
      next: motores => {
        this.motores = motores.map(motor => this.toDashboardMotor(motor));
        this.kpis = {
          total: this.motores.length,
          normal: this.motores.filter(m => m.estado === 'normal').length,
          warning: this.motores.filter(m => m.estado === 'warning').length,
          critical: this.motores.filter(m => m.estado === 'critical').length,
        };
        this.alertas = this.buildAlertas(this.motores);
      },
      error: () => {
        this.motores = [];
        this.kpis = { total: 0, normal: 0, warning: 0, critical: 0 };
        this.alertas = [];
      }
    });
  }

  private toDashboardMotor(motor: MotorCatalogo): DashboardMotor {
    return {
      motor_id: motor.id,
      motor: motor.nombre,
      division: motor.division_id,
      area: motor.area_id,
      potencia_kW: motor.potencia_kw,
      estado: 'normal',
      desgaste_pct: 0,
      temperatura_c: 0,
      bateria_pct: 0,
      alarmas: [],
    };
  }

  private buildAlertas(motores: DashboardMotor[]): AlertaReciente[] {
    const alertas: AlertaReciente[] = [];
    for (const motor of motores) {
      for (const alarma of motor.alarmas) {
        alertas.push({
          motor_id: motor.motor_id,
          motor: motor.motor,
          area: motor.area,
          division: motor.division,
          estado: motor.estado,
          alarma,
        });
      }
    }
    return alertas;
  }

  estadoClass(estado: string): string {
    return `bg-state-${estado} text-on-state-normal`;
  }

  borderClass(estado: string): string {
    return `border-state-${estado}`;
  }
}
