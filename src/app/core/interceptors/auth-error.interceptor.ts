import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '@services/auth.service';
import { OnboardingStateService } from '../state/onboarding-state.service';

export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);
    const onboardingState = inject(OnboardingStateService);

    return next(req).pipe(
        catchError((err: HttpErrorResponse) => {
            if (err.status === 401 || err.status === 403) {
                authService.logout();
                onboardingState.clear();
            }
            return throwError(() => err);
        })
    );
};