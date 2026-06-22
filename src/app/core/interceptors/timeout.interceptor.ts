import { HttpInterceptorFn } from '@angular/common/http';
import { timeout } from 'rxjs';

const REQUEST_TIMEOUT_MS = 120_000; // 2 minutos

export const timeoutInterceptor: HttpInterceptorFn = (req, next) => {
    return next(req).pipe(timeout(REQUEST_TIMEOUT_MS));
};
