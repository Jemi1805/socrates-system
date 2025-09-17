import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
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
  // Snapshot del postulante desde la BD (para mostrar datos persistidos en el resumen)
  postulanteDesdeBD: Partial<Postulante> | null = null;
  modalidad: ModalidadGraduacion | null = null;
  modalidades: ModalidadGraduacion[] = [];
  inscripciones: InscripcionModalidad[] = [];
  // Control de visibilidad del botón final de registro
  showRegistrarInscripcion: boolean = false;
  // Modal de éxito
  modalExitoVisible: boolean = false;
  // Resumen de inscripción
  resumenVisible: boolean = false;
  resumenInscripcion: {
    carrera: string | null;
    pensum: string | null;
    cod_ceta: string | number | null;
    nombre_completo: string;
    modalidad: string | null;
    tipo_bachiller: string | null;
    pago_estado: 'Completo' | 'Con deuda';
    aranceles: Array<{ gestion?: string; fecha?: string | null; concepto?: string; monto?: number | string; num_factura?: string; num_comprobante?: string }>;
    es_edu_regular: boolean;
    es_tecnico_medio: boolean;
    es_traspaso: boolean;
    es_cambio_plan: boolean;
  } | null = null;
  // Estado y error de inscripción
  inscripcionLoading: boolean = false;
  inscripcionError: string | null = null;
  
  // Control del modal
  modalVisible = false;
  showBiographicalData = true;
  showBachilleratoData = true;
  // Nuevo registro: habilita selects de carrera y pensum
  esNuevoPostulante = false;
  // Modo de edición para Datos del estudiante (biográficos)
  isEditing = false;
  // Paso 1 completado: al guardar datos biográficos se habilitan las demás secciones
  pasoBiograficosCompletado = false;

  // Aranceles
  aranceles: any[] = [];
  arancelesGraduacion: any[] = [];
  totalAranceles = 0;
  selectedAranceles: any[] = [];
  totalArancelesSeleccionados = 0;
  // Estado de pago para los aranceles seleccionados (conmutador Pago completo / Con deuda)
  pagoCompletoSeleccionados = false;
  // Edición de arancel manual
  editingArancelIndex: number | null = null;
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
  private readonly MIN_GESTIONES_DIF = 1; // conclusión debe ser al menos 1 gestion después del inicio
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

    // Construir en orden DESCENDENTE respecto a la gestión actual
    const opciones: string[] = [];
    // Año actual
    if (semestreActual === 2) {
      opciones.push(`2/${yearActual}`);
      opciones.push(`1/${yearActual}`);
    } else {
      // semestreActual === 1
      opciones.push(`1/${yearActual}`);
    }
    // Años previos completos
    for (let y = yearActual - 1; y >= desdeYear; y--) {
      opciones.push(`2/${y}`);
      opciones.push(`1/${y}`);
    }

    this.gestionesOpciones = opciones;
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
    // Ahora la lista está en orden descendente, tomamos las primeras N
    return arr.slice(0, this.N_ULTIMAS);
  }

  get gestionesConclusionOpcionesUI(): string[] {
    const base = this.gestionesConclusionOpciones;
    if (this.mostrarTodasGestiones) return base;
    // Base también queda en orden descendente
    return base.slice(0, this.N_ULTIMAS);
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

  // --- Validación integral de campos requeridos ---
  private isNonEmpty(v: any): boolean {
    return v !== undefined && v !== null && String(v).toString().trim() !== '';
  }

  private validarCampos(): string[] {
    const faltantes: string[] = [];

    // Datos biográficos mínimos
    const p = this.postulanteActual as any;
    if (!this.isNonEmpty(p.nombres_est)) faltantes.push('Nombres');
    if (!this.isNonEmpty(p.ap_pat)) faltantes.push('Apellido Paterno');
    if (!this.isNonEmpty(p.ap_mat)) faltantes.push('Apellido Materno');
    if (!this.isNonEmpty(p.ci)) faltantes.push('CI');
    if (!this.isNonEmpty(p.carrera)) faltantes.push('Carrera');
    if (!this.isNonEmpty(p.pensum)) faltantes.push('Pensum');
    if (!this.isNonEmpty(p.fecha_nacimiento)) faltantes.push('Fecha de Nacimiento');
    if (!this.isNonEmpty(p.lugar_nacimiento)) faltantes.push('Lugar de Nacimiento');
    if (!this.isNonEmpty(p.procedencia)) faltantes.push('Procedencia');

    // Bachillerato (según tipo)
    if (this.tipoBachiller === 'nacional') {
      if (!this.isNonEmpty(p.nro_serie_titulo)) faltantes.push('N° de Serie (Bachiller Nacional)');
      if (!this.isNonEmpty(this.diplomaNacional.emision)) faltantes.push('Emisión (Bachiller Nacional)');
      if (!this.isNonEmpty(this.diplomaNacional.fecha_emision)) faltantes.push('Fecha de Emisión (Bachiller Nacional)');
      if (!this.isNonEmpty(this.diplomaNacional.gestion_bachillerato)) faltantes.push('Gestión de Bachillerato');
    } else if (this.tipoBachiller === 'extranjero') {
      // Nota: En HTML actual el Nro. Resolución se enlaza a postulanteActual.nro_serie_titulo.
      // Para evitar falsos positivos, exigimos al menos la fecha y, si hubiese resolución en el modelo, validarla.
      if (!this.isNonEmpty(this.homologacionExtranjero.fecha_emision)) faltantes.push('Fecha de Emisión (Bachiller Extranjero)');
    }

    // Datos de Inicio/Conclusión (si el usuario los está usando)
    if (!this.isNonEmpty(this.datosInicioCarrera.gestion_ini)) faltantes.push('Gestión de Inicio de Carrera');
    if (!this.isNonEmpty(this.datosConclusionCarrera.gestion_fin)) faltantes.push('Gestión de Conclusión de Carrera');
    if (this.gestionErrorMessage) faltantes.push(this.gestionErrorMessage);

    // Validación por opción seleccionada (solo valida si está seleccionada)
    switch (this.selectedOpcion) {
      case 'educacionRegular': {
        const e = this.eduRegularData;
        if (!this.isNonEmpty(e.serie_titulo_tm)) faltantes.push('Serie título (Educación Regular)');
        if (!this.isNonEmpty(e.numero_titulo_tm)) faltantes.push('N° de Título (Educación Regular)');
        if (!this.isNonEmpty(e.fecha_emision)) faltantes.push('Fecha de Emisión (Educación Regular)');
        break;
      }
      case 'tecnicoMedio': {
        const t = this.tecnicoMedioData;
        if (!this.isNonEmpty(t.serie_titulo_tm)) faltantes.push('Serie título (Técnico Medio)');
        if (!this.isNonEmpty(t.numero_titulo_tm)) faltantes.push('N° de Título (Técnico Medio)');
        if (!this.isNonEmpty(t.fecha_emision)) faltantes.push('Fecha de Emisión (Técnico Medio)');
        break;
      }
      case 'traspasoInstituto': {
        if (!this.isNonEmpty(this.traspasoData.instituto_origen)) faltantes.push('Instituto de origen (Traspaso)');
        // Si el usuario añadió filas, exigir que estén completas
        (this.traspasoData.grados_gestiones || []).forEach((gg, i) => {
          if (this.isNonEmpty(gg.grado) || this.isNonEmpty(gg.gestion)) {
            if (!this.isNonEmpty(gg.grado)) faltantes.push(`Grado #${i + 1} (Traspaso)`);
            if (!this.isNonEmpty(gg.gestion)) faltantes.push(`Gestión #${i + 1} (Traspaso)`);
          }
        });
        break;
      }
      case 'homologacionCambioPlan': {
        if (!this.isNonEmpty(this.homoCambioPlanData.nro_resolucion_rectoral)) faltantes.push('N° de Resolución Rectoral (Cambio de plan)');
        if (!this.isNonEmpty(this.homoCambioPlanData.fecha_emision)) faltantes.push('Fecha de Emisión (Cambio de plan)');
        (this.homoCambioPlanData.grados_gestiones || []).forEach((gg, i) => {
          if (this.isNonEmpty(gg.grado) || this.isNonEmpty(gg.gestion)) {
            if (!this.isNonEmpty(gg.grado)) faltantes.push(`Grado #${i + 1} (Cambio de plan)`);
            if (!this.isNonEmpty(gg.gestion)) faltantes.push(`Gestión #${i + 1} (Cambio de plan)`);
          }
        });
        break;
      }
      default:
        // Sin opción seleccionada, no validamos secciones específicas
        break;
    }
    // Aranceles: exigir al menos uno seleccionado para poder registrar
    if (!Array.isArray(this.selectedAranceles) || this.selectedAranceles.length === 0) {
      faltantes.push('Seleccione al menos un arancel');
    }

    return faltantes;
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

  constructor(private postulanteService: PostulanteService, private sgaService: SgaService, private router: Router) {}

  // Normalizador para Tipo de Bachiller: siempre 'Nacional' o 'Extranjero'
  private formatTipoBachiller(v: string | null | undefined): string | null {
    if (!v) return null;
    const s = v.toString().trim().toLowerCase();
    if (s.startsWith('nac')) return 'Nacional';
    if (s.startsWith('ext')) return 'Extranjero';
    // Otros valores: capitalizar primera letra por defecto
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : null;
  }

  ngOnInit() {
    this.cargarDatosPostulacion();
    // Intentar traer el postulante desde BD para usar sus valores persistidos
    this.cargarPostulanteDesdeBD();
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
        // Tomar nro_serie_titulo desde la respuesta directa o desde raw si fuese necesario
        const raw = (this.estudiante as any)?.raw || {};
        const serieDesdeRaw = raw['N° Serie Titulo de Bachiller'] || raw['N° Serie Título de Bachiller'] || raw['Nro Serie Titulo de Bachiller'] || '';
        const nroSerieTitulo = (this.estudiante as any)?.nro_serie_titulo || (this.estudiante as any)?.nroSerieTitulo || serieDesdeRaw || '';

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
          nro_serie_titulo: nroSerieTitulo,
        };
        // Diagnóstico
        console.log('[BIO] Prefill SGA:', {
          nro_serie_titulo: nroSerieTitulo,
          procedencia: this.estudiante.procedencia,
        });
        // Si viene número de serie, asumimos Bachiller Nacional por defecto para mostrar el campo
        if (!this.tipoBachiller && this.postulanteActual.nro_serie_titulo) {
          this.tipoBachiller = 'nacional';
        }
        // Reasignar en el siguiente tick para asegurar que el input reciba el valor
        if (nroSerieTitulo) {
          setTimeout(() => {
            this.postulanteActual.nro_serie_titulo = nroSerieTitulo;
          }, 0);
        }
      }
      if (this.estudiante?.cod_ceta) {
        this.cargarArancelesMaterialExtra();
        // Si ya hay modalidad seleccionada desde la navegación, no sobreescribirla con backend
        if (!this.modalidad) {
          this.cargarModalidadActual();
        }
        // Con cod_ceta conocido, sincronizar snapshot desde BD
        this.cargarPostulanteDesdeBD();
      }
    } else {
      // Si no hay datos en sessionStorage venimos de "Registrar postulante": habilitar selectores
      this.esNuevoPostulante = true;
    }
    // Nota: la carga de pensums se realiza en ngOnInit()
    // Al iniciar SIEMPRE se requiere guardar biográficos antes de continuar
    this.pasoBiograficosCompletado = false;
  }

  // --- Cargar postulante desde BD para usar valores persistidos ---
  private cargarPostulanteDesdeBD() {
    const cod = (this.postulanteActual?.cod_ceta || this.estudiante?.cod_ceta) as number | undefined;
    if (!cod) return;
    this.postulanteService.getById(cod).subscribe({
      next: (p) => {
        this.postulanteDesdeBD = p || null;
        // Si ya existe un resumen o está visible, reconstruirlo para usar datos de BD
        if (this.resumenInscripcion || this.resumenVisible) {
          this.construirResumenInscripcion();
        }
      },
      error: (e) => {
        console.warn('No se pudo cargar postulante desde BD:', e);
        this.postulanteDesdeBD = null;
      }
    });
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

  // Navegar de vuelta al buscador de estudiantes (Modalidad de Graduación)
  goBackToModalidades() {
    try {
      // Mantener datos por si el usuario regresa nuevamente
      // sessionStorage.removeItem('datos_postulacion'); // si quisieras limpiar, descomenta
    } catch {}
    this.router.navigate(['/modalidad-graduacion']);
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

  // --- Edición de datos biográficos ---
  iniciarEdicionBiograficos() {
    this.isEditing = true;
  }

  guardarBiograficos() {
    // Si existe cod_ceta, persistimos los cambios; si es nuevo, solo cerramos edición
    if (this.postulanteActual.cod_ceta) {
      this.postulanteService
        .update(this.postulanteActual.cod_ceta as number, this.postulanteActual as Postulante)
        .subscribe({
          next: () => {
            this.cargarPostulantes();
            this.isEditing = false;
          },
          error: () => {
            // En caso de error, mantenemos el modo de edición para que el usuario pueda corregir
          }
        });
    } else {
      this.isEditing = false;
    }
  }

  // Guardar datos biográficos y habilitar el resto de secciones
  guardarYContinuarInscripcion() {
    // Siempre persistimos en backend. Si no hay cod_ceta, el backend lo generará.
    const datosBio: any = {
      ...this.postulanteActual,
      // asegurar campos mínimos y mapeos que backend espera
      apellidos_est: [this.postulanteActual.ap_pat || '', this.postulanteActual.ap_mat || ''].filter(Boolean).join(' ').trim(),
    };
    this.postulanteService.create(datosBio as Postulante).subscribe({
      next: (res) => {
        const prev = { ...this.postulanteActual } as any;
        this.postulanteActual = { ...prev, ...(res as any) };
        // Si backend generó cod_ceta, reflejarlo
        if ((res as any)?.cod_ceta) {
          this.postulanteActual.cod_ceta = (res as any).cod_ceta;
          // Con el CETA generado, cargar aranceles de material extra
          this.cargarArancelesMaterialExtra();
          // Y sincronizar snapshot desde BD
          this.cargarPostulanteDesdeBD();
        }
        if (!this.postulanteActual.nro_serie_titulo && prev.nro_serie_titulo) {
          this.postulanteActual.nro_serie_titulo = prev.nro_serie_titulo;
        }
        if (this.postulanteActual.nro_serie_titulo && !this.tipoBachiller) {
          this.tipoBachiller = 'nacional';
        }
        this.isEditing = false;
        // Importante: conservar esNuevoPostulante = true para mostrar formulario de aranceles manuales
        this.pasoBiograficosCompletado = true;
        this.showRegistrarInscripcion = true;
      },
      error: (err) => {
        console.error('Error al guardar datos biográficos:', err);
        alert('No se pudo guardar los datos biográficos. Verifique e intente nuevamente.');
      }
    });
  }

  // --- Handlers de validación/sanitización en inputs biográficos ---
  onCetaInput(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const clean = (input.value || '').replace(/\D+/g, '').slice(0, 9);
    input.value = clean;
    (this.postulanteActual as any).cod_ceta = clean ? parseInt(clean, 10) : undefined;
  }

  onNombreInput(campo: 'nombres_est' | 'ap_pat' | 'ap_mat', ev: Event) {
    const input = ev.target as HTMLInputElement;
    let clean = this.sanitizarNombre(input.value || '');
    clean = this.capitalizarPalabras(clean);
    input.value = clean;
    (this.postulanteActual as any)[campo] = clean;
  }

  onLugarNacimientoInput(ev: Event) {
    const input = ev.target as HTMLInputElement;
    let clean = this.sanitizarNombre(input.value || '');
    clean = this.capitalizarPalabras(clean);
    input.value = clean;
    this.postulanteActual.lugar_nacimiento = clean;
  }

  onProcedenciaInput(ev: Event) {
    const input = ev.target as HTMLInputElement;
    let val = (input.value || '');
    // Solo letras, espacios, guion y apóstrofe
    val = val.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ'\-\s]+/g, '').replace(/\s{2,}/g, ' ').trimStart();
    // Si es un código corto (<=3) lo dejamos en mayúsculas completas (caso 'QR')
    if (val.trim().length > 0 && val.trim().length <= 3 && !val.includes(' ')) {
      val = val.toLocaleUpperCase();
    } else {
      // En otro caso, capitalizar palabras
      val = this.capitalizarPalabras(val.toLocaleLowerCase());
    }
    input.value = val;
    this.postulanteActual.procedencia = val;
  }

  // --- Validaciones específicas: CI y Complemento ---
  onCiInput(ev: Event) {
    const input = ev.target as HTMLInputElement;
    // Mantener solo dígitos y limitar a 9
    let clean = (input.value || '').replace(/\D+/g, '').slice(0, 9);
    input.value = clean;
    this.postulanteActual.ci = clean;
  }

  onComplementoInput(ev: Event) {
    const input = ev.target as HTMLInputElement;
    let v = (input.value || '').toUpperCase();
    // Tomar solo primeros 2 caracteres válidos segun patrón: [0-9][A-Z]
    // Primero filtrar a dígitos y letras
    v = v.replace(/[^0-9A-Z]/g, '');
    if (v.length > 0) {
      // Asegurar que el primer caracter sea dígito
      if (!/^[0-9]/.test(v[0])) {
        v = v.replace(/^[A-Z]+/, '');
      }
    }
    if (v.length > 1) {
      // Asegurar que el segundo caracter sea letra
      const first = v[0];
      const rest = v.slice(1).replace(/[^A-Z]/g, '');
      v = (first || '') + (rest ? rest[0] : '');
    }
    v = v.slice(0, 2);
    input.value = v;
  }

  // --- Sanitización de números de serie/resolución (front) ---
  private sanitizeSerieStr(v: string, allowSpace: boolean = false): string {
    const re = allowSpace ? /[^A-Z0-9\-\"°\s]+/g : /[^A-Z0-9\-\"°]+/g;
    return (v || '')
      .toUpperCase()
      .replace(re, '');
  }

  onSerieInput(ev: Event, target: any, prop: string, allowSpace: boolean = false) {
    const input = ev.target as HTMLInputElement;
    const clean = this.sanitizeSerieStr(input.value || '', allowSpace);
    input.value = clean;
    if (target && typeof target === 'object') {
      target[prop] = clean;
    }
  }

  // --- Sanitización para 'gestión' (solo números y '/') ---
  private sanitizeGestionStr(v: string): string {
    return (v || '')
      .replace(/[^0-9\/]+/g, '')
      .replace(/\/{2,}/g, '/');
  }

  onGestionInput(ev: Event, target: any, prop: string) {
    const input = ev.target as HTMLInputElement;
    const clean = this.sanitizeGestionStr(input.value || '');
    input.value = clean;
    if (target && typeof target === 'object') {
      target[prop] = clean;
    }
  }

  private sanitizarNombre(v: string): string {
    return (v || '')
      .replace(/\d+/g, '')
      .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ'\-\s]+/g, '')
      .replace(/\s{2,}/g, ' ')
      .trimStart();
  }

  private capitalizarPalabras(v: string): string {
    const lower = (v || '').toLocaleLowerCase();
    return lower.replace(/(?:^|[\s\-'])\p{L}/gu, (m) => m.toUpperCase());
  }

  // --- Sanitización específica para arancel manual ---
  private sanitizeRazonUpper(v: string | null | undefined): string {
    if (!v) return '';
    const up = v.toString().toUpperCase();
    // Permitir: A-Z, 0-9, espacio, punto ., comilla simple ', comilla doble ", símbolo °
    return up.replace(/[^A-Z0-9\.\'"°\s]+/g, '');
  }

  private sanitizeDigits(v: string | null | undefined): string {
    if (!v) return '';
    return v.toString().replace(/\D+/g, '');
  }

  onRazonInput(val: any) {
    const s = this.sanitizeRazonUpper(val);
    if (!this.nuevoArancel) this.nuevoArancel = {} as any;
    this.nuevoArancel.razon = s;
  }

  onFacturaInput(val: any) {
    const d = this.sanitizeDigits(val);
    if (!this.nuevoArancel) this.nuevoArancel = {} as any;
    this.nuevoArancel.num_factura = d || '';
    if ((this.nuevoArancel.num_factura || '').length > 0) {
      this.nuevoArancel.num_comprobante = '';
    }
  }

  onReciboInput(val: any) {
    const d = this.sanitizeDigits(val);
    if (!this.nuevoArancel) this.nuevoArancel = {} as any;
    this.nuevoArancel.num_comprobante = d || '';
    if ((this.nuevoArancel.num_comprobante || '').length > 0) {
      this.nuevoArancel.num_factura = '';
    }
  }

  onNitInput(val: any) {
    const d = this.sanitizeDigits(val);
    if (!this.nuevoArancel) this.nuevoArancel = {} as any;
    this.nuevoArancel.nit = d || '';
  }

  // Bloquea teclas que no sean dígitos, permite teclas de control (backspace, delete, arrows, tab)
  onlyDigits(evt: KeyboardEvent) {
    const allowedControl = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
    if (allowedControl.includes(evt.key)) return;
    if (!/^[0-9]$/.test(evt.key)) {
      evt.preventDefault();
    }
  }

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
        // Si no hay modalidad ya establecida (p. ej., desde sessionStorage), consultar al backend
        if (!this.modalidad) {
          this.cargarModalidadActual();
        }
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

  // Normaliza una fecha a formato YYYY-MM-DD; si viene vacía o inválida devuelve null
  private normalizarFecha(f: any): string | null {
    if (!f) return null;
    // Si es Date
    if (f instanceof Date && !isNaN(f.getTime())) {
      const y = f.getFullYear();
      const m = String(f.getMonth() + 1).padStart(2, '0');
      const d = String(f.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const s = String(f).trim();
    if (!s) return null;
    // Ya está en YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // Formato común dd/mm/yyyy o d/m/yyyy
    const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m1) {
      const d = m1[1].padStart(2, '0');
      const mo = m1[2].padStart(2, '0');
      const y = m1[3];
      return `${y}-${mo}-${d}`;
    }
    // Intento de parseo nativo
    const d2 = new Date(s);
    if (!isNaN(d2.getTime())) {
      const y = d2.getFullYear();
      const mo = String(d2.getMonth() + 1).padStart(2, '0');
      const dd = String(d2.getDate()).padStart(2, '0');
      return `${y}-${mo}-${dd}`;
    }
    return null;
  }

  // --- Resumen de inscripción ---
  private construirResumenInscripcion() {
    // Preferir valores persistidos en BD cuando existan
    const carreraBD = (this.postulanteDesdeBD as any)?.carrera as string | undefined;
    const tipoBachBD = (this.postulanteDesdeBD as any)?.tipo_bachiller as string | undefined;
    const carrera = (carreraBD && carreraBD.toString()) || this.carreraNormalizada || (this.postulanteActual.carrera as string) || null;
    const carreraNombre = this.carreraLabelFromVal(carrera);
    const pensum = (this.postulanteActual.pensum as string) || null;
    const cod = this.postulanteActual.cod_ceta || null;
    const nombreCompleto = [
      this.postulanteActual.nombres_est || '',
      this.postulanteActual.ap_pat || '',
      this.postulanteActual.ap_mat || '',
    ].filter(Boolean).join(' ');
    const modalidad = this.modalidad?.nombre || null;
    const tipoBach = this.formatTipoBachiller((tipoBachBD && tipoBachBD.toString()) || this.tipoBachiller || null);
    const pagoEstado: 'Completo' | 'Con deuda' = this.pagoCompletoSeleccionados ? 'Completo' : 'Con deuda';
    const aranceles = (this.selectedAranceles || []).map((a: any) => ({
      gestion: a.gestion || undefined,
      fecha: this.normalizarFecha(a.fecha),
      concepto: a.concepto || undefined,
      monto: a.monto || undefined,
      num_factura: a.num_factura || undefined,
      num_comprobante: a.num_comprobante || undefined,
    }));
    this.resumenInscripcion = {
      carrera: carreraNombre,
      pensum,
      cod_ceta: cod || null,
      nombre_completo: nombreCompleto,
      modalidad,
      tipo_bachiller: tipoBach,
      pago_estado: pagoEstado,
      aranceles,
      es_edu_regular: this.selectedOpcion === 'educacionRegular',
      es_tecnico_medio: this.selectedOpcion === 'tecnicoMedio',
      es_traspaso: this.selectedOpcion === 'traspasoInstituto',
      es_cambio_plan: this.selectedOpcion === 'homologacionCambioPlan',
    };
  }

  cerrarModalExito() {
    this.modalExitoVisible = false;
    // Asegurar que el resumen esté construido
    if (!this.resumenInscripcion) {
      this.construirResumenInscripcion();
    }
    this.resumenVisible = !!this.resumenInscripcion;
    // Ocultar CTA de registro y llevar al usuario al inicio para ver el resumen
    this.showRegistrarInscripcion = false;
    try {
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 0);
    } catch (e) {}
  }

  // --- Registro de inscripción ---
  puedeRegistrar(): boolean {
    // Debe haber guardado biográficos
    if (!this.pasoBiograficosCompletado) return false;
    // Nombres y apellidos mínimos
    if (!this.postulanteActual?.nombres_est || !this.postulanteActual?.ap_pat) return false;
    // Modalidad seleccionada
    if (!this.modalidad) return false;
    // Validación de gestión de inicio/conclusión (si aplica)
    if (this.gestionErrorMessage) return false;
    return true;
  }

  registrarInscripcion() {
    // Validación integral antes del registro definitivo
    const faltantes = this.validarCampos();
    if (faltantes.length) {
      alert('Complete los siguientes campos: ' + faltantes.join(', '));
      return;
    }
    if (!this.puedeRegistrar()) {
      alert('Complete los datos requeridos antes de registrar la inscripción.');
      return;
    }

    const codEst = (this.postulanteActual?.cod_ceta || this.estudiante?.cod_ceta) as number;
    const nombres = this.postulanteActual?.nombres_est || '';
    const apellidos = [this.postulanteActual?.ap_pat || '', this.postulanteActual?.ap_mat || ''].filter(Boolean).join(' ');

    const payload: any = {
      cod_ceta_est: codEst,
      nombres_est: nombres,
      apellidos_est: apellidos,
      modalidad_id: this.modalidad?.id,
      modalidad_nom: this.modalidad?.nombre,
      carrera: this.carreraNormalizada || this.postulanteActual.carrera || null,
      aranceles_completos: !!this.pagoCompletoSeleccionados,
      aranceles: (this.selectedAranceles || []).map((a: any) => ({
        id: a.id || null,
        gestion: a.gestion || null,
        fecha: this.normalizarFecha(a.fecha),
        concepto: a.concepto || null,
        monto: a.monto || null,
        num_factura: a.num_factura || null,
        num_comprobante: a.num_comprobante || null,
        razon: a.razon || null,
        nit: a.nit || null,
        pagado: !!(a.pagado || this.pagoCompletoSeleccionados),
        origen: a.origen || 'sga',
        seleccionado: true,
      }))
    };

    // Incluir datos de Bachillerato si corresponde (enviar en minúsculas para pasar validación backend)
    payload.tipo_bachiller = (this.tipoBachiller || null) ? this.tipoBachiller!.toString().trim().toLowerCase() : null;
    if (this.tipoBachiller === 'nacional') {
      const d = this.diplomaNacional || ({} as any);
      payload.diploma_bachiller = {
        nro_serie_titulo: (d.nro_serie || this.postulanteActual?.nro_serie_titulo || '').toString().trim() || null,
        emision: (d.emision || '').toString().trim() || null,
        fecha_emision: this.normalizarFecha(d.fecha_emision),
        observacion: (d.observacion || '').toString().trim() || null,
        // En UI es gestion_bachillerato, el backend normaliza a gestion_bachiller
        gestion_bachillerato: (d.gestion_bachillerato || '').toString().trim() || null,
      };
    }

    // Incluir datos de carrera (regímenes y gestiones) con nuevo esquema
    if (this.datosInicioCarrera?.gestion_ini) {
      payload.datos_carrera = {
        regimen_ini: (this.datosInicioCarrera.reg_ini_c || '').toString().trim() || null,
        regimen_fin: (this.datosConclusionCarrera.reg_con_c || '').toString().trim() || null,
        gestion_ini: (this.datosInicioCarrera.gestion_ini || '').toString().trim() || null,
        gestion_fin: (this.datosConclusionCarrera.gestion_fin || '').toString().trim() || null,
      };
    }

    // Transitabilidad Educación Regular (si la opción seleccionada es educación regular)
    if (this.selectedOpcion === 'educacionRegular') {
      const t = this.eduRegularData || ({} as any);
      payload.transitabilidad_edu_reg = {
        serie_titulo_tm: (t.serie_titulo_tm || '').toString().trim() || null,
        numero_titulo_tm: (t.numero_titulo_tm || '').toString().trim() || null,
        fecha_emision: this.normalizarFecha(t.fecha_emision),
        observacion: null,
      };
    }

    // Transitabilidad Técnico Medio (si la opción seleccionada es técnico medio)
    if (this.selectedOpcion === 'tecnicoMedio') {
      const t2 = this.tecnicoMedioData || ({} as any);
      payload.transitabilidad_inst_tec = {
        serie_titulo_tm: (t2.serie_titulo_tm || '').toString().trim() || null,
        numero_titulo_tm: (t2.numero_titulo_tm || '').toString().trim() || null,
        fecha_emision: this.normalizarFecha(t2.fecha_emision),
        observacion: null,
      };
    }

    // Homologación de Bachiller Extranjero: guardar resolución y grados/gestiones
    if (this.tipoBachiller === 'extranjero') {
      const h = this.homologacionExtranjero || ({} as any);
      const nroDesdePostulante = (this.postulanteActual?.nro_serie_titulo || '').toString().trim() || null;
      payload.homol_extranjero = {
        nro_resolucion: ((h.nro_resolucion || '') || nroDesdePostulante)?.toString().trim() || null,
        fecha_emision: this.normalizarFecha(h.fecha_emision),
        grados_gestiones: Array.isArray(h.grados_gestiones)
          ? h.grados_gestiones.map((g: any) => ({
              grado: (g?.grado || '').toString().trim() || null,
              gestion: (g?.gestion || '').toString().trim() || null,
            }))
          : [],
      };
      // En backend se permite mapear nro_serie_titulo como nro_resolucion para extranjero
      // Para robustez, enviamos también diploma_bachiller con ese mismo valor
      const nroSerieComoResol = ((h.nro_resolucion || '') || nroDesdePostulante)?.toString().trim() || null;
      payload.diploma_bachiller = {
        nro_serie_titulo: nroSerieComoResol,
      };
    }

    // Traspaso de Instituto: enviar bloque al backend cuando está seleccionada esta opción
    if (this.selectedOpcion === 'traspasoInstituto') {
      const t = this.traspasoData || ({} as any);
      payload.traspaso_instituto = {
        instituto_origen: (t.instituto_origen || '').toString().trim() || null,
        // estos dos campos son opcionales en backend; si en el futuro se agregan inputs, completar aquí
        grados_cursados: null,
        gestiones_cursadas: null,
        grados: Array.isArray(t.grados_gestiones)
          ? t.grados_gestiones.map((gg: any) => ({
              grado: (gg?.grado || '').toString().trim() || null,
              gestion: (gg?.gestion || '').toString().trim() || null,
            }))
          : [],
      };
    }

    // Homologación por cambio de plan de estudios: enviar bloque al backend
    if (this.selectedOpcion === 'homologacionCambioPlan') {
      const cp = (this as any).homoCambioPlanData || ({} as any);
      // Permitir que el número venga como nro_resolucion_rectoral en la UI
      const nroResCp = ((cp.nro_resolucion || cp.nro_resolucion_rectoral) || '').toString().trim() || null;
      payload.homol_cambio_plan = {
        nro_resolucion: nroResCp,
        fecha_emision: this.normalizarFecha(cp.fecha_emision),
        grados_cursados: (cp.grados_cursados || '').toString().trim() || null,
        gestiones_cursadas: (cp.gestiones_cursadas || '').toString().trim() || null,
        grados_gestiones: Array.isArray(cp.grados_gestiones)
          ? cp.grados_gestiones.map((g: any) => ({
              grado: (g?.grado || '').toString().trim() || null,
              gestion: (g?.gestion || '').toString().trim() || null,
            }))
          : [],
      };
    }

    this.inscripcionLoading = true;
    this.inscripcionError = null;
    this.postulanteService.registrarInscripcion(payload).subscribe({
      next: (res) => {
        // Si backend generó cod_ceta, reflejarlo en el front
        const gen = (res && (res.data?.inscripcion?.cod_ceta_est ?? res.inscripcion?.cod_ceta_est)) || null;
        if (gen) {
          this.postulanteActual.cod_ceta = gen;
          // Si es nuevo postulante, persistir biográficos ahora con el cod_ceta generado
          const datosBio: any = {
            ...this.postulanteActual,
            cod_ceta: gen,
            // Asegurar campos mínimos requeridos por backend de postulantes
            apellidos_est: [this.postulanteActual.ap_pat || '', this.postulanteActual.ap_mat || ''].filter(Boolean).join(' ').trim(),
          };
          this.postulanteService.create(datosBio as Postulante).subscribe({
            next: () => {
              this.esNuevoPostulante = false;
            },
            error: (e) => {
              console.error('No se pudo persistir biográficos tras generar CETA:', e);
            }
          });
        }
        // Construir resumen (se mostrará al cerrar el modal)
        this.construirResumenInscripcion();
        this.resumenVisible = false;
        // Mostrar modal bonito de éxito
        this.modalExitoVisible = true;
        this.inscripcionLoading = false;
      },
      error: (err) => {
        console.error('Error al registrar inscripción:', err);
        this.inscripcionLoading = false;
        // Mensaje amigable según código
        if (err && err.status === 401) {
          this.inscripcionError = 'No autenticado. Inicie sesión nuevamente para registrar la inscripción.';
        } else if (err && err.status === 422) {
          const detalle = (err.error && (err.error.message || JSON.stringify(err.error))) || 'Datos inválidos';
          this.inscripcionError = 'Validación fallida: ' + detalle;
        } else {
          this.inscripcionError = 'No se pudo registrar la inscripción. Intente nuevamente.';
        }
      }
    });
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
    if (this.editingArancelIndex !== null && this.editingArancelIndex >= 0 && this.editingArancelIndex < this.selectedAranceles.length) {
      // Guardar cambios sobre el ítem existente
      this.selectedAranceles[this.editingArancelIndex] = { ...this.selectedAranceles[this.editingArancelIndex], ...item };
      this.editingArancelIndex = null;
    } else {
      // Añadir directamente a seleccionados para reflejar pago manual
      this.selectedAranceles.push(item);
    }
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

  editarArancelManual(item: any, index: number) {
    if (!this.esNuevoPostulante) return;
    // Prefill del formulario con los datos del ítem manual
    this.nuevoArancel = {
      gestion: (item?.gestion || '').toString(),
      fecha: item?.fecha || '',
      concepto: item?.concepto || '',
      monto: this.toNumber(item?.monto),
      num_factura: (item?.num_factura || '').toString(),
      num_comprobante: (item?.num_comprobante || '').toString(),
      razon: item?.razon || '',
      nit: (item?.nit || '').toString(),
    };
    this.editingArancelIndex = index;
  }

  cancelarEdicionArancelManual() {
    this.editingArancelIndex = null;
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

  // Conmutador de estado de pago para todos los seleccionados
  onTogglePagoSeleccionados(value: boolean) {
    this.pagoCompletoSeleccionados = value;
    // Propagar a cada ítem seleccionado (si tiene campo pagado)
    this.selectedAranceles = this.selectedAranceles.map(a => ({ ...a, pagado: value }));
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

  private carreraLabelFromVal(val: string | null | undefined): string | null {
    if (!val) return null;
    const s = val.toString().trim().toLowerCase();
    if (s === 'mecanica') return 'Mecánica Automotriz';
    if (s === 'electricidad') return 'Electricidad y Electrónica Automotriz';
    // Si viene ya con nombre desde BD, respetarlo
    // También capitalizamos mínimamente si parece en minúsculas puras
    if (s && s === val) {
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    return val.toString();
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