import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { Estudiante, EstudianteService } from '../../../core/services/estudiante.service';
import { PostulanteService } from '../postulantes/postulante.service';

interface ModalidadGraduacion {
  id: number;
  nombre: string;
  descripcion: string;
  monto_arancel?: string;
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
  tiposBusqueda: 'ceta' | 'nombre' = 'ceta';
  intentoBusqueda = false;
  
  // Información del estudiante
  estudiante: Estudiante | null = null;
  estudiantes: Estudiante[] = [];
  estudianteEncontrado = false;
  estudiantesEncontrados = false;
  
  // Modalidades de graduación
  modalidades: ModalidadGraduacion[] = [];
  
  modalidadSeleccionada: ModalidadGraduacion | null = null;
  
  // Estados
  loading = false;
  error = '';
  modalVisible = false;
  loadingModalidades = false;

  constructor(
    private estudianteService: EstudianteService,
    private router: Router,
    private postulanteService: PostulanteService
  ) {}

  ngOnInit() {
    this.cargarModalidades();
  }
 
  cargarModalidades() {
    this.loadingModalidades = true;
    this.postulanteService.getModalidades().subscribe({
      next: (res: any) => {
        const lista = Array.isArray(res) ? res : (res && Array.isArray(res.data) ? res.data : []);
        this.modalidades = (lista || []).map((m: any) => ({
          id: m.id,
          nombre: m.nombre,
          descripcion: m.descripcion || '',
          monto_arancel: m.monto_arancel || ''
        }));
        this.loadingModalidades = false;
      },
      error: (err) => {
        console.error('Error al cargar modalidades:', err);
        this.modalidades = [];
        this.loadingModalidades = false;
      }
    });
  }

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
    this.estudiantes = [];
    this.estudianteEncontrado = false;
    this.estudiantesEncontrados = false;

    this.estudianteService.buscarPorCeta(this.codigoCeta, this.carreraSeleccionada).subscribe({
      next: (response: any) => {
        this.loading = false;
        console.log('Respuesta API estudiante (CETA):', response);
        
        if (response.success) {
          try {
            let estudianteTmp: Estudiante | null = null;
            
            // Intentar extraer datos del estudiante de diferentes estructuras posibles
            if (response.data && response.data.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
              // Caso: response.data.data[0]
              estudianteTmp = response.data.data[0];
              this.estudiantes = response.data.data;
            } else if (response.data && Array.isArray(response.data) && response.data.length > 0) {
              // Caso: response.data[0]
              estudianteTmp = response.data[0];
              this.estudiantes = response.data;
            } else if (response.data && !Array.isArray(response.data)) {
              // Caso: response.data como objeto directo
              estudianteTmp = response.data;
              this.estudiantes = [response.data];
            }
            
            // Filtrar resultados vacíos/ inválidos para evitar filas sin datos
            this.estudiantes = (this.estudiantes || []).filter(e => this.tieneDatosEstudiante(e));

            console.log('Estudiantes encontrados (CETA):', this.estudiantes.length, this.estudiantes);
            
            if (this.estudiantes.length > 0) {
              this.estudiantesEncontrados = true;
              this.intentoBusqueda = false;
            } else {
              this.estudiantesEncontrados = false;
            }
          } catch (e) {
            console.error('Error al procesar datos (CETA):', e);
            this.error = 'Error al procesar los datos del estudiante';
          }
        } else {
          console.error('No se encontraron datos del estudiante (CETA):', response);
          this.error = response.message || 'No se encontró ningún estudiante con el código CETA proporcionado';
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
              
              // Filtrar resultados vacíos/ inválidos
              this.estudiantes = (this.estudiantes || []).filter(e => this.tieneDatosEstudiante(e));

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
                this.estudiantesEncontrados = false;
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

  seleccionarEstudianteYAbrirModal(estudiante: Estudiante) {
    this.seleccionarEstudiante(estudiante);
    this.abrirModal();
  }
  
  abrirModal() {
    this.modalVisible = true;
    document.body.classList.add('modal-open');
  }
  
  cerrarModal() {
    this.modalVisible = false;
    document.body.classList.remove('modal-open');
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
    
    // Cerrar el modal
    this.cerrarModal();

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

  registrarNuevoPostulante() {
    // Limpiar cualquier dato previo y navegar a la interfaz de Postulantes vacía
    try {
      sessionStorage.removeItem('datos_postulacion');
    } catch (e) {
      console.warn('No se pudo limpiar sessionStorage', e);
    }
    this.router.navigate(['/postulantes']);
  }

  tieneDatosEstudiante(e: any): boolean {
    if (!e || typeof e !== 'object') {
      return false;
    }
    const cod = ((e.cod_ceta ?? e.codCeta ?? e.codigo_ceta) ?? '').toString().trim();
    const nombres = (e.nombres ?? '').toString().trim();
    const apPat = (e.ap_pat ?? '').toString().trim();
    const apMat = (e.ap_mat ?? '').toString().trim();
    const ci = (e.ci ?? '').toString().trim();
    // Consideramos válido si existe al menos un dato identificatorio
    return !!(cod || ci || nombres || apPat || apMat);
  }

  // Métodos para mejorar la UI de modalidades
  getModalidadIcon(modalidadId: number): string {
    const icons = {
      1: 'bi bi-journal-text',     // Tesis
      2: 'bi bi-gear-fill',        // Proyecto Sociocomunitario Productivo
      3: 'bi bi-building',         // Proyecto de Emprendimiento Productivo
      4: 'bi bi-clipboard-check',   // Trabajo Dirigido Externo
      5: 'bi bi-award-fill',       // Graduacion por Experiencia Laboral
      6: 'bi bi-lightning-fill'    // Graduación por Excelencia Académica
    };
    return icons[modalidadId as keyof typeof icons] || 'bi bi-mortarboard';
  }

  getModalidadDuration(modalidadId: number): string {
    const durations = {
      1: '4 meses',
      2: '4 meses',
      3: '4 meses',
      4: '4 meses',
      5: 'Variable',
      6: '4 meses'
    };
    return durations[modalidadId as keyof typeof durations] || 'Variable';
  }

  getModalidadRequirements(modalidadId: number): string {
    const requirements = {
      1: 'Definición de Tema o área de trabajo, Formulario 1 (FDMG-1), Tutor Asignado, Perfil de Proyecto de Grado, Informe de Suficiencia, Perfil de Proyecto de Grado Aprobado',
      2: 'Equipo de 2-3 estudiantes (mismo instituto), Equipo 2-5 (diferentes institutos), Definición de Tema o área de trabajo, Formulario 1 (FDMG-1), Tutor Asignado, Perfil del Proyecto Sociocomunitario, Informe de Suficiencia, Perfil de Proyecto Sociocomunitario Aprobado',
      3: 'Equipo de 1-3 estudiantes, Definición de Tema o área de trabajo, Formulario 1 (FDMG-1), Tutor Asignado, Perfil del Proyecto de Emprendimiento Productivo, Enriquecimiento del proyecto, Perfil del Proyecto de Emprendimiento Productivo Aprobado',
      4: 'Definición de área de trabajo, Formulario 1 (FDMG-1), Tutor Asignado, Perfil de Trabajo Dirigido, Informe Técnico de Tutor y Supervisor de la Institución/Empresa/Emprendimiento, Perfil de Trabajo Dirigido Aprobado',
      5: 'Promedio general >= 90, No haber reprobado ninguna materia, Solicitud con nota a Dirección Académica',
      6: 'Definición Propuesta de Mejora Técnica/Tecnológica de Innoovación, Documentación de respaldo, Formulario 1 (FDMG-1), Tutor Asignado, Aprobación de la propuesta por inmediato superior, Informe de Tutor, Informe de Supervisor, Propuesta Aprobada'
    };
    return requirements[modalidadId as keyof typeof requirements] || 'Consultar reglamento';
  }

  getModalidadProcess(modalidadId: number): string {
    const processes = {
      1: 'Desarrollo del Proyecto de Grado → Pre-Defensa → Defensa → Graduación',
      2: 'Desarrollo del Proyecto Sociocomunitario → Pre-Defensa → Defensa → Graduación',
      3: 'Postulación → Asignación → Desarrollo → Informe → Graduación',
      4: 'Desarrollo del Trabajo Dirigido Externo → Informes de Trabajo → Exposición de su trabajo en sus etapas teórico-prácticas → Graduación',
      5: 'Nota de aceptación a la solicitud → Acta de Modalidad de Graduación por Excelencia Académica → Graduación',
      6: 'Desarrollo de la Propuesta de Mejora Técnica/Tecnológica → Informe Final → Defensa de la Propuesta → Graduación'
    };
    return processes[modalidadId as keyof typeof processes] || 'Proceso estándar';
  }

  onToggleSidebar() {
    console.log('Toggle sidebar clicked');
  }
} 