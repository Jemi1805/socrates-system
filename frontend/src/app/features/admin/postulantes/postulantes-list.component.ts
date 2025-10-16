import { Component, OnInit } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PostulanteService, DocumentoPostulante, ModalidadPostulante } from './postulante.service';
import { Postulante } from './postulante.model';
import { HttpEventType, HttpResponse } from '@angular/common/http';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SgaService } from '../../../shared/services/sga.service';
import { LoadingService } from '../../../core/services/loading.service';

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
  imports: [CommonModule, FormsModule, HeaderComponent, RouterModule],
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
  // Modo de visualización de inscripción (solo lectura por defecto)
  viewInscripcion: boolean = false;
  private debeEntrarVer: boolean = false;
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
  // Modal de confirmación de cambio de modalidad
  modalConfirmCambioVisible: boolean = false;
  nuevaModalidad: ModalidadGraduacion | null = null;
  // Modal de cambios guardados y lista de cambios
  modalCambiosVisible: boolean = false;
  cambiosRealizados: Array<{ campo: string; anterior: any; nuevo: any }> = [];
  // Modal de confirmación para guardar cambios (botón global)
  modalConfirmarCambioModalidadVisible: boolean = false;
  cambiosCambioModalidad: Array<{ campo: string; anterior: any; nuevo: any }> = [];
  modalConfirmGuardarVisible: boolean = false;
  showBiographicalData = true;
  showBachilleratoData = true;
  modalFaltantesVisible: boolean = false;
  faltantesSecciones: Array<{ titulo: string; items: string[] }> = [];
  // Nuevo registro: habilita selects de carrera y pensum
  esNuevoPostulante = false;
  // Modo de edición para Datos del estudiante (biográficos)
  isEditing = false;
  // Señales de origen de datos y control de UI
  datosRecuperadosSga = false;
  tienePostulanteBD = false;
  tieneArancelesSga = false;
  get isBioInputDisabled(): boolean {
    if (this.viewInscripcion && !this.editBio) return true;
    if (!this.viewInscripcion && !this.isEditing && (this.tienePostulanteBD || this.datosRecuperadosSga)) return true;
    return false;
  }
  // Edición por tarjeta cuando está en modo ver inscripción
  editBio = false;
  editBach = false;
  editInicio = false;
  editConclusion = false;
  editAranceles = false;
  // Muestra el formulario de nuevo arancel manual durante la edición en modo visualización
  showManualArancelesEnEdicion = false;
  // Seguimiento de cambios en modo visualización
  hasChangesInView: boolean = false;
  private markChangedInView() {
    if (this.viewInscripcion) {
      this.hasChangesInView = true;
    }
  }

  // Clave estable para identificar un arancel (factura, recibo o composite fecha|concepto|monto)
  private arancelKey(item: any): string {
    const normStr = (v: any) => (v === undefined || v === null) ? '' : String(v).trim();
    const normNum = (v: any) => {
      const n = Number(v);
      return isNaN(n) ? null : n;
    };
    // Priorizar ID si existe (id proveniente de BD o arancel_id en UI)
    const id = (item && (item.id ?? item.arancel_id));
    if (id !== undefined && id !== null && String(id).trim() !== '') {
      return `ID#${String(id).trim()}`;
    }
    const f = normStr(item?.num_factura);
    const c = normStr(item?.num_comprobante);
    if (f && f !== '0') return `F#${f}`;
    if (c && c !== '0') return `C#${c}`;
    const comp = [normStr(item?.fecha) || '', normStr(item?.concepto) || '', String(normNum(item?.monto) ?? '')].join('|');
    return `X#${comp}`;
  }

  // --- Confirmación de guardado global ---
  abrirModalConfirmarGuardar() {
    this.loadingService.showModal();
    setTimeout(() => {
      this.modalConfirmGuardarVisible = true;
      this.loadingService.hideModal();
    }, 0);
  }
  cerrarModalConfirmarGuardar() {
    this.modalConfirmGuardarVisible = false;
  }
  confirmarGuardarCambiosVerInscripcion() {
    this.modalConfirmGuardarVisible = false;
    this.guardarCambiosVerInscripcion();
  }

  private _aplicarArancelesEstEnVista(est: any[]) {
    const listaEst = Array.isArray(est) ? est : [];
    const cod = this.postulanteActual.cod_ceta || this.estudiante?.cod_ceta;
    // Filtrar por cod_ceta_est del estudiante actual
    const filtrados = (listaEst || []).filter((r: any) => {
      const rcod = (r?.cod_ceta_est ?? r?.cod_ceta ?? r?.codigo_ceta);
      return rcod !== undefined && rcod !== null && String(rcod) === String(cod ?? '');
    });

    if (this.esNuevoPostulante) {
      // NUEVO postulante: reemplazar la tabla con los registros en BD del estudiante
      // Si el filtro no encontró coincidencias pero el backend devolvió filas, confiar en backend
      const fuente = (filtrados.length > 0) ? filtrados : listaEst;
      if (Array.isArray(fuente) && fuente.length > 0) {
        const mapeados = this.mapArancelesEstToLista(fuente);
        this.aranceles = mapeados;
        this.selectedAranceles = [...mapeados];
        this.totalAranceles = mapeados.length;
      } else {
        this.aranceles = [];
        this.selectedAranceles = [];
        this.totalAranceles = 0;
      }
      this.recalcularTotalSeleccionados();
      this._dedupeSelectedAranceles();
    } else {
      // EXISTENTE (recuperado de SGA): mantener lista SGA cargada y solo marcar seleccionados según lo que hay en BD
      if (filtrados.length > 0) {
        this.aplicarSeleccionDesdeDB(filtrados);
        // Además, asegurar que los aranceles de origen 'manual' en BD se vean aunque no vengan del SGA
        const manuales = filtrados.filter((r: any) => String(r?.origen || '').toLowerCase() === 'manual');
        if (manuales.length) {
          const mapeados = this.mapArancelesEstToLista(manuales);
          for (const m of mapeados) {
            if (!this._existeArancelEnLista(m, this.aranceles)) {
              this.aranceles.push(m);
            }
            if (!this.isArancelSeleccionado(m)) {
              this.selectedAranceles.push(m);
            }
          }
          this.totalAranceles = this.aranceles.length;
          this.recalcularTotalSeleccionados();
          this._dedupeSelectedAranceles();
        }
      } else {
        // No hay registros en BD para este estudiante: limpiar selección, mantener SGA
        this.selectedAranceles = [];
        this.recalcularTotalSeleccionados();
      }
    }
  }

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
  // inscrip_modalidad vigente (para asociar aranceles_est)
  private inscripModalidadIdActual: number | null = null;
  // Edición de arancel manual
  editingArancelIndex: number | null = null;
  editingArancelId: number | null = null;
  // Contexto de edición: clave estable e índice en la tabla principal
  private editingArancelKey: string | null = null;
  private editingArancelIndexTabla: number | null = null;
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

get permiteEdicionArancelesEnVista(): boolean {
  // En ver inscripción, permitir edición manual SOLO si el CETA es temporal (empieza con '9').
  const cod: any = (this.postulanteActual?.cod_ceta ?? this.estudiante?.cod_ceta);
  const codStr = (cod !== undefined && cod !== null) ? String(cod) : '';
  const empiezaCon9 = codStr.startsWith('9');
  return !!(this.viewInscripcion && empiezaCon9);
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
    // En la UI el N° de Serie se edita en diplomaNacional.nro_serie, no en postulanteActual.nro_serie_titulo
    const nroSerie = (this.diplomaNacional?.nro_serie || p.nro_serie_titulo);
    if (!this.isNonEmpty(nroSerie)) faltantes.push('N° de Serie (Bachiller Nacional)');
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

// Construye faltantes por sección con etiquetas de UI
private validarCamposSecciones(): Array<{ titulo: string; items: string[] }> {
  const secciones: Array<{ titulo: string; items: string[] }> = [];
  // Datos del estudiante
  const p: any = this.postulanteActual || {};
  const bio: string[] = [];
  if (!this.isNonEmpty(p.nombres_est)) bio.push('Nombres');
  if (!this.isNonEmpty(p.ap_pat)) bio.push('Apellido Paterno');
  if (!this.isNonEmpty(p.ap_mat)) bio.push('Apellido Materno');
  if (!this.isNonEmpty(p.ci)) bio.push('CI');
  if (!this.isNonEmpty(p.carrera)) bio.push('Carrera');
  if (!this.isNonEmpty(p.pensum)) bio.push('Pensum');
  if (!this.isNonEmpty(p.fecha_nacimiento)) bio.push('Fecha de Nacimiento');
  if (!this.isNonEmpty(p.lugar_nacimiento)) bio.push('Lugar de Nacimiento');
  if (!this.isNonEmpty(p.procedencia)) bio.push('Procedencia');
  if (bio.length) secciones.push({ titulo: 'Datos del estudiante', items: bio });

  // Bachillerato
  const bach: string[] = [];
  if (this.tipoBachiller === 'nacional') {
    const nroSerie = (this.diplomaNacional?.nro_serie || p.nro_serie_titulo);
    if (!this.isNonEmpty(nroSerie)) bach.push('N° de Serie (Bachiller Nacional)');
    if (!this.isNonEmpty(this.diplomaNacional.emision)) bach.push('Emisión (Bachiller Nacional)');
    if (!this.isNonEmpty(this.diplomaNacional.fecha_emision)) bach.push('Fecha de Emisión (Bachiller Nacional)');
    if (!this.isNonEmpty(this.diplomaNacional.gestion_bachillerato)) bach.push('Gestión de Bachillerato');
  } else if (this.tipoBachiller === 'extranjero') {
    if (!this.isNonEmpty(this.homologacionExtranjero.fecha_emision)) bach.push('Fecha de Emisión (Bachiller Extranjero)');
  }
  if (bach.length) secciones.push({ titulo: 'Datos del Bachillerato', items: bach });

  // Inicio/Conclusión
  const ic: string[] = [];
  if (!this.isNonEmpty(this.datosInicioCarrera.reg_ini_c)) ic.push('Tipo de Régimen (Inicio de Carrera)');
  if (!this.isNonEmpty(this.datosConclusionCarrera.reg_con_c)) ic.push('Tipo de Régimen (Conclusión de Carrera)');
  if (!this.isNonEmpty(this.datosInicioCarrera.gestion_ini)) ic.push('Gestión de Inicio de Carrera');
  if (!this.isNonEmpty(this.datosConclusionCarrera.gestion_fin)) ic.push('Gestión de Conclusión de Carrera');
  if (
    this.isNonEmpty(this.datosInicioCarrera.reg_ini_c) &&
    this.isNonEmpty(this.datosConclusionCarrera.reg_con_c) &&
    this.datosInicioCarrera.reg_ini_c !== this.datosConclusionCarrera.reg_con_c
  ) {
    ic.push('El tipo de régimen debe ser el mismo en Inicio y Conclusión');
  }
  if (this.gestionErrorMessage) ic.push(this.gestionErrorMessage);
  if (ic.length) secciones.push({ titulo: 'Datos de Inicio/Conclusión de Carrera', items: ic });

  // Opciones de transitabilidad (si se seleccionó alguna)
  const tran: string[] = [];
  switch (this.selectedOpcion) {
    case 'educacionRegular': {
      const e = this.eduRegularData;
      if (!this.isNonEmpty(e.serie_titulo_tm)) tran.push('Serie título (Educación Regular)');
      if (!this.isNonEmpty(e.numero_titulo_tm)) tran.push('N° de Título (Educación Regular)');
      if (!this.isNonEmpty(e.fecha_emision)) tran.push('Fecha de Emisión (Educación Regular)');
      break;
    }
    case 'tecnicoMedio': {
      const t = this.tecnicoMedioData;
      if (!this.isNonEmpty(t.serie_titulo_tm)) tran.push('Serie título (Técnico Medio)');
      if (!this.isNonEmpty(t.numero_titulo_tm)) tran.push('N° de Título (Técnico Medio)');
      if (!this.isNonEmpty(t.fecha_emision)) tran.push('Fecha de Emisión (Técnico Medio)');
      break;
    }
    case 'traspasoInstituto': {
      if (!this.isNonEmpty(this.traspasoData.instituto_origen)) tran.push('Instituto de origen (Traspaso)');
      (this.traspasoData.grados_gestiones || []).forEach((gg, i) => {
        if (this.isNonEmpty(gg.grado) || this.isNonEmpty(gg.gestion)) {
          if (!this.isNonEmpty(gg.grado)) tran.push(`Grado #${i + 1} (Traspaso)`);
          if (!this.isNonEmpty(gg.gestion)) tran.push(`Gestión #${i + 1} (Traspaso)`);
        }
      });
      break;
    }
    case 'homologacionCambioPlan': {
      if (!this.isNonEmpty(this.homoCambioPlanData.nro_resolucion_rectoral)) tran.push('N° de Resolución Rectoral (Cambio de plan)');
      if (!this.isNonEmpty(this.homoCambioPlanData.fecha_emision)) tran.push('Fecha de Emisión (Cambio de plan)');
      (this.homoCambioPlanData.grados_gestiones || []).forEach((gg, i) => {
        if (this.isNonEmpty(gg.grado) || this.isNonEmpty(gg.gestion)) {
          if (!this.isNonEmpty(gg.grado)) tran.push(`Grado #${i + 1} (Cambio de plan)`);
          if (!this.isNonEmpty(gg.gestion)) tran.push(`Gestión #${i + 1} (Cambio de plan)`);
        }
      });
      break;
    }
  }
  if (tran.length) secciones.push({ titulo: 'Transitabilidad', items: tran });

  // Aranceles seleccionados
  const ar: string[] = [];
  if (!Array.isArray(this.selectedAranceles) || this.selectedAranceles.length === 0) {
    ar.push('Seleccione al menos un arancel');
    // Si es postulante nuevo y está el formulario manual visible, listar faltantes del formulario
    if (this.esNuevoPostulante && !this.tieneArancelesSga) {
      const n: any = this.nuevoArancel || {};
      if (!this.isNonEmpty(n.gestion)) ar.push('Gestión');
      if (!this.isNonEmpty(n.fecha)) ar.push('Fecha');
      if (!this.isNonEmpty(n.concepto)) ar.push('Concepto');
      const mn = this.toNumber(n.monto);
      if (!(mn > 0)) ar.push('Monto (> 0)');
      const hasFactura = !!(n.num_factura && String(n.num_factura).trim());
      const hasRecibo = !!(n.num_comprobante && String(n.num_comprobante).trim());
      if (!hasFactura && !hasRecibo) ar.push('N° Factura o N° Recibo');
      if (!this.isNonEmpty(n.razon)) ar.push('Razón Social');
      if (!this.isNonEmpty(n.nit)) ar.push('NIT');
      if (this.isNonEmpty(n.nit) && !/^\d+$/.test(String(n.nit).trim())) ar.push('NIT (solo números)');
    }
  }
  if (ar.length) secciones.push({ titulo: 'Aranceles', items: ar });

  return secciones;
}

private mostrarModalFaltantes(secciones: Array<{ titulo: string; items: string[] }>) {
  this.loadingService.showModal();
  setTimeout(() => {
    this.faltantesSecciones = secciones || [];
    this.modalFaltantesVisible = true;
    this.loadingService.hideModal();
  }, 0);
}

cerrarModalFaltantes() {
  this.modalFaltantesVisible = false;
}

// --- Handlers para dropdown custom ---
setGestionInicio(g: string) {
  this.datosInicioCarrera.gestion_ini = g;
  // Si la conclusión ya no es válida con el nuevo inicio, resetearla
  if (!this.gestionValida && this.datosConclusionCarrera.gestion_fin) {
    this.datosConclusionCarrera.gestion_fin = '';
  }
  this.markChangedInView();
}

setGestionFin(g: string) {
  this.datosConclusionCarrera.gestion_fin = g;
  this.markChangedInView();
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
  this.datosConclusionCarrera.reg_con_c = v;
  this.markChangedInView();
}

setRegimenFin(v: 'semestral' | 'anual') {
  this.datosConclusionCarrera.reg_con_c = v;
  this.datosInicioCarrera.reg_ini_c = v;
  this.markChangedInView();
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
  this.markChangedInView();
}

get labelNuevoArancelGestion(): string {
  return this.nuevoArancel?.gestion || 'Seleccione gestión';
}

constructor(private postulanteService: PostulanteService, private sgaService: SgaService, private router: Router, private route: ActivatedRoute, private loadingService: LoadingService) {}

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
  // Preasignar gestión actual para arancel manual
  try {
    const gActual = this.getGestionActual();
    if (gActual) this.nuevoArancel.gestion = gActual;
  } catch {}
  // Si venimos desde el modal con query ver=1, activar modo Ver inscripción
  const ver = this.route.snapshot.queryParamMap.get('ver');
  this.debeEntrarVer = (ver === '1');
}

cargarDatosPostulacion() {
  const datosPostulacion = sessionStorage.getItem('datos_postulacion');
  if (datosPostulacion) {
    const datos = JSON.parse(datosPostulacion);
    this.estudiante = datos.estudiante;
    this.modalidad = datos.modalidad;
    const est = datos.estudiante;
    const cod = est?.cod_ceta ?? est?.codCeta;
    const codStr = (cod !== undefined && cod !== null) ? String(cod).trim() : '';
    const hasCod = /^\d+$/.test(codStr);
    // Asumir "nuevo" hasta que backend confirme la existencia de una inscripción
    this.esNuevoPostulante = true;
    // Marcar que los datos provienen del SGA cuando hay estudiante con cod_ceta
    this.datosRecuperadosSga = !!(this.estudiante && hasCod);
    // Restaurar estado del paso de biográficos si se guardó previamente
    const biosGuardado = datos?.bio_guardado === true;
    if (biosGuardado) {
      this.pasoBiograficosCompletado = true;
      // Mostrar CTA al final hasta que se registre la inscripción (si no estamos en modo ver)
      if (!this.viewInscripcion) {
        this.showRegistrarInscripcion = true;
        this.resumenVisible = false;
      }
    }
    
    // Pre-llenar el formulario con los datos del estudiante
    if (this.estudiante && hasCod) {
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
      
      // Si el tipo de bachiller es 'extranjero', prellenar nro_resolucion con el nro_serie_titulo del SGA
      if (this.tipoBachiller === 'extranjero' && nroSerieTitulo) {
        this.homologacionExtranjero.nro_resolucion = nroSerieTitulo;
        // También aseguramos que postulanteActual.nro_serie_titulo tenga el valor para el input
        this.postulanteActual.nro_serie_titulo = nroSerieTitulo;
        console.log('[BIO] Prefill SGA - Homologación Extranjero:', {
          nro_resolucion: nroSerieTitulo,
          tipoBachiller: this.tipoBachiller
        });
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
  // Si no restauramos biosGuardado, el valor por defecto se mantiene en false
}

// --- Cargar postulante desde BD para usar valores persistidos ---
private cargarPostulanteDesdeBD() {
  const cod = (this.postulanteActual?.cod_ceta || this.estudiante?.cod_ceta) as number | undefined;
  if (!cod) return;
  // Intentar primero el endpoint composite de inscripción
  this.postulanteService.getInscripcionByCodCeta(cod).subscribe({
    next: (p) => {
      this.postulanteDesdeBD = p || null;
      this.tienePostulanteBD = !!p;
      const srcAny: any = p;
      // Considerar "no nuevo" SOLO si existe un registro de inscripción real en backend
      const tieneInscripcion = !!(srcAny && srcAny.inscripcion && srcAny.inscripcion.id);
      this.esNuevoPostulante = !tieneInscripcion;
      // Fusionar datos persistidos en el formulario actual para mostrar en modo lectura
      if (p && typeof p === 'object') {
        const src: any = p;
        const dst: any = { ...this.postulanteActual };
        const put = (k: string, v: any) => {
          if (v !== undefined && v !== null && String(v).toString().trim() !== '') dst[k] = v;
        };
        put('cod_ceta', src.cod_ceta);
        put('carrera', (src as any).carrera || (src as any).carrera_nombre);
        put('pensum', src.pensum);
        put('nombres_est', src.nombres_est);
        put('ap_pat', src.ap_pat);
        put('ap_mat', src.ap_mat);
        put('ci', src.ci);
        put('procedencia', (src as any).procedencia || (src as any).expedido);
        put('fecha_nacimiento', (src as any).fecha_nacimiento);
        put('lugar_nacimiento', src.lugar_nacimiento);
        put('nro_serie_titulo', (src as any).nro_serie_titulo);
        this.postulanteActual = dst;
        // Sincronizar estado de pago completo desde inscrip_modalidad.aranceles_completos
        // Aceptar tanto booleanos como 0/1 o strings "0"/"1"
        const pagoFlag = (src as any).aranceles_completos ?? (src as any).inscripcion?.aranceles_completos;
        if (pagoFlag !== undefined && pagoFlag !== null) {
          const v = (typeof pagoFlag === 'string') ? pagoFlag.trim() : pagoFlag;
          this.pagoCompletoSeleccionados = v === true || v === 1 || v === '1';
        }
        // Tipo de bachiller (si viene de BD) o inferido
        let tb = ((src as any).tipo_bachiller || '').toString().trim().toLowerCase();
        if (!tb) {
          // Inferir por presencia de bloques en BD
          if ((src as any).homologacion_extranjero) tb = 'extranjero';
          else if ((src as any).diploma_bachiller || dst.nro_serie_titulo) tb = 'nacional';
        }
        if (tb) {
          this.tipoBachiller = tb.startsWith('ext') ? 'extranjero' : 'nacional';
        }
        // Mapear datos de Bachillerato desde BD
        if (this.tipoBachiller === 'nacional') {
          const dn = (src as any).diploma_bachiller || {};
          // Aliases comunes que suelen venir de BD
          const nroSerie = (dn.nro_serie || dn.nro_serie_titulo || (src as any).nro_serie_titulo || dst.nro_serie_titulo || '').toString();
          const emision = (dn.emision || dn.emisor || dn.entidad || (src as any).emision_bachiller || (src as any).emision || '').toString();
          const fechaEmi = (dn.fecha_emision || dn.fecha || (src as any).fecha_emision_bachiller || (src as any).fecha_emision || '').toString();
          const obs = (dn.observacion || dn.obs || (src as any).observacion_bachiller || '').toString();
          const gestBach = (dn.gestion_bachillerato || dn.gestion || (src as any).gestion_bachillerato || '').toString();
          this.diplomaNacional = {
            nro_serie: nroSerie,
            emision: emision,
            fecha_emision: fechaEmi,
            observacion: obs,
            gestion_bachillerato: gestBach,
          } as any;
        } else if (this.tipoBachiller === 'extranjero') {
          const he = (src as any).homologacion_extranjero || {};
          // Priorizar datos de BD, pero si no hay, usar el nro_serie_titulo del SGA
          const nroResol = (he.nro_resolucion || (src as any).nro_resolucion || dst.nro_serie_titulo || '').toString();
          const fechaEmi = (he.fecha_emision || he.fecha || (src as any).fecha_emision_resolucion || '').toString();
          const grados = Array.isArray(he.grados_gestiones) ? he.grados_gestiones.map((g: any) => ({
            grado: (g?.grado || '').toString(),
            gestion: (g?.gestion || '').toString(),
          })) : [];
          this.homologacionExtranjero = {
            nro_resolucion: nroResol,
            fecha_emision: fechaEmi,
            grados_gestiones: grados,
          } as any;
          // Asegurar que el input (ligado a postulanteActual.nro_serie_titulo) muestre la resolución
          // Si no hay nro_resolucion en homologacionExtranjero pero hay nro_serie_titulo en dst, usarlo
          if (!this.postulanteActual.nro_serie_titulo && this.homologacionExtranjero.nro_resolucion) {
            this.postulanteActual.nro_serie_titulo = this.homologacionExtranjero.nro_resolucion;
          }
          // Si homologacionExtranjero.nro_resolucion está vacío pero hay nro_serie_titulo en dst, asignarlo
          if (!this.homologacionExtranjero.nro_resolucion && dst.nro_serie_titulo) {
            this.homologacionExtranjero.nro_resolucion = dst.nro_serie_titulo.toString();
            if (!this.postulanteActual.nro_serie_titulo) {
              this.postulanteActual.nro_serie_titulo = dst.nro_serie_titulo.toString();
            }
            console.log('[BD] Prefill SGA - Homologación Extranjero desde nro_serie_titulo:', {
              nro_resolucion: dst.nro_serie_titulo,
              tipoBachiller: this.tipoBachiller
            });
          }
        }

        // Mapear casos especiales si existen en BD
        const regIni = ((src as any).reg_ini_c || (src as any).regimen_inicio || (src as any).regimen_ini || (src as any).regimen || '').toString().trim();
        const gestIni = ((src as any).gestion_ini || (src as any).gestion_inicio || '').toString().trim();
        const regFin = ((src as any).reg_con_c || (src as any).regimen_conclusion || (src as any).regimen_fin || '').toString().trim();
        const gestFin = ((src as any).gestion_fin || (src as any).gestion_conclusion || '').toString().trim();

        // Prefill de datos de carrera en el formulario
        this.datosInicioCarrera.reg_ini_c = (regIni || '') as any;
        this.datosInicioCarrera.gestion_ini = gestIni || '';
        this.datosConclusionCarrera.reg_con_c = (regFin || '') as any;
        this.datosConclusionCarrera.gestion_fin = gestFin || '';
        const eduReg = (src as any).educacion_regular || (src as any).edu_regular || null;
        const tecMed = (src as any).tecnico_medio || null;
        const trasp = (src as any).traspaso_instituto || (src as any).traspaso_instituto_guardado || null;
        const cambio = (src as any).homol_cambio_plan || (src as any).homologacion_cambio_plan || (src as any).homol_cambio_plan_guardado || null;

        // Resetear banderas y opción seleccionada
        this.opciones.educacionRegular = false;
        this.opciones.tecnicoMedio = false;
        this.opciones.traspasoInstituto = false;
        this.opciones.homologacionCambioPlan = false;
        this.selectedOpcion = null;

        if (eduReg) {
          this.opciones.educacionRegular = true;
          this.selectedOpcion = 'educacionRegular';
          this.eduRegularData = {
            serie_titulo_tm: (eduReg.serie_titulo_tm || '').toString(),
            numero_titulo_tm: (eduReg.numero_titulo_tm || '').toString(),
            fecha_emision: (eduReg.fecha_emision || '').toString(),
          } as any;
        } else if (tecMed) {
          this.opciones.tecnicoMedio = true;
          this.selectedOpcion = 'tecnicoMedio';
          this.tecnicoMedioData = {
            serie_titulo_tm: (tecMed.serie_titulo_tm || '').toString(),
            numero_titulo_tm: (tecMed.numero_titulo_tm || '').toString(),
            fecha_emision: (tecMed.fecha_emision || '').toString(),
          } as any;
        } else if (trasp) {
          this.opciones.traspasoInstituto = true;
          this.selectedOpcion = 'traspasoInstituto';
          this.traspasoData = {
            instituto_origen: (trasp.instituto_origen || '').toString(),
            // Aceptar diferentes nombres de arreglo: grados_gestiones, grados, grados_trasp
            grados_gestiones: ((): Array<{ grado: string; gestion: string }> => {
              const arr: any[] = Array.isArray(trasp.grados_gestiones)
                ? trasp.grados_gestiones
                : (Array.isArray(trasp.grados) ? trasp.grados : (Array.isArray(trasp.grados_trasp) ? trasp.grados_trasp : []));
              return arr.map((g: any) => ({
                grado: ((g && g.grado) || '').toString(),
                gestion: ((g && g.gestion) || '').toString(),
              }));
            })(),
          } as any;
        } else if (cambio) {
          this.opciones.homologacionCambioPlan = true;
          this.selectedOpcion = 'homologacionCambioPlan';
          this.homoCambioPlanData = {
            nro_resolucion_rectoral: (cambio.nro_resolucion_rectoral || cambio.nro_resolucion || '').toString(),
            fecha_emision: (cambio.fecha_emision || '').toString(),
            // Aceptar diferentes nombres de arreglo: grados_gestiones, grados, grados_homol_cp
            grados_gestiones: ((): Array<{ grado: string; gestion: string }> => {
              const arr: any[] = Array.isArray(cambio.grados_gestiones)
                ? cambio.grados_gestiones
                : (Array.isArray(cambio.grados) ? cambio.grados : (Array.isArray(cambio.grados_homol_cp) ? cambio.grados_homol_cp : []));
              return arr.map((g: any) => ({
                grado: ((g && g.grado) || '').toString(),
                gestion: ((g && g.gestion) || '').toString(),
              }));
            })(),
          } as any;
        } else {
          // Fallback: si el composite no trae ni traspaso ni homol CP, intentar obtenerlos por cod_ceta_est
          const cod = (this.postulanteActual?.cod_ceta || this.estudiante?.cod_ceta) as any;
          if (cod) {
            // Consultar ambos en paralelo y poblar si existen
            forkJoin({
              traspaso: this.postulanteService.getTraspasoByCod(cod),
              homolcp: this.postulanteService.getHomolCpByCod(cod)
            }).subscribe(({ traspaso, homolcp }) => {
              if (traspaso) {
                this.opciones.traspasoInstituto = true;
                this.selectedOpcion = 'traspasoInstituto';
                const arr: any[] = Array.isArray((traspaso as any).grados_gestiones)
                  ? (traspaso as any).grados_gestiones
                  : (Array.isArray((traspaso as any).grados) ? (traspaso as any).grados : (Array.isArray((traspaso as any).grados_trasp) ? (traspaso as any).grados_trasp : []));
                this.traspasoData = {
                  instituto_origen: (((traspaso as any).instituto_origen) || '').toString(),
                  grados_gestiones: arr.map((g: any) => ({ grado: ((g && g.grado) || '').toString(), gestion: ((g && g.gestion) || '').toString() }))
                } as any;
              } else if (homolcp) {
                this.opciones.homologacionCambioPlan = true;
                this.selectedOpcion = 'homologacionCambioPlan';
                const arr2: any[] = Array.isArray((homolcp as any).grados_gestiones)
                  ? (homolcp as any).grados_gestiones
                  : (Array.isArray((homolcp as any).grados) ? (homolcp as any).grados : (Array.isArray((homolcp as any).grados_homol_cp) ? (homolcp as any).grados_homol_cp : []));
                this.homoCambioPlanData = {
                  nro_resolucion_rectoral: (((homolcp as any).nro_resolucion_rectoral || (homolcp as any).nro_res || (homolcp as any).nro_resolucion) || '').toString(),
                  fecha_emision: (((homolcp as any).fecha_emision) || '').toString(),
                  grados_gestiones: arr2.map((g: any) => ({ grado: ((g && g.grado) || '').toString(), gestion: ((g && g.gestion) || '').toString() }))
                } as any;
              }
            });
          }
        }
        // Marcar biográficos como completados en modo Ver
        this.pasoBiograficosCompletado = true;
        this.isEditing = false;
        this.showBiographicalData = true;
        this.showBachilleratoData = true;
        // Si la carrera/pensum cambió por datos de BD, recargar pensums para sincronizar select
        this.cargarPensums();
        // Cargar aranceles y modalidad asociados al CETA
        this.cargarArancelesMaterialExtra();
        // Importante: no sobreescribir la modalidad si ya vino desde sessionStorage
        if (!this.modalidad) {
          this.cargarModalidadActual();
        }
      }
      // Si venimos con bios ya guardados (paso completo) y aún no hay inscripción, reactivar CTA y permitir arancel manual
      if (this.pasoBiograficosCompletado && this.esNuevoPostulante && !this.viewInscripcion) {
        this.showRegistrarInscripcion = true;
      }
      if (this.debeEntrarVer && !this.esNuevoPostulante) {
        this.entrarVerInscripcion();
      }
      // Si ya existe un resumen o está visible, reconstruirlo para usar datos de BD
      if (this.resumenInscripcion || this.resumenVisible) {
        this.construirResumenInscripcion();
      }
    },
    error: (e) => {
      console.warn('Composite /inscripcion no disponible, intento fallback getById:', e?.status || e);
      // Fallback al endpoint simple si el composite aún no existe
      this.postulanteService.getById(cod).subscribe({
        next: (p2) => {
          this.postulanteDesdeBD = p2 || null;
          // Reusar el mismo flujo mapeando p2
          const src: any = p2;
          const dst: any = { ...this.postulanteActual };
          const put = (k: string, v: any) => {
            if (v !== undefined && v !== null && String(v).toString().trim() !== '') dst[k] = v;
          };
          put('cod_ceta', src?.cod_ceta);
          put('carrera', (src as any)?.carrera || (src as any)?.carrera_nombre);
          put('pensum', src?.pensum);
          put('nombres_est', src?.nombres_est);
          put('ap_pat', src?.ap_pat);
          put('ap_mat', src?.ap_mat);
          put('ci', src?.ci);
          put('procedencia', (src as any)?.procedencia || (src as any)?.expedido);
          put('fecha_nacimiento', (src as any)?.fecha_nacimiento);
          put('lugar_nacimiento', src?.lugar_nacimiento);
          put('nro_serie_titulo', (src as any)?.nro_serie_titulo);
          this.postulanteActual = dst;
          // Sincronizar estado de pago completo si viene disponible en el fallback
          const pagoFlag2 = (src as any)?.aranceles_completos ?? (src as any)?.inscripcion?.aranceles_completos;
          if (pagoFlag2 !== undefined && pagoFlag2 !== null) {
            const v2 = (typeof pagoFlag2 === 'string') ? pagoFlag2.trim() : pagoFlag2;
            this.pagoCompletoSeleccionados = v2 === true || v2 === 1 || v2 === '1';
          }
          // Señales de vista
          this.pasoBiograficosCompletado = true;
          this.isEditing = false;
          this.showBiographicalData = true;
          this.showBachilleratoData = true;
          // Dependientes
          this.cargarPensums();
          this.cargarArancelesMaterialExtra();
          // Importante: no sobreescribir la modalidad si ya vino desde sessionStorage
          if (!this.modalidad) {
            this.cargarModalidadActual();
          }
        },
        error: (err2) => {
          console.warn('Fallback getById también falló:', err2);
          this.postulanteDesdeBD = null;
        }
      });
    }
    });
  }

  // Mapea registros de aranceles_est (Laravel) al formato de la tabla de Material Extra
  private mapArancelesEstToLista(items: any[]): any[] {
    const normStr = (v: any) => (v === null || v === undefined) ? '' : String(v);
    const normNum = (v: any) => {
      const n = Number(v);
      return isNaN(n) ? 0 : n;
    };
    return (items || []).map((r: any) => ({
      arancel_id: (r && r.id != null) ? Number(r.id) : null,
      inscrip_modalidad_id: (r && r.inscrip_modalidad_id != null) ? Number(r.inscrip_modalidad_id) : null,
      gestion: normStr(r.gestion || ''),
      fecha: this.normalizarFecha(r.fecha) || '',
      concepto: normStr(r.concepto || r.descripcion || ''),
      monto: normNum(r.monto || r.importe || 0),
      num_factura: normStr(r.num_factura || ''),
      num_comprobante: normStr(r.num_comprobante || ''),
      razon: normStr(r.razon || ''),
      nit: normStr(r.nit || ''),
      selected: true,
    }));
  }

  // Aplica selección en this.aranceles cruzando con registros de aranceles_est seleccionados
  private aplicarSeleccionDesdeDB(arancelesEst: any[]) {
    const normStr = (v: any) => (v === null || v === undefined) ? '' : String(v).trim();
    const normNum = (v: any) => {
      const n = Number(v);
      return isNaN(n) ? null : n;
    };
    const normFecha = (v: any) => this.normalizarFecha(v);

    // Construir índice de búsqueda rápida desde DB por claves fuertes
    const idxFactura = new Set<string>(); // por num_factura
    const idxRecibo = new Set<string>();  // por num_comprobante
    const idxComposite = new Set<string>(); // por (fecha, concepto, monto)
    for (const r of (arancelesEst || [])) {
      const f = normStr(r.num_factura);
      const c = normStr(r.num_comprobante);
      if (f && f !== '0') idxFactura.add(f);
      if (c && c !== '0') idxRecibo.add(c);
      const comp = [normFecha(r.fecha) || '', normStr(r.concepto) || '', String(normNum(r.monto) ?? '')].join('|');
      if (comp !== '||') idxComposite.add(comp);
    }

    // Marcar seleccionados en la lista SGA comparando por factura, recibo o composite
    const seleccionados: any[] = [];
    for (const a of (this.aranceles || [])) {
      const f = normStr(a.num_factura);
      const c = normStr(a.num_comprobante);
      const comp = [normFecha(a.fecha) || '', normStr(a.concepto) || '', String(normNum(a.monto) ?? '')].join('|');
      const match = (f && f !== '0' && idxFactura.has(f)) || (c && c !== '0' && idxRecibo.has(c)) || (!!comp && idxComposite.has(comp));
      if (match) seleccionados.push(a);
    }

    this.selectedAranceles = seleccionados;
    this.recalcularTotalSeleccionados();
  }

  // Intenta recuperar la modalidad desde sessionStorage (datos_postulacion)
  private recuperarModalidadDeSession() {
    try {
      const raw = sessionStorage.getItem('datos_postulacion');
      if (!raw) return;
      const datos = JSON.parse(raw);
      if (datos && datos.modalidad && !this.modalidad) {
        this.modalidad = datos.modalidad;
      }
    } catch {}
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
    this.markChangedInView();
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
    if (!this.modalidades || this.modalidades.length === 0) {
      this.loadingService.showModal();
      this.postulanteService.getModalidades()
        .pipe(finalize(() => this.loadingService.hideModal()))
        .subscribe({
        next: (res: any) => {
          const data = res?.data || res || [];
          this.modalidades = Array.isArray(data) ? data : [];
          this.modalVisible = true;
        },
        error: () => {
          this.modalVisible = true; // mostrar modal aunque haya error para informar
        }
      });
    } else {
      this.loadingService.showModal();
      setTimeout(() => {
        this.modalVisible = true;
        this.loadingService.hideModal();
      }, 0);
    }
  }

  ocultarModal() {
    this.modalVisible = false;
  }
  
  seleccionarModalidad(modalidad: ModalidadGraduacion) {
    // Para postulantes nuevos: asignar directamente sin confirmación
    if (this.esNuevoPostulante) {
      this.modalidad = modalidad;
      return;
    }
    // Para edición: pedir confirmación mostrando el cambio
    this.nuevaModalidad = modalidad;
    this.loadingService.showModal();
    setTimeout(() => {
      this.modalConfirmCambioVisible = true;
      this.loadingService.hideModal();
    }, 0);
  }

  cancelarCambioModalidad() {
    this.modalConfirmCambioVisible = false;
    this.nuevaModalidad = null;
  }

  confirmarCambioModalidad() {
    if (!this.nuevaModalidad) return;
    const anterior = this.modalidad ? { ...this.modalidad } : null;
    const seleccionado = this.nuevaModalidad;
    this.modalConfirmCambioVisible = false;
    this.ocultarModal();

    const cod = this.postulanteActual.cod_ceta || this.estudiante?.cod_ceta;
    if (cod) {
      this.postulanteService.asignarModalidad(Number(cod), seleccionado.id).subscribe({
        next: (resultado) => {
          console.log('Modalidad asignada correctamente:', resultado);
          this.modalidad = seleccionado;
          // Solo mostrar modal de cambios si NO es postulante nuevo
          if (!this.esNuevoPostulante) {
            this.cambiosRealizados.push({
              campo: 'Modalidad de Graduación',
              anterior: anterior ? `${anterior.nombre}` : '- (sin modalidad) -',
              nuevo: `${seleccionado.nombre}`,
            });
            this.modalCambiosVisible = true;
          }
          this.cargarModalidadActual();
        },
        error: (err) => {
          console.error('Error al asignar modalidad:', err);
        }
      });
    } else {
      // Sin CETA aún: solo estado local; se persistirá más adelante
      this.modalidad = seleccionado;
      // Solo mostrar modal de cambios si NO es postulante nuevo
      if (!this.esNuevoPostulante) {
        this.cambiosRealizados.push({
          campo: 'Modalidad de Graduación',
          anterior: anterior ? `${anterior.nombre}` : '- (sin modalidad) -',
          nuevo: `${seleccionado.nombre}`,
        });
        this.modalCambiosVisible = true;
      }
    }
    this.nuevaModalidad = null;
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
          monto_arancel: (m.monto_arancel !== undefined && m.monto_arancel !== null
            ? String(Number(m.monto_arancel))
            : undefined),
        }));
        this.loadingModalidades = false;
        // Si no hay modalidad ya establecida (p. ej., desde sessionStorage), consultar al backend
        if (!this.modalidad) {
          this.cargarModalidadActual();
        } else {
          // Enriquecer modalidad actual con datos del catálogo si faltan descripción o monto
          const found = (this.modalidades || []).find(m => Number(m.id) === Number(this.modalidad?.id));
          if (found) {
            if (!this.modalidad.descripcion || String(this.modalidad.descripcion).trim() === '') {
              this.modalidad.descripcion = found.descripcion || '';
            }
            if (!this.modalidad.monto_arancel) {
              this.modalidad.monto_arancel = found.monto_arancel;
            }
          }
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
    this.postulanteService.getModalidadPostulante(Number(codCeta)).subscribe({
      next: (res: any) => {
        const mod = res?.modalidad || null;
        if (mod) {
          // Usar la modalidad devuelta por el backend
          const mId = Number(mod.id);
          const fromCatalog = (this.modalidades || []).find(m => Number(m.id) === mId) || null;
          const monto = (mod.monto_arancel !== undefined && mod.monto_arancel !== null)
            ? String(Number(mod.monto_arancel))
            : (fromCatalog?.monto_arancel !== undefined ? String(fromCatalog.monto_arancel as any) : undefined);
          const desc = (mod.descripcion && String(mod.descripcion).trim() !== '')
            ? String(mod.descripcion)
            : (fromCatalog?.descripcion || '');
          this.modalidad = {
            id: mId,
            nombre: mod.nombre,
            descripcion: desc,
            icono: this.getIconForModalidad(mod?.nombre ?? mod?.id),
            monto_arancel: monto,
          };
        } else {
          const mid = res?.modalidad_id;
          if (mid && this.modalidades?.length) {
            const found = this.modalidades.find(m => Number(m.id) === Number(mid)) || null;
            this.modalidad = found ? {
              id: Number(found.id),
              nombre: found.nombre,
              descripcion: found.descripcion || '',
              icono: this.getIconForModalidad(found?.nombre ?? found?.id),
              monto_arancel: (found.monto_arancel !== undefined && found.monto_arancel !== null) ? String(found.monto_arancel as any) : undefined,
            } : null;
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

  // --- Ver Inscripción (modo solo lectura con edición por tarjeta) ---
  entrarVerInscripcion() {
    this.viewInscripcion = true;
    // Asegurar que todas las secciones sean visibles para revisar
    this.pasoBiograficosCompletado = true;
    this.showBiographicalData = true;
    this.showBachilleratoData = true;
    // Reset de flags de edición por tarjeta
    this.editBio = false;
    this.editBach = false;
    this.editInicio = false;
    this.editConclusion = false;
    this.editAranceles = false;
    this.showManualArancelesEnEdicion = false;
  }

  salirVerInscripcion() {
    this.viewInscripcion = false;
    // Cerrar ediciones parciales si las hubiera
    this.editBio = false;
    this.editBach = false;
    this.editInicio = false;
    this.editConclusion = false;
    this.editAranceles = false;
    // Resetear marca de cambios en modo visualización
    this.hasChangesInView = false;
  }

  guardarCambiosVerInscripcion() {
    // Asegurar snapshot para poder mostrar diferencias aunque no haya entrado por los botones "Editar"
    if (!this._snapshotAntes) {
      this.prepararSnapshotAntesDeEditar();
    }
    // Guardado general. Persistimos biográficos y datos de carrera (datos_carrera)
    const cod = this.postulanteActual.cod_ceta as number | undefined;
    const guardarBio$ = cod
      ? this.postulanteService.update(cod, this.postulanteActual as Postulante)
      : this.postulanteService.create(this.postulanteActual as Postulante);

    // Preparar payload de datos_carrera si el usuario ha seleccionado valores
    guardarBio$.subscribe({
      next: (res) => {
        const codFinal = Number(cod || (res as any)?.cod_ceta || (this.postulanteActual?.cod_ceta as any)) || undefined;
        // Preparar guardados secundarios después de conocer codFinal
        const saves: any[] = [];
        // Detectar borrados por 'Quitar selección'
        const prevSnap = this._snapshotAntes || this.getSnapshotActual();
        const currSnap = this.getSnapshotActual();
        const prevHadEduReg = !!(prevSnap.edu_reg_serie_tm || prevSnap.edu_reg_numero_tm || prevSnap.edu_reg_fecha_emision);
        const nowHasEduReg = !!(currSnap.edu_reg_serie_tm || currSnap.edu_reg_numero_tm || currSnap.edu_reg_fecha_emision);
        const prevHadTecMed = !!(prevSnap.tec_med_serie_tm || prevSnap.tec_med_numero_tm || prevSnap.tec_med_fecha_emision);
        const nowHasTecMed = !!(currSnap.tec_med_serie_tm || currSnap.tec_med_numero_tm || currSnap.tec_med_fecha_emision);
        const prevHadTrasp = (prevSnap.traspaso_instituto_origen || 0) || (prevSnap.traspaso_grados_count || 0);
        const nowHasTrasp = (currSnap.traspaso_instituto_origen || 0) || (currSnap.traspaso_grados_count || 0);
        const prevHadHomoCP = !!(prevSnap.homocp_nro_resolucion || prevSnap.homocp_fecha_emision || (prevSnap.homocp_grados_count || 0));
        const nowHasHomoCP = !!(currSnap.homocp_nro_resolucion || currSnap.homocp_fecha_emision || (currSnap.homocp_grados_count || 0));
        if (codFinal) {
          if (prevHadEduReg && !nowHasEduReg) saves.push(this.postulanteService.deleteTransitabilidadEduRegByCod(codFinal));
          if (prevHadTecMed && !nowHasTecMed) saves.push(this.postulanteService.deleteTransitabilidadInstTecByCod(codFinal));
          if (prevHadTrasp && !nowHasTrasp) saves.push(this.postulanteService.deleteTraspasosByCod(codFinal));
          if (prevHadHomoCP && !nowHasHomoCP) saves.push(this.postulanteService.deleteHomolCambioPlanByCod(codFinal));
        }
        const tieneCarrera = !!(this.datosInicioCarrera?.reg_ini_c || this.datosInicioCarrera?.gestion_ini || this.datosConclusionCarrera?.reg_con_c || this.datosConclusionCarrera?.gestion_fin);
        if (codFinal && tieneCarrera) {
          const payloadCarrera = {
            cod_ceta_est: codFinal,
            regimen_ini: (this.datosInicioCarrera.reg_ini_c || '').toString().trim() || null,
            regimen_fin: (this.datosConclusionCarrera.reg_con_c || '').toString().trim() || null,
            gestion_ini: (this.datosInicioCarrera.gestion_ini || '').toString().trim() || null,
            gestion_fin: (this.datosConclusionCarrera.gestion_fin || '').toString().trim() || null,
            is_active: true,
          };
          saves.push(this.postulanteService.upsertDatosCarrera(payloadCarrera));
        }
        if (codFinal && this.selectedOpcion === 'educacionRegular') {
          const serieTM = (this.eduRegularData?.serie_titulo_tm || '').toString().trim();
          const numeroTM = (this.eduRegularData?.numero_titulo_tm || '').toString().trim();
          const fechaTM = this.normalizarFecha(this.eduRegularData?.fecha_emision);
          const hayDatosEduReg = !!(serieTM || numeroTM || fechaTM);
          if (hayDatosEduReg) {
            const payloadEduReg = {
              cod_ceta_est: codFinal,
              serie_titulo_tm: serieTM || null,
              numero_titulo_tm: numeroTM || null,
              fecha_emision: fechaTM,
              observacion: null,
            };
            saves.push(this.postulanteService.saveTransitabilidadEduReg(payloadEduReg));
          }
        }
        if (saves.length) {
          forkJoin(saves).subscribe({
            next: () => {
              this.cargarPostulantes();
              // Resetear flags de edición y mostrar modal de cambios
              this.editBio = false;
              this.editBach = false;
              this.editInicio = false;
              this.editConclusion = false;
              this.editAranceles = false;
              this.hasChangesInView = false;
              const cambios = this.compararSnapshots(this._snapshotAntes, this.getSnapshotActual());
              this.mostrarModalCambios(cambios);
            },
            error: (e: any) => {
              console.error('Error en guardados secundarios:', e);
              alert('Datos biográficos guardados, pero hubo un error al guardar datos adicionales (inicio/conclusión o transitabilidad).');
            }
          });
        } else {
          // No hay guardados secundarios, proceder directo
          this.cargarPostulantes();
          this.editBio = false;
          this.editBach = false;
          this.editInicio = false;
          this.editConclusion = false;
          this.editAranceles = false;
          this.hasChangesInView = false;
          const cambios = this.compararSnapshots(this._snapshotAntes, this.getSnapshotActual());
          this.mostrarModalCambios(cambios);
        }
      },
      error: () => {
        alert('No se pudo guardar los cambios. Verifique e intente nuevamente.');
      }
    });
  }

  // Toggles de edición por tarjeta
  iniciarEdicionBioCard() { this.prepararSnapshotAntesDeEditar(); this.editBio = true; }
  finalizarEdicionBioCard() { this.editBio = false; }
  iniciarEdicionBachCard() { this.prepararSnapshotAntesDeEditar(); this.editBach = true; }
  finalizarEdicionBachCard() { this.editBach = false; }
  iniciarEdicionInicioCard() { this.prepararSnapshotAntesDeEditar(); this.editInicio = true; }
  finalizarEdicionInicioCard() { this.editInicio = false; }
  iniciarEdicionConclusionCard() { this.prepararSnapshotAntesDeEditar(); this.editConclusion = true; }
  finalizarEdicionConclusionCard() { this.editConclusion = false; }
  iniciarEdicionArancelesCard() {
    this.prepararSnapshotAntesDeEditar();
    this.editAranceles = true;
    // Si estamos visualizando una inscripción, habilitar el formulario de arancel manual temporalmente
    if (this.viewInscripcion) {
      this.showManualArancelesEnEdicion = true;
    }
  }
  finalizarEdicionArancelesCard() { this.editAranceles = false; this.showManualArancelesEnEdicion = false; }

  // --- Guardados por tarjeta ---
  cancelarEdicionBioCard() { this.editBio = false; }
  cancelarEdicionBachCard() { this.editBach = false; }
  cancelarEdicionInicioCard() { this.editInicio = false; }
  cancelarEdicionConclusionCard() { this.editConclusion = false; }
  cancelarEdicionArancelesCard() { this.editAranceles = false; this.showManualArancelesEnEdicion = false; }

  guardarBioCard() {
    if (!this._snapshotAntes) this.prepararSnapshotAntesDeEditar();
    // Mapear bachiller extranjero en biográficos si aplica (campo nro_serie_titulo)
    if (this.tipoBachiller === 'extranjero') {
      const nro = (this.homologacionExtranjero?.nro_resolucion || '').toString().trim();
      if (nro) {
        (this.postulanteActual as any).nro_serie_titulo = nro;
      }
    }
    const cod = this.postulanteActual.cod_ceta as number | undefined;
    const req$ = cod
      ? this.postulanteService.update(cod, this.postulanteActual as Postulante)
      : this.postulanteService.create(this.postulanteActual as Postulante);
    req$.subscribe({
      next: () => {
        // Calcular cambios con el estado actual en memoria antes de refrescar
        const cambios = this.compararSnapshots(this._snapshotAntes, this.getSnapshotActual());
        this.mostrarModalCambios(cambios);
        // Reset de flags y refresco
        this.editBio = false;
        this.hasChangesInView = false;
        this.cargarPostulantes();
      },
      error: (e) => {
        console.error('Error al guardar biográficos:', e);
        alert('No se pudo guardar los datos biográficos. Verifique e intente nuevamente.');
      }
    });
  }

  guardarBachCard() {
    if (!this._snapshotAntes) this.prepararSnapshotAntesDeEditar();
    // Guardar biográficos (incluye nro_serie_titulo si extranjero)
    if (this.tipoBachiller === 'extranjero') {
      const nro = (this.homologacionExtranjero?.nro_resolucion || '').toString().trim();
      if (nro) {
        (this.postulanteActual as any).nro_serie_titulo = nro;
      }
    }
    const cod = this.postulanteActual.cod_ceta as number | undefined;
    const req$ = cod
      ? this.postulanteService.update(cod, this.postulanteActual as Postulante)
      : this.postulanteService.create(this.postulanteActual as Postulante);
    req$.subscribe({
      next: (res) => {
        const codFinal = Number(cod || (res as any)?.cod_ceta || (this.postulanteActual?.cod_ceta as any)) || undefined;
        const saves: any[] = [];
        // Detectar borrados por 'Quitar selección' comparando snapshot previo vs actual
        const prevSnap = this._snapshotAntes || this.getSnapshotActual();
        const currSnap = this.getSnapshotActual();
        const prevHadEduReg = !!(prevSnap.edu_reg_serie_tm || prevSnap.edu_reg_numero_tm || prevSnap.edu_reg_fecha_emision);
        const nowHasEduReg = !!(currSnap.edu_reg_serie_tm || currSnap.edu_reg_numero_tm || currSnap.edu_reg_fecha_emision);
        const prevHadTecMed = !!(prevSnap.tec_med_serie_tm || prevSnap.tec_med_numero_tm || prevSnap.tec_med_fecha_emision);
        const nowHasTecMed = !!(currSnap.tec_med_serie_tm || currSnap.tec_med_numero_tm || currSnap.tec_med_fecha_emision);
        const prevHadTrasp = (prevSnap.traspaso_instituto_origen || 0) || (prevSnap.traspaso_grados_count || 0);
        const nowHasTrasp = (currSnap.traspaso_instituto_origen || 0) || (currSnap.traspaso_grados_count || 0);
        const prevHadHomoCP = !!(prevSnap.homocp_nro_resolucion || prevSnap.homocp_fecha_emision || (prevSnap.homocp_grados_count || 0));
        const nowHasHomoCP = !!(currSnap.homocp_nro_resolucion || currSnap.homocp_fecha_emision || (currSnap.homocp_grados_count || 0));
        if (codFinal) {
          if (prevHadEduReg && !nowHasEduReg) {
            saves.push(this.postulanteService.deleteTransitabilidadEduRegByCod(codFinal));
          }
          if (prevHadTecMed && !nowHasTecMed) {
            saves.push(this.postulanteService.deleteTransitabilidadInstTecByCod(codFinal));
          }
          if (prevHadTrasp && !nowHasTrasp) {
            saves.push(this.postulanteService.deleteTraspasosByCod(codFinal));
          }
          if (prevHadHomoCP && !nowHasHomoCP) {
            saves.push(this.postulanteService.deleteHomolCambioPlanByCod(codFinal));
          }
        }
        // 1) Diploma de Bachiller
        if (codFinal) {
          // Detectar datos ingresados para nacional/extranjero
          const dn = this.diplomaNacional || ({} as any);
          const he = this.homologacionExtranjero || ({} as any);
          const hasNacional = !!(
            (dn.nro_serie || '').toString().trim() ||
            (dn.emision || '').toString().trim() ||
            this.normalizarFecha(dn.fecha_emision) ||
            (dn.observacion || '').toString().trim() ||
            (dn.gestion_bachillerato || '').toString().trim()
          );
          const hasExtranjero = !!(
            (he.nro_resolucion || '').toString().trim() ||
            this.normalizarFecha(he.fecha_emision)
          );
          // Si no hay tipo explícito, inferir por los datos ingresados
          let tipo = this.tipoBachiller as 'nacional' | 'extranjero' | null;
          if (!tipo) {
            if (hasExtranjero && !hasNacional) tipo = 'extranjero';
            else if (hasNacional && !hasExtranjero) tipo = 'nacional';
          }
          // Si no hay ningún dato de diploma, omitir guardado
          if (!tipo && !hasNacional && !hasExtranjero) {
            console.log('[GuardarBach] Sin datos de diploma, omitiendo upsert.');
          } else if (tipo) {
            const payloadDiploma: any = {
              cod_ceta_est: codFinal,
              tipo_bachiller: tipo,
              is_active: true,
            };
            if (tipo === 'nacional') {
              payloadDiploma.nro_serie_titulo = (this.diplomaNacional?.nro_serie || '').toString().trim() || null;
              payloadDiploma.emision = (this.diplomaNacional?.emision || '').toString().trim() || null;
              payloadDiploma.fecha_emision = this.normalizarFecha(this.diplomaNacional?.fecha_emision);
              payloadDiploma.gestion_bachillerato = (this.diplomaNacional?.gestion_bachillerato || '').toString().trim() || null;
              payloadDiploma.observacion = (this.diplomaNacional?.observacion || '').toString().trim() || null;
            } else if (tipo === 'extranjero') {
              payloadDiploma.nro_resolucion = (this.homologacionExtranjero?.nro_resolucion || '').toString().trim() || null;
              // El campo del formulario se llama fecha_emision, pero en modelo es fecha_resolucion
              payloadDiploma.fecha_resolucion = this.normalizarFecha(this.homologacionExtranjero?.fecha_emision);
            }
            console.log('[GuardarBach] Enviando diploma_bachiller/upsert:', payloadDiploma);
            saves.push(this.postulanteService.saveDiplomaBachiller(payloadDiploma));
          } else {
            console.warn('[GuardarBach] No se pudo inferir tipo_bachiller a partir de los datos.');
          }
        }
        if (codFinal && this.selectedOpcion === 'educacionRegular') {
          const payloadEduReg = {
            cod_ceta_est: codFinal,
            serie_titulo_tm: (this.eduRegularData?.serie_titulo_tm || '').toString().trim() || null,
            numero_titulo_tm: (this.eduRegularData?.numero_titulo_tm || '').toString().trim() || null,
            fecha_emision: this.normalizarFecha(this.eduRegularData?.fecha_emision),
            observacion: null,
          };
          saves.push(this.postulanteService.saveTransitabilidadEduReg(payloadEduReg));
        }
        // Guardado opcional de Transitabilidad Técnico Medio
        if (codFinal && this.selectedOpcion === 'tecnicoMedio') {
          const serieTM2 = (this.tecnicoMedioData?.serie_titulo_tm || '').toString().trim();
          const numeroTM2 = (this.tecnicoMedioData?.numero_titulo_tm || '').toString().trim();
          const fechaTM2 = this.normalizarFecha(this.tecnicoMedioData?.fecha_emision);
          const hayDatosTecMed = !!(serieTM2 || numeroTM2 || fechaTM2);
          if (hayDatosTecMed) {
            const payloadTecMed = {
              cod_ceta_est: codFinal,
              serie_titulo_tm: serieTM2 || null,
              numero_titulo_tm: numeroTM2 || null,
              fecha_emision: fechaTM2,
              observacion: null,
            };
            saves.push(this.postulanteService.saveTransitabilidadInstTec(payloadTecMed));
          }
        }
        // Guardado opcional de Traspaso de Instituto
        if (codFinal && this.selectedOpcion === 'traspasoInstituto') {
          const t = this.traspasoData || ({} as any);
          const instit = (t.instituto_origen || '').toString().trim();
          const hayTrasp = !!(instit || (Array.isArray(t.grados_gestiones) && t.grados_gestiones.length));
          if (hayTrasp) {
            const payloadTrasp = {
              cod_ceta_est: codFinal,
              instituto_origen: instit || null,
              grados_gestiones: Array.isArray(t.grados_gestiones) ? t.grados_gestiones.map((g: any) => ({ grado: (g?.grado || '').toString().trim() || null, gestion: (g?.gestion || '').toString().trim() || null })) : []
              // Si en el futuro agregamos más campos en el formulario, se añaden aquí
            };
            saves.push(this.postulanteService.upsertTraspasoByCod(payloadTrasp));
          }
        }
        // Guardado opcional de Homologación por Cambio de Plan
        if (codFinal && this.selectedOpcion === 'homologacionCambioPlan') {
          const cp = this.homoCambioPlanData || ({} as any);
          const nro = (cp.nro_resolucion_rectoral || '').toString().trim();
          const fec = this.normalizarFecha(cp.fecha_emision);
          const hayCp = !!(nro || fec || (Array.isArray(cp.grados_gestiones) && cp.grados_gestiones.length));
          if (hayCp) {
            const payloadCp = {
              cod_ceta_est: codFinal,
              nro_resolucion: nro || null,
              fecha_emision: fec,
              grados_gestiones: Array.isArray(cp.grados_gestiones)
                ? cp.grados_gestiones.map((g: any) => ({
                    grado: (g?.grado || '').toString().trim() || null,
                    gestion: (g?.gestion || '').toString().trim() || null,
                  }))
                : [],
            } as any;
            saves.push(this.postulanteService.upsertHomolCpByCod(payloadCp));
          }
        }
        const afterSuccess = () => {
          // Calcular cambios reales con snapshot previo y actual (incluye campos detallados de diploma)
          const cambios = this.compararSnapshots(this._snapshotAntes, this.getSnapshotActual()) || [];
          this.mostrarModalCambios(cambios as any[]);
          // Reset y refresco
          this.editBach = false;
          this.hasChangesInView = false;
          this.cargarPostulantes();
        };
        if (saves.length) {
          forkJoin(saves).subscribe({
            next: afterSuccess,
            error: (e: any) => {
              console.error('Error al guardar datos adicionales (diploma/transitabilidad):', e);
              const backendMsg = (e?.error && (e.error.message || e.error.error || JSON.stringify(e.error))) || e?.message || 'Error desconocido';
              alert('No se pudo guardar todos los datos de bachillerato. Detalle: ' + backendMsg);
              // Mantener modo edición para permitir corregir
              this.editBach = true;
              this.hasChangesInView = true;
            }
          });
        } else {
          afterSuccess();
        }
      },
      error: (e) => {
        console.error('Error al guardar bachillerato/biográficos:', e);
        alert('No se pudo guardar los datos de bachillerato. Verifique e intente nuevamente.');
      }
    });
  }

  guardarInicioCard() {
    if (!this._snapshotAntes) this.prepararSnapshotAntesDeEditar();
    const cod = Number(this.postulanteActual.cod_ceta || this.estudiante?.cod_ceta) || null;
    if (!cod) {
      alert('No hay código CETA para guardar datos de inicio. Guarde biográficos primero.');
      return;
    }
    const payload = {
      cod_ceta_est: cod,
      regimen_ini: (this.datosInicioCarrera.reg_ini_c || '').toString().trim() || null,
      regimen_fin: (this.datosConclusionCarrera.reg_con_c || '').toString().trim() || null,
      gestion_ini: (this.datosInicioCarrera.gestion_ini || '').toString().trim() || null,
      gestion_fin: (this.datosConclusionCarrera.gestion_fin || '').toString().trim() || null,
      is_active: true,
    };
    this.postulanteService.upsertDatosCarrera(payload).subscribe({
      next: () => {
        const cambios = this.compararSnapshots(this._snapshotAntes, this.getSnapshotActual());
        this.mostrarModalCambios(cambios);
        this.editInicio = false;
        this.hasChangesInView = false;
        this.cargarPostulantes();
      },
      error: (e) => {
        console.error('Error al guardar inicio de carrera:', e);
        alert('No se pudo guardar los datos de inicio de carrera.');
      }
    });
  }

  guardarConclusionCard() {
    if (!this._snapshotAntes) this.prepararSnapshotAntesDeEditar();
    const cod = Number(this.postulanteActual.cod_ceta || this.estudiante?.cod_ceta) || null;
    if (!cod) {
      alert('No hay código CETA para guardar datos de conclusión. Guarde biográficos primero.');
      return;
    }
    const payload = {
      cod_ceta_est: cod,
      regimen_ini: (this.datosInicioCarrera.reg_ini_c || '').toString().trim() || null,
      regimen_fin: (this.datosConclusionCarrera.reg_con_c || '').toString().trim() || null,
      gestion_ini: (this.datosInicioCarrera.gestion_ini || '').toString().trim() || null,
      gestion_fin: (this.datosConclusionCarrera.gestion_fin || '').toString().trim() || null,
      is_active: true,
    };
    this.postulanteService.upsertDatosCarrera(payload).subscribe({
      next: () => {
        const cambios = this.compararSnapshots(this._snapshotAntes, this.getSnapshotActual());
        this.mostrarModalCambios(cambios);
        this.editConclusion = false;
        this.hasChangesInView = false;
        this.cargarPostulantes();
      },
      error: (e) => {
        console.error('Error al guardar conclusión de carrera:', e);
        alert('No se pudo guardar los datos de conclusión de carrera.');
      }
    });
  }

  guardarArancelesCard() {
    if (!this._snapshotAntes) this.prepararSnapshotAntesDeEditar();
    const cod = this.postulanteActual.cod_ceta || this.estudiante?.cod_ceta;
    if (!cod) {
      alert('No hay código CETA. Guarde biográficos primero.');
      return;
    }

    // Preparar un resumen de cambios específico de aranceles para el modal
    const antesCount = (this._snapshotAntes as any)?.aranceles_count ?? this.selectedAranceles.length;
    const antesTotal = (this._snapshotAntes as any)?.aranceles_total ?? (this.selectedAranceles || []).reduce((s, a) => s + (Number(a?.monto) || 0), 0);
    const ahoraCount = (this.selectedAranceles || []).length;
    const ahoraTotal = (this.selectedAranceles || []).reduce((s, a) => s + (Number(a?.monto) || 0), 0);
    const cambiosResumen: Array<{ campo: string; anterior: any; nuevo: any }> = [];
    if (antesCount !== ahoraCount) cambiosResumen.push({ campo: 'Aranceles seleccionados', anterior: antesCount, nuevo: ahoraCount });
    if (antesTotal !== ahoraTotal) cambiosResumen.push({ campo: 'Total Aranceles', anterior: antesTotal, nuevo: ahoraTotal });

    // Primero obtener qué filas están seleccionadas en BD para poder desmarcarlas con ID cuando corresponda
    this.postulanteService.getArancelesEstByCodCeta(cod as number, true).subscribe({
      next: (resp) => {
        const dbSel: any[] = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
        const normStr = (v: any) => (v === undefined || v === null) ? '' : String(v).trim();
        const normNum = (v: any) => { const n = Number(v); return isNaN(n) ? null : n; };
        const normFecha = (v: any) => this.normalizarFecha(v);
        const keyOf = (o: any) => this.arancelKey(o);
        const compositeKey = (o: any) => `X#${[normFecha(o?.fecha) || '', normStr(o?.concepto) || '', String(normNum(o?.monto) ?? '')].join('|')}`;
        const facturaKey = (o: any) => { const f = normStr(o?.num_factura); return (f && f !== '0') ? `F#${f}` : null; };
        const reciboKey = (o: any) => { const c = normStr(o?.num_comprobante); return (c && c !== '0') ? `C#${c}` : null; };
        const dbIndex: Map<string, any> = new Map();
        for (const r of dbSel) {
          const kId = keyOf(r); // ID#id si existe, o fallback
          dbIndex.set(kId, r);
          const kF = facturaKey(r); if (kF) dbIndex.set(kF, r);
          const kC = reciboKey(r); if (kC) dbIndex.set(kC, r);
          const kX = compositeKey(r); dbIndex.set(kX, r);
        }

        const isSel = (a: any) => this.isArancelSeleccionado(a);
        const inscId = this.inscripModalidadIdActual || null;
        const buildPayload = (a: any, seleccionado: number) => {
          const fecha = this.normalizarFecha(a.fecha);
          const prev = { ...a };
          const p: any = {
            cod_ceta_est: Number(cod),
            gestion: a.gestion || null,
            fecha: fecha || null,
            concepto: a.concepto || null,
            monto: (a.monto ?? null),
            num_factura: (a.num_factura || null),
            num_comprobante: (a.num_comprobante || null),
            razon: (a.razon || null),
            nit: (a.nit || null),
            seleccionado,
            origen: (a.origen || 'sga'),
          };
          // Estado de pago: usa flag de la fila o el conmutador global "Pago completo"
          const pagadoFlag = !!(a?.pagado || this.pagoCompletoSeleccionados);
          p.pagado = pagadoFlag ? 1 : 0;
          p.fecha_pago = pagadoFlag ? (fecha || null) : null;
          if (inscId) p.inscrip_modalidad_id = inscId;
          // prev_* para asegurar UPDATE y no INSERT
          p.prev_num_factura = (prev.num_factura ?? null);
          p.prev_num_comprobante = (prev.num_comprobante ?? null);
          p.prev_fecha = fecha || null;
          p.prev_concepto = a.concepto || null;
          p.prev_monto = (a.monto ?? null);
          return p;
        };

        const ops: Array<any> = [];
        for (const a of (this.aranceles || [])) {
          const key = keyOf(a);
          const selFlag = isSel(a) ? 1 : 0;
          // Siempre realizar upsert para fijar el estado en BD (evita que no se actualice por falta de ID)
          const upsertPayload = buildPayload(a, selFlag);
          console.debug('[Aranceles][Save] Upsert payload:', upsertPayload);
          if (selFlag === 1) {
            // Selección: crear/actualizar
            ops.push(this.postulanteService.upsertArancelEst(upsertPayload));
          } else {
            // Deselección: eliminar si existe en BD
            const dbRow = dbIndex.get(key);
            if (dbRow && dbRow.id != null) {
              console.debug('[Aranceles][Save] Delete ID:', dbRow.id);
              ops.push(this.postulanteService.deleteArancelEst(dbRow.id));
            }
          }
        }

        forkJoin(ops.length ? ops : [of(null)]).subscribe({
          next: () => {
            // Refrescar desde backend para asegurar consistencia de selección
            this.cargarArancelesMaterialExtra();
            this.editAranceles = false;
            this.hasChangesInView = false;
            // Mostrar resumen específico si existe; si no hay diferencias, mostrar el comparador general
            if (cambiosResumen.length) {
              this.mostrarModalCambios(cambiosResumen);
            } else {
              const cambios = this.compararSnapshots(this._snapshotAntes, this.getSnapshotActual());
              this.mostrarModalCambios(cambios);
            }
          },
          error: (e) => {
            console.error('Error al guardar selección de aranceles:', e);
            alert('No se pudo guardar la selección de aranceles. Intente nuevamente.');
          }
        });
      },
      error: (e) => {
        console.error('No se pudieron obtener aranceles seleccionados desde BD:', e);
        alert('No se pudo sincronizar la selección de aranceles desde BD.');
      }
    });
  }

  // --- Guardar datos biográficos y habilitar el resto de secciones
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
          // Persistir cod_ceta en sessionStorage para rehidratar en recargas
          try {
            const raw = sessionStorage.getItem('datos_postulacion') || '{}';
            const datos = JSON.parse(raw);
            datos.estudiante = { ...(datos.estudiante || {}), cod_ceta: (res as any).cod_ceta };
            // Marcar que biográficos ya fueron guardados
            datos.bio_guardado = true;
            sessionStorage.setItem('datos_postulacion', JSON.stringify(datos));
          } catch {}
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
      // Si aún no hay modalidad establecida (por ejemplo, si no vino desde sessionStorage),
      // primero intentar recuperar de sessionStorage y luego cargar del backend
      if (!this.modalidad) {
        this.recuperarModalidadDeSession();
        if (!this.modalidad) {
          this.cargarModalidadActual();
        }
      }
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
    this.markChangedInView();
  }

  onNombreInput(campo: 'nombres_est' | 'ap_pat' | 'ap_mat', ev: Event) {
    const input = ev.target as HTMLInputElement;
    let clean = this.sanitizarNombre(input.value || '');
    clean = this.capitalizarPalabras(clean);
    input.value = clean;
    (this.postulanteActual as any)[campo] = clean;
    this.markChangedInView();
  }

  onLugarNacimientoInput(ev: Event) {
    const input = ev.target as HTMLInputElement;
    let clean = this.sanitizarNombre(input.value || '');
    clean = this.capitalizarPalabras(clean);
    input.value = clean;
    this.postulanteActual.lugar_nacimiento = clean;
    this.markChangedInView();
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
    this.markChangedInView();
  }

  // --- Validaciones específicas: CI y Complemento ---
  onCiInput(ev: Event) {
    const input = ev.target as HTMLInputElement;
    // Mantener solo dígitos y limitar a 9
    let clean = (input.value || '').replace(/\D+/g, '').slice(0, 9);
    input.value = clean;
    this.postulanteActual.ci = clean;
    this.markChangedInView();
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
    this.markChangedInView();
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
    this.markChangedInView();
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
    this.markChangedInView();
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
    this.markChangedInView();
  }

  onFacturaInput(val: any) {
    const d = this.sanitizeDigits(val);
    if (!this.nuevoArancel) this.nuevoArancel = {} as any;
    this.nuevoArancel.num_factura = d || '';
    if ((this.nuevoArancel.num_factura || '').length > 0) {
      this.nuevoArancel.num_comprobante = '';
    }
    this.markChangedInView();
  }

  onReciboInput(val: any) {
    const d = this.sanitizeDigits(val);
    if (!this.nuevoArancel) this.nuevoArancel = {} as any;
    this.nuevoArancel.num_comprobante = d || '';
    if ((this.nuevoArancel.num_comprobante || '').length > 0) {
      this.nuevoArancel.num_factura = '';
    }
    this.markChangedInView();
  }

  onNitInput(val: any) {
    const d = this.sanitizeDigits(val);
    if (!this.nuevoArancel) this.nuevoArancel = {} as any;
    this.nuevoArancel.nit = d || '';
    this.markChangedInView();
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
    // Prefill inmediato según selección y valor proveniente del SGA
    const serieSGA = (this.postulanteActual?.nro_serie_titulo || '').toString().trim();
    if (tipo === 'extranjero' && serieSGA) {
      this.homologacionExtranjero.nro_resolucion = serieSGA;
    } else if (tipo === 'nacional' && serieSGA) {
      this.diplomaNacional.nro_serie = serieSGA;
    }
    this.markChangedInView();
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
    this.markChangedInView();
  }

  clearOpcion() {
    // Quita la selección actual para permitir elegir otra opción
    this.selectedOpcion = null;
    (Object.keys(this.opciones) as ('educacionRegular' | 'tecnicoMedio' | 'traspasoInstituto' | 'homologacionCambioPlan')[]).forEach((k) => {
      this.opciones[k] = false;
    });
    // Limpiar formularios/estructuras de las opciones
    this.eduRegularData = { serie_titulo_tm: '', numero_titulo_tm: '', fecha_emision: '' } as any;
    this.tecnicoMedioData = { serie_titulo_tm: '', numero_titulo_tm: '', fecha_emision: '' } as any;
    this.traspasoData = { instituto_origen: '', grados_gestiones: [] } as any;
    this.homoCambioPlanData = { nro_resolucion_rectoral: '', fecha_emision: '', grados_gestiones: [] } as any;
    // Marcar cambios en la vista para habilitar guardado si corresponde
    this.markChangedInView();
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
      this.tieneArancelesSga = false;
      return;
    }
    this.loadingAranceles = true;
    // Limpiar selección previa al recargar
    this.selectedAranceles = [];
    this.totalArancelesSeleccionados = 0;
    // Por defecto, asumir que no hay aranceles SGA hasta que el endpoint los devuelva
    this.tieneArancelesSga = false;
    // En modo visualización y para postulante nuevo: evitar SGA y construir tabla directamente desde aranceles_est
    if (this.viewInscripcion && this.esNuevoPostulante && !this.editAranceles) {
      const cod = this.postulanteActual.cod_ceta || this.estudiante?.cod_ceta;
      // Para nuevos: primero SIN filtro seleccionado (puede que aún no marquemos 'seleccionado')
      this.postulanteService.getArancelesEstByCodCeta(cod as number, false).subscribe({
        next: (resp) => {
          let est = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
          const aplicar = (arr: any[]) => {
            this._aplicarArancelesEstEnVista(arr || []);
            this.loadingAranceles = false;
            this.tieneArancelesSga = false;
          };
          if (!est || est.length === 0) {
            // Reintentar con 'seleccionado=1' por compatibilidad
            this.postulanteService.getArancelesEstByCodCeta(cod as number, true).subscribe({
              next: (resp2) => {
                est = Array.isArray(resp2?.data) ? resp2.data : (Array.isArray(resp2) ? resp2 : []);
                aplicar(est || []);
              },
              error: () => {
                aplicar([]);
              }
            });
          } else {
            aplicar(est);
          }
        },
        error: () => {
          this._aplicarArancelesEstEnVista([]);
          this.loadingAranceles = false;
          this.tieneArancelesSga = false;
        }
      });
      return;
    }
    const carreraRaw = this.estudiante?.carrera || this.postulanteActual.carrera;
    const carrera = this.normalizarCarrera(carreraRaw || null) || undefined;
    this.postulanteService.getArancelesMaterialExtra(codCeta as number | string, carrera).subscribe({
      next: (res) => {
        this.aranceles = res?.data || [];
        this.totalAranceles = res?.total ?? this.aranceles.length;
        this.loadingAranceles = false;
        this.tieneArancelesSga = Array.isArray(this.aranceles) && this.aranceles.length > 0;
        // En modo Visualización (y mientras no se edita la card), cruzar con aranceles_est seleccionados en backend
        if (this.viewInscripcion && !this.editAranceles) {
          const cod = this.postulanteActual.cod_ceta || this.estudiante?.cod_ceta;
          if (cod) {
            // 1) Obtener aranceles_est seleccionados; si vienen vacíos, reintentar sin filtro
            this.postulanteService.getArancelesEstByCodCeta(cod as number, true).subscribe({
              next: (resp) => {
                let est = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
                if (!est || est.length === 0) {
                  // Reintentar sin filtro
                  this.postulanteService.getArancelesEstByCodCeta(cod as number, false).subscribe({
                    next: (resp2) => {
                      est = Array.isArray(resp2?.data) ? resp2.data : (Array.isArray(resp2) ? resp2 : []);
                      this._aplicarArancelesEstEnVista(est);
                    },
                    error: () => {
                      this._aplicarArancelesEstEnVista([]);
                    }
                  });
                } else {
                  this._aplicarArancelesEstEnVista(est);
                }
              },
              error: () => {
                // Fallback: si falla, mantener vacía la selección (no asumir nada)
                this.selectedAranceles = [];
                this.recalcularTotalSeleccionados();
              }
            });
            // También sincronizar el estado 'pago completo' desde el composite por si no se ha cargado aún
            this.postulanteService.getInscripcionByCodCeta(Number(cod)).subscribe({
              next: (p) => {
                const flag = (p as any)?.aranceles_completos ?? (p as any)?.inscripcion?.aranceles_completos;
                if (flag !== undefined && flag !== null) {
                  const v = (typeof flag === 'string') ? flag.trim() : flag;
                  this.pagoCompletoSeleccionados = v === true || v === 1 || v === '1';
                }
              },
              error: () => {
                // Fallback: consultar directamente inscrip_modalidad por cod_ceta_est
                this.postulanteService.getInscripModalidadByCodCeta(Number(cod)).subscribe({
                  next: (list) => {
                    const rows = Array.isArray(list?.data) ? list.data : (Array.isArray(list) ? list : []);
                    if (rows && rows.length) {
                      const r = rows[0];
                      const flag2 = (r as any)?.aranceles_completos;
                      if (flag2 !== undefined && flag2 !== null) {
                        const v2 = (typeof flag2 === 'string') ? flag2.trim() : flag2;
                        this.pagoCompletoSeleccionados = v2 === true || v2 === 1 || v2 === '1';
                      }
                    }
                  },
                  error: () => {}
                });
              }
            });
          }
        }
        // Si no hay modalidad ya establecida (p. ej., desde sessionStorage), consultar al backend
        if (!this.modalidad) {
          this.cargarModalidadActual();
        }
      },
      error: (err) => {
        console.error('Error al cargar aranceles SGA, fallback a aranceles_est:', err);
        // Fallback: intentar poblar desde aranceles_est incluso si no es postulante nuevo
        const cod = this.postulanteActual.cod_ceta || this.estudiante?.cod_ceta;
        if (cod) {
          this.postulanteService.getArancelesEstByCodCeta(cod as number, false).subscribe({
            next: (resp2) => {
              const est = Array.isArray(resp2?.data) ? resp2.data : (Array.isArray(resp2) ? resp2 : []);
              this._aplicarArancelesEstEnVista(est || []);
              this.loadingAranceles = false;
              this.tieneArancelesSga = false;
            },
            error: () => {
              this._aplicarArancelesEstEnVista([]);
              this.loadingAranceles = false;
              this.tieneArancelesSga = false;
            }
          });
        } else {
          this._aplicarArancelesEstEnVista([]);
          this.loadingAranceles = false;
          this.tieneArancelesSga = false;
        }
      }
    });
  }

  // Verifica si un arancel está seleccionado
  isArancelSeleccionado(a: any): boolean {
    // Comparar por claves de negocio: num_factura, num_comprobante o composite fecha|concepto|monto
    return this._existeArancelEnLista(a, this.selectedAranceles);
  }

  // Detecta si un arancel ya existe en una lista, comparando por factura, recibo o por composite (fecha|concepto|monto)
  private _existeArancelEnLista(item: any, lista: any[]): boolean {
    const normStr = (v: any) => (v === undefined || v === null) ? '' : String(v).trim();
    const normNum = (v: any) => {
      const n = Number(v);
      return isNaN(n) ? null : n;
    };
    const nf = normStr(item?.num_factura);
    const nc = normStr(item?.num_comprobante);
    const comp = [normStr(item?.fecha) || '', normStr(item?.concepto) || '', String(normNum(item?.monto) ?? '')].join('|');
    for (const a of (lista || [])) {
      const f = normStr(a?.num_factura);
      const c = normStr(a?.num_comprobante);
      const comp2 = [normStr(a?.fecha) || '', normStr(a?.concepto) || '', String(normNum(a?.monto) ?? '')].join('|');
      const matchFactura = nf && nf !== '0' && nf === f;
      const matchRecibo = nc && nc !== '0' && nc === c;
      const matchComposite = comp && comp === comp2;
      if (matchFactura || matchRecibo || matchComposite) return true;
    }
    return false;
  }

  onArancelToggle(a: any, checked: boolean) {
    const noIgual = (x: any, y: any) => !this._existeArancelEnLista(y, [x]);
    if (checked) {
      if (!this.isArancelSeleccionado(a)) {
        this.selectedAranceles.push(a);
      }
    } else {
      // Remover por claves de negocio, no por referencia
      const normStr = (v: any) => (v === undefined || v === null) ? '' : String(v).trim();
      const normNum = (v: any) => {
        const n = Number(v);
        return isNaN(n) ? null : n;
      };
      const comp = [normStr(a?.fecha) || '', normStr(a?.concepto) || '', String(normNum(a?.monto) ?? '')].join('|');
      const nf = normStr(a?.num_factura);
      const nc = normStr(a?.num_comprobante);
      this.selectedAranceles = (this.selectedAranceles || []).filter(s => {
        const comp2 = [normStr(s?.fecha) || '', normStr(s?.concepto) || '', String(normNum(s?.monto) ?? '')].join('|');
        const f2 = normStr(s?.num_factura);
        const c2 = normStr(s?.num_comprobante);
        const matchFactura = nf && nf !== '0' && nf === f2;
        const matchRecibo = nc && nc !== '0' && nc === c2;
        const matchComposite = comp && comp === comp2;
        return !(matchFactura || matchRecibo || matchComposite);
      });
    }
    this.recalcularTotalSeleccionados();
    this._dedupeSelectedAranceles();
  }

  recalcularTotalSeleccionados() {
    this.totalArancelesSeleccionados = this.selectedAranceles.reduce((sum, x) => sum + this.toNumber(x?.monto), 0);
  }

  // Elimina duplicados lógicos en selectedAranceles por clave de negocio
  private _dedupeSelectedAranceles() {
    const normStr = (v: any) => (v === undefined || v === null) ? '' : String(v).trim();
    const normNum = (v: any) => {
      const n = Number(v);
      return isNaN(n) ? null : n;
    };
    const keyOf = (a: any) => {
      const f = normStr(a?.num_factura);
      const c = normStr(a?.num_comprobante);
      if (f && f !== '0') return `F#${f}`;
      if (c && c !== '0') return `C#${c}`;
      const comp = [normStr(a?.fecha) || '', normStr(a?.concepto) || '', String(normNum(a?.monto) ?? '')].join('|');
      return `X#${comp}`;
    };
    const seen = new Set<string>();
    const dedup: any[] = [];
    for (const a of (this.selectedAranceles || [])) {
      const k = keyOf(a);
      if (!seen.has(k)) {
        seen.add(k);
        dedup.push(a);
      }
    }
    this.selectedAranceles = dedup;
    this.recalcularTotalSeleccionados();
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

  // Convierte cadenas con símbolos a número decimal; si es inválido devuelve 0
  private toNumber(val: any): number {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isFinite(val) ? val : 0;
    const parsed = parseFloat(String(val).replace(/[^0-9,.-]/g, '').replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
  }

  // --- Snapshot y resumen de cambios ---
  private _snapshotAntes: any = null;

  private getSnapshotActual() {
    return {
      // Biográficos
      nombres_est: this.postulanteActual.nombres_est ?? null,
      ap_pat: this.postulanteActual.ap_pat ?? null,
      ap_mat: this.postulanteActual.ap_mat ?? null,
      ci: this.postulanteActual.ci ?? null,
      procedencia: (this.postulanteActual as any).procedencia ?? null,
      fecha_nacimiento: this.postulanteActual.fecha_nacimiento ?? null,
      lugar_nacimiento: this.postulanteActual.lugar_nacimiento ?? null,
      carrera: (this.postulanteActual.carrera as any) ?? (this.carreraNormalizada as any) ?? null,
      pensum: this.postulanteActual.pensum ?? null,
      // Bachiller
      tipo_bachiller: this.tipoBachiller ?? null,
      nro_serie_titulo: (this.tipoBachiller === 'extranjero'
        ? (this.homologacionExtranjero?.nro_resolucion ?? (this.postulanteActual as any).nro_serie_titulo ?? null)
        : ((this.postulanteActual as any).nro_serie_titulo ?? null)
      ),
      // Diploma (detallado) para detectar cambios reales
      diploma_emision: (this.tipoBachiller === 'nacional') ? (this.diplomaNacional?.emision ?? null) : null,
      diploma_fecha_emision: (this.tipoBachiller === 'nacional') ? (this.normalizarFecha(this.diplomaNacional?.fecha_emision) ?? null) : null,
      diploma_gestion_bachillerato: (this.tipoBachiller === 'nacional') ? ((this.diplomaNacional?.gestion_bachillerato ?? null) as any) : null,
      diploma_observacion: (this.tipoBachiller === 'nacional') ? (this.diplomaNacional?.observacion ?? null) : null,
      diploma_nro_resolucion: (this.tipoBachiller === 'extranjero') ? (this.homologacionExtranjero?.nro_resolucion ?? null) : null,
      diploma_fecha_resolucion: (this.tipoBachiller === 'extranjero') ? (this.normalizarFecha(this.homologacionExtranjero?.fecha_emision) ?? null) : null,
      // Transitabilidad Educación Regular (solo si opción activa)
      edu_reg_serie_tm: (this.selectedOpcion === 'educacionRegular') ? (this.eduRegularData?.serie_titulo_tm ?? null) : null,
      edu_reg_numero_tm: (this.selectedOpcion === 'educacionRegular') ? (this.eduRegularData?.numero_titulo_tm ?? null) : null,
      edu_reg_fecha_emision: (this.selectedOpcion === 'educacionRegular') ? (this.normalizarFecha(this.eduRegularData?.fecha_emision) ?? null) : null,
      // Transitabilidad Técnico Medio (solo si opción activa)
      tec_med_serie_tm: (this.selectedOpcion === 'tecnicoMedio') ? (this.tecnicoMedioData?.serie_titulo_tm ?? null) : null,
      tec_med_numero_tm: (this.selectedOpcion === 'tecnicoMedio') ? (this.tecnicoMedioData?.numero_titulo_tm ?? null) : null,
      tec_med_fecha_emision: (this.selectedOpcion === 'tecnicoMedio') ? (this.normalizarFecha(this.tecnicoMedioData?.fecha_emision) ?? null) : null,
      // Traspaso de Instituto (solo si opción activa)
      traspaso_instituto_origen: (this.selectedOpcion === 'traspasoInstituto') ? (this.traspasoData?.instituto_origen ?? null) : null,
      traspaso_grados_count: (this.selectedOpcion === 'traspasoInstituto') ? ((Array.isArray(this.traspasoData?.grados_gestiones) ? this.traspasoData.grados_gestiones.length : 0)) : null,
      // Homologación por cambio de plan (solo si opción activa)
      homocp_nro_resolucion: (this.selectedOpcion === 'homologacionCambioPlan') ? (this.homoCambioPlanData?.nro_resolucion_rectoral ?? null) : null,
      homocp_fecha_emision: (this.selectedOpcion === 'homologacionCambioPlan') ? (this.normalizarFecha(this.homoCambioPlanData?.fecha_emision) ?? null) : null,
      homocp_grados_count: (this.selectedOpcion === 'homologacionCambioPlan') ? ((Array.isArray(this.homoCambioPlanData?.grados_gestiones) ? this.homoCambioPlanData.grados_gestiones.length : 0)) : null,
      // Inicio/Conclusión
      reg_ini_c: this.datosInicioCarrera.reg_ini_c ?? null,
      gestion_ini: this.datosInicioCarrera.gestion_ini ?? null,
      reg_con_c: this.datosConclusionCarrera.reg_con_c ?? null,
      gestion_fin: this.datosConclusionCarrera.gestion_fin ?? null,
      // Modalidad y Aranceles (resumen)
      modalidad_id: this.modalidad?.id ?? null,
      modalidad_nombre: this.modalidad?.nombre ?? null,
      aranceles_count: (this.selectedAranceles || []).length,
      aranceles_total: this.totalArancelesSeleccionados ?? 0,
    };
  }

  private normalizarValor(v: any): string {
    if (v === undefined || v === null) return '';
    return String(v).trim();
  }

  private compararSnapshots(prev: any, curr: any): Array<{ campo: string; anterior: any; nuevo: any }> {
    if (!prev) return [];
    const etiquetas: Record<string, string> = {
      nombres_est: 'Nombres',
      ap_pat: 'Apellido Paterno',
      ap_mat: 'Apellido Materno',
      ci: 'CI',
      procedencia: 'Procedencia',
      fecha_nacimiento: 'Fecha de Nacimiento',
      lugar_nacimiento: 'Lugar de Nacimiento',
      carrera: 'Carrera',
      pensum: 'Pensum',
      tipo_bachiller: 'Tipo de Bachiller',
      nro_serie_titulo: 'N° Serie/Resolución',
      diploma_emision: 'diploma.emision',
      diploma_fecha_emision: 'diploma.fecha_emision',
      diploma_gestion_bachillerato: 'diploma.gestion_bachillerato',
      diploma_observacion: 'diploma.observacion',
      diploma_nro_resolucion: 'diploma.nro_resolucion',
      diploma_fecha_resolucion: 'diploma.fecha_resolucion',
      edu_reg_serie_tm: 'transitabilidad.edu_regular.serie_titulo_tm',
      edu_reg_numero_tm: 'transitabilidad.edu_regular.numero_titulo_tm',
      edu_reg_fecha_emision: 'transitabilidad.edu_regular.fecha_emision',
      tec_med_serie_tm: 'transitabilidad.tecnico_medio.serie_titulo_tm',
      tec_med_numero_tm: 'transitabilidad.tecnico_medio.numero_titulo_tm',
      tec_med_fecha_emision: 'transitabilidad.tecnico_medio.fecha_emision',
      traspaso_instituto_origen: 'traspaso.instituto_origen',
      traspaso_grados_count: 'traspaso.grados_gestiones_count',
      homocp_nro_resolucion: 'homologacion_cp.nro_resolucion',
      homocp_fecha_emision: 'homologacion_cp.fecha_emision',
      homocp_grados_count: 'homologacion_cp.grados_gestiones_count',
      reg_ini_c: 'Régimen Inicio',
      gestion_ini: 'Gestión Inicio',
      reg_con_c: 'Régimen Conclusión',
      gestion_fin: 'Gestión Conclusión',
      modalidad_id: 'Modalidad (ID)',
      modalidad_nombre: 'Modalidad',
      aranceles_count: 'Aranceles seleccionados',
      aranceles_total: 'Total Aranceles',
    };
    const cambios: Array<{ campo: string; anterior: any; nuevo: any }> = [];
    Object.keys(prev).forEach((k) => {
      const a = this.normalizarValor(prev[k]);
      const n = this.normalizarValor(curr[k]);
      if (a !== n) {
        cambios.push({ campo: etiquetas[k] || k, anterior: prev[k] ?? '', nuevo: curr[k] ?? '' });
      }
    });
    return cambios;
  }

  private prepararSnapshotAntesDeEditar() {
    this._snapshotAntes = this.getSnapshotActual();
  }

  private mostrarModalCambios(cambios: Array<{ campo: string; anterior: any; nuevo: any }>) {
    // Solo mostrar el modal si NO es un postulante nuevo (modo edición)
    if (this.esNuevoPostulante) {
      return;
    }
    this.loadingService.showModal();
    setTimeout(() => {
      this.cambiosRealizados = cambios || [];
      this.modalCambiosVisible = true;
      this.loadingService.hideModal();
    }, 0);
  }

  cerrarModalCambios() {
    this.modalCambiosVisible = false;
    // Construir y mostrar el resumen de inscripción en la parte superior
    this.construirResumenInscripcion();
    this.resumenVisible = true;
    try {
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 0);
    } catch (e) {}
  }

  // Cerrar el modal de cambios y permanecer en la vista para seguir editando
  continuarCambios() {
    this.modalCambiosVisible = false;
    this.cambiosRealizados = [];
    // No construimos ni mostramos el resumen aquí para permitir más cambios
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
    const faltantesSecc = this.validarCamposSecciones();
    if (faltantesSecc.length) {
      this.mostrarModalFaltantes(faltantesSecc);
      return;
    }
    if (!this.puedeRegistrar()) {
      this.inscripcionError = 'Complete los datos requeridos antes de registrar la inscripción.';
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
        // Spinner antes del modal de éxito
        this.loadingService.showModal();
        setTimeout(() => {
          this.modalExitoVisible = true;
          this.loadingService.hideModal();
        }, 0);
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
    // Permitir registro manual:
    // - Siempre fuera de ver-inscripción (flujo de registro)
    // - En ver-inscripción: solo si la card está en edición y permiteEdicionArancelesEnVista (cod CETA inicia con '9')
    const puedeManual = (!this.viewInscripcion) || (this.viewInscripcion && this.editAranceles && this.permiteEdicionArancelesEnVista);
    if (!puedeManual) {
      this.arancelManualError = 'El registro manual de arancel solo está disponible en edición para inscripciones nuevas (CETA inicia con 9).';
      return;
    }
    // if (!this.esNuevoPostulante) {
    //   this.arancelManualError = 'El registro manual de arancel solo está disponible para nuevos postulantes.';
    //   return;
    // }
    // Validación estricta: todos los campos requeridos, excepto que Factura o Recibo puede ser uno u otro
    const montoNum = this.toNumber(this.nuevoArancel.monto);
    const falt: string[] = [];
    if (!this.nuevoArancel.gestion) falt.push('Gestión');
    if (!this.nuevoArancel.fecha) falt.push('Fecha');
    if (!this.nuevoArancel.concepto) falt.push('Concepto');
    if (!(montoNum > 0)) falt.push('Monto (> 0)');
    const hasFactura = !!(this.nuevoArancel.num_factura && String(this.nuevoArancel.num_factura).trim());
    const hasRecibo = !!(this.nuevoArancel.num_comprobante && String(this.nuevoArancel.num_comprobante).trim());
    if (!hasFactura && !hasRecibo) falt.push('N° Factura o N° Recibo');
    if (!this.nuevoArancel.razon) falt.push('Razón Social');
    if (!this.nuevoArancel.nit) falt.push('NIT');
    if (this.nuevoArancel.nit && !/^\d+$/.test(String(this.nuevoArancel.nit).trim())) falt.push('NIT (solo números)');
    if (falt.length) {
      this.arancelManualError = 'Complete: ' + falt.join(', ');
      return;
    }
    const cod = Number(this.postulanteActual.cod_ceta || this.estudiante?.cod_ceta) || null;
    if (!cod) {
      this.arancelManualError = 'No hay código CETA. Guarde biográficos primero.';
      return;
    }

    const nuevoItem: any = {
      gestion: (this.nuevoArancel.gestion || '').toString(),
      fecha: this.normalizarFecha(this.nuevoArancel.fecha),
      concepto: (this.nuevoArancel.concepto || '').toString(),
      monto: montoNum,
      num_factura: (this.nuevoArancel.num_factura || '').toString(),
      num_comprobante: (this.nuevoArancel.num_comprobante || '').toString(),
      razon: (this.nuevoArancel.razon || '').toString(),
      nit: (this.nuevoArancel.nit || '').toString(),
      origen: 'manual',
      pagado: true,
    };

    const prevItem = (this.editingArancelIndex !== null && this.editingArancelIndex >= 0 && this.editingArancelIndex < this.selectedAranceles.length)
      ? { ...this.selectedAranceles[this.editingArancelIndex] }
      : null;

    const payload = {
      cod_ceta_est: cod,
      gestion: nuevoItem.gestion || null,
      fecha: nuevoItem.fecha || null,
      concepto: nuevoItem.concepto || null,
      monto: nuevoItem.monto ?? null,
      num_factura: nuevoItem.num_factura || null,
      num_comprobante: nuevoItem.num_comprobante || null,
      razon: nuevoItem.razon || null,
      nit: nuevoItem.nit || null,
      pagado: nuevoItem.pagado ? 1 : 0,
      fecha_pago: nuevoItem.pagado ? (nuevoItem.fecha || null) : null,
      seleccionado: 1,
      origen: 'manual',
    };

    // Asociar inscrip_modalidad_id si está disponible
    const inscId = this.inscripModalidadIdActual || (prevItem && (prevItem as any).inscrip_modalidad_id) || null;
    if (inscId) (payload as any).inscrip_modalidad_id = inscId;

    // Incluir valores previos para upsert robusto en backend
    if (prevItem) {
      (payload as any).prev_num_factura = (prevItem as any).num_factura ?? null;
      (payload as any).prev_num_comprobante = (prevItem as any).num_comprobante ?? null;
      (payload as any).prev_fecha = (prevItem as any).fecha ?? null;
      (payload as any).prev_concepto = (prevItem as any).concepto ?? null;
      (payload as any).prev_monto = (prevItem as any).monto ?? null;
    }

    this.postulanteService.upsertArancelEst(payload).subscribe({
      next: (res: any) => {
        // Actualizar tablas en memoria
        if (this.editingArancelIndex !== null && this.editingArancelIndex >= 0 && this.editingArancelIndex < this.selectedAranceles.length) {
          const updated: any = { ...this.selectedAranceles[this.editingArancelIndex], ...nuevoItem };
          if (res && res.id != null) updated.arancel_id = Number(res.id);
          if (res && res.inscrip_modalidad_id != null) updated.inscrip_modalidad_id = Number(res.inscrip_modalidad_id);
          this.selectedAranceles[this.editingArancelIndex] = updated;
          // Si existe en la tabla principal, actualizarlo también
          if (this.aranceles && this.aranceles[this.editingArancelIndex]) {
            const upd2: any = { ...this.aranceles[this.editingArancelIndex], ...nuevoItem };
            if (res && res.id != null) upd2.arancel_id = Number(res.id);
            if (res && res.inscrip_modalidad_id != null) upd2.inscrip_modalidad_id = Number(res.inscrip_modalidad_id);
            this.aranceles[this.editingArancelIndex] = upd2;
          }
        } else {
          const created: any = { ...nuevoItem };
          if (res && res.id != null) created.arancel_id = Number(res.id);
          if (res && res.inscrip_modalidad_id != null) created.inscrip_modalidad_id = Number(res.inscrip_modalidad_id);
          this.selectedAranceles.push(created);
          // Añadir a tabla principal si no existe por composite
          if (!this._existeArancelEnLista(created, this.aranceles)) {
            this.aranceles.push(created);
            this.totalAranceles = this.aranceles.length;
          }
        }
        this.recalcularTotalSeleccionados();
        this._dedupeSelectedAranceles();

        // Construir lista de cambios específica de arancel
        const cambios: Array<{ campo: string; anterior: any; nuevo: any }> = [];
        const etiquetas: Record<string, string> = {
          gestion: 'Arancel.gestion',
          fecha: 'Arancel.fecha',
          concepto: 'Arancel.concepto',
          monto: 'Arancel.monto',
          num_factura: 'Arancel.factura',
          num_comprobante: 'Arancel.recibo',
          razon: 'Arancel.razon_social',
          nit: 'Arancel.nit',
        };
        const campos = Object.keys(etiquetas);
        for (const k of campos) {
          const a = prevItem ? (prevItem as any)[k] ?? '' : '';
          const n = (nuevoItem as any)[k] ?? '';
          if (String(a) !== String(n)) {
            cambios.push({ campo: etiquetas[k], anterior: a, nuevo: n });
          }
        }

        // Mostrar modal de cambios como en otros cards
        this.mostrarModalCambios(cambios);

        // Limpiar formulario y estado de edición
        this.editingArancelIndex = null;
        this.editingArancelId = null;
        this.editingArancelKey = null;
        this.editingArancelIndexTabla = null;
        this.nuevoArancel = {
          gestion: this.getGestionActual(), fecha: '', concepto: '', monto: '', num_factura: '', num_comprobante: '', razon: '', nit: ''
        };
        },
        error: (e) => {
          console.error('No se pudo guardar el arancel manual:', e);
          this.arancelManualError = 'No se pudo guardar el arancel. Intente nuevamente.';
        }
      });
  }

  editarArancelManual(item: any, index: number) {
    // Si estás en ver inscripción y no está en edición la tarjeta, activarla para mostrar el formulario
    if (this.viewInscripcion && !this.editAranceles && this.permiteEdicionArancelesEnVista) {
      this.iniciarEdicionArancelesCard();
    }
    const puedeManual = this.esNuevoPostulante || (this.viewInscripcion && this.editAranceles && this.permiteEdicionArancelesEnVista);
    if (!puedeManual) return;
  
    // Prefill del formulario con los datos del ítem (tu lógica existente):
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
    this.editingArancelId = (item && item.arancel_id != null) ? Number(item.arancel_id) : null;
    this.editingArancelIndexTabla = index;
    this.editingArancelKey = this.arancelKey(item);
  }

  cancelarEdicionArancelManual() {
    this.editingArancelIndex = null;
    this.nuevoArancel = {
      gestion: this.getGestionActual(),
      fecha: '',
      concepto: '',
      monto: '',
      num_factura: '',
      num_comprobante: '',
      razon: '',
      nit: ''
    };
  }

  // Cancelar edición de una fila y salir de modo edición de la tarjeta
  cancelarEdicionManualYCard() {
    this.editingArancelIndex = null;
    this.editingArancelId = null;
    this.editingArancelKey = null;
    this.editingArancelIndexTabla = null;
    this.arancelManualError = null;
    this.nuevoArancel = {
      gestion: this.getGestionActual(),
      fecha: '',
      concepto: '',
      monto: '',
      num_factura: '',
      num_comprobante: '',
      razon: '',
      nit: ''
    };
    this.showManualArancelesEnEdicion = false;
    this.editAranceles = false;
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
    this.markChangedInView();
  }

  // Retorna la gestión actual calculada (primer elemento de la lista o cálculo directo)
  private getGestionActual(): string {
    if (Array.isArray(this.gestionesOpciones) && this.gestionesOpciones.length) return this.gestionesOpciones[0];
    const ahora = new Date();
    let year = ahora.getFullYear();
    const mes = ahora.getMonth() + 1;
    let sem: 1 | 2;
    if (mes >= 2 && mes <= 6) sem = 1; else if (mes >= 7 && mes <= 12) sem = 2; else { sem = 2; year = year - 1; }
    return `${sem}/${year}`;
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