import { Component, OnInit, ElementRef, ViewChild, HostListener } from '@angular/core';
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
  editingCiOriginal: string | null = null; // para permitir cambio de CI
  showFieldErrors: boolean = false;        // activa estilos is-invalid
  // Pertinencias académicas filtradas por carrera
  pertinencias: Pertinencia[] = [];
  // Selección múltiple de pertinencias en el modal
  selectedPertIds: number[] = [];
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
  // Set de nombres normalizados de tutores registrados (fallback si cambió el CI)
  registradosNameSet: Set<string> = new Set<string>();
  // Filtro de gestión para el panel de "Tutores registrados"
  gestionFiltro: string | null = this.gestionActual;
  // Filtro de carrera (MEA/EEA) para el panel de "Tutores registrados"
  carreraFiltroCode: string | null = null;

  constructor(private sga: SgaService, private router: Router) {}

  ngOnInit(): void {
    this.loadPertinencias();
  }

  // -------- Multiselect Pertinencias (UI) --------
  togglePertDropdown() {
    this.pertDropdownOpen = !this.pertDropdownOpen;
  }

  openPertDropdown() {
    this.pertDropdownOpen = true;
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
    const item = {
      ci,
      nombre,
      apellido_p: this.editingDocente.apellido_p || undefined,
      apellido_m: this.editingDocente.apellido_m || undefined,
      celular,
      profesion: this.editingDocente.profesion || undefined,
      cod_carrera: codCarr,
      pertinencia_acad_id: primaryPertId,
      pertinencia_acad_ids: this.selectedPertIds,
      pertinencia: pertNom || undefined,
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
    const hasAnyPert = (this.selectedPertIds?.length || 0) > 0;
    if (!(cod === 'MEA' || cod === 'EEA')) miss.push('Carrera');
    if (!nombre) miss.push('Nombres');
    if (!apPat) miss.push('Apellido paterno');
    if (!ci) miss.push('CI');
    if (!celular) miss.push('Celular');
    if (!titulo) miss.push('Título(s)');
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
              pertinencia: (d as any).pertinencia || '',
              pertinencia_acad_id: (d as any).pertinencia_acad_id ?? null,
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
              pertinencia: (ld as any).pertinencia ?? prev.pertinencia,
              pertinencia_acad_id: (ld as any).pertinencia_acad_id != null ? (ld as any).pertinencia_acad_id : prev.pertinencia_acad_id,
              // Si hicimos merge por nombre (prev venía de SGA con CI malo), sobreescribir el CI mostrado con el local
              ci: pickCi,
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
          }
        } else {
          this.registradosSet = new Set<string>();
          this.registradosNameSet = new Set<string>();
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
      id: (doc as any).id,
      nombre: doc.nombre,
      apellido_p: doc.apellido_p,
      apellido_m: doc.apellido_m,
      ci: doc.ci,
      profesion: doc.profesion,
      celular: doc.celular,
      pertinencia: doc.pertinencia || '',
      pertinencia_acad_id: (doc.pertinencia_acad_id ?? null)
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
    this.pertDropdownOpen = true;
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
    this.selectedPertIds = [];
    this.pertSearch = '';
    this.pertDropdownOpen = true;
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
    // Normalizar entradas también en edición
    this.editingDocente.nombre = this.toTitleCase(this.sanitizeNameChars(((this.editingDocente.nombre || '') as string).replace(/\s+/g, ' ').trim())) as any;
    this.editingDocente.apellido_p = this.toTitleCase(this.sanitizeNameChars(((this.editingDocente.apellido_p || '') as string).replace(/\s+/g, ' ').trim())) as any;
    this.editingDocente.apellido_m = this.toTitleCase(this.sanitizeNameChars(((this.editingDocente.apellido_m || '') as string).replace(/\s+/g, ' ').trim())) as any;
    this.editingDocente.celular = ((this.editingDocente.celular || '') as string).replace(/\D/g, '').slice(0, 8) as any;
    const ciKey = (this.editingDocente.ci || '').toString().trim();
    // Determinar nombre(s) de pertinencia desde los ids seleccionados (multi)
    const selectedP = (this.pertinencias || []).filter(p => this.selectedPertIds.includes(p.id));
    const pertNombre = selectedP.map(p => p.nombre_pert).join(', ');
    const primaryPertId = this.selectedPertIds?.[0] ?? null;
    const codCarr = (this.modalCarreraCode === 'MEA' || this.modalCarreraCode === 'EEA')
      ? this.modalCarreraCode
      : ((this.carreraSeleccionada && this.carreraSeleccionadaCodigo !== '—') ? this.carreraSeleccionadaCodigo : null);
    const payload = {
      id: this.isCreateMode ? undefined : (this.editingDocente as any).id,
      ci: ciKey,
      nombre: this.editingDocente.nombre || '',
      apellido_p: this.editingDocente.apellido_p || '',
      apellido_m: this.editingDocente.apellido_m || '',
      profesion: this.editingDocente.profesion || '',
      celular: this.editingDocente.celular || '',
      pertinencia_acad_id: primaryPertId,
      cod_carrera: codCarr,
      ci_original: this.isCreateMode ? null : (this.editingCiOriginal || null),
      activo: true,
    };
    this.sga.saveDocenteByCi(payload).subscribe({
      next: (resp) => {
        this.savingDocente = false;
        if (resp?.success && resp.data) {
          const saved = resp.data as any;
          const updated: Docente = {
            id: (saved as any)?.id ?? (this.editingDocente as any)?.id,
            nombre: saved.nombre || this.editingDocente!.nombre || '',
            apellido_p: saved.apellido_p || this.editingDocente!.apellido_p || '',
            apellido_m: saved.apellido_m || this.editingDocente!.apellido_m || '',
            ci: saved.ci || ciKey,
            profesion: saved.profesion || this.editingDocente!.profesion || '',
            celular: saved.celular || this.editingDocente!.celular || '',
            pertinencia: (saved.pertinenciaAcad?.nombre_pert) || pertNombre,
            pertinencia_acad_id: saved.pertinencia_acad_id ?? primaryPertId,
          } as Docente;
          // localizar por CI previo y actualizar en lista
          const prevKey = (this.editingCiOriginal || ciKey) as string;
          const idx = this.docentes.findIndex(d => (d.ci || '').toString().trim() === prevKey);
          if (idx >= 0) this.docentes[idx] = updated; else this.docentes.push(updated);
          // actualizar CI original para futuras ediciones
          this.editingCiOriginal = (updated.ci || '').toString().trim();
          // Si este docente ya es tutor en gestión actual, refrescar snapshot automáticamente
          this.refreshTutorSnapshotIfExists(updated);
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
      pertinencia_acad_ids: (d as any).pertinencia_ids,
      pertinencia: (Array.isArray((d as any).pertinencias) && (d as any).pertinencias.length)
        ? (d as any).pertinencias.join(', ')
        : (d.pertinencia || undefined),
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
