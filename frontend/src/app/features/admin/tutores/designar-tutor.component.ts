import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { SgaService, Pertinencia, TutorReg, Convocatoria, InscripModalidad, ApiResponse } from '../../../shared/services/sga.service';
import { ProyectoService } from '../proyectos/proyecto.service';
import { LoadingService } from '../../../core/services/loading.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-designar-tutor',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent, RouterModule],
  templateUrl: './designar-tutor.component.html',
  styleUrls: ['./designar-tutor.component.scss']
})
export class DesignarTutorComponent implements OnInit {
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
  confirmArea: string | null = null;
  tutorPertinenciaIds: number[] = [];
  selectedPertinenciaId: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sga: SgaService,
    private proyectoService: ProyectoService,
    private loadingService: LoadingService,
    private auth: AuthService,
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
        this.lastDesignation = parsed?.last_designation
          || parsed?.designacion
          || parsed?.lastDesignation
          || null;
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
      }
      const pc = sessionStorage.getItem('proyecto_cache');
      if (pc) {
        this.proyecto = JSON.parse(pc);
      }
    } catch {}

    if (this.lastDesignation) {
      this.showResumenDesignacion = true;
      this.showSeleccionTutores = false;
    } else {
      this.showResumenDesignacion = false;
    }

    // Tomar query params (cod_ceta, carrera)
    this.route.queryParamMap.subscribe(params => {
      const cod = params.get('cod_ceta');
      const carr = params.get('carrera');
      this.codCeta = cod;
      this.carreraKey = this.normalizeCarreraKey(carr || (this.estudiante?.carrera || this.estudiante?.carrera_nombre)) || 'mecanica';

      const codNumeric = cod ? Number(cod) : this.estudiante?.cod_ceta ? Number(this.estudiante.cod_ceta) : null;
      this.fetchInscripcionForCod(codNumeric);

      // Si no hay proyecto cache, intentar traerlo por código
      if (!this.proyecto && cod) {
        this.proyectoService.getByCod(cod).subscribe({ next: (res) => {
          this.proyecto = (Array.isArray(res?.data) ? res.data[0] : (res?.data || res)) || null;
        }, error: () => {} });
      }
      // Cargar áreas (pertinencias) y tutores
      this.loadAreas();
      this.loadTutores();
      this.loadConvocatorias();
    });
  }

  private loadConvocatorias() {
    this.sga.getConvocatorias({ per_page: 100 }).subscribe({
      next: (resp) => {
        const raw = (resp?.data ?? resp) as any;
        const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        this.convocatorias = list as Convocatoria[];
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
    const carrCode = this.carreraKeyToCode(this.carreraKey);
    this.sga.getTutores({ carrera: carrCode }).subscribe({
      next: (resp) => {
        this.loadingTutores = false;
        this.tutores = resp?.data || [];
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
    this.confirmArea = this.areasText(t);
    this.syncSelectedConvocatoriaWithConvocatorias();
    const convRow = this.convocatorias.find(c => Number(c.id) === this.selectedConvocatoriaId) || null;
    if (convRow) {
      this.confirmConvocatoriaNombre = this.formatConvocatoriaLabel(convRow);
    } else {
      const storedLabel = (this.inscripcion as any)?.convocatoria_nom || (this.inscripcion as any)?.nom_convocatoria;
      this.confirmConvocatoriaNombre = storedLabel ? String(storedLabel) : null;
    }
    this.tutorPertinenciaIds = this.extraerPertinenciaIds(t);
    const selectedSet = new Set((this.selectedAreaIds || []).map(id => Number(id)));
    const preferred = this.tutorPertinenciaIds.find(id => selectedSet.has(Number(id)));
    if (preferred !== undefined) {
      this.selectedPertinenciaId = Number(preferred);
    } else {
      this.selectedPertinenciaId = this.tutorPertinenciaIds.length ? Number(this.tutorPertinenciaIds[0]) : null;
    }
    this.showConfirmModal = true;
  }

  public confirmarDesignacion() {
    if (!this.selectedTutor || (!this.codCeta && !this.estudiante?.cod_ceta)) {
      this.showConfirmModal = false;
      return;
    }
    const cod = Number(this.codCeta || this.estudiante?.cod_ceta);
    const proyectoId = this.proyecto?.id ? Number(this.proyecto.id) : undefined;
    const payload: any = { tutor_id: Number(this.selectedTutor.id), cod_ceta: cod, proyecto_id: proyectoId };
    if (this.selectedConvocatoriaId) {
      payload.convocatoria_id = Number(this.selectedConvocatoriaId);
      const convRow = this.convocatorias.find(c => Number(c.id) === Number(this.selectedConvocatoriaId));
      if (convRow) {
        payload.convocatoria_nom = this.formatConvocatoriaLabel(convRow);
      } else if (this.confirmConvocatoriaNombre) {
        payload.convocatoria_nom = this.confirmConvocatoriaNombre;
      }
    }
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
          this.lastDesignation = resp?.data || null;
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
            if (!this.lastDesignation.cod_ceta && cod) {
              this.lastDesignation.cod_ceta = cod;
            }
            if (!this.lastDesignation.user_name && resolvedName) {
              this.lastDesignation.user_name = resolvedName;
            }
            if (!this.lastDesignation.user_id && resolvedUserId !== null) {
              this.lastDesignation.user_id = resolvedUserId;
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
    this.router.navigate(['/modalidad-graduacion']);
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

  public reopenDesignacion() {
    this.selectedTutor = null;
    this.showConfirmModal = false;
    this.confirmArea = null;
    this.confirmConvocatoriaNombre = null;
    this.showResumenDesignacion = false;
    this.showSeleccionTutores = true;
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
        parsed.last_designation = designation;
      } else {
        delete parsed.last_designation;
        delete parsed.lastDesignation;
        delete parsed.designacion;
      }
      sessionStorage.setItem('datos_postulacion', JSON.stringify(parsed));
    } catch {}
  }
}
