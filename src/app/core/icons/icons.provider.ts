import { inject, makeEnvironmentProviders, ENVIRONMENT_INITIALIZER } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

export function provideAppIcons() {
    return makeEnvironmentProviders([
        {
            provide: ENVIRONMENT_INITIALIZER,
            useValue: () => {
                const registry = inject(MatIconRegistry);
                const sanitizer = inject(DomSanitizer);

                const icons = [
                    'logo-wila',
                    'icon-check',
                    'icon-motor',
                    'icon-carbon',
                    'icon-not-carbon',        
                ];

                icons.forEach(name => {
                    registry.addSvgIcon(
                        name,
                        sanitizer.bypassSecurityTrustResourceUrl(`assets/images/${name}.svg`),
                    );
                });
            },
            multi: true
        }
    ]);
}