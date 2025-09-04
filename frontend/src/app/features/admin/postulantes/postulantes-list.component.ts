import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PostulanteService, DocumentoPostulante, ModalidadPostulante } from './postulante.service';
import { Postulante } from './postulante.model';
import { HttpEventType, HttpResponse } from '@angular/common/http';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SgaService } from '../../../shared/services/sga.service';

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
  monto_arancel?: string;
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
  aranceles: any[] = [];
  arancelesGraduacion: any[] = [];
  totalAranceles = 0;
  selectedAranceles: any[] = [];
  totalArancelesSeleccionados = 0;
  
  // Estados de carga
  loadingModalidades = false;
  loadingAranceles = false;
  
  // Pensums
  pensums: string[] = [];
  carreraNormalizada: string | null = null;
  
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

  constructor(private postulanteService: PostulanteService, private sgaService: SgaService) {}

  ngOnInit() {
    this.cargarDatosPostulacion();
    this.cargarPostulantes();
    // Asegurar carga de pensums aún si no hay datos en sessionStorage
    this.cargarPensums();
    // Cargar modalidades desde el backend
    this.cargarModalidades();
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
      if (this.estudiante?.cod_ceta) {
        this.cargarArancelesMaterialExtra();
        // Si ya hay modalidad seleccionada desde la navegación, no sobreescribirla con backend
        if (!this.modalidad) {
          this.cargarModalidadActual();
        }
      }
    }
    // Nota: la carga de pensums se realiza en ngOnInit()
  }

  // --- Pensums ---
  cargarPensums() {
    const carreraRaw = this.estudiante?.carrera || this.postulanteActual.carrera;
    this.carreraNormalizada = this.normalizarCarrera(carreraRaw || null);
    this.sgaService.getPensums(this.carreraNormalizada || undefined).subscribe({
      next: (res) => {
        this.pensums = (res && (res as any).data) ? (res as any).data : [];
        const pensumRaw = (this.postulanteActual.pensum ?? '').toString();
        const normalizedTarget = this.normalizePensumCode(pensumRaw);
        console.log('[Pensums] carrera=', this.carreraNormalizada, 'lista=', this.pensums, 'targetRaw=', pensumRaw, 'targetNorm=', normalizedTarget);
        if (this.pensums.length > 0) {
          if (normalizedTarget) {
            const idx = this.pensums.findIndex(p => this.normalizePensumCode(p) === normalizedTarget);
            if (idx >= 0) {
              this.postulanteActual.pensum = this.pensums[idx];
              console.log('[Pensums] Match encontrado. Seleccionado:', this.postulanteActual.pensum);
            } else if (!pensumRaw) {
              this.postulanteActual.pensum = this.pensums[0];
              console.log('[Pensums] Sin pensum previo. Auto-seleccionado:', this.postulanteActual.pensum);
            } else {
              console.warn('[Pensums] No hay match exacto para', pensumRaw, 'en', this.pensums);
            }
          } else {
            this.postulanteActual.pensum = this.pensums[0];
            console.log('[Pensums] Sin pensum previo. Auto-seleccionado:', this.postulanteActual.pensum);
          }
        }
      },
      error: (err) => {
        console.error('Error al cargar pensums:', err);
        this.pensums = [];
      }
    });
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
          // Refrescar modalidad actual desde el backend
          this.cargarModalidadActual();
        },
        error: (err) => {
          console.error('Error al asignar modalidad:', err);
          // Opcionalmente mostrar un mensaje de error
        }
      });
    }
  }

  // --- Modalidades: carga y estado actual ---
  cargarModalidades() {
    this.loadingModalidades = true;
    this.postulanteService.getModalidades().subscribe({
      next: (res: any) => {
        const lista = Array.isArray(res) ? res : (res && Array.isArray(res.data) ? res.data : []);
        this.modalidades = (lista || []).map((m: any) => ({
          id: m.id,
          nombre: m.nombre,
          descripcion: m.descripcion || '',
          icono: this.getIconForModalidad(m?.nombre ?? m?.id),
          monto_arancel: m.monto_arancel || undefined,
        }));
        this.loadingModalidades = false;
        // Si no hay modalidad ya establecida (p. ej., desde sessionStorage), consultar al backend
        if (!this.modalidad) {
          this.cargarModalidadActual();
        }
      },
      error: (err) => {
        console.error('Error al cargar modalidades:', err);
        this.modalidades = [];
        this.loadingModalidades = false;
      }
    });
  }

  cargarModalidadActual() {
    const codCeta = this.postulanteActual.cod_ceta || this.estudiante?.cod_ceta;
    if (!codCeta) return;
    this.postulanteService.getModalidadPostulante(codCeta as number).subscribe({
      next: (res: any) => {
        const mod = res?.modalidad || null;
        if (mod) {
          // Usar la modalidad devuelta por el backend
          this.modalidad = {
            id: mod.id,
            nombre: mod.nombre,
            descripcion: mod.descripcion || '',
            icono: this.getIconForModalidad(mod?.nombre ?? mod?.id),
            monto_arancel: mod.monto_arancel || undefined,
          };
        } else {
          const mid = res?.modalidad_id;
          if (mid && this.modalidades?.length) {
            this.modalidad = this.modalidades.find(m => m.id === mid) || null;
          } else {
            this.modalidad = null;
          }
        }
      },
      error: (err) => {
        if (err && err.status === 404) {
          this.modalidad = null;
        } else {
          console.error('Error al obtener modalidad del postulante:', err);
        }
      }
    });
  }

  private getIconForModalidad(val: string | number | undefined): string {
    if (typeof val === 'number') {
      switch (val) {
        case 1: return 'bi-book';
        case 2: return 'bi-award';
        case 3: return 'bi-building';
        case 4: return 'bi-person-workspace';
        default: return 'bi-mortarboard';
      }
    }
    const s = (val || '').toString().toLowerCase();
    if (s.includes('proyecto')) return 'bi-book';
    if (s.includes('excelencia')) return 'bi-award';
    if (s.includes('práct') || s.includes('pract')) return 'bi-building';
    if (s.includes('trabajo')) return 'bi-person-workspace';
    return 'bi-mortarboard';
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

  // --- Aranceles (Material Extra) ---
  cargarArancelesMaterialExtra() {
    const codCeta = this.postulanteActual.cod_ceta || this.estudiante?.cod_ceta;
    if (!codCeta) {
      this.aranceles = [];
      this.totalAranceles = 0;
      return;
    }
    this.loadingAranceles = true;
    // Limpiar selección previa al recargar
    this.selectedAranceles = [];
    this.totalArancelesSeleccionados = 0;
    const carreraRaw = this.estudiante?.carrera || this.postulanteActual.carrera;
    const carrera = this.normalizarCarrera(carreraRaw || null) || undefined;
    this.postulanteService.getArancelesMaterialExtra(codCeta as number | string, carrera).subscribe({
      next: (res) => {
        this.aranceles = res?.data || [];
        this.totalAranceles = res?.total ?? this.aranceles.length;
        this.loadingAranceles = false;
      },
      error: (err) => {
        console.error('Error al cargar aranceles:', err);
        this.aranceles = [];
        this.totalAranceles = 0;
        this.loadingAranceles = false;
      }
    });
  }

  // --- Selección de aranceles y total ---
  isArancelSeleccionado(a: any): boolean {
    return this.selectedAranceles.includes(a);
  }

  onArancelToggle(a: any, checked: boolean) {
    if (checked) {
      if (!this.isArancelSeleccionado(a)) {
        this.selectedAranceles.push(a);
      }
    } else {
      this.selectedAranceles = this.selectedAranceles.filter(x => x !== a);
    }
    this.recalcularTotalSeleccionados();
  }

  recalcularTotalSeleccionados() {
    this.totalArancelesSeleccionados = this.selectedAranceles.reduce((sum, x) => sum + this.toNumber(x?.monto), 0);
  }

  private toNumber(val: any): number {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isFinite(val) ? val : 0;
    const parsed = parseFloat(val.toString().replace(/[^0-9,.-]/g, '').replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
  }

  private normalizarCarrera(c: string | null | undefined): string | null {
    if (!c) return null;
    const s = c.toLowerCase();
    // Códigos exactos o parciales
    if (s.includes('mea')) return 'mecanica';
    if (s.includes('eea')) return 'electricidad';
    // Si menciona electricidad/electrónica
    if (s.includes('elect')) return 'electricidad';
    // Si menciona mecánica o automotriz (y no electricidad)
    if (s.includes('mec') || (s.includes('automotriz') && !s.includes('elect'))) return 'mecanica';
    return null; // dejar que el backend use default
  }

  private normalizePensumCode(p: string | null | undefined): string {
    if (!p) return '';
    return p
      .toString()
      .toUpperCase()
      .replace(/\s+/g, '') // quitar espacios
      .replace(/[–—−]/g, '-') // normalizar guiones largos a '-'
      .replace(/[^A-Z0-9-]+/g, '-') // cualquier separador a '-'
      .replace(/-+/g, '-') // colapsar múltiples '-'
      .replace(/^-|-$/g, ''); // recortar '-' extremos
  }
}