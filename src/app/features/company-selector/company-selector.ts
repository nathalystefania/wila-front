import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { Company } from '@models/company.model';
import { CompanyService } from '@services/company.service';
import { CompanyContextService } from '@services/company-context.service';

@Component({
  selector: 'app-company-selector',
  standalone: true,
  imports: [],
  templateUrl: './company-selector.html',
  styleUrl: './company-selector.scss',
})

export class CompanySelector {
  private readonly companyService = inject(CompanyService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly router = inject(Router);

  readonly companies = signal<Company[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.companyService.getCompanies().subscribe({
      next: companies => {
        this.companies.set(companies);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  selectCompany(company: Company): void {
    this.companyContext.setCompany(company);

    this.router.navigate(['/dashboard']);
  }
}