import { Component, OnInit, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { SgaService, Docente, ApiResponse, Pertinencia, TutorReg, TutorTipo, Convocatoria, TutorDesignacionItem } from '../../../shared/services/sga.service';
import { ProyectoService } from '../proyectos/proyecto.service';
import { PdfService } from '../../../shared/services/pdf.service';
import { AuthService } from '../../../core/services/auth.service';
import { LoadingService } from '../../../core/services/loading.service';
import { firstValueFrom, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-tutores-home',
  standalone: true,
  imports: [CommonModule, RouterLink, HeaderComponent, FormsModule],
  templateUrl: './tutores-home.component.html',
  styleUrls: ['./tutores-home.component.scss']
})
export class TutoresHomeComponent implements OnInit {
  // Importar Docentes (SGA)
  showImport = false;
  docentes: Docente[] = [];
  loadingDocentes = false;
  docentesLoaded = false;
  errorDocentes: string | null = null;
  // Selección múltiple por checkbox (clave: ci)
  selectedCis: Set<string> = new Set<string>();
  // Modal de edición de docente
  modalEditarDocenteVisible: boolean = false;
  editingDocente: Partial<Docente> | null = null;
  isCreateMode: boolean = false;
  // Controles del modal
  modalCarreraCode: 'MEA' | 'EEA' | 'EEA/MEA' | null = null; // selección de carrera en modal
  modalGestion: string | null = null;     // 1/YYYY o 2/YYYY (solo visual)
  editingCiOriginal: string | null = null; // para permitir cambio de CI
  showFieldErrors: boolean = false;        // activa estilos is-invalid
  // Pertinencias académicas
  allPertinencias: Pertinencia[] = [];
  pertinencias: Pertinencia[] = [];
  // Selección múltiple de pertinencias en el modal
  selectedPertIds: number[] = [];
  tituloAcademicoOpciones: string[] = ['T.S.', 'Lic.', 'Ing.'];
  // UI del multiselect con chips
  pertDropdownOpen = false;
  pertSearch = '';
  pertMax: number | null = null; // sin límite de selección
  @ViewChild('msRoot') msRoot?: ElementRef;
  // Guardado
  savingDocente: boolean = false;
  successModalVisible: boolean = false;
  successMessage: string = 'Docente guardado correctamente';
  editingSaveError: string | null = null;
  confirmDisableModalVisible: boolean = false;
  disableTutorSaving: boolean = false;
  pendingDisableTutor: TutorReg | null = null;
  pendingDisableDocente: Docente | null = null;
  // Registro masivo
  bulkSaving: boolean = false;
  bulkError: string | null = null;
  // Tutores registrados
  showRegistrados: boolean = false;
  loadingTutores: boolean = false;
  errorTutores: string | null = null;
  tutores: TutorReg[] = [];
  tutorTipos: TutorTipo[] = [];
  selectedTipoTutorId: number | null = null;
  tipoSeleccionado: Record<string, number | null> = {};
  // Set de CIs de tutores ya registrados en gestión actual (para evitar duplicado)
  registradosSet: Set<string> = new Set<string>();
  // Set de nombres normalizados de tutores registrados (fallback si cambió el CI)
  registradosNameSet: Set<string> = new Set<string>();
  // Filtro de gestión para el panel de "Tutores registrados"
  gestionFiltro: string | null = this.gestionActual;
  // Filtro de carrera (MEA/EEA) para el panel de "Tutores registrados"
  carreraFiltroCode: 'MEA' | 'EEA' | 'EEA/MEA' | null = null;
  skipFirstPertFocus = false;
  // Tutores designados
  showDesignados: boolean = false;
  loadingDesignados: boolean = false;
  errorDesignados: string | null = null;
  designados: TutorDesignacionItem[] = [];
  designadosConvocatorias: Convocatoria[] = [];
  loadingConvocatoriasDesignados: boolean = false;
  selectedConvocatoriaDesignados: number | null = null;
  designadosSearchTerm: string = '';
  generatingDesignadoId: number | null = null;
  selectedStudentsByTutor: Map<number, Set<number>> = new Map<number, Set<number>>();
  confirmModalVisible = false;
  confirmModalTutor: TutorDesignacionItem | null = null;
  confirmModalEstudiantes: Array<{
    cod_ceta: number;
    nombre: string | null;
    modalidad?: string | null;
    area?: string | null;
    proyecto_nombre?: string | null;
    fecha_designacion?: string | null;
  }> = [];

  private proyectoCachePorCod: Map<number, any> = new Map();
  private proyectoCachePorId: Map<number, any> = new Map();
  private proyectoFetchInFlight: Map<string, Promise<any | null>> = new Map();

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(_event?: Event) {
    if (this.confirmModalVisible) {
      this.closeConfirmModal();
    }
  }

  constructor(private sga: SgaService, private router: Router, private pdfService: PdfService, private auth: AuthService, private loadingService: LoadingService, private proyectoService: ProyectoService) {}

  ngOnInit(): void {
    this.loadTutorTipos();
    this.loadAllPertinencias();
  }

  toggleDesignados() {
    const newVal = !this.showDesignados;
    this.showDesignados = newVal;
    if (newVal) {
      this.showImport = false;
      this.showRegistrados = false;
      this.ensureDesignadosConvocatorias();
      this.loadDesignados();
    } else {
      this.errorDesignados = null;
    }
  }

  onDesignadosConvocatoriaChange() {
    this.loadDesignados();
  }

  onDesignadosSearchEnter() {
    this.loadDesignados();
  }

  clearDesignadosFilters() {
    this.designadosSearchTerm = '';
    this.selectedConvocatoriaDesignados = null;
    this.loadDesignados();
  }

  get totalDesignaciones(): number {
    return this.designados.reduce((acc, item) => acc + (item?.total_estudiantes || 0), 0);
  }

  private ensureDesignadosConvocatorias() {
    if (this.designadosConvocatorias.length || this.loadingConvocatoriasDesignados) {
      return;
    }
    this.loadingConvocatoriasDesignados = true;
    this.sga.getConvocatorias({ per_page: 100 }).subscribe({
      next: (resp) => {
        const raw = (resp as any)?.data ?? resp;
        const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        this.designadosConvocatorias = list as Convocatoria[];
        this.loadingConvocatoriasDesignados = false;
      },
      error: () => {
        this.designadosConvocatorias = [];
        this.loadingConvocatoriasDesignados = false;
      }
    });
  }

  private getSelectedStudentSet(tutorId: number): Set<number> {
    if (!this.selectedStudentsByTutor.has(tutorId)) {
      this.selectedStudentsByTutor.set(tutorId, new Set<number>());
    }
    return this.selectedStudentsByTutor.get(tutorId)!;
  }

  private resolveFirstNonEmpty(...values: Array<string | null | undefined>): string | null {
    for (const value of values) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length) {
          return trimmed;
        }
      }
    }
    return null;
  }

  private normalizeEstudianteData(est: any) {
    const modalidad = this.sanitizeNombreSegment(
      this.resolveFirstNonEmpty(
        est?.proyecto_tipo,
        est?.modalidad,
        est?.modalidad_nombre,
        est?.proyecto_modalidad,
        est?.inscripcion_modalidad_nom,
        est?.modalidad_label,
        est?.modalidad_est,
        est?.modalidad_estudiante,
        est?.doc_modalidad
      )
    );
    const area = this.resolveFirstNonEmpty(est?.area, est?.area_nombre, est?.area_label, est?.pertinencia);
    const proyecto = this.resolveFirstNonEmpty(
      est?.proyecto_nombre,
      est?.tema,
      est?.tema_registro,
      est?.tema_proyecto,
      est?.tema_estudiante,
      est?.tema1,
      est?.proyecto_tema
    );
    const fechaDesignacion = est?.fecha_designacion ? new Date(est.fecha_designacion) : null;
    const codCetaRaw = Number(est?.cod_ceta ?? 0);

    let apellidoP = this.resolveFirstNonEmpty(est?.apellido_p, est?.ap_pat, est?.apellidoPaterno, est?.primer_apellido);
    let apellidoM = this.resolveFirstNonEmpty(est?.apellido_m, est?.ap_mat, est?.apellidoMaterno, est?.segundo_apellido);
    let nombres = this.resolveFirstNonEmpty(est?.nombres, est?.nombre, est?.nombres_est, est?.nombres_estudiante);

    const nombreCompuesto = this.resolveFirstNonEmpty(
      est?.estudiante_nombre,
      est?.nombre_completo,
      est?.nombre,
      est?.nombre_estudiante
    );

    if (!apellidoP || !apellidoM || !nombres) {
      if (nombreCompuesto) {
        const parts = this.splitNombreCompleto(nombreCompuesto);
        apellidoP = apellidoP || parts.apellidoP || '';
        apellidoM = apellidoM || parts.apellidoM || '';
        nombres = nombres || parts.nombres || '';
      }
    }

    apellidoP = this.sanitizeNombreSegment(apellidoP);
    apellidoM = this.sanitizeNombreSegment(apellidoM);
    nombres = this.sanitizeNombreSegment(nombres);
    const fallbackNombre = this.sanitizeNombreCompleto(nombreCompuesto);

    if (apellidoP && apellidoM && apellidoP.toLocaleLowerCase() === apellidoM.toLocaleLowerCase() && fallbackNombre) {
      const parts = this.splitNombreCompleto(fallbackNombre);
      apellidoP = this.sanitizeNombreSegment(parts.apellidoP) || apellidoP;
      apellidoM = this.sanitizeNombreSegment(parts.apellidoM) || apellidoM;
      nombres = this.sanitizeNombreSegment(parts.nombres) || nombres;
    }

    if ((!apellidoP || !apellidoM) && fallbackNombre) {
      const parts = this.splitNombreCompleto(fallbackNombre);
      apellidoP = apellidoP || this.sanitizeNombreSegment(parts.apellidoP);
      apellidoM = apellidoM || this.sanitizeNombreSegment(parts.apellidoM);
      nombres = nombres || this.sanitizeNombreSegment(parts.nombres);
    }

    let nombreCompleto = this.formatNombreCompleto(
      apellidoP,
      apellidoM,
      nombres,
      fallbackNombre || (this.resolveFirstNonEmpty(est?.estudiante_nombre, est?.nombre, est?.nombre_completo) || '-').toString()
    );
    nombreCompleto = this.dedupeNombreCompleto(nombreCompleto) || nombreCompleto;

    return {
      cod_ceta: Number.isFinite(codCetaRaw) ? codCetaRaw : 0,
      nombre: nombreCompleto,
      apellidoP: apellidoP ? apellidoP.toString() : '',
      apellidoM: apellidoM ? apellidoM.toString() : '',
      nombres: nombres ? nombres.toString() : '',
      modalidad,
      area,
      tema: proyecto,
      fechaDesignacion,
      raw: est,
    };
  }

  private resolveEstudianteModalidadFromRaw(raw: any): string | undefined {
    if (!raw) return undefined;
    return this.resolveFirstNonEmpty(
      raw?.modalidad,
      raw?.modalidad_nombre,
      raw?.proyecto_modalidad,
      raw?.proyecto_tipo,
      raw?.inscripcion_modalidad_nom,
      raw?.modalidad_label,
      raw?.modalidad_id ? this.lookupModalidadNombre(raw.modalidad_id) : null
    ) || undefined;
  }

  private lookupModalidadNombre(modalidadId: number | string | null | undefined): string | null {
    if (modalidadId === null || modalidadId === undefined) return null;
    const idNum = Number(modalidadId);
    if (!Number.isFinite(idNum)) return null;
    const map: Record<number, string> = {
      1: 'Proyecto de Grado',
      2: 'Proyecto Sociocomunitario Productivo',
      3: 'Proyecto de Emprendimiento Productivo',
      4: 'Trabajo Dirigido Externo',
      5: 'Graduación por Experiencia Laboral',
      6: 'Graduación por Excelencia Académica',
    };
    return map[idNum] || null;
  }

  private resolveEstudianteCarreraFromRaw(raw: any, tutor: TutorDesignacionItem): string | undefined {
    return this.resolveFirstNonEmpty(
      raw?.carrera,
      raw?.carrera_nombre,
      raw?.carrera_label,
      raw?.carrera_estudiante,
      tutor.carrera_nombre,
      tutor.cod_carrera
    ) || undefined;
  }

  private resolveEstudianteAreaFromRaw(raw: any, tutorArea?: string | null, fallbackArea?: string | null): string | undefined {
    return this.resolveFirstNonEmpty(
      raw?.area,
      raw?.area_nombre,
      raw?.area_label,
      raw?.pertinencia,
      fallbackArea,
      tutorArea
    ) || undefined;
  }

  private resolveEstudianteTemaFromRaw(raw: any, fallbackTema?: string | null): string | undefined {
    return this.resolveFirstNonEmpty(
      raw?.proyecto_nombre,
      raw?.tema,
      raw?.tema_registro,
      raw?.tema_proyecto,
      raw?.tema_estudiante,
      raw?.tema1,
      raw?.proyecto_tema,
      fallbackTema
    ) || undefined;
  }

  private extractResumenFromDocData(docData: any): any[] {
    if (!docData) {
      return [];
    }
    const candidates: any[] = [];

    const pushCandidate = (value: any) => {
      if (!value) return;
      if (Array.isArray(value)) {
        if (value.length) {
          candidates.push(value);
        }
        return;
      }
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed) && parsed.length) {
            candidates.push(parsed);
          }
        } catch {
          // ignorar valores string no parseables
        }
      }
    };

    pushCandidate(docData.doc_estudiantes_resumen);
    pushCandidate(docData.estudiantes_resumen);
    pushCandidate(docData.estudiantes);

    return candidates.flat().filter(Boolean);
  }

  private buildResumenLookup(resumen: any[]): Map<number, any> {
    const map = new Map<number, any>();
    if (!Array.isArray(resumen)) {
      return map;
    }
    resumen.forEach((item) => {
      if (!item) return;
      const codRaw = item.cod_ceta ?? item.codCeta ?? item.codigo ?? item.codigo_ceta ?? item.cod;
      const cod = Number(codRaw);
      if (!Number.isFinite(cod)) {
        return;
      }
      if (!map.has(cod)) {
        map.set(cod, item);
      }
    });
    return map;
  }

  private sanitizeNombreSegment(value?: string | null): string {
    if (!value) {
      return '';
    }
    const trimmed = value.toString().trim();
    if (!trimmed) {
      return '';
    }
    return trimmed.replace(/\s+/g, ' ');
  }

  private sanitizeNombreCompleto(value?: string | null): string | undefined {
    if (!value) return undefined;
    const tokens = value.split(/\s+/).filter(Boolean);
    if (!tokens.length) return undefined;
    const seen = new Set<string>();
    const deduped = tokens.filter(tok => {
      const key = tok.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
    const result = deduped.join(' ').trim();
    return result || undefined;
  }

  private compareEstudiantesByNombre(a: { apellidoP?: string; apellidoM?: string; nombres?: string; nombre?: string }, b: { apellidoP?: string; apellidoM?: string; nombres?: string; nombre?: string }): number {
    const pA = (a.apellidoP || '').toLocaleLowerCase();
    const pB = (b.apellidoP || '').toLocaleLowerCase();
    if (pA !== pB) {
      return pA.localeCompare(pB, 'es');
    }
    const mA = (a.apellidoM || '').toLocaleLowerCase();
    const mB = (b.apellidoM || '').toLocaleLowerCase();
    if (mA !== mB) {
      return mA.localeCompare(mB, 'es');
    }
    const nA = (a.nombres || a.nombre || '').toLocaleLowerCase();
    const nB = (b.nombres || b.nombre || '').toLocaleLowerCase();
    return nA.localeCompare(nB, 'es');
  }

  private formatNombreCompleto(apellidoP?: string | null, apellidoM?: string | null, nombres?: string | null, fallback: string = '-'): string {
    const parts = [apellidoP, apellidoM, nombres]
      .map(seg => (seg || '').toString().trim())
      .filter(seg => seg.length > 0);
    const texto = parts.join(' ').trim();
    if (texto.length) {
      return texto;
    }
    return (fallback || '-').toString();
  }

  private splitNombreCompleto(nombre?: string | null): { apellidoP: string; apellidoM: string; nombres: string } {
    if (!nombre) {
      return { apellidoP: '', apellidoM: '', nombres: '' };
    }
    const tokens = nombre.split(/\s+/).filter(Boolean);
    if (!tokens.length) {
      return { apellidoP: '', apellidoM: '', nombres: '' };
    }
    if (tokens.length === 1) {
      return { apellidoP: tokens[0], apellidoM: '', nombres: '' };
    }
    const apellidoP = tokens[0];
    const apellidoM = tokens[1];
    const nombres = tokens.slice(2).join(' ');
    return { apellidoP, apellidoM, nombres };
  }

  private resolveNombreParts(
    normalized: { apellidoP?: string; apellidoM?: string; nombres?: string; nombre?: string } | null,
    fallbackNombre: string
  ): { apellidoP: string; apellidoM: string; nombres: string } {
    let apellidoP = normalized?.apellidoP || '';
    let apellidoM = normalized?.apellidoM || '';
    let nombres = normalized?.nombres || '';
    if (!apellidoP || !apellidoM || !nombres) {
      const parsed = this.splitNombreCompleto(fallbackNombre);
      apellidoP = apellidoP || parsed.apellidoP;
      apellidoM = apellidoM || parsed.apellidoM;
      nombres = nombres || parsed.nombres;
    }
    return { apellidoP, apellidoM, nombres };
  }

  private dedupeNombreCompleto(nombre?: string | null): string | undefined {
    if (!nombre) return undefined;
    const tokens = nombre.split(/\s+/).filter(Boolean);
    const seen = new Set<string>();
    const deduped = tokens.filter(tok => {
      const key = tok.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const result = deduped.join(' ').trim();
    return result || undefined;
  }

  isDocumentoGenerado(est?: { documento_generado?: unknown; fecha_designacion?: unknown } | null): boolean {
    if (!est) {
      return false;
    }

    if (typeof est.documento_generado !== 'undefined') {
      return Boolean(est.documento_generado);
    }

    if (est.fecha_designacion === null || est.fecha_designacion === undefined) {
      return false;
    }

    const fecha = est.fecha_designacion;
    if (fecha instanceof Date) {
      return Number.isFinite(fecha.getTime());
    }
    if (typeof fecha === 'string') {
      return fecha.trim().length > 0;
    }
    if (typeof fecha === 'number') {
      return Number.isFinite(fecha);
    }
    return Boolean(fecha);
  }

  private buildDesignacionPayload(
    tutor: TutorDesignacionItem,
    estudiante: any,
    userName?: string,
    userId?: number,
    selectedCodCetas?: number[]
  ): any {
    const codCeta = Number(estudiante?.cod_ceta ?? 0);
    const payload: any = {
      tutor_id: Number(tutor.tutor_id),
      cod_ceta: codCeta,
      generar_documento: true,
      refrescar_correlativo: true,
    };

    if (estudiante?.proyecto_id != null) {
      payload.proyecto_id = Number(estudiante.proyecto_id);
    }

    const area = this.resolveFirstNonEmpty(estudiante?.area, estudiante?.area_nombre, estudiante?.area_label, tutor.area ?? null);
    if (area) {
      payload.area = area;
    }

    if (tutor.convocatoria_id != null) {
      payload.convocatoria_id = Number(tutor.convocatoria_id);
    }
    if (tutor.convocatoria_label) {
      payload.convocatoria_nom = tutor.convocatoria_label;
    }
    if (tutor.convocatoria_fecha_inicio) {
      payload.convocatoria_fecha_inicio = tutor.convocatoria_fecha_inicio;
    }
    if (tutor.convocatoria_fecha_fin) {
      payload.convocatoria_fecha_fin = tutor.convocatoria_fecha_fin;
    }

    if (userName) {
      payload.user_name = userName;
    }
    if (userId != null) {
      payload.user_id = userId;
    }

    if (selectedCodCetas && selectedCodCetas.length) {
      payload.seleccionados_cod_ceta = selectedCodCetas.map((value) => Number(value));
    }

    return payload;
  }

  private resolveUserId(user: any): number | null {
    if (!user) return null;
    const candidates = [user.id, user.user_id, user.usuario_id];
    for (const value of candidates) {
      if (value !== undefined && value !== null) {
        const num = Number(value);
        if (Number.isFinite(num)) {
          return num;
        }
      }
    }
    return null;
  }

  private normalizeNumeroDocumento(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        return null;
      }
      return value.toString().padStart(3, '0');
    }
    const str = value.toString().trim();
    return str.length ? str : null;
  }

  toggleStudentSelection(tutorId: number, codCeta: number, checked: boolean) {
    const tutor = this.designados.find(t => t.tutor_id === tutorId);
    const estudiante = tutor?.estudiantes?.find(est => Number(est.cod_ceta) === Number(codCeta));
    if (estudiante && this.isDocumentoGenerado(estudiante)) {
      const set = this.getSelectedStudentSet(tutorId);
      set.delete(codCeta);
      return;
    }
    const set = this.getSelectedStudentSet(tutorId);
    if (checked) {
      set.add(codCeta);
    } else {
      set.delete(codCeta);
    }
  }

  selectAllStudents(tutor: TutorDesignacionItem, checked: boolean) {
    const set = this.getSelectedStudentSet(tutor.tutor_id);
    set.clear();
    if (checked) {
      (tutor.estudiantes || []).forEach(est => {
        if (!this.isDocumentoGenerado(est)) {
          set.add(est.cod_ceta);
        }
      });
    }
  }

  hasSelectedStudents(tutor: TutorDesignacionItem): boolean {
    return this.getSelectedStudentSet(tutor.tutor_id).size > 0;
  }

  hasSelectableStudents(tutor: TutorDesignacionItem): boolean {
    if (!tutor.estudiantes || !tutor.estudiantes.length) {
      return false;
    }
    return tutor.estudiantes.some(est => !this.isDocumentoGenerado(est));
  }

  isAllStudentsSelected(tutor: TutorDesignacionItem): boolean {
    if (!this.hasSelectableStudents(tutor)) {
      return false;
    }
    const set = this.getSelectedStudentSet(tutor.tutor_id);
    const totalSelectable = (tutor.estudiantes || []).filter(est => !this.isDocumentoGenerado(est)).length;
    return totalSelectable > 0 && set.size === totalSelectable;
  }

  isStudentSelected(tutorId: number, codCeta: number): boolean {
    return this.getSelectedStudentSet(tutorId).has(codCeta);
  }

  openConfirmModal(tutor: TutorDesignacionItem) {
    const selectedSet = this.getSelectedStudentSet(tutor.tutor_id);
    if (!selectedSet.size) {
      return;
    }
    const estudiantes = (tutor.estudiantes || []).filter(est => selectedSet.has(est.cod_ceta));
    if (!estudiantes.length) {
      return;
    }
    const normalizados = estudiantes.map(est => this.normalizeEstudianteData(est));
    const ordenados = normalizados.sort((a, b) => this.compareEstudiantesByNombre(a, b));
    this.confirmModalTutor = tutor;
    this.confirmModalEstudiantes = ordenados.map((n) => ({
      cod_ceta: n.cod_ceta,
      nombre: n.nombre,
      modalidad: n.modalidad,
      area: n.area,
      proyecto_nombre: n.tema,
      fecha_designacion: n.fechaDesignacion ? n.fechaDesignacion.toISOString() : null,
    }));
    this.confirmModalVisible = true;
  }

  closeConfirmModal() {
    this.confirmModalVisible = false;
    this.confirmModalTutor = null;
    this.confirmModalEstudiantes = [];
    this.generatingDesignadoId = null;
  }

  async confirmGenerateDesignado() {
    const tutor = this.confirmModalTutor;
    if (!tutor || !this.confirmModalEstudiantes.length || this.generatingDesignadoId === tutor.tutor_id) {
      return;
    }
    this.generatingDesignadoId = tutor.tutor_id;
    this.loadingService.showModal();
    try {
      const selectedSet = this.getSelectedStudentSet(tutor.tutor_id);
      const estudiantesSeleccionados = (tutor.estudiantes || []).filter(est => selectedSet.has(est.cod_ceta));
      if (!estudiantesSeleccionados.length) {
        return;
      }
      const selectedCodCetas = Array.from(selectedSet.values());
      const user = this.auth.getUser();
      const userNombre = user?.nombre_usuario
        || [user?.nombre, user?.apellido_p, user?.apellido_m].filter(Boolean).join(' ').trim()
        || user?.email
        || undefined;
      const resolvedUserId = this.resolveUserId(user);

      const responseDataByCod = new Map<number, any>();

      for (const est of estudiantesSeleccionados) {
        const payload = this.buildDesignacionPayload(
          tutor,
          est,
          userNombre,
          resolvedUserId ?? undefined,
          selectedCodCetas
        );
        try {
          const resp = await firstValueFrom(this.sga.designarTutor(payload));
          if (!resp?.success) {
            throw new Error(resp?.message || 'Respuesta inválida del backend');
          }
          if (resp.data) {
            responseDataByCod.set(Number(est.cod_ceta), resp.data);
          }
        } catch (error) {
          console.error('Error al actualizar la designación en backend', error);
          alert('No se pudo generar el documento porque la actualización en el servidor falló.');
          this.loadingService.hideModal();
          return;
        }
      }

      let docData: any = null;

      const primaryData = responseDataByCod.values().next().value || null;

      if (primaryData) {
        const numeroDocumento = this.normalizeNumeroDocumento(primaryData.numero_documento ?? primaryData.doc_correlativo ?? primaryData.correlativo);
        if (numeroDocumento) {
          tutor.numero_documento = numeroDocumento;
        }
        const cite = this.resolveFirstNonEmpty(primaryData.cite, primaryData.doc_cite, tutor.cite);
        if (cite) {
          tutor.cite = cite;
        }
        tutor.convocatoria_fecha_inicio = this.resolveFirstNonEmpty(primaryData.convocatoria_fecha_inicio, tutor.convocatoria_fecha_inicio);
        tutor.convocatoria_fecha_fin = this.resolveFirstNonEmpty(primaryData.convocatoria_fecha_fin, tutor.convocatoria_fecha_fin);
        tutor.cronograma_inicio = this.resolveFirstNonEmpty(primaryData.cronograma_inicio, tutor.cronograma_inicio);
        tutor.cronograma_fin = this.resolveFirstNonEmpty(primaryData.cronograma_fin, tutor.cronograma_fin);
        tutor.area = this.resolveFirstNonEmpty(primaryData.area, tutor.area ?? null);
      }

      const correlativoBusqueda = this.resolveFirstNonEmpty(
        primaryData?.doc_correlativo,
        primaryData?.correlativo,
        primaryData?.numero_documento,
        primaryData?.numeroDocumento,
        tutor.numero_documento,
        (tutor as any)?.doc_correlativo
      );

      if (correlativoBusqueda) {
        try {
          const correlativoParam = this.normalizeNumeroDocumento(correlativoBusqueda) || correlativoBusqueda;
          const respDoc = await firstValueFrom(this.sga.getDocDesignacionesByCorrelativo(correlativoParam));
          docData = (respDoc as any)?.data ?? respDoc ?? null;
        } catch (err) {
          console.warn('No se pudo obtener el documento consolidado para el correlativo', correlativoBusqueda, err);
        }
      }

      if (docData) {
        const numeroDoc = this.normalizeNumeroDocumento(docData.correlativo ?? docData.numero_documento ?? correlativoBusqueda ?? tutor.numero_documento);
        if (numeroDoc) {
          tutor.numero_documento = numeroDoc;
        }
        const citeDoc = this.resolveFirstNonEmpty(docData.cite, tutor.cite);
        if (citeDoc) {
          tutor.cite = citeDoc;
        }
        tutor.area = this.resolveFirstNonEmpty(docData.area, docData.designacion_area, tutor.area ?? null);
        tutor.convocatoria_fecha_inicio = this.resolveFirstNonEmpty(docData.convocatoria_fecha_inicio, tutor.convocatoria_fecha_inicio);
        tutor.convocatoria_fecha_fin = this.resolveFirstNonEmpty(docData.convocatoria_fecha_fin, tutor.convocatoria_fecha_fin);
        tutor.cronograma_inicio = this.resolveFirstNonEmpty(docData.cronograma_inicio, tutor.cronograma_inicio);
        tutor.cronograma_fin = this.resolveFirstNonEmpty(docData.cronograma_fin, tutor.cronograma_fin);
      }

      const resumenDocLookup = this.buildResumenLookup(this.extractResumenFromDocData(docData));

      const normalizados = estudiantesSeleccionados.map(est => {
        const cod = Number(est.cod_ceta);
        const respData = responseDataByCod.get(cod);
        const docItem = resumenDocLookup.get(cod) || {};
        const merged = {
          ...(est || {}),
          ...(respData || {}),
          ...(docItem || {}),
        };
        const normalized = this.normalizeEstudianteData(merged);
        if (respData?.fecha_designacion) {
          normalized.fechaDesignacion = new Date(respData.fecha_designacion);
        } else if (docItem?.fecha_designacion) {
          const fechaDoc = new Date(docItem.fecha_designacion as any);
          if (!Number.isNaN(fechaDoc.getTime())) {
            normalized.fechaDesignacion = fechaDoc;
          }
        }
        return normalized;
      }).sort((a, b) => this.compareEstudiantesByNombre(a, b));

      const fechaDocumento = normalizados[0]?.fechaDesignacion
        || (primaryData?.fecha_designacion ? new Date(primaryData.fecha_designacion) : new Date());

      // Actualizar información local de estudiantes (fecha de designación)
      for (const est of estudiantesSeleccionados) {
        const cod = Number(est.cod_ceta);
        const match = (tutor.estudiantes || []).find(item => Number(item.cod_ceta) === cod);
        if (!match) {
          continue;
        }
        const data = responseDataByCod.get(cod);
        const fechaDesignacion = data?.fecha_designacion
          ? new Date(data.fecha_designacion)
          : fechaDocumento;
        match.fecha_designacion = fechaDesignacion instanceof Date && Number.isFinite(fechaDesignacion.getTime())
          ? fechaDesignacion.toISOString()
          : fechaDocumento.toISOString();
        match.documento_generado = true;
      }

      const modalidadGeneral = this.resolveFirstNonEmpty(
        docData?.modalidad,
        docData?.modalidad_nombre,
        docData?.doc_modalidad,
        primaryData?.modalidad,
        primaryData?.modalidad_nombre,
        normalizados[0]?.modalidad,
        this.resolveEstudianteModalidadFromRaw(normalizados[0]?.raw)
      ) || undefined;

      const tutorDisplayName = this.dedupeNombreCompleto(
        this.resolveFirstNonEmpty(docData?.doc_para_nombre, docData?.tutor_nombre, primaryData?.tutor_nombre, tutor.tutor_nombre)
      ) || tutor.tutor_nombre;

      const paraNombreBase = this.dedupeNombreCompleto(
        this.resolveFirstNonEmpty(docData?.doc_para_nombre, tutorDisplayName)
      ) || tutorDisplayName;

      const academicCargoRaw = this.resolveFirstNonEmpty(
        docData?.tutor_titulo_academico,
        primaryData?.tutor_titulo_academico,
        tutor.tutor_titulo_academico,
        (tutor as any)?.titulo_academico,
      );
      const academicCargo = this.sanitizeNombreSegment(
        academicCargoRaw !== undefined && academicCargoRaw !== null ? String(academicCargoRaw) : ''
      );

      const cargoSegment = academicCargo ? academicCargo.toUpperCase() : 'DOCENTE TÉCNICO';
      const paraCargo = 'DOCENTE TÉCNICO';
      const nombreSegment = paraNombreBase ? paraNombreBase.replace(/\s+/g, ' ').trim() : '';
      const paraNombre = nombreSegment
        ? (nombreSegment.toUpperCase().startsWith(cargoSegment)
          ? nombreSegment
          : `${cargoSegment} ${nombreSegment}`)
        : cargoSegment;

      const fechaGeneracion = new Date();

      await this.pdfService.generarDesignacionTutorPdf({
        tutorNombre: tutorDisplayName,
        tutorTipo: tutor.tipo_tutor_nombre || undefined,
        tutorCi: tutor.tutor_ci || undefined,
        tutorCelular: tutor.tutor_celular || undefined,
        tutorTitulo: tutor.tutor_titulo || undefined,
        tutorTituloAcademico: tutor.tutor_titulo_academico || undefined,
        area: docData?.area || docData?.designacion_area || tutor.area || tutor.tutor_titulo || undefined,
        carrera: docData?.carrera_nombre || docData?.carrera || tutor.carrera_nombre || tutor.cod_carrera || undefined,
        convocatoria: tutor.convocatoria_label || undefined,
        convocatoriaFechaInicio: tutor.convocatoria_fecha_inicio || undefined,
        convocatoriaFechaFin: tutor.convocatoria_fecha_fin || undefined,
        cronogramaInicio: docData?.cronograma_inicio || tutor.cronograma_inicio || tutor.convocatoria_fecha_inicio || fechaDocumento,
        cronogramaFin: docData?.cronograma_fin || tutor.cronograma_fin || tutor.convocatoria_fecha_fin || fechaDocumento,
        modalidad: modalidadGeneral,
        paraNombre,
        paraCargo,
        fecha: fechaDocumento,
        fechaGeneracion,
        lugar: 'Cochabamba',
        numeroDocumento: tutor.numero_documento || docData?.correlativo || undefined,
        cite: tutor.cite || docData?.cite || undefined,
        elaboradoPor: docData?.elaborado_por || userNombre,
        cargoElaborador: 'Responsable de Modalidad de Graduación',
        estudiantes: normalizados.map((est) => {
          const raw = (est && est.raw) ? est.raw as any : {};
          const mergedRaw = { ...(docData || {}), ...raw };
          return {
            nombre: est.nombre || '-',
            codigo: est.cod_ceta ? String(est.cod_ceta) : undefined,
            carrera: this.resolveEstudianteCarreraFromRaw(mergedRaw, tutor)
              || docData?.carrera_nombre
              || docData?.carrera
              || tutor.carrera_nombre
              || tutor.cod_carrera
              || undefined,
            modalidad: this.resolveEstudianteModalidadFromRaw(mergedRaw)
              || est.modalidad
              || modalidadGeneral,
            area: this.resolveEstudianteAreaFromRaw(mergedRaw, docData?.area || tutor.area, est.area) || undefined,
            tema: this.resolveEstudianteTemaFromRaw(mergedRaw, est.tema || raw?.tema || raw?.proyecto_nombre || (docData as any)?.proyecto_nombre) || undefined,
            fechaDesignacion: est.fechaDesignacion || raw?.fecha_designacion || fechaDocumento,
          };
        }),
      }, {
        fileName: `designacion-${tutor.tutor_nombre.replace(/\s+/g, '-').toLowerCase()}.pdf`
      });
    } catch (err) {
      console.error('Error generando PDF de designado:', err);
      alert('No se pudo generar el documento PDF para este tutor.');
    } finally {
      this.loadingService.hideModal();
      this.closeConfirmModal();
      const set = this.getSelectedStudentSet(tutor.tutor_id);
      set.clear();
    }
  }

  loadDesignados() {
    if (!this.showDesignados) return;
    this.loadingDesignados = true;
    this.errorDesignados = null;
    const params: Record<string, any> = {};
    if (this.selectedConvocatoriaDesignados != null) {
      params['convocatoria_id'] = this.selectedConvocatoriaDesignados;
    }
    if (this.designadosSearchTerm && this.designadosSearchTerm.trim()) {
      params['search'] = this.designadosSearchTerm.trim();
    }
    this.sga.getTutoresDesignados(params).subscribe({
      next: (resp) => {
        const rows = (resp as any)?.data ?? resp;
        this.designados = Array.isArray(rows) ? rows as TutorDesignacionItem[] : [];
        this.loadingDesignados = false;
      },
      error: (err) => {
        this.loadingDesignados = false;
        this.designados = [];
        this.errorDesignados = err?.message || 'Error al cargar tutores designados';
      }
    });
  }

  // -------- Multiselect Pertinencias (UI) --------
  togglePertDropdown() {
    this.skipFirstPertFocus = false;
    this.pertDropdownOpen = !this.pertDropdownOpen;
  }

  openPertDropdown() {
    this.skipFirstPertFocus = false;
    this.pertDropdownOpen = true;
  }

  closePertDropdown() {
    this.pertDropdownOpen = false;
  }

  onPertInputClick(ev: MouseEvent) {
    ev.stopPropagation();
    this.openPertDropdown();
  }

  onPertInputFocus() {
    if (this.skipFirstPertFocus) {
      this.skipFirstPertFocus = false;
      return;
    }
    this.openPertDropdown();
  }

  onPertInputKeydown(ev: KeyboardEvent) {
    if (ev.key === 'Tab' || ev.key === 'Shift') return;
    ev.stopPropagation();
    this.openPertDropdown();
  }

  onPertInputInput(ev: Event) {
    ev.stopPropagation();
    this.openPertDropdown();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    if (!this.pertDropdownOpen) return;
    if (this.msRoot && !this.msRoot.nativeElement.contains(ev.target)) {
      this.pertDropdownOpen = false;
    }
  }

  get filteredPertinencias(): Pertinencia[] {
    const term = (this.pertSearch || '').toLowerCase().trim();
    const list = this.pertinencias || [];
    if (!term) return list;
    return list.filter(p => (p.nombre_pert || '').toLowerCase().includes(term));
  }

  // ===== Validaciones y sanitización: nombres/apellidos y celular =====
  private sanitizeNameChars(v: string): string {
    if (!v) return '';
    // Permitir letras (incluye acentos/ñ/ü), espacios, guiones y apóstrofes
    return v.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ'\-\s]/g, '');
  }

  private toTitleCase(v: string): string {
    const s = (v || '').toLowerCase().replace(/\s+/g, ' ').trim();
    // Mayúscula al inicio y después de espacio o guion
    return s.replace(/(^|[\s-])([a-záéíóúüñ])/g, (m, p1, p2) => p1 + p2.toUpperCase());
  }

  onNameInput(field: 'nombre' | 'apellido_p' | 'apellido_m', ev: Event) {
    if (!this.editingDocente) return;
    const el = ev.target as HTMLInputElement;
    let val = this.sanitizeNameChars(el.value || '');
    val = val.replace(/\s+/g, ' ');
    // eliminar espacios iniciales
    if (val.startsWith(' ')) val = val.replace(/^\s+/, '');
    // Mayúscula inmediata del primer carácter (resto se mantiene como esté)
    if (val.length > 0) {
      const pos = el.selectionStart ?? val.length;
      const first = val.charAt(0);
      const upperFirst = first.toLocaleUpperCase();
      if (first !== upperFirst) {
        val = upperFirst + val.slice(1);
        // restaurar caret lo mejor posible
        setTimeout(() => { try { el.setSelectionRange(pos, pos); } catch {} }, 0);
      }
    }
    // reflejar inmediatamente en el input
    if (el.value !== val) el.value = val;
    this.editingDocente[field] = val as any;
  }

  onNameBlur(field: 'nombre' | 'apellido_p' | 'apellido_m') {
    if (!this.editingDocente) return;
    const current = (this.editingDocente[field] || '').toString();
    this.editingDocente[field] = this.toTitleCase(current) as any;
  }

  isValidNombre(v: any, required: boolean = true): boolean {
    const s = (v == null ? '' : String(v)).trim();
    if (required && !s) return false;
    if (!s) return true;
    if (/[0-9]/.test(s)) return false; // no números
    // Debe iniciar con mayúscula
    return /^[A-ZÁÉÍÓÚÜÑ]/.test(s);
  }

  onCelularInput(ev: Event) {
    if (!this.editingDocente) return;
    const el = ev.target as HTMLInputElement;
    const digits = (el.value || '').replace(/\D/g, '').slice(0, 8);
    if (el.value !== digits) el.value = digits;
    this.editingDocente.celular = digits as any;
  }

  // Bloquear teclas no permitidas (experiencia inmediata)
  onlyLettersKeypress(e: KeyboardEvent) {
    const k = e.key;
    if (k.length > 1) return; // teclas de control (Backspace, Tab, flechas) permitidas
    if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'\-\s]/.test(k)) e.preventDefault();
  }

  onlyDigitsKeypress(e: KeyboardEvent) {
    const k = e.key;
    if (k.length > 1) return; // control keys
    if (!/[0-9]/.test(k)) e.preventDefault();
  }

  onNamePaste(field: 'nombre' | 'apellido_p' | 'apellido_m', ev: ClipboardEvent) {
    if (!this.editingDocente) return;
    const el = ev.target as HTMLInputElement;
    const text = (ev.clipboardData?.getData('text') || '');
    const clean = this.sanitizeNameChars(text).replace(/\s+/g, ' ');
    ev.preventDefault();
    el.value = clean;
    this.editingDocente[field] = clean as any;
  }

  onCelularPaste(ev: ClipboardEvent) {
    if (!this.editingDocente) return;
    const el = ev.target as HTMLInputElement;
    const text = (ev.clipboardData?.getData('text') || '');
    const digits = text.replace(/\D/g, '').slice(0, 8);
    ev.preventDefault();
    el.value = digits;
    this.editingDocente.celular = digits as any;
  }

  isValidCelular(v: any): boolean {
    const s = (v == null ? '' : String(v)).trim();
    return /^\d{8}$/.test(s);
  }

  isPertSelected(id: number): boolean {
    return this.selectedPertIds.includes(id);
  }

  selectPert(p: Pertinencia) {
    const id = p.id;
    if (this.isPertSelected(id)) {
      this.selectedPertIds = this.selectedPertIds.filter(x => x !== id);
      return;
    }
    if (this.pertMax != null && this.selectedPertIds.length >= this.pertMax) {
      // opcional: mostrar un mini error local (no bloqueante)
      return;
    }
    this.selectedPertIds = [...this.selectedPertIds, id];
  }

  removePert(id: number) {
    this.selectedPertIds = this.selectedPertIds.filter(x => x !== id);
  }

  clearPert() {
    this.selectedPertIds = [];
  }

  private normalizeCi(val: any): string {
    const s = (val == null ? '' : String(val)).trim().toUpperCase();
    const digits = s.replace(/[^0-9]/g, '');
    return digits || s;
  }

  private getTipoSeleccionado(ci: any): number | null {
    const key = this.normalizeCi(ci);
    return this.tipoSeleccionado[key] ?? null;
  }

  private setTipoSeleccionado(ci: any, tipoId: number | null) {
    const key = this.normalizeCi(ci);
    this.tipoSeleccionado[key] = tipoId ?? null;
  }

  getTipoTutorNombre(doc: Docente): string | null {
    const tipoId = this.getTipoSeleccionado(doc.ci) ?? (doc as any).tipo_tutor_id ?? null;
    if (tipoId == null) {
      return null;
    }
    const found = this.tutorTipos.find(tt => tt.id === tipoId);
    if (found) {
      return found.nombre || null;
    }
    const fallback = (doc as any).tipo_tutor;
    return fallback ? String(fallback) : null;
  }

  get pertPlaceholder(): string {
    return this.pertMax ? `Seleccione hasta ${this.pertMax} pertinencias` : 'Seleccione una o más pertinencias';
  }

  // Registrar y activar directamente como Tutor (usa register_bulk con un item)
  registrarYActivarTutor() {
    if (!this.editingDocente) return;
    this.editingSaveError = null;
    // Normalizar entradas antes de validar
    this.editingDocente.nombre = this.toTitleCase(this.sanitizeNameChars(((this.editingDocente.nombre || '') as string).replace(/\s+/g, ' ').trim())) as any;
    this.editingDocente.apellido_p = this.toTitleCase(this.sanitizeNameChars(((this.editingDocente.apellido_p || '') as string).replace(/\s+/g, ' ').trim())) as any;
    this.editingDocente.apellido_m = this.toTitleCase(this.sanitizeNameChars(((this.editingDocente.apellido_m || '') as string).replace(/\s+/g, ' ').trim())) as any;
    this.editingDocente.celular = ((this.editingDocente.celular || '') as string).replace(/\D/g, '').slice(0, 8) as any;
    this.showFieldErrors = true; // activar estilos de error
    // Validaciones requeridas
    const missing = this.getMissingRequiredFields();
    if (missing.length) {
      this.editingSaveError = `Complete los campos requeridos: ${missing.join(', ')}`;
      return;
    }
    const ci = (this.editingDocente.ci || '').toString().trim();
    const nombre = (this.editingDocente.nombre || '').toString().trim();
    const celular = (this.editingDocente.celular || '').toString().trim();
    const codCarr = (this.modalCarreraCode === 'MEA' || this.modalCarreraCode === 'EEA') ? this.modalCarreraCode : undefined;
    const primaryPertId = this.selectedPertIds?.[0] ?? null;
    const pertNom = (this.pertinencias || [])
      .filter(p => this.selectedPertIds.includes(p.id))
      .map(p => p.nombre_pert)
      .join(', ');
    const tipoTutorId = this.selectedTipoTutorId ?? null;
    const item = {
      ci,
      nombre,
      apellido_p: this.editingDocente.apellido_p || undefined,
      apellido_m: this.editingDocente.apellido_m || undefined,
      celular,
      profesion: this.editingDocente.profesion || undefined,
      titulo: this.editingDocente.profesion || undefined,
      titulo_academico: this.editingDocente.titulo_academico || undefined,
      cod_carrera: codCarr,
      pertinencia_acad_id: primaryPertId,
      pertinencia_acad_ids: this.selectedPertIds,
      pertinencia: pertNom || undefined,
      tipo_tutor_id: tipoTutorId ?? undefined,
      activo: true,
    } as any;
    this.savingDocente = true;
    this.sga.registerTutoresBulk([item]).subscribe({
      next: (resp) => {
        this.savingDocente = false;
        if (resp?.success) {
          this.successMessage = `Tutor registrado y activado.`;
          this.successModalVisible = true;
          // Marcar en set de registrados
          this.registradosSet.add(this.normalizeCi(ci));
          this.setTipoSeleccionado(ci, tipoTutorId);
          this.modalEditarDocenteVisible = false;
          // Si panel de registrados está visible, refrescar
          if (this.showRegistrados) this.loadTutores();
          this.buscarDocentes();
        } else {
          this.editingSaveError = resp?.message || 'No se pudo registrar el tutor';
        }
      },
      error: (err) => {
        this.savingDocente = false;
        this.editingSaveError = err?.message || 'Error al registrar tutor';
      }
    });
  }

  onSubmitTutorModal() {
    this.registrarYActivarTutor();
  }

  onTipoSeleccionadoChange(doc: Docente, value: any) {
    let tipoId: number | null;
    if (value === null || value === undefined || value === '') {
      tipoId = null;
    } else {
      const parsed = Number(value);
      tipoId = Number.isFinite(parsed) ? parsed : null;
    }
    this.setTipoSeleccionado(doc.ci, tipoId);
    (doc as any).tipo_tutor_id = tipoId;
    const found = tipoId != null ? this.tutorTipos.find(tt => tt.id === tipoId) : undefined;
    (doc as any).tipo_tutor = found ? found.nombre : null;

    if (this.editingDocente && this.normalizeCi(this.editingDocente.ci) === this.normalizeCi(doc.ci)) {
      this.selectedTipoTutorId = tipoId;
    }
  }

  // Si el docente ya figura como tutor en la gestión actual, actualizar su snapshot en 'tutores'
  private refreshTutorSnapshotIfExists(doc: Docente) {
    // Buscar sin filtrar por carrera para no omitir coincidencias al cambiar de MEA/EEA
    const params: any = { gestion: this.gestionActual };
    this.sga.getTutores(params).subscribe({
      next: (resp) => {
        const prevCi = (this.editingCiOriginal || '').toString().trim();
        const exists = !!resp?.data?.some(t => (t as any).ci === doc.ci || (!!prevCi && (t as any).ci === prevCi));
        if (!exists) return;
        const pertNom = (this.pertinencias || [])
          .filter(p => this.selectedPertIds.includes(p.id))
          .map(p => p.nombre_pert)
          .join(', ');
        const primaryPertId = this.selectedPertIds?.[0] ?? (doc as any).pertinencia_acad_id ?? null;
        const item: any = {
          ci: (doc.ci || '').toString().trim(),
          nombre: doc.nombre || '',
          apellido_p: doc.apellido_p || '',
          apellido_m: doc.apellido_m || '',
          celular: doc.celular || '',
          profesion: doc.profesion || '',
          cod_carrera: (this.modalCarreraCode === 'MEA' || this.modalCarreraCode === 'EEA') ? this.modalCarreraCode : undefined,
          pertinencia_acad_id: primaryPertId,
          pertinencia_acad_ids: this.selectedPertIds,
          pertinencia: pertNom || undefined,
          titulo_academico: doc.titulo_academico || undefined,
        };
        this.sga.registerTutoresBulk([item], { updateOnly: true }).subscribe({ next: () => {}, error: () => {} });
      },
      error: () => {}
    });
  }

  // Devuelve lista de campos requeridos faltantes para el registro directo como tutor
  private getMissingRequiredFields(): string[] {
    const miss: string[] = [];
    const cod = this.modalCarreraCode;
    const nombre = (this.editingDocente?.nombre || '').toString().trim();
    const apPat = (this.editingDocente?.apellido_p || '').toString().trim();
    const ci = (this.editingDocente?.ci || '').toString().trim();
    const celular = (this.editingDocente?.celular || '').toString().trim();
    const titulo = (this.editingDocente?.profesion || '').toString().trim();
    const tituloAcademico = (this.editingDocente?.titulo_academico || '').toString().trim();
    const hasAnyPert = (this.selectedPertIds?.length || 0) > 0;
    const tipoTutor = this.selectedTipoTutorId;
    if (!(cod === 'MEA' || cod === 'EEA')) miss.push('Carrera');
    if (!nombre) miss.push('Nombres');
    if (!apPat) miss.push('Apellido paterno');
    if (!ci) miss.push('CI');
    if (!celular) miss.push('Celular');
    if (!titulo) miss.push('Título(s)');
    if (!tituloAcademico) miss.push('Título académico');
    if (!tipoTutor) miss.push('Tipo de Tutor');
    if (!hasAnyPert) miss.push('Pertinencia académica');
    // Validaciones de formato
    if (!this.isValidNombre(nombre, true)) miss.push('Nombres (formato)');
    if (!this.isValidNombre(apPat, true)) miss.push('Apellido paterno (formato)');
    const apMat = (this.editingDocente?.apellido_m || '').toString().trim();
    if (apMat && !this.isValidNombre(apMat, false)) miss.push('Apellido materno (formato)');
    if (!this.isValidCelular(celular)) miss.push('Celular (8 dígitos)');
    return miss;
  }

  private loadAllPertinencias() {
    this.sga.getPertinencias().subscribe({
      next: (resp) => {
        this.allPertinencias = Array.isArray(resp?.data) ? resp.data : [];
        this.applyPertinenciaFilter(this.modalCarreraCode);
      },
      error: () => {
        this.allPertinencias = [];
        this.pertinencias = [];
      }
    });
  }

  private applyPertinenciaFilter(code: 'MEA' | 'EEA' | 'EEA/MEA' | null) {
    if (!code) {
      this.pertinencias = [];
      return;
    }
    const allowed = code === 'EEA/MEA' ? ['EEA', 'MEA'] : [code];
    this.pertinencias = this.allPertinencias.filter((p) => {
      const carrera = (p.cod_carrera || '').toUpperCase();
      if (!carrera) return true;
      return allowed.includes(carrera as 'MEA' | 'EEA');
    });
  }

  isCarreraModalValida(code: 'MEA' | 'EEA' | 'EEA/MEA' | null): boolean {
    return code === 'MEA' || code === 'EEA' || code === 'EEA/MEA';
  }

  private normalizeCarreraCode(value: string | null | undefined): 'MEA' | 'EEA' | 'EEA/MEA' | null {
    if (!value) return null;
    const trimmed = value.toString().trim();
    if (!trimmed) return null;
    const normalized = trimmed
      .normalize('NFD')
      .replace(/\p{Diacritic}+/gu, '')
      .toUpperCase();

    const hasMea = /MEA|MECANICA/.test(normalized);
    const hasEea = /EEA|ELECTRICIDAD/.test(normalized);

    if (hasMea && hasEea) return 'EEA/MEA';
    if (hasEea) return 'EEA';
    if (hasMea) return 'MEA';

    if (normalized.includes('/')) {
      const parts = normalized.split('/');
      const mapped = parts.map(p => this.normalizeCarreraCode(p as string)).filter(Boolean) as Array<'MEA' | 'EEA' | 'EEA/MEA'>;
      if (mapped.includes('EEA/MEA')) return 'EEA/MEA';
      const hasBoth = mapped.includes('EEA') && mapped.includes('MEA');
      if (hasBoth) return 'EEA/MEA';
      return mapped[0] ?? null;
    }

    return null;
  }

  private buildCarreraInfo(
    codeA?: string | null,
    labelA?: string | null,
    listA?: string[] | null,
    codeB?: string | null,
    labelB?: string | null,
    listB?: string[] | null
  ): { code: 'MEA' | 'EEA' | 'EEA/MEA' | null; list: Array<'MEA' | 'EEA'> } {
    const codes = new Set<'MEA' | 'EEA'>();

    const collectString = (input?: string | null) => {
      const normalized = this.normalizeCarreraCode(input);
      if (!normalized) return;
      if (normalized === 'EEA/MEA') {
        codes.add('EEA');
        codes.add('MEA');
      } else {
        codes.add(normalized);
      }
    };

    const collectList = (list?: string[] | null) => {
      if (!Array.isArray(list)) return;
      list.forEach(item => collectString(item));
    };

    collectString(codeA);
    collectString(labelA);
    collectList(listA);
    collectString(codeB);
    collectString(labelB);
    collectList(listB);

    if (!codes.size) {
      return { code: null, list: [] };
    }

    const list = Array.from(codes.values()).sort() as Array<'EEA' | 'MEA'>;
    if (codes.size > 1) {
      return { code: 'EEA/MEA', list };
    }

    const single = list[0];
    return { code: single, list };
  }

  private resolveCarreraPrincipal(entry: Partial<Docente> | null | undefined): 'MEA' | 'EEA' | 'EEA/MEA' | null {
    if (!entry) return null;
    const info = this.buildCarreraInfo(
      (entry as any).cod_carrera,
      (entry as any).carrera_label,
      (entry as any).carreras
    );
    return info.code;
  }

  toggleImportar() {
    const newVal = !this.showImport;
    this.showImport = newVal;
    if (newVal) {
      // Mostrar Importar -> ocultar panel de registrados
      this.showRegistrados = false;
      this.showDesignados = false;
      if (!this.docentesLoaded && !this.loadingDocentes) {
        this.buscarDocentes();
      }
    } else {
      // Limpia estado al ocultar
      this.errorDocentes = null;
    }
  }

  buscarDocentes() {
    this.errorDocentes = null;
    this.loadingDocentes = true;
    this.docentesLoaded = false;
    this.docentes = [];
    forkJoin({
      sga: this.sga.getDocentes(),
      // Traer snapshot local de tutores (todas las carreras)
      local: this.sga.getDocentesLocales(),
      // Dos consultas de tutores: gestión actual, alterna y sin filtro (cualquier gestión)
      reg: this.sga.getTutores({ gestion: this.gestionActual }),
      regAlt: this.sga.getTutores({ gestion: this.gestionAlternaActual }),
      regAll: this.sga.getTutores()
    }).subscribe({
      next: ({ sga, local, reg, regAlt, regAll }: {
        sga: ApiResponse<Docente[]>;
        local: ApiResponse<Docente[]>;
        reg: ApiResponse<TutorReg[]>;
        regAlt: ApiResponse<TutorReg[]>;
        regAll: ApiResponse<TutorReg[]>;
      }) => {
        this.loadingDocentes = false;
        const map = new Map<string, Docente>();
        const normCi = (v: any) => {
          const s = (v == null ? '' : String(v)).trim().toUpperCase();
          const digits = s.replace(/[^0-9]/g, '');
          return digits || s; // usar dígitos si existen, sino el valor normalizado
        };
        const toKey = (s: string) => s
          .normalize('NFD')
          .replace(/\p{Diacritic}+/gu, '')
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim();
        const fullNameKey = (o: any) => toKey(`${o?.nombre || ''} ${o?.apellido_p || ''} ${o?.apellido_m || ''}`);
        const sgaNameIndex = new Map<string, string>(); // nombre completo -> ciKey en map

        // 1) Cargar SGA primero
        if (sga?.success && Array.isArray(sga.data)) {
          for (const raw of sga.data as any[]) {
            const d = raw as Docente;
            const key = normCi((d as any).ci);
            if (!key) continue;
            const carreraInfo = this.buildCarreraInfo(
              (d as any).cod_carrera,
              (d as any).carrera_label,
              (d as any).carreras
            );
            const item = {
              nombre: (d as any).nombre || '',
              apellido_p: (d as any).apellido_p || '',
              apellido_m: (d as any).apellido_m || '',
              ci: key,
              profesion: (d as any).profesion || '',
              celular: (d as any).celular || '',
              titulo_academico: (d as any).titulo_academico ?? null,
              pertinencia: (d as any).pertinencia || '',
              pertinencia_acad_id: (d as any).pertinencia_acad_id ?? null,
              tipo_tutor_id: (d as any).tipo_tutor_id ?? null,
              tipo_tutor: (d as any).tipo_tutor || null,
              cod_carrera: carreraInfo.code,
              carrera_label: carreraInfo.code,
              carreras: carreraInfo.list,
            } as Docente;
            map.set(key, item);
            sgaNameIndex.set(fullNameKey(item), key);
          }
        }

        // 2) Mezclar/Agregar locales, priorizando locales
        if (local?.success && Array.isArray(local.data)) {
          // Elegir el mejor registro local por nombre completo (evita que uno con CI '0' pise a otro con CI válido)
          const bestLocalByName = new Map<string, any>();
          const scoreLocal = (o: any) => {
            const ci = normCi(o?.ci);
            const cel = (o?.celular == null ? '' : String(o.celular)).trim();
            let s = 0;
            if (ci && ci !== '0') s += 10;
            if (cel && cel !== '0') s += 1;
            return s;
          };
          for (const raw of local.data as any[]) {
            const nkey = fullNameKey(raw);
            const prev = bestLocalByName.get(nkey);
            if (!prev || scoreLocal(raw) > scoreLocal(prev)) {
              bestLocalByName.set(nkey, raw);
            }
          }
          const localsToMerge = Array.from(bestLocalByName.values());
          for (const raw of localsToMerge as any[]) {
            const ld = raw as Docente;
            const key = normCi((ld as any).ci);
            if (!key) continue;
            let prev = map.get(key) || {
              nombre: '', apellido_p: '', apellido_m: '', ci: key, profesion: '', celular: '', pertinencia: '', pertinencia_acad_id: null
            } as Docente;
            // Si no hay match por CI, intentar merge por nombre completo con el registro SGA
            if (!map.has(key)) {
              const nkey = fullNameKey(ld);
              const sgaKey = sgaNameIndex.get(nkey);
              if (sgaKey && map.has(sgaKey)) {
                prev = map.get(sgaKey)!;
              }
            }
            const localCi = normCi((ld as any).ci);
            const prevCi = normCi((prev as any).ci);
            const pickCi = localCi && localCi !== '0' ? localCi : prevCi;
            const toStr = (v: any) => (v == null ? '' : String(v)).trim();
            const localCel = toStr((ld as any).celular);
            const prevCel = toStr((prev as any).celular);
            const pickCel = localCel && localCel !== '0' ? localCel : prevCel;

            const merged: Docente = {
              ...prev,
              id: (ld as any).id ?? (prev as any).id,
              // Preferir SIEMPRE el valor local cuando no sea null/undefined (permitir string vacío)
              nombre: (ld as any).nombre ?? prev.nombre,
              apellido_p: (ld as any).apellido_p ?? prev.apellido_p,
              apellido_m: (ld as any).apellido_m ?? prev.apellido_m,
              profesion: (ld as any).profesion ?? prev.profesion,
              celular: pickCel,
              titulo_academico: (ld as any).titulo_academico ?? (prev as any).titulo_academico ?? null,
              pertinencia: (ld as any).pertinencia ?? prev.pertinencia,
              pertinencia_acad_id: (ld as any).pertinencia_acad_id != null ? (ld as any).pertinencia_acad_id : prev.pertinencia_acad_id,
              // Si hicimos merge por nombre (prev venía de SGA con CI malo), sobreescribir el CI mostrado con el local
              ci: pickCi,
              tipo_tutor_id: (ld as any).tipo_tutor_id ?? (prev as any).tipo_tutor_id ?? null,
              tipo_tutor: (ld as any).tipo_tutor ?? (prev as any).tipo_tutor ?? null,
              cod_carrera: this.buildCarreraInfo(
                (prev as any).cod_carrera,
                (prev as any).carrera_label,
                (prev as any).carreras,
                (ld as any).cod_carrera,
                (ld as any).carrera_label,
                (ld as any).carreras
              ).code,
              carrera_label: this.buildCarreraInfo(
                (prev as any).cod_carrera,
                (prev as any).carrera_label,
                (prev as any).carreras,
                (ld as any).cod_carrera,
                (ld as any).carrera_label,
                (ld as any).carreras
              ).code,
              carreras: this.buildCarreraInfo(
                (prev as any).cod_carrera,
                (prev as any).carrera_label,
                (prev as any).carreras,
                (ld as any).cod_carrera,
                (ld as any).carrera_label,
                (ld as any).carreras
              ).list,
            } as Docente;
            // Guardar de regreso en el mismo slot del map que se esté usando (por CI local o por CI SGA si hicimos merge por nombre)
            if (map.has(key)) {
              map.set(key, merged);
            } else {
              const nkey = fullNameKey(ld);
              const sgaKey = sgaNameIndex.get(nkey);
              if (sgaKey) {
                map.set(sgaKey, merged);
              } else {
                map.set(key, merged);
              }
            }
          }
        }

        // 3) Construir set de registrados en gestión actual y mapa de pertinencias por CI
        if ((reg?.success && Array.isArray(reg.data)) || (regAlt?.success && Array.isArray(regAlt.data)) || (regAll?.success && Array.isArray(regAll.data))) {
          const regArr = ([...(reg?.data as any[] || []), ...(regAlt?.data as any[] || []), ...(regAll?.data as any[] || [])]);
          this.registradosSet = new Set(
            regArr.map(t => normCi((t as any).ci)).filter(x => !!x)
          );
          // Construir set por nombre completo normalizado
          const toKey = (s: string) => s
            .normalize('NFD')
            .replace(/\p{Diacritic}+/gu, '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
          const fullNameKey = (o: any) => toKey(`${o?.nombre || ''} ${o?.apellido_p || ''} ${o?.apellido_m || ''}`);
          this.registradosNameSet = new Set(
            regArr.map(t => fullNameKey(t)).filter(x => !!x)
          );

          // Mapa CI -> listas de pertinencias (nombres e ids) provenientes del snapshot de tutores
          const pertMap = new Map<string, { ids: number[]; noms: string[] }>();
          const tutorInfoByCi = new Map<string, TutorReg>();
          const tutorInfoByName = new Map<string, TutorReg>();
          for (const t of regArr) {
            const ciKey = normCi((t as any).ci);
            if (!ciKey) continue;
            const ids = Array.isArray((t as any).pertinencia_ids) ? ((t as any).pertinencia_ids as number[]) : (((t as any).pertinencia_acad_id != null) ? [Number((t as any).pertinencia_acad_id)] : []);
            const noms = Array.isArray((t as any).pertinencias) ? ((t as any).pertinencias as string[]) : (((t as any).pertinencia ? String((t as any).pertinencia).split(',').map((s: string) => s.trim()).filter(Boolean) : []));
            if (ids.length || noms.length) {
              const prev = pertMap.get(ciKey) || { ids: [], noms: [] };
              const newIds = Array.from(new Set([...prev.ids, ...ids]));
              const newNoms = Array.from(new Set([...prev.noms, ...noms]));
              pertMap.set(ciKey, { ids: newIds, noms: newNoms });
            }
            tutorInfoByCi.set(ciKey, t as TutorReg);
            const nameKey = fullNameKey(t);
            if (nameKey) tutorInfoByName.set(nameKey, t as TutorReg);
          }

          // Enriquecer docentes con todas las pertinencias registradas en tutores
          for (const [ciKey, docVal] of map.entries()) {
            const entry = pertMap.get(ciKey);
            if (entry) {
              (docVal as any).pertinencia_ids = entry.ids;
              (docVal as any).pertinencias = entry.noms;
              if (!docVal.pertinencia && entry.noms.length) {
                (docVal as any).pertinencia = entry.noms.join(', ');
              }
            }
            const tutorInfo = tutorInfoByCi.get(ciKey) || tutorInfoByName.get(fullNameKey(docVal));
            if (tutorInfo) {
              (docVal as any).tutor_reg_id = tutorInfo.id;
              (docVal as any).tutor_activo = (tutorInfo.activo ?? true) ? true : false;
              if ((docVal as any).tipo_tutor_id == null && tutorInfo.tipo_tutor_id != null) {
                (docVal as any).tipo_tutor_id = tutorInfo.tipo_tutor_id;
              }
              if (!(docVal as any).tipo_tutor && tutorInfo.tipo_tutor) {
                (docVal as any).tipo_tutor = tutorInfo.tipo_tutor;
              }
              if (!docVal.profesion && (tutorInfo as any).titulo) {
                docVal.profesion = (tutorInfo as any).titulo;
              }
              if (!(docVal as any).titulo_academico && (tutorInfo as any).titulo_academico) {
                (docVal as any).titulo_academico = (tutorInfo as any).titulo_academico;
              }
            } else {
              (docVal as any).tutor_reg_id = undefined;
              (docVal as any).tutor_activo = false;
            }
          }
        } else {
          this.registradosSet = new Set<string>();
          this.registradosNameSet = new Set<string>();
        }

        this.docentes = Array.from(map.values());
        this.tipoSeleccionado = {};
        for (const d of this.docentes) {
          this.setTipoSeleccionado(d.ci, (d as any).tipo_tutor_id ?? null);
        }
        this.docentesLoaded = true;
      },
      error: (err: unknown) => {
        this.loadingDocentes = false;
        const message = err instanceof Error ? err.message : 'Error al cargar docentes';
        this.errorDocentes = message;
        this.docentesLoaded = false;
      }
    });
  }

  editarDocente(doc: Docente) {
    // Abrir modal de edición en lugar de navegar
    this.isCreateMode = false;
    this.editingDocente = {
      id: (doc as any).id,
      nombre: doc.nombre,
      apellido_p: doc.apellido_p,
      apellido_m: doc.apellido_m,
      ci: doc.ci,
      profesion: doc.profesion,
      celular: doc.celular,
      pertinencia: doc.pertinencia || '',
      pertinencia_acad_id: (doc.pertinencia_acad_id ?? null),
      titulo_academico: (doc as any).titulo_academico ?? null,
    } as Partial<Docente>;
    this.editingCiOriginal = (doc.ci || '').toString().trim() || null;
    this.showFieldErrors = false;
    // Inicializar carrera/gestión del modal
    this.modalCarreraCode = this.resolveCarreraPrincipal(doc);
    this.modalGestion = this.gestionActual;
    // cargar pertinencias para la carrera del modal
    this.onModalCarreraChange(this.modalCarreraCode);
    // Inicializar multi-selección con la pertinencia actual (si existe)
    const initPert = (doc as any).pertinencia_acad_id;
    this.selectedPertIds = (initPert != null) ? [Number(initPert)] : [];
    this.pertSearch = '';
    this.pertDropdownOpen = false;
    this.skipFirstPertFocus = true;
    const tipo = this.getTipoSeleccionado(doc.ci) ?? ((doc as any).tipo_tutor_id ?? null);
    this.selectedTipoTutorId = tipo;
    this.modalEditarDocenteVisible = true;
  }

  // Abrir modal en modo creación (Registrar tutor)
  abrirModalRegistrar() {
    this.isCreateMode = true;
    this.editingDocente = {
      nombre: '',
      apellido_p: '',
      apellido_m: '',
      ci: '',
      profesion: '',
      celular: '',
      pertinencia: '',
      pertinencia_acad_id: null
    } as Partial<Docente>;
    // Mostrar placeholder "Seleccione carrera" al abrir
    this.modalCarreraCode = null;
    this.modalGestion = this.gestionActual;
    this.selectedPertIds = [];
    this.pertSearch = '';
    this.pertDropdownOpen = false;
    this.skipFirstPertFocus = true;
    this.selectedTipoTutorId = null;
    this.editingDocente!.titulo_academico = null;
    this.modalEditarDocenteVisible = true;
  }

  cerrarModalEditarDocente() {
    this.modalEditarDocenteVisible = false;
    this.editingDocente = null;
  }

  cerrarModalExito() {
    this.successModalVisible = false;
  }

  guardarDocenteEditado() {
    if (!this.editingDocente) return;
    this.editingSaveError = null;
    this.savingDocente = true;

    // Normalizar entradas
    this.editingDocente.nombre = this.toTitleCase(
      this.sanitizeNameChars(((this.editingDocente.nombre || '') as string).replace(/\s+/g, ' ').trim())
    ) as any;
    this.editingDocente.apellido_p = this.toTitleCase(
      this.sanitizeNameChars(((this.editingDocente.apellido_p || '') as string).replace(/\s+/g, ' ').trim())
    ) as any;
    this.editingDocente.apellido_m = this.toTitleCase(
      this.sanitizeNameChars(((this.editingDocente.apellido_m || '') as string).replace(/\s+/g, ' ').trim())
    ) as any;
    this.editingDocente.celular = ((this.editingDocente.celular || '') as string)
      .replace(/\D/g, '')
      .slice(0, 8) as any;

    const ciKey = (this.editingDocente.ci || '').toString().trim();
    const selectedP = (this.pertinencias || []).filter(p => this.selectedPertIds.includes(p.id));
    const pertNombre = selectedP.map(p => p.nombre_pert).join(', ');
    const primaryPertId = this.selectedPertIds?.[0] ?? null;

    const updated: Docente = {
      ...this.editingDocente,
      ci: ciKey,
      profesion: this.editingDocente.profesion || '',
      titulo_academico: this.editingDocente?.titulo_academico ?? null,
      pertinencia: pertNombre,
      pertinencia_acad_id: primaryPertId as any,
      pertinencia_ids: [...this.selectedPertIds],
      pertinencias: selectedP.map(p => p.nombre_pert),
    } as Docente;

    const prevKey = (this.editingCiOriginal || ciKey) as string;
    const idx = this.docentes.findIndex(d => (d.ci || '').toString().trim() === prevKey);
    if (idx >= 0) {
      this.docentes[idx] = updated;
    } else {
      this.docentes.push(updated);
    }
    this.editingCiOriginal = (updated.ci || '').toString().trim();
    this.setTipoSeleccionado(this.editingCiOriginal, this.selectedTipoTutorId ?? null);

    this.savingDocente = false;
    this.cerrarModalEditarDocente();
    this.successMessage = 'Datos actualizados (pendientes de registro como tutor)';
    this.successModalVisible = true;
  }

  // Helpers de selección
  isSelected(doc: Docente): boolean {
    return !!doc?.ci && this.selectedCis.has(doc.ci);
  }

  toggleSelect(doc: Docente, checked: boolean) {
    if (!doc?.ci) return;
    // No permitir seleccionar si faltan campos requeridos
    if (!this.isDocenteSeleccionable(doc)) {
      return;
    }
    if (checked) this.selectedCis.add(doc.ci); else this.selectedCis.delete(doc.ci);
  }

  get hasSeleccion(): boolean {
    return this.selectedCis.size > 0;
  }

  // Reglas: requiere pertinencia (id o nombre), celular, profesion (título) y ci
  isDocenteSeleccionable(doc: Docente): boolean {
    const hasCi = !!(doc.ci && String(doc.ci).trim());
    const hasTitulo = !!(doc.profesion && String(doc.profesion).trim());
    const hasCelular = !!(doc.celular && String(doc.celular).trim());
    const hasPert = (doc as any).pertinencia_acad_id != null || !!(doc.pertinencia && String(doc.pertinencia).trim());
    const notRegistrado = !this.isRegistradoGestionActual(doc);
    const tipoId = this.getTipoSeleccionado(doc.ci) ?? (doc as any).tipo_tutor_id ?? null;
    const hasTipo = !!tipoId;
    return hasCi && hasTitulo && hasCelular && hasPert && hasTipo && notRegistrado;
  }

  isRegistradoGestionActual(doc: Docente): boolean {
    const norm = (s: string) => s
      .normalize('NFD')
      .replace(/\p{Diacritic}+/gu, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    // Normalizar CI igual que al construir registradosSet (dígitos si existen)
    const s = (doc?.ci == null ? '' : String(doc.ci)).trim().toUpperCase();
    const digits = s.replace(/[^0-9]/g, '');
    const ciKey = digits || s;
    if (ciKey && this.registradosSet.has(ciKey)) return true;
    const nameKey = norm(`${doc?.nombre || ''} ${doc?.apellido_p || ''} ${doc?.apellido_m || ''}`);
    return !!nameKey && this.registradosNameSet.has(nameKey);
  }

  registrarTutores() {
    const seleccionados = this.docentes.filter(d => this.selectedCis.has(d.ci));
    if (!seleccionados.length) return;
    this.bulkError = null;
    const faltanTipo = seleccionados.filter(d => !this.getTipoSeleccionado(d.ci) && !(d as any).tipo_tutor_id);
    if (faltanTipo.length) {
      this.bulkError = 'Seleccione el Tipo de Tutor para todos los docentes marcados.';
      return;
    }
    this.bulkSaving = true;
    const firstCarrera = this.resolveCarreraPrincipal(seleccionados[0]);
    const items = seleccionados.map(d => ({
      ci: (d.ci || '').toString().trim(),
      nombre: d.nombre || '',
      apellido_p: d.apellido_p || '',
      apellido_m: d.apellido_m || '',
      celular: d.celular || '',
      profesion: d.profesion || '',
      titulo: d.profesion || '',
      titulo_academico: (d as any).titulo_academico ?? null,
      cod_carrera: this.resolveCarreraPrincipal(d) ?? firstCarrera ?? undefined,
      pertinencia_acad_id: (d as any).pertinencia_acad_id ?? null,
      pertinencia_acad_ids: (d as any).pertinencia_ids,
      pertinencia: (Array.isArray((d as any).pertinencias) && (d as any).pertinencias.length)
        ? (d as any).pertinencias.join(', ')
        : (d.pertinencia || undefined),
      tipo_tutor_id: this.getTipoSeleccionado(d.ci) ?? (d as any).tipo_tutor_id ?? undefined,
    }));
    this.sga.registerTutoresBulk(items as any).subscribe({
      next: (resp) => {
        this.bulkSaving = false;
        if (resp?.success) {
          const created = (resp as any)?.counts?.created ?? 0;
          const updated = (resp as any)?.counts?.updated ?? 0;
          this.successMessage = `Tutores registrados correctamente. Nuevos: ${created}, Actualizados: ${updated}.`;
          this.successModalVisible = true;
          // Limpiar selección
          this.selectedCis.clear();
          // Marcar inmediatamente como registrados en esta gestión para bloquear re-registro
          for (const d of seleccionados) {
            const ci = (d.ci || '').toString().trim();
            if (!ci) continue;
            this.registradosSet.add(ci);
            d.tutor_activo = true;
          }
          this.buscarDocentes();
        } else {
          this.bulkError = resp?.message || 'No se pudo registrar tutores';
        }
      },
      error: (err) => {
        this.bulkSaving = false;
        this.bulkError = err?.message || 'Error al registrar tutores';
      }
    });
  }

  // =====================
  // Tutores registrados
  // =====================
  toggleRegistrados() {
    this.showRegistrados = !this.showRegistrados;
    if (this.showRegistrados) {
      // Mostrar Registrados -> ocultar panel de importar
      this.showImport = false;
      if (!this.tutorTipos.length) this.loadTutorTipos();
      this.loadTutores();
    }
  }

  loadTutores() {
    this.loadingTutores = true;
    this.errorTutores = null;
    this.tutores = [];
    const params: any = {};
    if (this.carreraFiltroCode) params.carrera = this.carreraFiltroCode;
    this.sga.getTutores(params).subscribe({
      next: (resp) => {
        this.loadingTutores = false;
        if (resp?.success && Array.isArray(resp.data)) {
          const incoming = resp.data as TutorReg[];
          if (this.tutores.length) {
            const byId = new Map<number, TutorReg>();
            for (const existing of this.tutores) {
              if (existing?.id != null) byId.set(existing.id, existing);
            }
            const merged: TutorReg[] = [];
            for (const item of incoming) {
              if (item?.id != null && byId.has(item.id)) {
                const target = byId.get(item.id)!;
                Object.assign(target, item, { activo: !!item.activo });
                merged.push(target);
              } else {
                merged.push({ ...item, activo: !!item.activo });
              }
            }
            this.tutores = merged;
          } else {
            this.tutores = incoming.map(t => ({ ...t, activo: !!t.activo }));
          }
        } else {
          this.tutores = [];
        }
      },
      error: (err) => {
        this.loadingTutores = false;
        this.errorTutores = err?.message || 'Error al cargar tutores';
      }
    });
  }

  private loadTutorTipos() {
    this.sga.getTutorTipos().subscribe({
      next: (resp) => { this.tutorTipos = resp?.data || []; },
      error: () => { this.tutorTipos = []; }
    });
  }

  getPertListFromString(value?: string | null): string[] {
    if (!value) return [];
    return value.split(',').map(p => p.trim()).filter(p => !!p);
  }

  canEnableTutor(t: TutorReg): boolean {
    const hasTipo = !!t.tipo_tutor_id;
    const hasPert = (t.pertinencia_acad_id != null) || ((t.pertinencia_ids || []).length > 0) || !!(t.pertinencia && String(t.pertinencia).trim());
    return hasTipo && hasPert;
  }

  onToggleActivo(t: TutorReg, checked: boolean) {
    this.pendingDisableDocente = null;
    if (checked) {
      // Si se intenta habilitar sin datos completos, revertir
      if (!this.canEnableTutor(t)) {
        this.errorTutores = 'No se puede habilitar: requiere Tipo de Tutor y Pertinencia académica';
        // Revertir visualmente en el próximo ciclo de cambio de detección
        setTimeout(() => { t.activo = false; }, 0);
        return;
      }
      this.sga.toggleTutor(t.id, true).subscribe({
        next: (resp) => {
          if (resp?.success && resp.data) {
            t.activo = !!resp.data.activo;
          }
        },
        error: (err) => {
          this.errorTutores = err?.message || 'No se pudo cambiar el estado del tutor';
        }
      });
      return;
    }

    // Confirmar antes de deshabilitar
    this.errorTutores = null;
    this.pendingDisableTutor = t;
    this.pendingDisableDocente = null;
    this.confirmDisableModalVisible = true;
    // Mantener switch activado hasta confirmar
    setTimeout(() => { t.activo = true; }, 0);
  }

  onToggleDocenteActivo(event: Event, doc: Docente) {
    const input = event.target as HTMLInputElement | null;
    const checked = input?.checked ?? false;

    if (!doc.tutor_reg_id) {
      this.errorDocentes = 'No se pudo determinar el tutor registrado para este docente.';
      if (input) input.checked = !!doc.tutor_activo;
      return;
    }

    if (checked) {
      this.sga.toggleTutor(doc.tutor_reg_id, true).subscribe({
        next: (resp) => {
          if (resp?.success && resp.data) {
            doc.tutor_activo = !!resp.data.activo;
            if (input) input.checked = doc.tutor_activo;
          } else {
            doc.tutor_activo = false;
            if (input) input.checked = false;
            this.errorDocentes = 'No se pudo habilitar al tutor';
          }
        },
        error: (err) => {
          doc.tutor_activo = false;
          if (input) input.checked = false;
          this.errorDocentes = err?.message || 'Error al habilitar tutor';
        }
      });
      return;
    }

    // Intento de deshabilitar: revertir visualmente hasta confirmar
    if (input) input.checked = true;
    doc.tutor_activo = true;
    this.errorDocentes = null;
    this.pendingDisableDocente = doc;
    this.pendingDisableTutor = null;
    this.confirmDisableModalVisible = true;
  }

  confirmarDeshabilitarTutor() {
    if (this.pendingDisableDocente) {
      const doc = this.pendingDisableDocente;
      this.disableTutorSaving = true;
      this.sga.toggleTutor(doc.tutor_reg_id!, false).subscribe({
        next: (resp) => {
          this.disableTutorSaving = false;
          this.confirmDisableModalVisible = false;
          this.pendingDisableDocente = null;
          if (resp?.success && resp.data) {
            doc.tutor_activo = !!resp.data.activo;
            if (!doc.tutor_activo) {
              this.successMessage = 'Tutor deshabilitado.';
              this.successModalVisible = true;
            } else {
              doc.tutor_activo = true;
            }
          } else {
            doc.tutor_activo = true;
            this.errorDocentes = 'No se pudo deshabilitar al tutor';
          }
        },
        error: (err) => {
          this.disableTutorSaving = false;
          this.confirmDisableModalVisible = false;
          doc.tutor_activo = true;
          this.errorDocentes = err?.message || 'Error al deshabilitar tutor';
          this.pendingDisableDocente = null;
        }
      });
      this.pendingDisableTutor = null;
      return;
    }

    if (!this.pendingDisableTutor) {
      this.cancelarDeshabilitarTutor();
      return;
    }
    const tutor = this.pendingDisableTutor;
    this.disableTutorSaving = true;
    this.sga.toggleTutor(tutor.id, false).subscribe({
      next: (resp) => {
        this.disableTutorSaving = false;
        this.confirmDisableModalVisible = false;
        this.pendingDisableTutor = null;
        if (resp?.success && resp.data) {
          tutor.activo = !!resp.data.activo;
          this.successMessage = 'Tutor deshabilitado.';
          this.successModalVisible = true;
        } else {
          tutor.activo = true;
          this.errorTutores = 'No se pudo deshabilitar al tutor';
        }
      },
      error: (err) => {
        this.disableTutorSaving = false;
        this.confirmDisableModalVisible = false;
        this.errorTutores = err?.message || 'Error al deshabilitar tutor';
        if (this.pendingDisableTutor) {
          this.pendingDisableTutor.activo = true;
        }
        this.pendingDisableTutor = null;
      }
    });
  }

  cancelarDeshabilitarTutor() {
    if (this.pendingDisableTutor) {
      this.pendingDisableTutor.activo = true;
    }
    if (this.pendingDisableDocente) {
      this.pendingDisableDocente.tutor_activo = true;
    }
    this.pendingDisableTutor = null;
    this.pendingDisableDocente = null;
    this.confirmDisableModalVisible = false;
    this.disableTutorSaving = false;
  }

  tipoTutorNombre(t: TutorReg): string | null {
    if (!t) return null;
    if (t.tipo_tutor && typeof t.tipo_tutor === 'string') {
      return t.tipo_tutor;
    }
    if ((t as any)?.tipo_tutor?.nombre) {
      return String((t as any).tipo_tutor.nombre);
    }
    if (t.tipo_tutor_id != null) {
      const found = this.tutorTipos.find(tt => tt.id === t.tipo_tutor_id);
      if (found?.nombre) return found.nombre;
    }
    return null;
  }

  onEnableDocenteClick(doc: Docente) {
    if (!doc.tutor_reg_id) return;
    this.disableTutorSaving = true;
    this.sga.toggleTutor(doc.tutor_reg_id, true).subscribe({
      next: (resp) => {
        this.disableTutorSaving = false;
        if (resp?.success && resp.data) {
          doc.tutor_activo = !!resp.data.activo;
        } else {
          doc.tutor_activo = false;
          this.errorDocentes = 'No se pudo habilitar al tutor';
        }
      },
      error: (err) => {
        this.disableTutorSaving = false;
        doc.tutor_activo = false;
        this.errorDocentes = err?.message || 'Error al habilitar tutor';
      }
    });
  }

  onDisableDocenteClick(doc: Docente) {
    if (!doc.tutor_reg_id) return;
    this.errorDocentes = null;
    this.pendingDisableDocente = doc;
    this.pendingDisableTutor = null;
    this.confirmDisableModalVisible = true;
  }

  onTipoTutorChange(t: TutorReg, tipoId: number) {
    this.sga.updateTutor(t.id, { tipo_tutor_id: tipoId }).subscribe({
      next: (resp) => {
        if (resp?.success && resp.data) {
          t.tipo_tutor_id = tipoId;
          const found = this.tutorTipos.find(x => x.id === tipoId);
          t.tipo_tutor = found ? found.nombre : undefined;
        }
      },
      error: (err) => {
        this.errorTutores = err?.message || 'No se pudo actualizar el tipo de tutor';
      }
    });
  }

  // Gestión actual (1/YYYY o 2/YYYY) igual que backend (mes >= 7 -> 2)
  get gestionActual(): string {
    const now = new Date();
    const periodo = (now.getMonth() + 1) >= 7 ? '2' : '1';
    return `${periodo}/${now.getFullYear()}`;
  }

  // Gestión alterna del mismo año (si actual es 1/AAAA => 2/AAAA, y viceversa)
  get gestionAlternaActual(): string {
    const [periodo, anio] = this.gestionActual.split('/');
    const alt = periodo === '1' ? '2' : '1';
    return `${alt}/${anio}`;
  }

  onGestionFiltroChange(_: any) {
    if (this.showRegistrados) this.loadTutores();
  }

  onCarreraFiltroChange(_: any) {
    if (this.showRegistrados) this.loadTutores();
  }

  // Cambiar carrera dentro del modal y recargar pertinencias
  onModalCarreraChange(code: string | null) {
    // Limpiar selección de pertinencia para evitar inconsistencia
    if (this.editingDocente) this.editingDocente.pertinencia_acad_id = null;
    this.selectedPertIds = [];
    let carreraStr: 'mecanica' | 'electricidad' | undefined = undefined;
    if (code === 'MEA') carreraStr = 'mecanica';
    if (code === 'EEA') carreraStr = 'electricidad';
    if (!carreraStr) {
      this.pertinencias = [];
      return;
    }
    this.sga.getPertinencias(carreraStr).subscribe({
      next: (resp) => {
        if (resp?.success) this.pertinencias = resp.data || []; else this.pertinencias = [];
        // abrir el dropdown al cargar opciones
        this.pertDropdownOpen = true;
      },
      error: () => { this.pertinencias = []; }
    });
  }
}
