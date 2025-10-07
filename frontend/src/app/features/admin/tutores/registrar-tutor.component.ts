import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../../shared/components/header/header.component';

@Component({
  selector: 'app-registrar-tutor',
  standalone: true,
  // Componente DEPRECADO: el registro ahora se realiza desde el modal en TutoresHomeComponent
  // Dejamos plantilla inline vacía para evitar NG2008 por falta de archivo HTML
  template: '<!-- Componente deprecated: usar modal en Tutores -->',
  styles: []
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
