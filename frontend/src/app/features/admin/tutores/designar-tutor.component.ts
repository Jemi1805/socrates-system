import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../../shared/components/header/header.component';

@Component({
  selector: 'app-designar-tutor',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent],
  templateUrl: './designar-tutor.component.html',
  // Nota: si NG2008 persiste, es porque el watcher no detectó el nuevo archivo SCSS.
  // Puedes volver a 'styleUrls' cuando el servidor se reinicie.
  styles: [
    `
    .tutores-container{min-height:100vh;background:linear-gradient(135deg,#052544 0%,#4C9DBD 100%);padding:0}
    .content-wrapper{max-width:1200px;margin:0 auto;padding:2rem 1rem}
    .modalidad-card,.student-table-card{background:#ffffffd2;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.1);backdrop-filter:blur(10px);padding:1rem}
    .card-title{color:#052544;margin:0 0 1rem 0;font-size:1.3rem;font-weight:600;border-bottom:2px solid #4C9DBD;padding-bottom:10px;display:flex;align-items:center;gap:.5rem}
    .btn{color:#052544;border-color:#4C9DBD;border-radius:8px;font-weight:500;padding:.25rem .75rem;transition:all .3s ease}
    .btn:hover{color:#fff !important;background-color:#4C9DBD;transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.15)}
    .btn:active{transform:translateY(0)}
    .btn-primary{background:#4C9DBD;color:#fff}
    .nav-pills .nav-link{border:1px solid #4C9DBD;color:#052544;background:#fff;margin-right:.5rem}
    .nav-pills .nav-link.active{background:#4C9DBD;color:#fff}
    label.form-label{color:#052544;font-weight:500}
    input.form-control{color:#052544}
    `
  ]
})
export class DesignarTutorComponent {
  // Búsqueda por CETA o Nombre (placeholder)
  criterio: 'ceta' | 'nombre' = 'ceta';
  codigoCeta = '';
  nombres = '';
  ap_pat = '';
  ap_mat = '';

  buscar() {
    // TODO: conectar con servicio backend
    console.log('[DesignarTutor] Buscar', { criterio: this.criterio, codigoCeta: this.codigoCeta, nombres: this.nombres, ap_pat: this.ap_pat, ap_mat: this.ap_mat });
  }
}
