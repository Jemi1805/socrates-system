import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { SgaService, Docente, ApiResponse, Pertinencia, TutorReg } from '../../../shared/services/sga.service';
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
  // Pertinencias académicas filtradas por carrera
  pertinencias: Pertinencia[] = [];
  // Guardado
  savingDocente: boolean = false;
  successModalVisible: boolean = false;
  successMessage: string = 'Docente guardado correctamente';
  editingSaveError: string | null = null;
  // Registro masivo
  bulkSaving: boolean = false;
  bulkError: string | null = null;
  // Tutores registrados
  showRegistrados: boolean = false;
  loadingTutores: boolean = false;
  errorTutores: string | null = null;
  tutores: TutorReg[] = [];
  // Set de CIs de tutores ya registrados en gestión actual (para evitar duplicado)
  registradosSet: Set<string> = new Set<string>();
  // Filtro de gestión para el panel de "Tutores registrados"
  gestionFiltro: string | null = this.gestionActual;
  // Filtro de carrera (MEA/EEA) para el panel de "Tutores registrados"
  carreraFiltroCode: string | null = null;

  constructor(private sga: SgaService, private router: Router) {}

  ngOnInit(): void {
    this.loadPertinencias();
  }

  // Registrar y activar directamente como Tutor (usa register_bulk con un item)
  registrarYActivarTutor() {
    if (!this.editingDocente) return;
    this.editingSaveError = null;
    // Validaciones mínimas
    const ci = (this.editingDocente.ci || '').toString().trim();
    const nombre = (this.editingDocente.nombre || '').toString().trim();
    const celular = (this.editingDocente.celular || '').toString().trim();
    if (!ci || !nombre || !celular) {
      this.editingSaveError = 'Complete CI, Nombres y Celular';
      return;
    }
    const codCarr = (this.modalCarreraCode === 'MEA' || this.modalCarreraCode === 'EEA') ? this.modalCarreraCode : undefined;
    const item = {
      ci,
      nombre,
      apellido_p: this.editingDocente.apellido_p || undefined,
      apellido_m: this.editingDocente.apellido_m || undefined,
      celular,
      profesion: this.editingDocente.profesion || undefined,
      cod_carrera: codCarr,
      pertinencia_acad_id: this.editingDocente.pertinencia_acad_id ?? null,
      pertinencia: this.editingDocente.pertinencia || undefined,
    } as any;
    this.savingDocente = true;
    this.sga.registerTutoresBulk([item]).subscribe({
      next: (resp) => {
        this.savingDocente = false;
        if (resp?.success) {
          const gestion = (resp as any)?.gestion ?? this.gestionActual;
          this.successMessage = `Tutor registrado y activado. Gestión: ${gestion}`;
          this.successModalVisible = true;
          // Marcar en set de registrados
          this.registradosSet.add(ci);
          this.modalEditarDocenteVisible = false;
          // Si panel de registrados está visible, refrescar
          if (this.showRegistrados) this.loadTutores();
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
    const params: any = {};
    const codigo = this.carreraSeleccionadaCodigo;
    if (codigo && codigo !== '—') params.carrera = codigo;
    params.gestion = this.gestionActual;
    forkJoin({
      sga: this.sga.getDocentes(this.carreraSeleccionada),
      local: this.sga.getDocentesLocales(this.carreraSeleccionada),
      reg: this.sga.getTutores(params)
    }).subscribe({
      next: ({ sga, local, reg }) => {
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

        // 3) Construir set de registrados en gestión actual
        if (reg?.success && Array.isArray(reg.data)) {
          this.registradosSet = new Set(
            (reg.data as any[])
              .map(t => normCi((t as any).ci))
              .filter(x => !!x)
          );
        } else {
          this.registradosSet = new Set<string>();
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
    this.isCreateMode = false;
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
    // Inicializar carrera/gestión del modal
    const codSel = this.carreraSeleccionadaCodigo;
    this.modalCarreraCode = (codSel === 'MEA' || codSel === 'EEA') ? codSel : 'MEA';
    this.modalGestion = this.gestionActual;
    // cargar pertinencias para la carrera del modal
    this.onModalCarreraChange(this.modalCarreraCode);
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
    const codSel = this.carreraSeleccionadaCodigo;
    this.modalCarreraCode = (codSel === 'MEA' || codSel === 'EEA') ? codSel : 'MEA';
    this.modalGestion = this.gestionActual;
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
    const codCarr = (this.modalCarreraCode === 'MEA' || this.modalCarreraCode === 'EEA')
      ? this.modalCarreraCode
      : ((this.carreraSeleccionada && this.carreraSeleccionadaCodigo !== '—') ? this.carreraSeleccionadaCodigo : null);
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
    const notRegistrado = !this.isRegistradoGestionActual(doc);
    return hasCi && hasTitulo && hasCelular && hasPert && notRegistrado;
  }

  isRegistradoGestionActual(doc: Docente): boolean {
    const ci = (doc?.ci || '').toString().trim();
    if (!ci) return false;
    return this.registradosSet.has(ci);
  }

  registrarTutores() {
    const seleccionados = this.docentes.filter(d => this.selectedCis.has(d.ci));
    if (!seleccionados.length) return;
    this.bulkError = null;
    this.bulkSaving = true;
    const codCarr = (this.carreraSeleccionada && this.carreraSeleccionadaCodigo !== '—') ? this.carreraSeleccionadaCodigo : undefined;
    const items = seleccionados.map(d => ({
      ci: (d.ci || '').toString().trim(),
      nombre: d.nombre || '',
      apellido_p: d.apellido_p || '',
      apellido_m: d.apellido_m || '',
      celular: d.celular || '',
      profesion: d.profesion || '',
      cod_carrera: codCarr,
      pertinencia_acad_id: (d as any).pertinencia_acad_id ?? null,
      pertinencia: d.pertinencia || undefined,
    }));
    this.sga.registerTutoresBulk(items as any).subscribe({
      next: (resp) => {
        this.bulkSaving = false;
        if (resp?.success) {
          const created = (resp as any)?.counts?.created ?? 0;
          const updated = (resp as any)?.counts?.updated ?? 0;
          const gestion = (resp as any)?.gestion ?? '';
          this.successMessage = `Tutores registrados correctamente. Nuevos: ${created}, Actualizados: ${updated}. Gestión: ${gestion}`;
          this.successModalVisible = true;
          // Limpiar selección
          this.selectedCis.clear();
          // Marcar inmediatamente como registrados en esta gestión para bloquear re-registro
          for (const d of seleccionados) {
            const ci = (d.ci || '').toString().trim();
            if (!ci) continue;
            this.registradosSet.add(ci);
          }
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
    if (this.gestionFiltro) params.gestion = this.gestionFiltro;
    this.sga.getTutores(params).subscribe({
      next: (resp) => {
        this.loadingTutores = false;
        if (resp?.success && Array.isArray(resp.data)) {
          this.tutores = resp.data as TutorReg[];
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
      },
      error: () => { this.pertinencias = []; }
    });
  }
}
