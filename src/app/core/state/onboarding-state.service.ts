import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  EmpresaSelectionDraft,
  CarbonConfiguracionDraft,
  MotorConfiguracionDraft,
  AsignacionDraft,
} from '@core/models/catalogo.models';

export interface AuthDraft {
  email: string;
  mode: 'register' | 'login';
}

@Injectable({ providedIn: 'root' })
export class OnboardingStateService {
  private readonly storageKey = 'onboarding_state';
  private platformId = inject(PLATFORM_ID);
  
  private state: {
    authDraft?: AuthDraft;
    empresaDraft?: EmpresaSelectionDraft;
    motoresDraft?: MotorConfiguracionDraft[];
    carbonesConfiguracionDraft?: CarbonConfiguracionDraft[];
    carbonDraft?: string[];
    asignacionDraft?: AsignacionDraft[];
  } = {};

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (!this.isBrowser) return;
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.state = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Error loading onboarding state from localStorage:', error);
      this.state = {};
    }
  }

  private saveToStorage() {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch (error) {
      console.warn('Error saving onboarding state to localStorage:', error);
    }
  }

  // Auth
  setAuthDraft(draft: AuthDraft) {
    this.state.authDraft = draft;
    this.saveToStorage();
  }
  getAuthDraft(): AuthDraft | null {
    return this.state.authDraft ?? null;
  }

  // Empresa
  setEmpresaDraft(draft: EmpresaSelectionDraft | null) {
    if (draft === null) {
      delete this.state.empresaDraft;
    } else {
      this.state.empresaDraft = draft;
    }
    this.saveToStorage();
  }
  getEmpresaDraft(): EmpresaSelectionDraft | null {
    return this.state.empresaDraft ?? null;
  }

  // Motores (draft)
  setMotoresDraft(motores: MotorConfiguracionDraft[] | null) {
    if (motores === null) {
      delete this.state.motoresDraft;
    } else {
      this.state.motoresDraft = motores;
    }
    this.saveToStorage();
  }
  getMotoresDraft(): MotorConfiguracionDraft[] | null {
    return this.state.motoresDraft ?? null;
  }

  setCarbonesConfiguracionDraft(carbones: CarbonConfiguracionDraft[] | null) {
    if (carbones === null) {
      delete this.state.carbonesConfiguracionDraft;
    } else {
      this.state.carbonesConfiguracionDraft = carbones;
    }
    this.saveToStorage();
  }

  getCarbonesConfiguracionDraft(): CarbonConfiguracionDraft[] | null {
    return this.state.carbonesConfiguracionDraft ?? null;
  }

  // IDs de carbones en onboarding
  setcarbonDraft(ids: string[] | null) {
    if (ids === null) {
      delete this.state.carbonDraft;
    } else {
      this.state.carbonDraft = ids;
    }
    this.saveToStorage();
  }

  getcarbonDraft(): string[] {
    return this.state.carbonDraft ?? [];
  }

  setAsignacionDraft(asignaciones: AsignacionDraft[] | null) {
    if (asignaciones === null) {
      delete this.state.asignacionDraft;
    } else {
      this.state.asignacionDraft = asignaciones;
    }
    this.saveToStorage();
  }

  getAsignacionDraft(): AsignacionDraft[] | null {
    return this.state.asignacionDraft ?? null;
  }

  clear() {
    this.state = {};
    if (this.isBrowser) {
      localStorage.removeItem(this.storageKey);
    }
  }
}