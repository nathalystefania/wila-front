import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Company } from '@models/company.model';
import { environment } from '@environments/environment';

@Injectable({
  providedIn: 'root',
})
export class CompanyService {
  private readonly http = inject(HttpClient);

  getCompanies(): Observable<Company[]> {
    return this.http.get<Company[]>(
      `${environment.apiUrl}/empresas`
    );
  }
}