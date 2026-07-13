import {
  Injectable,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';

import { isPlatformBrowser } from '@angular/common';

import { CompanyContext } from '@models/catalogo.models';

@Injectable({
  providedIn: 'root',
})
export class CompanyContextService {
  private readonly storageKey =
    'active_company_context';

  private readonly platformId =
    inject(PLATFORM_ID);

  private readonly contextSignal =
    signal<CompanyContext | null>(
      this.loadFromStorage()
    );

  readonly context =
    this.contextSignal.asReadonly();

  readonly empresaId = computed(
    () => this.contextSignal()?.empresaId ?? null
  );

  readonly divisionId = computed(
    () => this.contextSignal()?.divisionId ?? null
  );

  readonly hasActiveCompany = computed(
    () => Boolean(this.empresaId())
  );

  getContext(): CompanyContext | null {
    return this.contextSignal();
  }

  setContext(context: CompanyContext): void {
    this.contextSignal.set(context);
    this.saveToStorage(context);
  }

  clearContext(): void {
    this.contextSignal.set(null);

    if (this.isBrowser) {
      localStorage.removeItem(this.storageKey);
    }
  }

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private loadFromStorage(): CompanyContext | null {
    if (!this.isBrowser) {
      return null;
    }

    try {
      const stored = localStorage.getItem(
        this.storageKey
      );

      return stored
        ? JSON.parse(stored)
        : null;
    } catch {
      localStorage.removeItem(this.storageKey);
      return null;
    }
  }

  private saveToStorage(
    context: CompanyContext
  ): void {
    if (!this.isBrowser) {
      return;
    }

    localStorage.setItem(
      this.storageKey,
      JSON.stringify(context)
    );
  }
}