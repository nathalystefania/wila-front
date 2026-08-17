import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { AlarmaDetalle } from '@models/catalogo.models';

@Component({
  selector: 'app-alarm-resolution-dialog',
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './alarm-resolution-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlarmResolutionDialog {
  readonly data = inject<AlarmaDetalle>(MAT_DIALOG_DATA);

  private readonly dialogRef = inject(MatDialogRef<AlarmResolutionDialog, boolean>);

  cancelar(): void {
    this.dialogRef.close(false);
  }

  confirmar(): void {
    this.dialogRef.close(true);
  }
}
