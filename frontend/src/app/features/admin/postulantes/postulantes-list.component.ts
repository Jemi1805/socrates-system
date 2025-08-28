import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PostulanteService, DocumentoPostulante, ModalidadPostulante } from './postulante.service';
import { Postulante } from './postulante.model';
import { HttpEventType, HttpResponse } from '@angular/common/http';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

interface Estudiante {
  cod_ceta: string;
  nombres: string;
  ap_pat: string;
  ap_mat: string;
  carrera: string;
  pensum: string;
  fecha_nacimiento: string;
  lugar_nacimiento: string;
  ci: string;
  procedencia?: string;
  nro_serie_titulo?: string;
  reg_ini_c?: string;
  gestion_ini?: string;
  reg_con_c?: string;
  gestion_fin?: string;
  incrip_uni?: boolean;
}

interface ModalidadGraduacion {
  id: number;
  nombre: string;
  descripcion: string;
  icono?: string;
  duracion?: string;
}

interface InscripcionModalidad {
  id: number;
  cod_ceta: number;
  modalidad_id: number;
  estado: string;
  fecha_inscripcion: string;
}

interface Arancel {
  id: number;
  cod_ceta: number;
  concepto: string;
  monto: number;
  fecha: string;
  pagado: boolean;
}

@Component({
  selector: 'app-postulantes-list',
  templateUrl: './postulantes-list.component.html',
  styleUrls: ['./postulantes-list.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent],
})
export class PostulantesListComponent implements OnInit {
  postulantes: Postulante[] = [];
  postulanteActual: Partial<Postulante> = {};
  
  // Datos del estudiante y modalidad
  estudiante: Estudiante | null = null;
  modalidad: ModalidadGraduacion | null = null;
  modalidades: ModalidadGraduacion[] = [];
  inscripciones: InscripcionModalidad[] = [];
  
  // Control del modal
  modalVisible = false;
  showBiographicalData = true;
  showBachilleratoData = true;

  // Aranceles
  aranceles: Arancel[] = [];
  arancelesGraduacion: Arancel[] = [];
  
  // Estados de carga
  loadingModalidades = false;
  loadingAranceles = false;
  
  // Bachillerato
  tipoBachiller: 'nacional' | 'extranjero' | null = null;

  diplomaNacional: {
    nro_serie: string;
    emision: string;
    fecha_emision: string;
    observacion: string;
    gestion_bachillerato: string;
  } = {
    nro_serie: '',
    emision: '',
    fecha_emision: '',
    observacion: '',
    gestion_bachillerato: ''
  };

  homologacionExtranjero: {
    nro_resolucion: string;
    fecha_emision: string;
    grados_gestiones: Array<{ grado: string; gestion: string }>;
  } = {
    nro_resolucion: '',
    fecha_emision: '',
    grados_gestiones: []
  };

  opciones: Record<'educacionRegular' | 'tecnicoMedio' | 'traspasoInstituto' | 'homologacionCambioPlan', boolean> = {
    educacionRegular: false,
    tecnicoMedio: false,
    traspasoInstituto: false,
    homologacionCambioPlan: false
  };

  // Opción seleccionada de forma exclusiva
  selectedOpcion: 'educacionRegular' | 'tecnicoMedio' | 'traspasoInstituto' | 'homologacionCambioPlan' | null = null;

  // Formularios por opción seleccionada
  eduRegularData: { serie_titulo_tm: string; numero_titulo_tm: string; fecha_emision: string } = {
    serie_titulo_tm: '',
    numero_titulo_tm: '',
    fecha_emision: ''
  };

  tecnicoMedioData: { serie_titulo_tm: string; numero_titulo_tm: string; fecha_emision: string } = {
    serie_titulo_tm: '',
    numero_titulo_tm: '',
    fecha_emision: ''
  };

  traspasoData: {
    instituto_origen: string;
    grados_gestiones: Array<{ grado: string; gestion: string }>;
  } = {
    instituto_origen: '',
    grados_gestiones: []
  };

  homoCambioPlanData: {
    nro_resolucion_rectoral: string;
    fecha_emision: string;
    grados_gestiones: Array<{ grado: string; gestion: string }>;
  } = {
    nro_resolucion_rectoral: '',
    fecha_emision: '',
    grados_gestiones: []
  };

  datosInicioCarrera: {
    reg_ini_c: string;
    gestion_ini: string;
  } = {
    reg_ini_c: '',
    gestion_ini: ''
  };

  datosConclusionCarrera: {
    reg_con_c: string;
    gestion_fin: string;
  } = {
    reg_con_c: '',
    gestion_fin: ''
  };

  constructor(private postulanteService: PostulanteService) {
    // Inicializar modalidades para prueba
    this.modalidades = [
      { id: 1, nombre: 'Proyecto de Grado', descripcion: 'Trabajo de investigación y desarrollo', icono: 'bi-book', duracion: '6 meses' },
      { id: 2, nombre: 'Excelencia Académica', descripcion: 'Promedio superior al 80%', icono: 'bi-award', duracion: '3 meses' },
      { id: 3, nombre: 'Prácticas Industriales', descripcion: 'Prácticas en empresa del sector', icono: 'bi-building', duracion: '12 meses' },
      { id: 4, nombre: 'Trabajo Dirigido', descripcion: 'Trabajo dirigido por un profesional', icono: 'bi-person-workspace', duracion: '9 meses' }
    ];
  }

  ngOnInit() {
    this.cargarDatosPostulacion();
    this.cargarPostulantes();
  }

  cargarDatosPostulacion() {
    const datosPostulacion = sessionStorage.getItem('datos_postulacion');
    if (datosPostulacion) {
      const datos = JSON.parse(datosPostulacion);
      this.estudiante = datos.estudiante;
      this.modalidad = datos.modalidad;
      
      // Pre-llenar el formulario con los datos del estudiante
      if (this.estudiante) {
        this.postulanteActual = {
          cod_ceta: parseInt(this.estudiante.cod_ceta),
          nombres_est: this.estudiante.nombres,
          ap_pat: this.estudiante.ap_pat,
          ap_mat: this.estudiante.ap_mat,
          ci: this.estudiante.ci,
          procedencia: this.estudiante.procedencia,
          fecha_nacimiento: this.estudiante.fecha_nacimiento,
          lugar_nacimiento: this.estudiante.lugar_nacimiento,
          carrera: this.estudiante.carrera,
          pensum: this.estudiante.pensum,
          nro_serie_titulo: this.estudiante.nro_serie_titulo || '',
        };
      }
    }
  }

  cargarPostulantes() {
    this.postulanteService.getAll().subscribe((data: Postulante[]) => {
      this.postulantes = data;
    });
  }

  guardar() {
    if (this.postulanteActual.cod_ceta) {
      // Actualizar
      this.postulanteService.update(this.postulanteActual.cod_ceta, this.postulanteActual as Postulante)
        .subscribe(() => {
          this.cargarPostulantes();
          this.cancelar();
        });
    } else {
      // Crear
      this.postulanteService.create(this.postulanteActual as Postulante)
        .subscribe(() => {
          this.cargarPostulantes();
          this.cancelar();
        });
    }
  }

  eliminar(id: number) {
    if (confirm('¿Seguro que deseas eliminar este postulante?')) {
      this.postulanteService.delete(id).subscribe(() => this.cargarPostulantes());
    }
  }

  cancelar() {
    this.postulanteActual = {};
    
    // Resetear estado de modalidad
    this.modalidad = null;
  }
  
  // Métodos para gestión de modalidades
  mostrarModal() {
    this.modalVisible = true;
  }

  ocultarModal() {
    this.modalVisible = false;
  }
  
  seleccionarModalidad(modalidad: ModalidadGraduacion) {
    this.modalidad = modalidad;
    this.ocultarModal();
    
    // Si hay un postulante seleccionado, actualizar la modalidad en el backend
    if (this.postulanteActual.cod_ceta) {
      this.postulanteService.asignarModalidad(this.postulanteActual.cod_ceta, modalidad.id).subscribe({
        next: (resultado) => {
          console.log('Modalidad asignada correctamente:', resultado);
        },
        error: (err) => {
          console.error('Error al asignar modalidad:', err);
          // Opcionalmente mostrar un mensaje de error
        }
      });
    }
  }

  
  getModalidadNombre(): string {
    return this.modalidad ? this.modalidad.nombre : 'Seleccionar modalidad';
  }
  
  toggleBiographicalData() {
    this.showBiographicalData = !this.showBiographicalData;
  }

  toggleBachilleratoData() {
    this.showBachilleratoData = !this.showBachilleratoData;
  }

  // --- Bachillerato: lógica de UI ---
  onTipoBachillerChange(tipo: 'nacional' | 'extranjero') {
    this.tipoBachiller = tipo;
    // Reset de formularios específicos
    this.diplomaNacional = {
      nro_serie: '',
      emision: '',
      fecha_emision: '',
      observacion: '',
      gestion_bachillerato: ''
    };
    this.homologacionExtranjero = {
      nro_resolucion: '',
      fecha_emision: '',
      grados_gestiones: []
    };
    // Reglas de habilitado para opciones
    if (tipo === 'extranjero') {
      this.opciones.educacionRegular = false; // Se deshabilita para extranjero
      if (this.selectedOpcion === 'educacionRegular') {
        this.selectedOpcion = null;
      }
    }
  }

  isOpcionDisabled(opcion: 'educacionRegular' | 'tecnicoMedio' | 'traspasoInstituto' | 'homologacionCambioPlan'): boolean {
    // Regla por tipo de bachiller
    if (opcion === 'educacionRegular' && this.tipoBachiller === 'extranjero') {
      return true;
    }
    // Si hay una opción seleccionada, deshabilitar las demás
    if (this.selectedOpcion && this.selectedOpcion !== opcion) {
      return true;
    }
    return false;
  }

  // --- Opciones: selección exclusiva y helpers ---
  onOpcionToggle(opcion: 'educacionRegular' | 'tecnicoMedio' | 'traspasoInstituto' | 'homologacionCambioPlan', checked: boolean) {
    const isChecked = checked;
    if (isChecked) {
      this.selectedOpcion = opcion;
      // Desmarcar las demás
      (Object.keys(this.opciones) as ('educacionRegular' | 'tecnicoMedio' | 'traspasoInstituto' | 'homologacionCambioPlan')[]).forEach((k) => {
        if (k !== opcion) this.opciones[k] = false;
      });
    } else {
      this.selectedOpcion = null;
    }
  }

  clearOpcion() {
    // Quita la selección actual para permitir elegir otra opción
    this.selectedOpcion = null;
    (Object.keys(this.opciones) as ('educacionRegular' | 'tecnicoMedio' | 'traspasoInstituto' | 'homologacionCambioPlan')[]).forEach((k) => {
      this.opciones[k] = false;
    });
  }

  // --- Traspaso: ABM de grados/gestiones ---
  agregarGradoGestionTraspaso() {
    this.traspasoData.grados_gestiones.push({ grado: '', gestion: '' });
  }

  eliminarGradoGestionTraspaso(index: number) {
    this.traspasoData.grados_gestiones.splice(index, 1);
  }

  // --- Homologación por cambio de plan: ABM de grados/gestiones ---
  agregarGradoGestionCambioPlan() {
    this.homoCambioPlanData.grados_gestiones.push({ grado: '', gestion: '' });
  }

  eliminarGradoGestionCambioPlan(index: number) {
    this.homoCambioPlanData.grados_gestiones.splice(index, 1);
  }

  agregarGradoGestion() {
    this.homologacionExtranjero.grados_gestiones.push({ grado: '', gestion: '' });
  }

  eliminarGradoGestion(index: number) {
    this.homologacionExtranjero.grados_gestiones.splice(index, 1);
  }
}