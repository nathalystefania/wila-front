import { TestBed } from '@angular/core/testing';

import { OnboardingStateService } from './onboarding-state.service';

describe('OnboardingStateService', () => {
  let service: OnboardingStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OnboardingStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
