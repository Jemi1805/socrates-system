import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { SgaService, Pertinencia, TutorReg, Convocatoria } from '../../../shared/services/sga.service';
import { ProyectoService } from '../proyectos/proyecto.service';

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
  ) {}

  ngOnInit(): void {
    // Recuperar contexto de sessionStorage si existe
    try {
      const dp = sessionStorage.getItem('datos_postulacion');
      if (dp) {
        const parsed = JSON.parse(dp);
        this.estudiante = parsed?.estudiante || null;
      }
      const pc = sessionStorage.getItem('proyecto_cache');
      if (pc) {
        this.proyecto = JSON.parse(pc);
      }
    } catch {}

    // Tomar query params (cod_ceta, carrera)
    this.route.queryParamMap.subscribe(params => {
      const cod = params.get('cod_ceta');
      const carr = params.get('carrera');
      this.codCeta = cod;
      this.carreraKey = this.normalizeCarreraKey(carr || (this.estudiante?.carrera || this.estudiante?.carrera_nombre)) || 'mecanica';

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
        const raw = (resp?.data ?? resp?.items ?? resp) as any;
        const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        this.convocatorias = list as Convocatoria[];
        if (!this.selectedConvocatoriaId) {
          const convId = (this.estudiante as any)?.inscripcion?.convocatoria_id
            ?? this.inscripcionConvocatoriaIdFromStorage();
          if (convId) {
            this.selectedConvocatoriaId = Number(convId);
          }
        }
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
      const ins = parsed?.inscripcion;
      if (ins && ins.convocatoria_id) return Number(ins.convocatoria_id);
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

  // Acción de designar (placeholder para futura integración)
  public designarTutor(t: TutorReg) {
    if (!t || (!this.codCeta && !this.estudiante?.cod_ceta)) {
      console.warn('Falta cod_ceta o tutor');
      return;
    }
    this.selectedTutor = t;
    this.confirmArea = this.areasText(t);
    const convId = this.selectedConvocatoriaId
      ?? (this.estudiante as any)?.inscripcion?.convocatoria_id
      ?? this.inscripcionConvocatoriaIdFromStorage();
    this.selectedConvocatoriaId = convId ? Number(convId) : null;
    this.confirmConvocatoriaNombre = this.convocatorias.find(c => Number(c.id) === this.selectedConvocatoriaId)?.nombre || null;
    this.tutorPertinenciaIds = this.extraerPertinenciaIds(t);
    this.selectedPertinenciaId = this.tutorPertinenciaIds.length ? Number(this.tutorPertinenciaIds[0]) : null;
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
    }
    if (this.selectedPertinenciaId) {
      payload.pertinencia_id = Number(this.selectedPertinenciaId);
    }
    this.isSaving = true;
    this.sga.designarTutor(payload).subscribe({
      next: (resp) => {
        this.isSaving = false;
        this.showConfirmModal = false;
        if (resp?.success) {
          this.lastDesignation = resp?.data || null;
          this.showSuccessModal = true;
        }
      },
      error: (err) => {
        this.isSaving = false;
        this.showConfirmModal = false;
        alert('No se pudo designar el tutor. ' + (err?.message || ''));
      }
    });
  }

  public cancelarConfirmacion() {
    this.showConfirmModal = false;
    this.selectedTutor = null;
    this.selectedPertinenciaId = null;
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
}
