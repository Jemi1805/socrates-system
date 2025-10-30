import { Component, OnInit, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { SgaService, Docente, ApiResponse, Pertinencia, TutorReg, TutorTipo, Convocatoria, TutorDesignacionItem } from '../../../shared/services/sga.service';
import { PdfService } from '../../../shared/services/pdf.service';
import { AuthService } from '../../../core/services/auth.service';
import { forkJoin } from 'rxjs';

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
  carreraSeleccionada: 'mecanica' | 'electricidad' | null = null;
  docentes: Docente[] = [];
  loadingDocentes = false;
  errorDocentes: string | null = null;
  // Selección múltiple por checkbox (clave: ci)
  selectedCis: Set<string> = new Set<string>();
  // Modal de edición de docente
  modalEditarDocenteVisible: boolean = false;
  editingDocente: Partial<Docente> | null = null;
  isCreateMode: boolean = false;
  // Controles del modal
  modalCarreraCode: string | null = null; // 'MEA' | 'EEA'
  modalGestion: string | null = null;     // 1/YYYY o 2/YYYY (solo visual)
  editingCiOriginal: string | null = null; // para permitir cambio de CI
  showFieldErrors: boolean = false;        // activa estilos is-invalid
  // Pertinencias académicas filtradas por carrera
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
  carreraFiltroCode: string | null = null;
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

  constructor(private sga: SgaService, private router: Router, private pdfService: PdfService, private auth: AuthService) {}

  ngOnInit(): void {
    this.loadPertinencias();
    this.loadTutorTipos();
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

  async generarPdfDesignado(item: TutorDesignacionItem) {
    if (!item || this.generatingDesignadoId === item.tutor_id) {
      return;
    }
    this.generatingDesignadoId = item.tutor_id;
    try {
      const estudiantes = item.estudiantes || [];
      const firstEst = estudiantes[0] || {} as any;
      const estudianteNombre = estudiantes.length === 1
        ? (firstEst.estudiante_nombre || 'Estudiante asignado')
        : estudiantes.map(e => e.estudiante_nombre).filter(Boolean).join(', ') || 'Estudiantes asignados';
      const estudianteCodigo = estudiantes.length === 1 ? (firstEst.cod_ceta ? String(firstEst.cod_ceta) : undefined) : undefined;
      const proyectoNombre = estudiantes.length === 1 ? (firstEst.proyecto_nombre || undefined) : undefined;
      const fechaDesignacion = estudiantes.length === 1 ? (firstEst.fecha_designacion || undefined) : undefined;
      const user = this.auth.getUser();
      const userNombre = user?.nombre_usuario
        || [user?.nombre, user?.apellido_p, user?.apellido_m].filter(Boolean).join(' ').trim()
        || user?.email
        || undefined;

      await this.pdfService.generarDesignacionTutorPdf({
        tutorNombre: item.tutor_nombre,
        tutorTipo: item.tipo_tutor_nombre || undefined,
        tutorCi: item.tutor_ci || undefined,
        tutorCelular: item.tutor_celular || undefined,
        area: item.tutor_titulo || undefined,
        estudianteNombre,
        estudianteCodigo,
        carrera: item.carrera_nombre || item.cod_carrera || undefined,
        proyectoNombre,
        convocatoria: item.convocatoria_label || undefined,
        fecha: fechaDesignacion,
        lugar: 'Cochabamba',
        numeroDocumento: item.numero_documento || undefined,
        cite: item.cite || undefined,
        elaboradoPor: userNombre,
        cargoElaborador: 'Responsable de Modalidad de Graduación',
        observaciones: estudiantes.length > 1
          ? `Se asigna la tutoría para ${estudiantes.length} estudiantes bajo la responsabilidad del tutor indicado.`
          : undefined,
      }, {
        fileName: `designacion-${item.tutor_nombre.replace(/\s+/g, '-').toLowerCase()}.pdf`
      });
    } catch (err) {
      console.error('Error generando PDF de designado:', err);
      alert('No se pudo generar el documento PDF para este tutor.');
    } finally {
      this.generatingDesignadoId = null;
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

  onCarreraChange(_: any) {
    this.loadPertinencias();
    if (this.editingDocente) {
      this.editingDocente.pertinencia_acad_id = null;
    }
    // Si se está mostrando la lista de tutores, recargar con el nuevo filtro
    if (this.showRegistrados) {
      this.loadTutores();
    }
  }

  private loadPertinencias() {
    if (!this.carreraSeleccionada) {
      this.pertinencias = [];
      return;
    }
    this.sga.getPertinencias(this.carreraSeleccionada).subscribe({
      next: (resp) => {
        if (resp?.success) {
          this.pertinencias = resp.data || [];
        } else {
          this.pertinencias = [];
        }
      },
      error: () => {
        this.pertinencias = [];
      }
    });
  }

  toggleImportar() {
    const newVal = !this.showImport;
    this.showImport = newVal;
    if (newVal) {
      // Mostrar Importar -> ocultar panel de registrados
      this.showRegistrados = false;
      this.showDesignados = false;
    } else {
      // Limpia estado al ocultar
      this.errorDocentes = null;
    }
  }

  buscarDocentes() {
    if (!this.carreraSeleccionada) {
      this.errorDocentes = 'Seleccione la carrera';
      return;
    }
    this.errorDocentes = null;
    this.loadingDocentes = true;
    this.docentes = [];
    const params: any = { };
    // Para calcular el estado "Registrado", no filtramos por carrera, solo por gestión
    params.gestion = this.gestionActual;
    forkJoin({
      sga: this.sga.getDocentes(this.carreraSeleccionada),
      // Traer SOLO los locales de la carrera seleccionada
      local: this.sga.getDocentesLocales(this.carreraSeleccionada),
      // Dos consultas de tutores: gestión actual, alterna y sin filtro (cualquier gestión)
      reg: this.sga.getTutores({ gestion: this.gestionActual }),
      regAlt: this.sga.getTutores({ gestion: this.gestionAlternaActual }),
      regAll: this.sga.getTutores()
    }).subscribe({
      next: ({ sga, local, reg, regAlt, regAll }) => {
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
      },
      error: (err) => {
        this.loadingDocentes = false;
        this.errorDocentes = err?.message || 'Error al cargar docentes';
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
    const codSel = this.carreraSeleccionadaCodigo;
    this.modalCarreraCode = (codSel === 'MEA' || codSel === 'EEA') ? codSel : 'MEA';
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

  // Código de carrera (MEA/EEA) para UI
  get carreraSeleccionadaCodigo(): string {
    if (this.carreraSeleccionada === 'mecanica') return 'MEA';
    if (this.carreraSeleccionada === 'electricidad') return 'EEA';
    return '—';
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
    const codCarr = (this.carreraSeleccionada && this.carreraSeleccionadaCodigo !== '—') ? this.carreraSeleccionadaCodigo : undefined;
    const items = seleccionados.map(d => ({
      ci: (d.ci || '').toString().trim(),
      nombre: d.nombre || '',
      apellido_p: d.apellido_p || '',
      apellido_m: d.apellido_m || '',
      celular: d.celular || '',
      profesion: d.profesion || '',
      titulo: d.profesion || '',
      titulo_academico: (d as any).titulo_academico ?? null,
      cod_carrera: codCarr,
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
      // Inicializar carrera por defecto al abrir el panel
      if (!this.carreraFiltroCode || this.carreraFiltroCode === '—') {
        const codSel = this.carreraSeleccionadaCodigo;
        this.carreraFiltroCode = (codSel === 'MEA' || codSel === 'EEA') ? codSel : 'MEA';
      }
      if (!this.tutorTipos.length) this.loadTutorTipos();
      this.loadTutores();
    }
  }

  loadTutores() {
    this.loadingTutores = true;
    this.errorTutores = null;
    this.tutores = [];
    const params: any = {};
    const codigo = this.carreraFiltroCode || (this.carreraSeleccionadaCodigo !== '—' ? this.carreraSeleccionadaCodigo : undefined);
    if (codigo) params.carrera = codigo;
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
