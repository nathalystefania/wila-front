import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  EmpresaSelectionDraft,
  AnillosDraft,
  CarbonesDraft,
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
    anillosDraft?: AnillosDraft[];
    carbonesDraft?: CarbonesDraft[];
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

  // Anillos (draft)
  setAnillosDraft(anillos: AnillosDraft[] | null) {
    if (anillos === null) {
      delete this.state.anillosDraft;
    } else {
      this.state.anillosDraft = anillos;
    }
    this.saveToStorage();
  }
  getAnillosDraft(): AnillosDraft[] | null {
    return this.state.anillosDraft ?? null;
  }

  setCarbonesDraft(carbones: CarbonesDraft[] | null) {
    if (carbones === null) {
      delete this.state.carbonesDraft;
    } else {
      this.state.carbonesDraft = carbones;
    }
    this.saveToStorage();
  }

  getCarbonesDraft(): CarbonesDraft[] | null {
    return this.state.carbonesDraft ?? null;
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