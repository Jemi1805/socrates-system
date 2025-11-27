import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { SgaService, Pertinencia, TutorReg, Convocatoria, InscripModalidad, ApiResponse } from '../../../shared/services/sga.service';
import { ProyectoService } from '../proyectos/proyecto.service';
import { PostulanteService } from '../postulantes/postulante.service';
import { LoadingService } from '../../../core/services/loading.service';
import { AuthService } from '../../../core/services/auth.service';
import { PdfService } from '../../../shared/services/pdf.service';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-designar-tutor',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent, RouterModule],
  templateUrl: './designar-tutor.component.html',
  styleUrls: ['./designar-tutor.component.scss']
})
export class DesignarTutorComponent implements OnInit {
  @Input() modalidadSeleccionadaNombre?: string | null;

  // Contexto del estudiante y proyecto
  estudiante: any = null;
  proyecto: any = null;
  codCeta: string | null = null;
  carreraKey: 'mecanica' | 'electricidad' | null = null;
  inscripcion: InscripModalidad | null = null;
  private inscripcionFetchCod: number | null = null;

  // Áreas (pertinencias)
  areas: Pertinencia[] = [];
  selectedAreaIds: number[] = [];

  // Tutores
  loadingTutores = false;
  tutores: TutorReg[] = [];
  filteredTutores: TutorReg[] = [];

  // UI State
  isSaving = false;
  showSuccessModal = false;
  showConfirmModal = false;
  selectedTutor: TutorReg | null = null;
  lastDesignation: any = null;
  showResumenDesignacion = true;
  showSeleccionTutores = true;
  convocatorias: Convocatoria[] = [];
  selectedConvocatoriaId: number | null = null;
  confirmConvocatoriaNombre: string | null = null;
  confirmConvocatoriaInicio: string | Date | null = null;
  confirmConvocatoriaFin: string | Date | null = null;
  confirmArea: string | null = null;
  tutorPertinenciaIds: number[] = [];
  selectedPertinenciaId: number | null = null;
  generatingPdf = false;

  private normalizeModalidad(value: any): string | undefined {
    if (value === null || value === undefined) return undefined;
    const text = String(value).replace(/\s+/g, ' ').trim();
    if (!text.length) return undefined;
    return text;
  }

  private carreraNombreFromAny(value?: string | null): string | undefined {
    const raw = (value == null ? '' : String(value)).trim();
    if (!raw) return undefined;
    const upper = raw.toUpperCase();
    if (upper === 'EEA') return 'Electricidad y Electrónica Automotriz';
    if (upper === 'MEA') return 'Mecánica Automotriz';
    if (upper === 'EEA/MEA' || upper === 'MEA/EEA') return undefined; // no mostrar combinaciones
    const norm = raw
      .normalize('NFD')
      .replace(/\p{Diacritic}+/gu, '')
      .toLowerCase();
    const hasElec = /\belect|\beea/.test(norm);
    const hasMec = /\bmec|\bmea/.test(norm);
    if (hasElec && hasMec) return undefined; // ambiguo -> forzar fallback
    if (hasElec && !hasMec) return 'Electricidad y Electrónica Automotriz';
    if (hasMec && !hasElec) return 'Mecánica Automotriz';
    return raw; // ya descriptivo
  }

  private resolveCarreraPreferidaDesignar(...candidates: Array<any>): string | undefined {
    for (const v of candidates) {
      if (v === null || v === undefined) continue;
      const mapped = this.carreraNombreFromAny(v);
      if (mapped && mapped.toString().trim().length) return mapped;
      const upper = String(v).trim().toUpperCase();
      if (upper === 'EEA' || upper === 'MEA') {
        const full = this.carreraNombreFromAny(upper);
        if (full) return full;
      }
    }
    return undefined;
  }

  private isGenericProyectoDeGrado(value: string): boolean {
    return /proyecto\s+de\s+grado/i.test(value);
  }

  private pickModalidadCandidate(values: Array<any>): string | undefined {
    let fallbackProyecto: string | undefined;
    for (const raw of values) {
      const normalized = this.normalizeModalidad(raw);
      if (!normalized) continue;
      if (!this.isGenericProyectoDeGrado(normalized)) {
        return normalized;
      }
      if (!fallbackProyecto) {
        fallbackProyecto = normalized;
      }
    }
    return fallbackProyecto;
  }

  private getTemaModalidad(tema?: any): string | undefined {
    if (!tema) return undefined;
    const direct = this.pickModalidadCandidate([
      tema?.modalidad,
      tema?.modalidad_nombre,
      tema?.modalidadNombre,
      tema?.modalidad_inscrita,
      tema?.tipo,
      tema?.modalidad_tipo,
      tema?.modalidadGraduacion,
      tema?.modalidadGraduacionNombre,
    ]);
    if (direct) return direct;

    if (tema?.modalidad_objeto && typeof tema.modalidad_objeto === 'object') {
      const nested = this.getTemaModalidad(tema.modalidad_objeto);
      if (nested) return nested;
    }
    if (tema?.modalidad_detalle && typeof tema.modalidad_detalle === 'object') {
      const nestedDetalle = this.getTemaModalidad(tema.modalidad_detalle);
      if (nestedDetalle) return nestedDetalle;
    }
    if (Array.isArray(tema?.modalidades) && tema.modalidades.length) {
      const listCandidates = tema.modalidades.map((m: any) => {
        if (typeof m === 'string') return m;
        if (!m) return undefined;
        return m.nombre || m.modalidad || m.tipo || m.descripcion;
      });
      const fromList = this.pickModalidadCandidate(listCandidates);
      if (fromList) return fromList;
    }
    return undefined;
  }

  private resolveEstudianteModalidad(est: any, modalidadGeneral?: string): string | undefined {
    if (!est) return this.normalizeModalidad(modalidadGeneral);
    const tema = est.tema_registro || est.temaDetalle || est.tema || est.proyecto;
    return this.pickModalidadCandidate([
      est.modalidad,
      est.modalidad_nombre,
      est.modalidadNombre,
      est.modalidad_inscrita,
      this.getTemaModalidad(tema),
      modalidadGeneral,
    ]);
  }

  private resolveModalidad(): string | undefined {
    const temaActual = this.proyecto
      || this.lastDesignation?.tema_registro
      || (this.estudiante as any)?.tema_registro
      || (this.estudiante as any)?.tema
      || (this.lastDesignation as any)?.tema
      || (this.lastDesignation as any)?.temaDetalle
      || (this.lastDesignation as any)?.tema_registro_detalle
      || null;

    const primary = this.pickModalidadCandidate([
      this.getTemaModalidad(temaActual),
      this.modalidadSeleccionadaNombre,
      (this.proyecto as any)?.tipo,
      (this.proyecto as any)?.modalidad,
      (this.proyecto as any)?.modalidad_nombre,
      (this.proyecto as any)?.modalidadNombre,
      (this.proyecto as any)?.modalidad_inscrita,
      this.estudiante?.modalidad,
      (this.estudiante as any)?.modalidad_nombre,
      this.inscripcion ? (this.inscripcion as any)?.modalidad : undefined,
      this.inscripcion ? (this.inscripcion as any)?.modalidad_nombre : undefined,
      this.inscripcion ? (this.inscripcion as any)?.modalidad_descripcion : undefined,
    ]);
    if (primary) return primary;

    return this.pickModalidadCandidate([
      this.lastDesignation?.modalidad,
      this.lastDesignation?.modalidad_nombre,
      this.lastDesignationEstudiantes()?.[0]?.modalidad,
    ]);
  }

  get modalidadNombre(): string | undefined {
    return this.resolveModalidad();
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sga: SgaService,
    private proyectoService: ProyectoService,
    private postulanteService: PostulanteService,
    private loadingService: LoadingService,
    private auth: AuthService,
    private pdfService: PdfService,
  ) {}

  ngOnInit(): void {
    this.auth.me().subscribe({
      error: () => {}
    });
    // Recuperar contexto de sessionStorage si existe
    try {
      const dp = sessionStorage.getItem('datos_postulacion');
      if (dp) {
        const parsed = JSON.parse(dp);
        this.estudiante = parsed?.estudiante || null;
        this.inscripcion = (parsed?.inscripcion as InscripModalidad) || null;
        if (!this.inscripcion) {
          const ins = (this.estudiante as any)?.inscripcion
            || parsed?.inscripcion_modalidad
            || parsed?.inscripcionModalidad
            || parsed?.inscripcionModalidadActual;
          if (ins) {
            this.inscripcion = ins as InscripModalidad;
          }
        }
        if (this.estudiante && this.inscripcion) {
          this.estudiante = { ...this.estudiante, inscripcion: this.inscripcion };
        }
        // No restaurar lastDesignation desde sesión; solo el backend decide si existe designación para este postulante
        this.lastDesignation = null;
      }
      // Ya no se restaura un proyecto_cache global para evitar mostrar el tema de otro postulante.
      this.proyecto = null;
    } catch {}

    if (this.lastDesignation) {
      this.showResumenDesignacion = true;
    } else {
      this.showResumenDesignacion = false;
    }
    // Siempre permitir ver y seleccionar tutores, incluso si ya hay una designación previa
    this.showSeleccionTutores = true;

    // Tomar query params (cod_ceta, carrera)
    this.route.queryParamMap.subscribe(params => {
      const cod = params.get('cod_ceta');
      const carr = params.get('carrera');
      // Cada vez que cambia cod_ceta, limpiar proyecto para evitar arrastrar el tema de otro postulante
      this.codCeta = cod;
      this.proyecto = null;
      this.carreraKey = this.normalizeCarreraKey(carr || (this.estudiante?.carrera || this.estudiante?.carrera_nombre)) || 'mecanica';

      // Si la designación guardada pertenece a otro cod_ceta, limpiarla para no arrastrar datos
      const currentCod = (this.codCeta || this.estudiante?.cod_ceta || '').toString().trim();
      const lastCod = (this.lastDesignation?.cod_ceta || '').toString().trim();
      if (currentCod && lastCod && currentCod !== lastCod) {
        this.lastDesignation = null;
        this.showResumenDesignacion = false;
        this.showSeleccionTutores = true;
        this.persistLastDesignation(null);
      }

      const codNumeric = cod ? Number(cod) : this.estudiante?.cod_ceta ? Number(this.estudiante.cod_ceta) : null;
      this.fetchInscripcionForCod(codNumeric);

      // Rehidratar SIEMPRE los datos del postulante desde backend para el cod_ceta actual
      if (codNumeric && Number.isFinite(codNumeric)) {
        this.postulanteService.getById(codNumeric as any).subscribe({
          next: (p: any) => {
            if (!p) return;
            const nombres = (p.nombres_est || p.nombres || '').toString().trim();
            const apPat = (p.ap_pat || '').toString().trim();
            const apMat = (p.ap_mat || '').toString().trim();
            const carrera = ((p as any).carrera_nombre || p.carrera || '').toString();
            this.estudiante = {
              cod_ceta: cod,
              nombres,
              ap_pat: apPat,
              ap_mat: apMat,
              ci: (p.ci || '').toString(),
              carrera,
              pensum: (p as any).pensum,
            };
            try {
              const raw = sessionStorage.getItem('datos_postulacion');
              const datos = raw ? JSON.parse(raw) : {};
              datos.estudiante = { ...(datos.estudiante || {}), ...this.estudiante };
              sessionStorage.setItem('datos_postulacion', JSON.stringify(datos));
            } catch {}
          },
          error: () => {},
        });
      }

      // Completar/recuperar designación real desde backend (tabla designacion_tutor)
      this.loadLastDesignationFromBackend(this.codCeta || (this.estudiante?.cod_ceta ? String(this.estudiante.cod_ceta) : null));

      // Cargar siempre el proyecto correspondiente al cod_ceta actual
      if (cod) {
        this.proyectoService.getByCod(cod).subscribe({ next: (res) => {
          this.proyecto = (Array.isArray(res?.data) ? res.data[0] : (res?.data || res)) || null;
        }, error: () => { this.proyecto = null; } });
      } else {
        this.proyecto = null;
      }
      // Cargar áreas (pertinencias) y tutores
      this.loadAreas();
      this.loadTutores();
      this.loadConvocatorias();
    });
  }

  private loadLastDesignationFromBackend(cod: string | null) {
    const codStr = (cod || '').toString().trim() || (this.estudiante?.cod_ceta ? String(this.estudiante.cod_ceta) : '');
    if (!codStr) {
      return;
    }
    this.sga.getTutoresDesignados({ cod_ceta: codStr }).subscribe({
      next: (resp) => {
        const base: any = (resp as any)?.data ?? resp;
        const rows: any[] = Array.isArray(base) ? base : Array.isArray(base?.data) ? base.data : [];
        if (!Array.isArray(rows) || !rows.length) return;
        const item: any = rows[0];

        // Si ya hay lastDesignation en sesión, solo completar campos vacíos
        if (this.lastDesignation) {
          if (!this.lastDesignation.convocatoria_nom && (item as any).convocatoria_label) {
            this.lastDesignation.convocatoria_nom = (item as any).convocatoria_label;
          }
          if (!this.lastDesignation.area && (item as any).area) {
            this.lastDesignation.area = (item as any).area;
          }
          if (!this.lastDesignation.tutor_nombre && (item as any).tutor_nombre) {
            this.lastDesignation.tutor_nombre = (item as any).tutor_nombre;
          }
        } else {
          // Crear una designación mínima para mostrar en el resumen
          this.lastDesignation = {
            tutor_nombre: (item as any).tutor_nombre || null,
            area: (item as any).area || null,
            convocatoria_nom: (item as any).convocatoria_label || null,
            cod_ceta: codStr,
          };
        }

        if (this.lastDesignation?.convocatoria_nom) {
          this.confirmConvocatoriaNombre = this.lastDesignation.convocatoria_nom;
        }

        // Mostrar el resumen si hay una designación válida, pero mantener la lista de tutores disponible
        if (this.lastDesignation && (this.lastDesignation.tutor_nombre || this.lastDesignation.convocatoria_nom)) {
          this.showResumenDesignacion = true;
        }
      },
      error: () => {
        // En caso de error, mantener el estado actual sin romper otras funcionalidades
      },
    });
  }

  private loadConvocatorias() {
    this.sga.getConvocatoriasActivas({ per_page: 100 }).subscribe({
      next: (list) => {
        this.convocatorias = Array.isArray(list) ? list : [];
        this.syncSelectedConvocatoriaWithConvocatorias();
      },
      error: () => {
        this.convocatorias = [];
      }
    });
  }

  private inscripcionConvocatoriaIdFromStorage(): number | null {
    try {
      const raw = sessionStorage.getItem('datos_postulacion');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const ins = parsed?.inscripcion
        || parsed?.inscripcion_modalidad
        || parsed?.inscripcionModalidad
        || parsed?.inscripcionModalidadActual
        || (parsed?.estudiante && parsed.estudiante.inscripcion);
      if (ins && ins.convocatoria_id) return Number(ins.convocatoria_id);
      const conv = parsed?.convocatoria_id ?? parsed?.convocatoriaId
        ?? parsed?.convocatoria?.id ?? parsed?.convocatoria?.convocatoria_id;
      if (conv) return Number(conv);
      return null;
    } catch {
      return null;
    }
  }

  // Cargar pertinencias por carrera (renombradas como Áreas)
  private loadAreas() {
    const key = this.carreraKey;
    if (!key) { this.areas = []; return; }
    this.sga.getPertinencias(key).subscribe({
      next: (resp) => { this.areas = resp?.data || []; },
      error: () => { this.areas = []; }
    });
  }

  // Cargar tutores registrados (de la carrera)
  private loadTutores() {
    this.loadingTutores = true;
    const target = this.carreraKeyToCode(this.carreraKey);
    this.sga.getTutores().subscribe({
      next: (resp) => {
        this.loadingTutores = false;
        const list = Array.isArray(resp?.data) ? resp.data : [];
        const toCode = (raw: any): 'EEA' | 'MEA' | 'EEA/MEA' | null => {
          const s = (raw || '').toString().trim().toUpperCase();
          if (!s) return null;
          if (s.includes('/')) {
            const parts = s.split('/').map((p: string) => p.trim());
            const mapped = parts.map((p: string) => toCode(p)).filter(Boolean) as Array<'EEA'|'MEA'|'EEA/MEA'>;
            if (mapped.includes('EEA/MEA')) return 'EEA/MEA';
            const hasE = mapped.includes('EEA');
            const hasM = mapped.includes('MEA');
            if (hasE && hasM) return 'EEA/MEA';
            return mapped[0] ?? null;
          }
          const hasMea = /MEA|MECANICA/.test(s);
          const hasEea = /EEA|ELECTRICIDAD/.test(s);
          if (hasMea && hasEea) return 'EEA/MEA';
          if (hasEea) return 'EEA';
          if (hasMea) return 'MEA';
          return null;
        };
        const filtered = list.filter((t: any) => {
          if (!target) return true;
          const code = toCode(t?.cod_carrera || t?.carrera || t?.carrera_nombre);
          if (code === 'EEA/MEA') return true; // tutor multi-carrera disponible para ambas
          return code === target;
        });
        this.tutores = filtered;
        this.applyFilter();
      },
      error: () => {
        this.loadingTutores = false;
        this.tutores = [];
        this.filteredTutores = [];
      }
    });
  }

  public onAreasChange() {
    this.applyFilter();
  }

  private applyFilter() {
    const sel = new Set((this.selectedAreaIds || []).map(Number));
    if (!sel.size) {
      this.filteredTutores = [...this.tutores];
      return;
    }
    this.filteredTutores = (this.tutores || []).filter(t => {
      const ids: number[] = (Array.isArray((t as any).pertinencia_ids) && (t as any).pertinencia_ids.length
        ? (t as any).pertinencia_ids.map((x: any) => Number(x))
        : (((t as any).pertinencia_acad_id != null) ? [Number((t as any).pertinencia_acad_id)] : [])) as number[];
      return ids.some((id: number) => sel.has(Number(id)));
    });
  }

  // Helpers
  private normalizeCarreraKey(v: any): 'mecanica' | 'electricidad' | null {
    const s = (v || '').toString().toLowerCase();
    if (!s) return null;
    if (s === 'mea' || s.includes('mecánica') || s.includes('mecanica')) return 'mecanica';
    if (s === 'eea' || s.includes('electricidad') || s.includes('electrónica') || s.includes('electronica')) return 'electricidad';
    return null;
  }

  private carreraKeyToCode(k: 'mecanica' | 'electricidad' | null): string | undefined {
    if (k === 'mecanica') return 'MEA';
    if (k === 'electricidad') return 'EEA';
    return undefined;
  }

  private fetchInscripcionForCod(cod: number | null) {
    if (!cod) {
      this.syncSelectedConvocatoriaWithConvocatorias();
      return;
    }
    if (this.inscripcionFetchCod === cod && this.inscripcion) {
      this.syncSelectedConvocatoriaWithConvocatorias();
      return;
    }
    this.inscripcionFetchCod = cod;
    this.sga.getInscripModalidadByPostulante(cod).subscribe({
      next: (resp: ApiResponse<InscripModalidad[]>) => {
        const base = resp?.data ?? resp;
        const list = Array.isArray(base) ? base : Array.isArray((base as any)?.data) ? (base as any).data : [];
        if (Array.isArray(list) && list.length) {
          const active = list.find((item: any) => String(item?.estado || '').toLowerCase() === 'inscrito')
            || list.find((item: any) => item?.es_activo)
            || list[0];
          if (active) {
            this.inscripcion = active as InscripModalidad;
            const convId = (active as any)?.convocatoria_id ?? (active as any)?.convocatoriaId;
            if (convId) {
              this.selectedConvocatoriaId = Number(convId);
            }
            if (this.estudiante) {
              const currentIns = (this.estudiante as any).inscripcion || {};
              this.estudiante = { ...this.estudiante, inscripcion: { ...currentIns, ...active } };
            }
          }
        }
        this.syncSelectedConvocatoriaWithConvocatorias();
      },
      error: () => {
        this.syncSelectedConvocatoriaWithConvocatorias();
      }
    });
  }

  private syncSelectedConvocatoriaWithConvocatorias() {
    const candidate = this.selectedConvocatoriaId
      ?? (this.inscripcion as any)?.convocatoria_id
      ?? (this.estudiante as any)?.inscripcion?.convocatoria_id
      ?? this.inscripcionConvocatoriaIdFromStorage();

    if (candidate) {
      const matched = this.convocatorias.find(c => Number(c.id) === Number(candidate));
      if (matched) {
        this.selectedConvocatoriaId = Number(matched.id);
      } else {
        this.selectedConvocatoriaId = Number(candidate);
      }
    }

    if (!this.selectedConvocatoriaId && this.convocatorias.length) {
      const fallback = this.convocatorias.find(c => c.es_activo) || this.convocatorias[0];
      if (fallback?.id != null) {
        this.selectedConvocatoriaId = Number(fallback.id);
      }
    }
  }

  private formatConvocatoriaLabel(conv: any): string {
    if (!conv) return '';
    const numero = conv?.numero_convocatoria ?? conv?.numero ?? conv?.numeroConvocatoria ?? conv?.convocatoria_numero;
    const nombreRaw = conv?.nombre ?? conv?.convocatoria_nom ?? conv?.titulo ?? '';
    const nombre = typeof nombreRaw === 'string' ? nombreRaw.trim() : nombreRaw;
    if (numero && nombre) return `${numero} - ${nombre}`;
    if (numero) return `Convocatoria ${numero}`;
    if (nombre) return String(nombre);
    const anio = conv?.anio ?? conv?.gestion;
    return anio ? `Convocatoria ${anio}` : '';
  }

  // Acción de designar (placeholder para futura integración)
  public designarTutor(t: TutorReg) {
    if (!t || (!this.codCeta && !this.estudiante?.cod_ceta)) {
      console.warn('Falta cod_ceta o tutor');
      return;
    }
    this.selectedTutor = t;

    // Si aún no hay convocatoria seleccionada, intentar usar la convocatoria de la inscripción del postulante
    if (!this.selectedConvocatoriaId) {
      const insConvId = (this.inscripcion as any)?.convocatoria_id
        ?? (this.estudiante as any)?.inscripcion?.convocatoria_id
        ?? null;
      if (insConvId) {
        this.selectedConvocatoriaId = Number(insConvId);
      }
    }

    this.syncSelectedConvocatoriaWithConvocatorias();
    const convRow = this.convocatorias.find(c => Number(c.id) === this.selectedConvocatoriaId) || null;
    if (convRow) {
      this.confirmConvocatoriaNombre = this.formatConvocatoriaLabel(convRow);
      const inicio = this.resolveConvocatoriaFechaInicioFromSource(convRow);
      const fin = this.resolveConvocatoriaFechaFinFromSource(convRow);
      this.confirmConvocatoriaInicio = inicio;
      this.confirmConvocatoriaFin = fin;
    } else {
      const storedLabel = (this.inscripcion as any)?.convocatoria_nom || (this.inscripcion as any)?.nom_convocatoria;
      this.confirmConvocatoriaNombre = storedLabel ? String(storedLabel) : null;
      const fallbackSource = this.inscripcion || (this.estudiante as any)?.inscripcion || this.lastDesignation;
      const inicio = this.resolveConvocatoriaFechaInicioFromSource(fallbackSource);
      const fin = this.resolveConvocatoriaFechaFinFromSource(fallbackSource);
      this.confirmConvocatoriaInicio = inicio;
      this.confirmConvocatoriaFin = fin;
    }
    this.tutorPertinenciaIds = this.extraerPertinenciaIds(t);
    const selectedSet = new Set((this.selectedAreaIds || []).map(id => Number(id)));
    const preferred = this.tutorPertinenciaIds.find(id => selectedSet.has(Number(id)));
    if (preferred !== undefined) {
      this.selectedPertinenciaId = Number(preferred);
    } else {
      this.selectedPertinenciaId = this.tutorPertinenciaIds.length ? Number(this.tutorPertinenciaIds[0]) : null;
    }
    this.confirmArea = this.resolveTutorAreaLabel(t, this.selectedPertinenciaId);
    this.showConfirmModal = true;
  }

  public confirmarDesignacion() {
    if (!this.selectedTutor || (!this.codCeta && !this.estudiante?.cod_ceta)) {
      this.showConfirmModal = false;
      return;
    }
    const codRaw = this.normalizeCodCetaValue(this.codCeta ?? this.estudiante?.cod_ceta);
    if (!codRaw) {
      this.showConfirmModal = false;
      return;
    }
    const codNumeric = Number(codRaw);
    if (!Number.isFinite(codNumeric)) {
      this.showConfirmModal = false;
      return;
    }
    const proyectoId = this.proyecto?.id ? Number(this.proyecto.id) : undefined;
    const payload: any = {
      tutor_id: Number(this.selectedTutor.id),
      cod_ceta: codNumeric,
      proyecto_id: proyectoId,
    };
    const areaSeleccionada = this.confirmArea || this.resolveTutorAreaLabel(this.selectedTutor, this.selectedPertinenciaId);
    if (areaSeleccionada) {
      payload.area = areaSeleccionada;
    }
    let currentConvocatoriaRow: any = null;
    if (this.selectedConvocatoriaId) {
      payload.convocatoria_id = Number(this.selectedConvocatoriaId);
      const convRow = this.convocatorias.find(c => Number(c.id) === Number(this.selectedConvocatoriaId));
      if (convRow) {
        payload.convocatoria_nom = this.formatConvocatoriaLabel(convRow);
        payload.convocatoria_fecha_inicio = this.resolveConvocatoriaFechaInicioFromSource(convRow);
        payload.convocatoria_fecha_fin = this.resolveConvocatoriaFechaFinFromSource(convRow);
        currentConvocatoriaRow = convRow;
      } else if (this.confirmConvocatoriaNombre) {
        payload.convocatoria_nom = this.confirmConvocatoriaNombre;
      }
    }
    console.debug('[DesignarTutor] payload listo', payload);
    const user = this.auth.getUser();
    const resolvedName = user?.nombre_usuario
      || [user?.nombre, user?.apellido_p, user?.apellido_m].filter(Boolean).join(' ').trim()
      || user?.email
      || null;
    if (resolvedName) {
      payload.user_name = resolvedName;
    }
    const resolvedUserId = this.resolveUserId(user);
    if (resolvedUserId !== null) {
      payload.user_id = resolvedUserId;
    }
    this.isSaving = true;
    this.loadingService.showModal();
    this.sga.designarTutor(payload).subscribe({
      next: (resp) => {
        this.isSaving = false;
        this.showConfirmModal = false;
        this.loadingService.hideModal();
        if (resp?.success) {
          const respData: any = resp?.data || null;
          this.lastDesignation = respData;
          if (this.lastDesignation) {
            const areaLabel = this.confirmArea || (this.selectedTutor ? this.areasText(this.selectedTutor) : null);
            if (areaLabel) {
              (this.lastDesignation as any).area = areaLabel;
            }
            if (!this.lastDesignation.convocatoria_nom && payload.convocatoria_nom) {
              this.lastDesignation.convocatoria_nom = payload.convocatoria_nom;
            }
            if (!this.lastDesignation.tutor_nombre && this.selectedTutor) {
              this.lastDesignation.tutor_nombre = [
                this.selectedTutor.nombre,
                this.selectedTutor.apellido_p,
                this.selectedTutor.apellido_m,
              ].filter(Boolean).join(' ').trim();
            }
            if (codRaw) {
              this.lastDesignation.cod_ceta = codRaw;
            }
            if (resp?.data?.numero_documento) {
              (this.lastDesignation as any).numero_documento = resp.data.numero_documento;
            }
            if (resp?.data?.cite) {
              (this.lastDesignation as any).cite = resp.data.cite;
            }
            if (!this.lastDesignation.user_name && resolvedName) {
              this.lastDesignation.user_name = resolvedName;
            }
            if (!this.lastDesignation.user_id && resolvedUserId !== null) {
              this.lastDesignation.user_id = resolvedUserId;
            }
            const apiConvInicio = respData?.convocatoria_fecha_inicio ?? null;
            const apiConvFin = respData?.convocatoria_fecha_fin ?? null;
            const apiCronogramaInicio = respData?.cronograma_inicio ?? respData?.doc_cronograma_inicio ?? null;
            const apiCronogramaFin = respData?.cronograma_fin ?? respData?.doc_cronograma_fin ?? null;
            const resolvedInicio = currentConvocatoriaRow
              ? this.resolveConvocatoriaFechaInicioFromSource(currentConvocatoriaRow)
              : this.resolveConvocatoriaFechaInicioFromSource(apiConvInicio ? { convocatoria_fecha_inicio: apiConvInicio } : this.lastDesignation);
            const resolvedFin = currentConvocatoriaRow
              ? this.resolveConvocatoriaFechaFinFromSource(currentConvocatoriaRow)
              : this.resolveConvocatoriaFechaFinFromSource(apiConvFin ? { convocatoria_fecha_fin: apiConvFin } : this.lastDesignation);
            const finalConvInicio = apiConvInicio || resolvedInicio || this.confirmConvocatoriaInicio;
            const finalConvFin = apiConvFin || resolvedFin || this.confirmConvocatoriaFin;
            if (finalConvInicio) {
              this.confirmConvocatoriaInicio = finalConvInicio;
              (this.lastDesignation as any).convocatoria_fecha_inicio = finalConvInicio;
            }
            if (finalConvFin) {
              this.confirmConvocatoriaFin = finalConvFin;
              (this.lastDesignation as any).convocatoria_fecha_fin = finalConvFin;
            }
            if (apiCronogramaInicio) {
              (this.lastDesignation as any).cronograma_inicio = apiCronogramaInicio;
            }
            if (apiCronogramaFin) {
              (this.lastDesignation as any).cronograma_fin = apiCronogramaFin;
            }
          }
          this.persistLastDesignation(this.lastDesignation);
          this.showSuccessModal = true;
          this.showResumenDesignacion = true;
          this.showSeleccionTutores = false;
        }
      },
      error: (err) => {
        this.isSaving = false;
        this.showConfirmModal = false;
        this.loadingService.hideModal();
        alert('No se pudo designar el tutor. ' + (err?.message || ''));
      }
    });
  }

  public cancelarConfirmacion() {
    this.showConfirmModal = false;
    this.selectedTutor = null;
    this.selectedPertinenciaId = null;
  }

  public volverAModalidadGraduacion() {
    this.router.navigate(['/postulantes']);
  }

  // Texto de áreas mostrado en la tabla
  public areasText(t: TutorReg): string {
    const arr = (t as any)?.pertinencias;
    if (Array.isArray(arr) && arr.length) return arr.join(', ');
    const single = (t as any)?.pertinencia;
    return single ? String(single) : '-';
  }

  private extraerPertinenciaIds(t: TutorReg | null): number[] {
    if (!t) return [];
    const rawIds = (t as any)?.pertinencia_ids;
    if (Array.isArray(rawIds) && rawIds.length) {
      return rawIds.map((x: any) => Number(x)).filter(x => !Number.isNaN(x));
    }
    const single = (t as any)?.pertinencia_acad_id;
    if (single !== undefined && single !== null) {
      const n = Number(single);
      return Number.isNaN(n) ? [] : [n];
    }
    return [];
  }

  public pertinenciaNombre(id: number | null): string {
    if (!id) return '-';
    const found = (this.areas || []).find(a => Number(a.id) === Number(id));
    return found?.nombre_pert || '-';
  }

  private resolveTutorAreaLabel(tutor: TutorReg | null, pertinenciaId: number | null | undefined): string | null {
    if (!tutor) return null;
    if (pertinenciaId != null) {
      const name = this.pertinenciaNombre(pertinenciaId);
      if (name && name !== '-') {
        return name;
      }
    }
    const label = this.areasText(tutor);
    return label && label !== '-' ? label : null;
  }

  // Toggle de áreas por checkbox
  public onToggleArea(ev: Event, id: number) {
    const checked = (ev.target as HTMLInputElement).checked;
    const nid = Number(id);
    if (checked) {
      if (!this.selectedAreaIds.includes(nid)) this.selectedAreaIds = [...this.selectedAreaIds, nid];
    } else {
      this.selectedAreaIds = this.selectedAreaIds.filter(x => Number(x) !== nid);
    }
    this.applyFilter();
  }

  public clearAreas() {
    this.selectedAreaIds = [];
    this.applyFilter();
  }

  // Helpers de UI
  public estudianteNombre(): string {
    const e = this.estudiante || {} as any;
    const nombres = e.nombres || e.nombres_est || '';
    const apPat = e.ap_pat || e.apellido_p || '';
    const apMat = e.ap_mat || e.apellido_m || '';
    const full = `${apPat} ${apMat} ${nombres}`.trim();
    return full || String(this.codCeta || '');
  }

  public closeSuccessModal() {
    this.showSuccessModal = false;
  }

  public clearSavedDesignation() {
    this.lastDesignation = null;
    this.persistLastDesignation(null);
    this.showResumenDesignacion = false;
    this.showSeleccionTutores = true;
  }

  private lastDesignationEstudiantes(): any[] | null {
    const designation: any = this.lastDesignation || null;
    if (!designation) return null;

    const direct = designation.estudiantes;
    if (Array.isArray(direct) && direct.length) {
      return direct;
    }

    const candidateKeys = ['detalles', 'detalle', 'estudiantes_asignados', 'postulantes', 'lista_estudiantes'];
    for (const key of candidateKeys) {
      const value = designation[key];
      if (Array.isArray(value) && value.length) {
        return value;
      }
    }

    if (designation.estudiante_nombre) {
      return [{
        estudiante_nombre: designation.estudiante_nombre,
        carrera: designation.carrera_nombre,
        modalidad: designation.modalidad || designation.modalidad_nombre,
        area: designation.area,
        proyecto_nombre: designation.proyecto_nombre,
      }];
    }

    return null;
  }

  public reopenDesignacion() {
    this.selectedTutor = null;
    this.showConfirmModal = false;
    this.confirmArea = null;
    this.confirmConvocatoriaNombre = null;
    this.confirmConvocatoriaInicio = null;
    this.confirmConvocatoriaFin = null;
    this.showResumenDesignacion = false;
    this.showSeleccionTutores = true;
    this.persistLastDesignation(this.lastDesignation);
  }

  public async generarDesignacionPdf() {
    if (this.generatingPdf) return;
    const designation = this.lastDesignation;
    if (!designation) {
      alert('No se encontró una designación para generar el documento.');
      return;
    }
    const tutorId = designation?.tutor_id ?? (this.selectedTutor?.id ?? null);
    const tutor = this.resolveTutorById(tutorId) || this.selectedTutor || null;
    const tutorNombreRaw = designation?.tutor_nombre
      || (tutor ? [tutor.nombre, tutor.apellido_p, tutor.apellido_m].filter(Boolean).join(' ').trim() : null)
      || 'Tutor designado';
    const tutorNombre = this.formatNombreApellidosPrimero(
      tutor?.apellido_p,
      tutor?.apellido_m,
      tutor?.nombre,
      tutorNombreRaw
    ) || tutorNombreRaw;
    const resolvedArea = this.resolveDesignationArea(designation);
    const area = resolvedArea || undefined;
    const estudianteNombre = this.formatNombreApellidosPrimero(
      this.estudiante?.apellido_p,
      this.estudiante?.apellido_m,
      this.estudiante?.nombres,
      designation?.estudiante_nombre || this.estudianteNombre()
    ) || this.estudianteNombre();
    const tutorTipo = (tutor as any)?.tipo_tutor || (tutor as any)?.tipo_tutor_nombre || null;
    const tutorCi = (tutor as any)?.ci || designation?.tutor_ci || null;
    const tutorCel = (tutor as any)?.celular || designation?.tutor_celular || null;
    const tituloAcademico = (designation?.tutor_titulo_academico || (tutor as any)?.titulo_academico || (tutor as any)?.titulo || '').toString().trim();
    const estudianteCodigo = designation?.cod_ceta || this.codCeta || null;
    const carrera = designation?.carrera_nombre || this.estudiante?.carrera || this.proyecto?.carrera || null;
    const proyectoNombre = designation?.proyecto_nombre || this.proyecto?.nombre || null;
    const convocatoria = designation?.convocatoria_nom || this.confirmConvocatoriaNombre || null;
    const convocatoriaInicio = (designation as any)?.convocatoria_fecha_inicio || this.confirmConvocatoriaInicio || null;
    const convocatoriaFin = (designation as any)?.convocatoria_fecha_fin || this.confirmConvocatoriaFin || null;
    const fecha = designation?.fecha_designacion || new Date();
    const numeroDocumento = designation?.numero_documento || designation?.numeroDocumento || designation?.designacion_id || undefined;
    const user = this.auth.getUser();
    const userName = designation?.user_name
      || user?.nombre_usuario
      || [user?.nombre, user?.apellido_p, user?.apellido_m].filter(Boolean).join(' ').trim()
      || user?.email
      || undefined;
    this.generatingPdf = true;
    try {
      // Asegurar documento y correlativo justo antes de generar el PDF
      const tutorIdForDoc = tutorId != null ? Number(tutorId) : null;
      const codCetaForDoc = estudianteCodigo ? Number(estudianteCodigo) : (this.codCeta ? Number(this.codCeta) : null);
      if (Number.isFinite(tutorIdForDoc as any) && Number.isFinite(codCetaForDoc as any)) {
        try {
          const genResp = await lastValueFrom(this.sga.generarDocDesignacion({ tutor_id: Number(tutorIdForDoc), cod_ceta: Number(codCetaForDoc) } as any));
          const dataDoc: any = (genResp as any)?.data ?? null;
          if (dataDoc) {
            if (!designation.numero_documento && dataDoc.numero_documento) {
              (designation as any).numero_documento = dataDoc.numero_documento;
            }
            if (!designation.cite && dataDoc.cite) {
              (designation as any).cite = dataDoc.cite;
            }
          }
        } catch {}
      }
      let sgaEst: any = null;
      try {
        if (Number.isFinite(Number(codCetaForDoc))) {
          const resp = await lastValueFrom(this.sga.getPostulanteById(Number(codCetaForDoc)));
          let data: any = (resp as any)?.data ?? resp;
          if (Array.isArray(data?.data)) data = data.data[0];
          if (data && data.data && typeof data.data === 'object') data = data.data;
          sgaEst = data || null;
        }
      } catch {}
      let caratulaPostNum: string | undefined;
      try {
        if (Number.isFinite(Number(codCetaForDoc))) {
          const asign = await lastValueFrom(this.postulanteService.assignPostulanteNum({ cod_ceta_est: Number(codCetaForDoc) }));
          if (asign && (asign as any).nro_postulante != null) {
            caratulaPostNum = String((asign as any).nro_postulante);
          }
        }
      } catch {}
      const modalidadGeneral = this.modalidadNombre || 'Proyecto de Grado';
      const paraCargo = (designation?.doc_para_cargo
        || designation?.tutor_cargo
        || (tutor as any)?.cargo
        || (tutor as any)?.tipo_tutor_nombre
        || 'DOCENTE TÉCNICO')?.toString().trim();
      const carreraPreferida = this.resolveCarreraPreferidaDesignar(
        designation?.carrera_nombre,
        this.estudiante?.carrera,
        this.proyecto?.carrera,
        sgaEst?.carrera || sgaEst?.carrera_nombre || sgaEst?.cod_carrera
      );
      await this.pdfService.generarDesignacionTutorPdf({
        tutorNombre,
        tutorApellidoP: tutor?.apellido_p || undefined,
        tutorApellidoM: tutor?.apellido_m || undefined,
        tutorNombres: tutor?.nombre || undefined,
        tutorTipo: tutorTipo || undefined,
        tutorTitulo: 'DOCENTE TÉCNICO',
        tutorTituloAcademico: tituloAcademico || undefined,
        tutorCi: tutorCi || undefined,
        tutorCelular: tutorCel || undefined,
        area: area || undefined,
        estudianteNombre,
        estudianteCodigo: estudianteCodigo ? String(estudianteCodigo) : undefined,
        carrera: carreraPreferida || undefined,
        modalidad: modalidadGeneral,
        proyectoNombre: proyectoNombre || undefined,
        convocatoria: convocatoria || undefined,
        convocatoriaFechaInicio: convocatoriaInicio || undefined,
        convocatoriaFechaFin: convocatoriaFin || undefined,
        numeroDocumento: (designation?.numero_documento ?? numeroDocumento ?? null)?.toString() || undefined,
        cite: designation?.cite || undefined,
        fecha: new Date().toISOString(),
        fechaGeneracion: new Date().toISOString(),
        formatoCodigo: '«F3»',
        paraNombre: undefined,
        paraCargo: paraCargo || 'DOCENTE TÉCNICO',
        deNombre: 'Ing. Bradley Jailita Burgoa',
        deCargo: 'DIRECTOR ACADÉMICO',
        asunto: 'Designación como tutor para proyectos de defensa de grado',
        introduccion: designation?.introduccion || undefined,
        cronogramaInicio: designation?.cronograma_inicio || fecha,
        cronogramaFin: designation?.cronograma_fin || fecha,
        cierre: designation?.cierre || undefined,
        elaboradoPor: userName,
        cargoElaborador: 'Responsable de Modalidad de Graduación',
        pieNotas: ['BJB', 'CC: REC/DA'],
        caratulaPostulanteNumero: caratulaPostNum || undefined,
        estudiantes: (designation?.estudiantes || this.lastDesignationEstudiantes())
          ?.map((est: any) => {
            const resolvedModalidad = this.resolveEstudianteModalidad(est, modalidadGeneral);
            const carreraEst = this.resolveCarreraPreferidaDesignar(
              est?.carrera,
              this.estudiante?.carrera,
              this.proyecto?.carrera,
              sgaEst?.carrera || sgaEst?.carrera_nombre || sgaEst?.cod_carrera
            );
            return {
              nombre: this.formatNombreApellidosPrimero(
                est.apellido_p,
                est.apellido_m,
                est.nombres,
                est.estudiante_nombre || this.estudianteNombre()
              ) || this.estudianteNombre(),
              carrera: carreraEst || carreraPreferida || undefined,
              modalidad: resolvedModalidad || 'Proyecto de Grado',
              area,
              tema: est.proyecto_nombre || proyectoNombre || undefined,
            };
          }) || undefined,
      }, {
        fileName: `designacion-tutor-${estudianteCodigo || this.codCeta || 'documento'}.pdf`
      });
    } catch (err) {
      console.error('Error generando PDF de designación:', err);
      alert('No se pudo generar el documento PDF.');
    } finally {
      this.generatingPdf = false;
    }
  }

  private resolveTutorById(id: number | null | undefined): TutorReg | null {
    if (!id) return null;
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) return null;
    const fromList = (this.tutores || []).find(t => Number(t.id) === numericId);
    if (fromList) return fromList;
    if (this.selectedTutor && Number(this.selectedTutor.id) === numericId) return this.selectedTutor;
    return null;
  }

  private resolveUserId(user: any): number | null {
    if (!user) return null;
    const candidates = [user.id, user.user_id, user.usuario_id];
    for (const value of candidates) {
      if (value === null || value === undefined) continue;
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  private persistLastDesignation(designation: any | null) {
    try {
      const raw = sessionStorage.getItem('datos_postulacion');
      const parsed = raw ? JSON.parse(raw) : {};
      if (designation) {
        const normalizedCod = this.normalizeCodCetaValue(designation.cod_ceta ?? this.codCeta ?? this.estudiante?.cod_ceta);
        const normalizedDesignation = {
          ...designation,
          ...(normalizedCod ? { cod_ceta: normalizedCod } : {}),
        };
        this.lastDesignation = normalizedDesignation;
        parsed.last_designation = normalizedDesignation;
        delete parsed.lastDesignation;
        delete parsed.designacion;
      } else {
        delete parsed.last_designation;
        delete parsed.lastDesignation;
        delete parsed.designacion;
      }
      sessionStorage.setItem('datos_postulacion', JSON.stringify(parsed));
    } catch {}
  }

  private normalizeCodCetaValue(value: any): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    const raw = value.toString().trim();
    return raw || null;
  }

  private resolveDesignationArea(designation: any): string | null {
    const direct = designation?.area ?? this.confirmArea ?? null;
    if (!direct) return null;
    if (Array.isArray(direct)) {
      const first = direct.find((item: any) => item != null && String(item).trim().length);
      return first ? String(first).trim() : null;
    }
    const text = String(direct).trim();
    return text.length ? text : null;
  }

  private formatNombreApellidosPrimero(
    apellidoP?: string | null,
    apellidoM?: string | null,
    nombres?: string | null,
    fallback?: string | null,
  ): string | null {
    const parts: string[] = [];
    if (apellidoP && apellidoP.trim()) parts.push(apellidoP.trim());
    if (apellidoM && apellidoM.trim()) parts.push(apellidoM.trim());
    if (nombres && nombres.trim()) parts.push(nombres.trim());
    if (parts.length) {
      return parts.join(' ').replace(/\s+/g, ' ').trim();
    }
    const fb = (fallback || '').trim();
    if (!fb) return null;
    const tokens = fb.split(/\s+/).filter(Boolean);
    if (tokens.length >= 3) {
      const lastTwo = tokens.slice(-2);
      const rest = tokens.slice(0, -2);
      return [...lastTwo, ...rest].join(' ').replace(/\s+/g, ' ').trim();
    }
    return fb;
  }

  private buildParaNombreLinea(tutor: TutorReg | null, nombreNormalizado: string): string {
    const resolvedName = nombreNormalizado.trim();
    const prefijo = 'T.S.';
    if (!tutor) {
      return `${prefijo} ${resolvedName}`.replace(/\s+/g, ' ').trim();
    }
    const baseNombre = this.formatNombreApellidosPrimero(
      (tutor as any)?.apellido_p,
      (tutor as any)?.apellido_m,
      tutor?.nombre,
      resolvedName
    ) || resolvedName;
    return `${prefijo} ${baseNombre}`.replace(/\s+/g, ' ').trim();
  }

  private resolveConvocatoriaFechaInicioFromSource(source: any): string | Date | null {
    if (!source) return null;
    const candidates = [
      source?.convocatoria_fecha_inicio,
      source?.fecha_inicio,
      source?.fechaInicio,
      source?.fecha_inicio_convocatoria,
      source?.fechaInicioConvocatoria,
      source?.inicio,
    ];
    return this.pickFirstNonEmpty(candidates);
  }

  private resolveConvocatoriaFechaFinFromSource(source: any): string | Date | null {
    if (!source) return null;
    const candidates = [
      source?.convocatoria_fecha_fin,
      source?.fecha_fin,
      source?.fechaFin,
      source?.fecha_fin_convocatoria,
      source?.fechaFinConvocatoria,
      source?.fin,
    ];
    return this.pickFirstNonEmpty(candidates);
  }

  private pickFirstNonEmpty(values: Array<any>): string | Date | null {
    for (const value of values) {
      if (value === null || value === undefined) continue;
      if (typeof value === 'string' && !value.trim()) continue;
      return value;
    }
    return null;
  }
}
