import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { EstudianteService } from '../../../core/services/estudiante.service';

interface Estudiante {
  cod_ceta: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  ci: string;
  carrera: string;
}

interface ModalidadGraduacion {
  id: number;
  nombre: string;
  descripcion: string;
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
  codigoCeta: string = '';
  numeroCI: string = '';
  tiposBusqueda: 'ceta' | 'ci' = 'ceta';
  intentoBusqueda = false;
  
  // Información del estudiante
  estudiante: Estudiante | null = null;
  estudianteEncontrado = false;
  
  // Modalidades de graduación
  modalidades: ModalidadGraduacion[] = [
    { id: 1, nombre: 'Tesis', descripcion: 'Investigación original con contribución académica significativa' },
    { id: 2, nombre: 'Proyecto de Grado', descripcion: 'Desarrollo de solución tecnológica aplicada' },
    { id: 3, nombre: 'Trabajo Dirigido', descripcion: 'Experiencia práctica en empresa o institución' },
    { id: 4, nombre: 'Examen de Conocimientos', descripcion: 'Evaluación integral de competencias académicas' }
  ];
  
  modalidadSeleccionada: ModalidadGraduacion | null = null;
  
  // Estados
  loading = false;
  error = '';

  constructor(
    private estudianteService: EstudianteService,
    private router: Router
  ) {}

  ngOnInit() {}

  cambiarTipoBusqueda(tipo: 'ceta' | 'ci') {
    this.tiposBusqueda = tipo;
    this.limpiarFormulario();
  }

  buscarPorCeta() {
    this.intentoBusqueda = true;
    
    if (!this.codigoCeta.trim()) {
      this.error = 'Por favor, ingrese un código CETA válido';
      return;
    }

    this.loading = true;
    this.error = '';
    this.estudiante = null;
    this.estudianteEncontrado = false;

    this.estudianteService.buscarPorCeta(this.codigoCeta).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success && response.data) {
          this.estudiante = response.data;
          this.estudianteEncontrado = true;
          this.intentoBusqueda = false;
        } else {
          this.error = 'No se encontró ningún estudiante con el código CETA proporcionado';
        }
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Error al conectar con el servidor. Intente nuevamente.';
        console.error('Error:', error);
      }
    });
  }

  buscarPorCI() {
    this.intentoBusqueda = true;
    
    if (!this.numeroCI.trim()) {
      this.error = 'Por favor, ingrese un número de CI válido';
      return;
    }

    this.loading = true;
    this.error = '';
    this.estudiante = null;
    this.estudianteEncontrado = false;

    this.estudianteService.buscarPorCI(this.numeroCI).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success && response.data) {
          this.estudiante = response.data;
          this.estudianteEncontrado = true;
          this.intentoBusqueda = false;
        } else {
          this.error = 'No se encontró ningún estudiante con el número de CI proporcionado';
        }
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Error al conectar con el servidor. Intente nuevamente.';
        console.error('Error:', error);
      }
    });
  }

  seleccionarModalidad(modalidad: ModalidadGraduacion) {
    this.modalidadSeleccionada = modalidad;
  }

  continuarConModalidad() {
    if (!this.estudiante || !this.modalidadSeleccionada) {
      this.error = 'Debe seleccionar un estudiante y una modalidad';
      return;
    }

    // Guardar datos en sessionStorage para pasarlos a postulantes
    const datosPostulacion = {
      estudiante: this.estudiante,
      modalidad: this.modalidadSeleccionada
    };
    sessionStorage.setItem('datos_postulacion', JSON.stringify(datosPostulacion));

    // Navegar a la página de postulantes
    this.router.navigate(['/postulantes']);
  }

  limpiarFormulario() {
    this.codigoCeta = '';
    this.numeroCI = '';
    this.estudiante = null;
    this.estudianteEncontrado = false;
    this.modalidadSeleccionada = null;
    this.error = '';
    this.intentoBusqueda = false;
  }

  // Métodos para mejorar la UI de modalidades
  getModalidadIcon(modalidadId: number): string {
    const icons = {
      1: 'bi bi-journal-text',     // Tesis
      2: 'bi bi-gear-fill',        // Proyecto de Grado
      3: 'bi bi-building',         // Trabajo Dirigido
      4: 'bi bi-clipboard-check'   // Examen de Conocimientos
    };
    return icons[modalidadId as keyof typeof icons] || 'bi bi-mortarboard';
  }

  getModalidadFeatures(modalidadId: number): string[] {
    const features = {
      1: ['Investigación original', 'Contribución académica', 'Defensa pública'],
      2: ['Solución tecnológica', 'Aplicación práctica', 'Innovación'],
      3: ['Experiencia laboral', 'Aplicación de conocimientos', 'Supervisión profesional'],
      4: ['Evaluación integral', 'Conocimientos teóricos', 'Competencias prácticas']
    };
    return features[modalidadId as keyof typeof features] || [];
  }

  getModalidadDifficulty(modalidadId: number): number {
    const difficulty = {
      1: 5, // Tesis - Más difícil
      2: 4, // Proyecto de Grado
      3: 3, // Trabajo Dirigido
      4: 2  // Examen de Conocimientos - Menos difícil
    };
    return difficulty[modalidadId as keyof typeof difficulty] || 3;
  }

  getModalidadDuration(modalidadId: number): string {
    const durations = {
      1: '12-18 meses',
      2: '8-12 meses',
      3: '6-9 meses',
      4: '3-6 meses'
    };
    return durations[modalidadId as keyof typeof durations] || 'Variable';
  }

  getModalidadRequirements(modalidadId: number): string {
    const requirements = {
      1: 'Promedio mínimo 75, propuesta aprobada, tutor asignado',
      2: 'Promedio mínimo 70, proyecto factible, recursos disponibles',
      3: 'Promedio mínimo 65, convenio institucional, supervisor designado',
      4: 'Promedio mínimo 60, materias aprobadas, inscripción vigente'
    };
    return requirements[modalidadId as keyof typeof requirements] || 'Consultar reglamento';
  }

  getModalidadProcess(modalidadId: number): string {
    const processes = {
      1: 'Propuesta → Perfil → Desarrollo → Defensa → Graduación',
      2: 'Propuesta → Desarrollo → Implementación → Defensa → Graduación',
      3: 'Postulación → Asignación → Desarrollo → Informe → Graduación',
      4: 'Inscripción → Preparación → Exámenes → Resultados → Graduación'
    };
    return processes[modalidadId as keyof typeof processes] || 'Proceso estándar';
  }

  onToggleSidebar() {
    console.log('Toggle sidebar clicked');
  }
} 