import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastStackComponent } from './shared/components/toast/toast.component';
import { ConfirmDialogComponent } from './shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastStackComponent, ConfirmDialogComponent],
  template: `<router-outlet /><dojo-toast-stack /><dojo-confirm-dialog />`,
})
export class AppComponent {}
