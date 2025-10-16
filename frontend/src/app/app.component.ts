import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LoadingService } from './core/services/loading.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, CommonModule],
  styleUrls: ['./app.component.scss'],
  template: `
    <div class="modal-backdrop fade show cascade-loader" *ngIf="modalLoading$ | async"></div>
    <div class="modal show d-block cascade-loader" *ngIf="modalLoading$ | async" tabindex="-1" role="dialog" aria-modal="true">
      <div class="modal-dialog modal-sm modal-dialog-centered" role="document">
        <div class="modal-content d-flex align-items-center justify-content-center flex-column text-center p-4">
          <div class="spinner-border" role="status"></div>
          <div class="mt-2">Cargando...</div>
        </div>
      </div>
    </div>
    <router-outlet></router-outlet>
  `,
})
export class AppComponent {
  modalLoading$;
  constructor(private loadingService: LoadingService) {
    this.modalLoading$ = this.loadingService.modalLoading$;
  }
}