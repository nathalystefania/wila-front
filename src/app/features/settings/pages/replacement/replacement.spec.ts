import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Replacement } from './replacement';

describe('Replacement', () => {
  let component: Replacement;
  let fixture: ComponentFixture<Replacement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Replacement],
    }).compileComponents();

    fixture = TestBed.createComponent(Replacement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
