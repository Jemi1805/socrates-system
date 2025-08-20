import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { Estudiante, EstudianteService } from '../../../core/services/estudiante.service';

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
  nombres: string = '';
  ap_pat: string = '';
  ap_mat: string = '';
  carreraSeleccionada: string = 'mecanica';
  carreras = [
    { valor: 'mecanica', nombre: 'Mecánica Automotriz' },
    { valor: 'electricidad', nombre: 'Electricidad y Electrónica Automotriz' }
  ];
  tiposBusqueda: 'ceta' | 'nombre' = 'nombre';
  intentoBusqueda = false;
  
  // Información del estudiante
  estudiante: Estudiante | null = null;
  estudiantes: Estudiante[] = [];
  estudianteEncontrado = false;
  estudiantesEncontrados = false;
  
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

  cambiarTipoBusqueda(tipo: 'ceta' | 'nombre') {
    this.tiposBusqueda = tipo;
    this.limpiarFormulario();
  }

  buscarPorCeta() {
    this.intentoBusqueda = true;
    
    if (!this.codigoCeta.trim()) {
      this.error = 'Por favor, ingrese un código CETA válido';
      return;
    }

    if (!this.carreraSeleccionada) {
      this.error = 'Por favor, seleccione una carrera';
      return;
    }

    this.loading = true;
    this.error = '';
    this.estudiante = null;
    this.estudianteEncontrado = false;

    this.estudianteService.buscarPorCeta(this.codigoCeta, this.carreraSeleccionada).subscribe({
      next: (response: any) => {
        this.loading = false;
        console.log('Respuesta API estudiante:', response);
        
        if (response.success) {
          try {
            // Intentar extraer datos del estudiante de diferentes estructuras posibles
            if (response.data && response.data.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
              // Caso: response.data.data[0]
              this.estudiante = response.data.data[0];
            } else if (response.data && Array.isArray(response.data) && response.data.length > 0) {
              // Caso: response.data[0]
              this.estudiante = response.data[0];
            } else if (response.data && !Array.isArray(response.data)) {
              // Caso: response.data como objeto directo
              this.estudiante = response.data;
            }
            
            console.log('Estudiante asignado:', this.estudiante);
            
            if (this.estudiante) {
              this.estudianteEncontrado = true;
              this.intentoBusqueda = false;
            } else {
              this.error = 'No se encontraron datos del estudiante';
            }
          } catch (e) {
            console.error('Error al procesar datos:', e);
            this.error = 'Error al procesar los datos del estudiante';
          }
        } else {
          console.error('No se encontraron datos del estudiante:', response);
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

  buscarPorNombre() {
    this.intentoBusqueda = true;
    
    // Verificar que al menos uno de los campos de nombre tenga contenido
    if (!this.nombres.trim() && !this.ap_pat.trim() && !this.ap_mat.trim()) {
      this.error = 'Por favor, ingrese al menos un criterio de búsqueda (nombres, apellido paterno o apellido materno)';
      return;
    }

    if (!this.carreraSeleccionada) {
      this.error = 'Por favor, seleccione una carrera';
      return;
    }

    this.loading = true;
    this.error = '';
    this.estudiante = null;
    this.estudiantes = [];
    this.estudianteEncontrado = false;
    this.estudiantesEncontrados = false;

    this.estudianteService.buscarPorNombre(this.nombres, this.ap_pat, this.ap_mat, this.carreraSeleccionada).subscribe({
      next: (response: any) => {
        this.loading = false;
        console.log('Respuesta API (Nombre):', response);
        
        if (response.success) {
          try {
            // Procesar lista de estudiantes
            if (response.data) {
              if (Array.isArray(response.data)) {
                // Caso: response.data es un array
                this.estudiantes = response.data;
              } else if (response.data.data && Array.isArray(response.data.data)) {
                // Caso: response.data.data es un array
                this.estudiantes = response.data.data;
              } else {
                // Caso: response.data es un objeto único
                this.estudiantes = [response.data];
              }
              
              console.log('Estudiantes encontrados:', this.estudiantes.length, this.estudiantes);
              
              if (this.estudiantes.length > 0) {
                this.estudiantesEncontrados = true;
                // Si solo hay un estudiante, seleccionarlo automáticamente
                if (this.estudiantes.length === 1) {
                  this.estudiante = this.estudiantes[0];
                  this.estudianteEncontrado = true;
                }
                this.intentoBusqueda = false;
              } else {
                this.error = 'No se encontraron estudiantes con los criterios proporcionados';
              }
            } else {
              this.error = 'No se recibieron datos de estudiantes';
            }
          } catch (e) {
            console.error('Error al procesar datos (Nombre):', e);
            this.error = 'Error al procesar los datos del estudiante';
          }
        } else {
          console.error('No se encontraron datos del estudiante:', response);
          this.error = response.message || 'No se encontró ningún estudiante con los criterios proporcionados';
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
  
  seleccionarEstudiante(estudiante: Estudiante) {
    this.estudiante = estudiante;
    this.estudianteEncontrado = true;
    this.modalidadSeleccionada = null;
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
    this.nombres = '';
    this.ap_pat = '';
    this.ap_mat = '';
    this.estudiante = null;
    this.estudiantes = [];
    this.estudianteEncontrado = false;
    this.estudiantesEncontrados = false;
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