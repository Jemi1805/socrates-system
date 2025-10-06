import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { SgaService, Docente, ApiResponse, Pertinencia } from '../../../shared/services/sga.service';
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
  // Pertinencias académicas filtradas por carrera
  pertinencias: Pertinencia[] = [];
  // Guardado
  savingDocente: boolean = false;
  successModalVisible: boolean = false;
  successMessage: string = 'Docente guardado correctamente';
  editingSaveError: string | null = null;

  constructor(private sga: SgaService, private router: Router) {}

  ngOnInit(): void {
    this.loadPertinencias();
  }

  onCarreraChange(_: any) {
    this.loadPertinencias();
    if (this.editingDocente) {
      this.editingDocente.pertinencia_acad_id = null;
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
    this.showImport = !this.showImport;
    // Limpia estado al ocultar
    if (!this.showImport) {
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
    forkJoin({
      sga: this.sga.getDocentes(this.carreraSeleccionada),
      local: this.sga.getDocentesLocales(this.carreraSeleccionada)
    }).subscribe({
      next: ({ sga, local }) => {
        this.loadingDocentes = false;
        const map = new Map<string, Docente>();
        const normCi = (v: any) => (v == null ? '' : String(v)).trim();

        // 1) Cargar SGA primero
        if (sga?.success && Array.isArray(sga.data)) {
          for (const raw of sga.data as any[]) {
            const d = raw as Docente;
            const key = normCi((d as any).ci);
            if (!key) continue;
            map.set(key, {
              nombre: (d as any).nombre || '',
              apellido_p: (d as any).apellido_p || '',
              apellido_m: (d as any).apellido_m || '',
              ci: key,
              profesion: (d as any).profesion || '',
              celular: (d as any).celular || '',
              pertinencia: (d as any).pertinencia || '',
              pertinencia_acad_id: (d as any).pertinencia_acad_id ?? null,
            } as Docente);
          }
        }

        // 2) Mezclar/Agregar locales, priorizando locales
        if (local?.success && Array.isArray(local.data)) {
          for (const raw of local.data as any[]) {
            const ld = raw as Docente;
            const key = normCi((ld as any).ci);
            if (!key) continue;
            const prev = map.get(key) || {
              nombre: '', apellido_p: '', apellido_m: '', ci: key, profesion: '', celular: '', pertinencia: '', pertinencia_acad_id: null
            } as Docente;
            map.set(key, {
              ...prev,
              // Preferir valores locales si existen
              nombre: (ld as any).nombre || prev.nombre,
              apellido_p: (ld as any).apellido_p || prev.apellido_p,
              apellido_m: (ld as any).apellido_m || prev.apellido_m,
              profesion: (ld as any).profesion || prev.profesion,
              celular: (ld as any).celular || prev.celular,
              pertinencia: (ld as any).pertinencia || prev.pertinencia,
              pertinencia_acad_id: (ld as any).pertinencia_acad_id != null ? (ld as any).pertinencia_acad_id : prev.pertinencia_acad_id,
            } as Docente);
          }
        }

        this.docentes = Array.from(map.values());
      },
      error: (err) => {
        this.loadingDocentes = false;
        this.errorDocentes = err?.message || 'Error al cargar docentes';
      }
    });
  }

  editarDocente(doc: Docente) {
    // Abrir modal de edición en lugar de navegar
    this.editingDocente = {
      nombre: doc.nombre,
      apellido_p: doc.apellido_p,
      apellido_m: doc.apellido_m,
      ci: doc.ci,
      profesion: doc.profesion,
      celular: doc.celular,
      pertinencia: doc.pertinencia || '',
      pertinencia_acad_id: (doc.pertinencia_acad_id ?? null)
    } as Partial<Docente>;
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

  guardarDocenteEditado() {
    if (!this.editingDocente) return;
    this.editingSaveError = null;
    this.savingDocente = true;
    const ciKey = (this.editingDocente.ci || '').toString().trim();
    // Determinar nombre de pertinencia desde el id seleccionado
    let pertNombre = this.editingDocente.pertinencia || '';
    if (this.editingDocente.pertinencia_acad_id != null) {
      const p = this.pertinencias.find(x => x.id === this.editingDocente!.pertinencia_acad_id);
      if (p) pertNombre = p.nombre_pert;
    }
    const codCarr = (this.carreraSeleccionada && this.carreraSeleccionadaCodigo !== '—') ? this.carreraSeleccionadaCodigo : null;
    const payload = {
      ci: ciKey,
      nombre: this.editingDocente.nombre || '',
      apellido_p: this.editingDocente.apellido_p || '',
      apellido_m: this.editingDocente.apellido_m || '',
      profesion: this.editingDocente.profesion || '',
      celular: this.editingDocente.celular || '',
      pertinencia_acad_id: this.editingDocente.pertinencia_acad_id ?? null,
      cod_carrera: codCarr,
      activo: true,
    };
    this.sga.saveDocenteByCi(payload).subscribe({
      next: (resp) => {
        this.savingDocente = false;
        if (resp?.success && resp.data) {
          const saved = resp.data as any;
          const updated: Docente = {
            nombre: saved.nombre || this.editingDocente!.nombre || '',
            apellido_p: saved.apellido_p || this.editingDocente!.apellido_p || '',
            apellido_m: saved.apellido_m || this.editingDocente!.apellido_m || '',
            ci: saved.ci || ciKey,
            profesion: saved.profesion || this.editingDocente!.profesion || '',
            celular: saved.celular || this.editingDocente!.celular || '',
            pertinencia: (saved.pertinenciaAcad?.nombre_pert) || pertNombre,
            pertinencia_acad_id: saved.pertinencia_acad_id ?? this.editingDocente!.pertinencia_acad_id ?? null,
          } as Docente;
          const idx = this.docentes.findIndex(d => (d.ci || '').toString().trim() === ciKey);
          if (idx >= 0) this.docentes[idx] = updated; else this.docentes.push(updated);
          this.cerrarModalEditarDocente();
          this.successMessage = 'Datos del docente guardados correctamente';
          this.successModalVisible = true;
        } else {
          this.editingSaveError = resp?.message || 'No se pudo guardar el docente';
        }
      },
      error: (err) => {
        this.savingDocente = false;
        this.editingSaveError = err?.message || 'Error al guardar docente';
      }
    });
  }

  cerrarModalExito() {
    this.successModalVisible = false;
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
    return hasCi && hasTitulo && hasCelular && hasPert;
  }

  registrarTutores() {
    // Por ahora, navega al registro con el primer docente seleccionado
    const seleccionados = this.docentes.filter(d => this.selectedCis.has(d.ci));
    if (!seleccionados.length) return;
    this.editarDocente(seleccionados[0]);
  }
}
