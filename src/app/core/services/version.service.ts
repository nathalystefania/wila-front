import { Injectable, signal } from '@angular/core';
import { version } from '@environments/version';

@Injectable({
    providedIn: 'root'
})
export class VersionService {

    readonly version = signal(version);

}