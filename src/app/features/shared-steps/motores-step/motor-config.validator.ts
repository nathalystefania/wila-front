import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const motorConfigValidator: ValidatorFn = (
  group: AbstractControl
): ValidationErrors | null => {

  const inicial = Number(group.get('largo_inicial')?.value);
  const prealarma = Number(group.get('largo_prealarma')?.value);
  const alarma = Number(group.get('largo_alarma')?.value);

  const aviso = Number(group.get('nivel_bateria_aviso')?.value);
  const minimo = Number(group.get('nivel_bateria_minimo')?.value);

  const errors: ValidationErrors = {};

  // Solo validar si todos tienen valor
  if (!isNaN(inicial) && !isNaN(prealarma) && !isNaN(alarma)) {

    if (prealarma >= inicial) {
      errors['prealarmaMayorIgualInicial'] = true;
    }

    if (alarma >= prealarma) {
      errors['alarmaMayorIgualPrealarma'] = true;
    }
  }

  if (!isNaN(aviso) && !isNaN(minimo)) {

    if (aviso <= minimo) {
      errors['bateriaAvisoInvalida'] = true;
    }
  }

  return Object.keys(errors).length ? errors : null;
};