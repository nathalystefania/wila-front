import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompanySelector } from './company-selector';

describe('CompanySelector', () => {
  let component: CompanySelector;
  let fixture: ComponentFixture<CompanySelector>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompanySelector],
    }).compileComponents();

    fixture = TestBed.createComponent(CompanySelector);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
