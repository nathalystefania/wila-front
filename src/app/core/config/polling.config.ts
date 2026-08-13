import { InjectionToken } from '@angular/core';

export interface PollingConfig {
  dashboardMs: number;
  motorDetailMs: number;
  alarmsMs: number;
  defaultMs: number;
}

export const POLLING_CONFIG = new InjectionToken<PollingConfig>('POLLING_CONFIG');

export const DEFAULT_POLLING_CONFIG: PollingConfig = {
  defaultMs: 15_000,
  dashboardMs: 15_000,
  motorDetailMs: 10_000,
  alarmsMs: 15_000,
};
