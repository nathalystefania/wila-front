import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {

    private baseUrl = environment.apiUrl;

    private buildUrl(endpoint: string): string {
        return `${this.baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
    }

    constructor(private http: HttpClient) { }

    get<T>(endpoint: string) {
        return this.http.get<T>(this.buildUrl(endpoint));
    }

    post<T>(endpoint: string, body: any) {
        return this.http.post<T>(this.buildUrl(endpoint), body);
    }

    put<T>(endpoint: string, body: any) {
        return this.http.put<T>(this.buildUrl(endpoint), body);
    }

    delete<T>(endpoint: string) {
        return this.http.delete<T>(this.buildUrl(endpoint));
    }
}