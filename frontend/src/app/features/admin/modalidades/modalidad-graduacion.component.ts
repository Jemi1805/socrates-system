import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../../shared/components/header/header.component';

interface Estudiante {
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombres: string;
  carrera: string;
}

@Component({
  selector: 'app-modalidad-graduacion',
  templateUrl: './modalidad-graduacion.component.html',
  styleUrls: ['./modalidad-graduacion.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent],
})
export class ModalidadGraduacionComponent implements OnInit {
  
  // Formulario de búsqueda
  carreraSeleccionada: string = '';
  codigoCeta: string = '';
  numeroCI: string = '';
  
  // Información del estudiante
  estudiante: Estudiante | null = null;
  
  // Opciones de carrera
  carreras = [
    'Electricidad y Electrónica Automotriz',
    'Informática',
    'Mecánica Automotriz',
    'Administración de Empresas',
    'Contabilidad'
  ];

  constructor() {}

  ngOnInit() {}

  buscarPorCeta() {
    // Simular búsqueda por código CETA
    if (this.codigoCeta) {
      this.estudiante = {
        apellidoPaterno: 'Mejia',
        apellidoMaterno: 'Mamani',
        nombres: 'Cristhian Ronald',
        carrera: 'Electricidad y Electrónica Automotriz'
      };
    }
  }

  buscarPorCI() {
    // Simular búsqueda por CI
    if (this.numeroCI) {
      this.estudiante = {
        apellidoPaterno: 'Mejia',
        apellidoMaterno: 'Mamani',
        nombres: 'Cristhian Ronald',
        carrera: 'Electricidad y Electrónica Automotriz'
      };
    }
  }

  limpiarFormulario() {
    this.carreraSeleccionada = '';
    this.codigoCeta = '';
    this.numeroCI = '';
    this.estudiante = null;
  }

  onToggleSidebar() {
    // Aquí puedes implementar la lógica para mostrar/ocultar el sidebar
    console.log('Toggle sidebar clicked');
  }
} 