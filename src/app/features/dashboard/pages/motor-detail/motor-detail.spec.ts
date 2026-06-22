import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MotorDetail } from './motor-detail';

describe('MotorDetail', () => {
  let component: MotorDetail;
  let fixture: ComponentFixture<MotorDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MotorDetail],
    }).compileComponents();

    fixture = TestBed.createComponent(MotorDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
