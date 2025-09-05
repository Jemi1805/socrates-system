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
  // Nuevo registro: habilita selects de carrera y pensum
  esNuevoPostulante = false;

  // Aranceles
  aranceles: any[] = [];
  arancelesGraduacion: any[] = [];
  totalAranceles = 0;
  selectedAranceles: any[] = [];
  totalArancelesSeleccionados = 0;
  // Registro manual de aranceles
  nuevoArancel: {
    gestion: string;
    fecha: string;
    concepto: string;
    monto: string | number;
    num_factura: string;
    num_comprobante: string;
    razon: string;
    nit: string;
  } = {
    gestion: '',
    fecha: '',
    concepto: '',
    monto: '',
    num_factura: '',
    num_comprobante: '',
    razon: '',
    nit: ''
  };
  arancelManualError: string | null = null;
  
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

  // --- Gestiones (inicio/conclusión) ---
  gestionesOpciones: string[] = [];
  private readonly MIN_GESTIONES_DIF = 5; // conclusión debe ser al menos 5 gestiones después del inicio
  // Opción 1: mostrar pocas opciones por defecto y permitir "ver todas"
  mostrarTodasGestiones = false;
  private readonly N_ULTIMAS = 20;

  private generarGestiones(desdeYear: number = 2006) {
    const ahora = new Date();
    let yearActual = ahora.getFullYear();
    const mes = ahora.getMonth() + 1; // 1-12
    // Determinar gestión actual considerando el rango dado: 1 = Feb-Jun, 2 = Jul-Nov, tratar Dic como 2; Ene como 2 del año anterior
    let semestreActual: 1 | 2;
    if (mes >= 2 && mes <= 6) {
      semestreActual = 1;
    } else if (mes >= 7 && mes <= 12) {
      semestreActual = 2;
    } else {
      // mes === 1 (enero): considerar como 2 del año anterior
      semestreActual = 2;
      yearActual = yearActual - 1;
    }
    const ultimaGestion = `${semestreActual}/${yearActual}`;

    const opciones: string[] = [];
    for (let y = desdeYear; y <= yearActual; y++) {
      // 1er semestre siempre
      opciones.push(`1/${y}`);
      // 2do semestre solo si no sobrepasa la última gestión
      if (!(y === yearActual && semestreActual === 1)) {
        opciones.push(`2/${y}`);
      }
    }
    // Asegurar que la última gestión calculada está incluida y quitar posibles extras
    this.gestionesOpciones = opciones.filter(g => this.indiceGestion(g) <= this.indiceGestion(ultimaGestion));
  }

  private indiceGestion(gestion: string): number {
    // Formato esperado: "1/AAAA" o "2/AAAA"
    if (!gestion) return -1;
    const m = gestion.toString().trim().match(/^(1|2)\/(\d{4})$/);
    if (!m) return -1;
    const sem = parseInt(m[1], 10); // 1 o 2
    const year = parseInt(m[2], 10);
    return year * 2 + (sem - 1);
  }

  get gestionesConclusionOpciones(): string[] {
    const ini = this.datosInicioCarrera.gestion_ini;
    if (!ini) return this.gestionesOpciones;
    const minIdx = this.indiceGestion(ini) + this.MIN_GESTIONES_DIF;
    return this.gestionesOpciones.filter(g => this.indiceGestion(g) >= minIdx);
  }

  // Listas para UI (limitadas) segun toggle
  get gestionesOpcionesUI(): string[] {
    if (this.mostrarTodasGestiones) return this.gestionesOpciones;
    const arr = this.gestionesOpciones;
    return arr.slice(Math.max(0, arr.length - this.N_ULTIMAS));
  }

  get gestionesConclusionOpcionesUI(): string[] {
    const base = this.gestionesConclusionOpciones;
    if (this.mostrarTodasGestiones) return base;
    return base.slice(Math.max(0, base.length - this.N_ULTIMAS));
  }

  get gestionValida(): boolean {
    const ini = this.datosInicioCarrera.gestion_ini;
    const fin = this.datosConclusionCarrera.gestion_fin;
    if (!ini || !fin) return true; // no validar hasta que ambos estén seleccionados
    return this.indiceGestion(fin) >= this.indiceGestion(ini) + this.MIN_GESTIONES_DIF;
  }

  get gestionErrorMessage(): string | null {
    const ini = this.datosInicioCarrera.gestion_ini;
    const fin = this.datosConclusionCarrera.gestion_fin;
    if (!ini || !fin) return null;
    if (this.gestionValida) return null;
    return `La gestión de conclusión debe ser mayor a la de inicio por al menos ${this.MIN_GESTIONES_DIF} gestiones.`;
  }

  // --- Handlers para dropdown custom ---
  setGestionInicio(g: string) {
    this.datosInicioCarrera.gestion_ini = g;
    // Si la conclusión ya no es válida con el nuevo inicio, resetearla
    if (!this.gestionValida && this.datosConclusionCarrera.gestion_fin) {
      this.datosConclusionCarrera.gestion_fin = '';
    }
  }

  setGestionFin(g: string) {
    this.datosConclusionCarrera.gestion_fin = g;
  }

  get labelGestionInicio(): string {
    return this.datosInicioCarrera.gestion_ini || 'Seleccione gestión';
  }

  get labelGestionFin(): string {
    return this.datosConclusionCarrera.gestion_fin || 'Seleccione gestión';
  }

  // --- Regímenes (dropdown custom) ---
  readonly regimenOptions: { value: 'semestral' | 'anual'; label: string }[] = [
    { value: 'semestral', label: 'Semestral' },
    { value: 'anual', label: 'Anual' },
  ];

  setRegimenInicio(v: 'semestral' | 'anual') {
    this.datosInicioCarrera.reg_ini_c = v;
  }

  setRegimenFin(v: 'semestral' | 'anual') {
    this.datosConclusionCarrera.reg_con_c = v;
  }

  get labelRegimenInicio(): string {
    const v = this.datosInicioCarrera.reg_ini_c as 'semestral' | 'anual' | undefined;
    const found = this.regimenOptions.find(o => o.value === v);
    return found?.label || 'Seleccione tipo de Régimen';
  }

  get labelRegimenFin(): string {
    const v = this.datosConclusionCarrera.reg_con_c as 'semestral' | 'anual' | undefined;
    const found = this.regimenOptions.find(o => o.value === v);
    return found?.label || 'Seleccione tipo de Régimen';
  }

  // --- Gestión para registro manual de aranceles ---
  setNuevoArancelGestion(g: string) {
    if (!this.nuevoArancel) return;
    this.nuevoArancel.gestion = g;
  }

  get labelNuevoArancelGestion(): string {
    return this.nuevoArancel?.gestion || 'Seleccione gestión';
  }

  constructor(private postulanteService: PostulanteService, private sgaService: SgaService) {}

  ngOnInit() {
    this.cargarDatosPostulacion();
    this.cargarPostulantes();
    // Asegurar carga de pensums aún si no hay datos en sessionStorage
    this.cargarPensums();
    // Cargar modalidades desde el backend
    this.cargarModalidades();
    // Generar lista de gestiones dinámicamente
    this.generarGestiones();
  }

  cargarDatosPostulacion() {
    const datosPostulacion = sessionStorage.getItem('datos_postulacion');
    if (datosPostulacion) {
      const datos = JSON.parse(datosPostulacion);
      this.estudiante = datos.estudiante;
      this.modalidad = datos.modalidad;
      this.esNuevoPostulante = false;
      
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
    } else {
      // Si no hay datos en sessionStorage venimos de "Registrar postulante": habilitar selectores
      this.esNuevoPostulante = true;
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

  // --- Cambio de carrera en nuevo registro ---
  onCarreraChange(newCarrera: string | null) {
    // Actualizar carrera seleccionada para nuevo postulante
    this.carreraNormalizada = newCarrera;
    this.postulanteActual.carrera = newCarrera || '';
    // Limpiar pensum previo para recalcular
    this.postulanteActual.pensum = undefined as any;
    // Recargar lista de pensums según carrera seleccionada
    this.cargarPensums();
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

  // --- Arancel manual: agregar a seleccionados ---
  agregarArancelManual() {
    this.arancelManualError = null;
    if (!this.esNuevoPostulante) {
      this.arancelManualError = 'El registro manual de arancel solo está disponible para nuevos postulantes.';
      return;
    }
    const montoNum = this.toNumber(this.nuevoArancel.monto);
    if (!this.nuevoArancel.concepto || montoNum <= 0) {
      this.arancelManualError = 'Ingrese al menos Concepto y un Monto válido (> 0).';
      return;
    }
    const item: any = {
      gestion: (this.nuevoArancel.gestion || '').toString(),
      fecha: this.nuevoArancel.fecha || '',
      concepto: this.nuevoArancel.concepto,
      monto: montoNum,
      num_factura: (this.nuevoArancel.num_factura || '').toString(),
      num_comprobante: (this.nuevoArancel.num_comprobante || '').toString(),
      razon: this.nuevoArancel.razon || '',
      nit: (this.nuevoArancel.nit || '').toString(),
      origen: 'manual',
      pagado: true,
    };
    // Añadir directamente a seleccionados para reflejar pago manual
    this.selectedAranceles.push(item);
    this.recalcularTotalSeleccionados();
    // Limpiar formulario
    this.nuevoArancel = {
      gestion: '',
      fecha: '',
      concepto: '',
      monto: '',
      num_factura: '',
      num_comprobante: '',
      razon: '',
      nit: ''
    };
  }

  // Acciones de aranceles seleccionados
  marcarPagoCompleto() {
    // Placeholder: aquí podrías persistir estado de pago completo
    console.log('[Aranceles] Pago completo confirmado. Total seleccionado:', this.totalArancelesSeleccionados, 'items:', this.selectedAranceles.length);
  }

  marcarConDeuda() {
    // Placeholder: aquí podrías persistir estado de pago con deuda
    console.log('[Aranceles] Marcado con deuda. Total seleccionado:', this.totalArancelesSeleccionados, 'items:', this.selectedAranceles.length);
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