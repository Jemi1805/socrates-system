import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../../shared/components/header/header.component';

@Component({
  selector: 'app-registrar-tutor',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent],
  templateUrl: './registrar-tutor.component.html',
  styleUrls: ['./registrar-tutor.component.scss']
})
export class RegistrarTutorComponent {
  // Placeholder de modelo
  tutor: any = {
    nombres: '',
    ap_pat: '',
    ap_mat: '',
    ci: '',
    correo: '',
    telefono: ''
  };

  guardar() {
    // TODO: conectar con servicio backend
    console.log('[RegistrarTutor] Guardar', this.tutor);
    alert('Registro de tutor en construcción.');
  }
}
