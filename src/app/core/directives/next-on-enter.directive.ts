import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
  selector: '[nextOnEnter]'
})
export class NextOnEnterDirective {

  constructor(private element: ElementRef<HTMLInputElement>) {}

  @HostListener('keydown.enter', ['$event'])
  onEnter(event: Event) {
    (event as KeyboardEvent).preventDefault();

    const form = this.element.nativeElement.form;

    if (!form) return;

    const elements = Array.from(form.elements) as HTMLElement[];
    const index = elements.indexOf(this.element.nativeElement);

    for (let i = index + 1; i < elements.length; i++) {
      const next = elements[i];

      if (
        next instanceof HTMLInputElement ||
        next instanceof HTMLSelectElement ||
        next instanceof HTMLTextAreaElement
      ) {
        next.focus();
        break;
      }
    }
  }
}