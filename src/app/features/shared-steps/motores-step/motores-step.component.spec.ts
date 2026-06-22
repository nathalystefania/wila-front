import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MotoresStepComponent } from './motores-step.component';

describe('MotoresStepComponent', () => {
  let component: MotoresStepComponent;
  let fixture: ComponentFixture<MotoresStepComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MotoresStepComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MotoresStepComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
