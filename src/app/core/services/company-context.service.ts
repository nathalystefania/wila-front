import { Injectable, signal } from '@angular/core';
import { Company } from '@models/company.model';

@Injectable({
  providedIn: 'root',
})
export class CompanyContextService {
  private readonly _company = signal<Company | null>(null);

  readonly currentCompany = this._company.asReadonly();

  setCompany(company: Company): void {
    this._company.set(company);
  }

  clear(): void {
    this._company.set(null);
  }
}