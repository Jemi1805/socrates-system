import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { SgaService, TutorReg } from '../../../shared/services/sga.service';
import { LoadingService } from '../../../core/services/loading.service';

@Component({
  selector: 'app-tribunales-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, HeaderComponent],
  templateUrl: './tribunales-home.component.html',
  styleUrls: ['./tribunales-home.component.scss']
})
export class TribunalesHomeComponent implements OnInit {
  // Tribunales disponibles (basados en tutores registrados)
  loadingDisponibles = false;
  errorDisponibles: string | null = null;
  tribunalesInternos: Array<TutorReg & { es_tribunal?: boolean }> = [];
  showDisponibles = true;
  // Tribunales externos (cargados desde backend)
  tribunalesExternos: Array<{
    id: number;
    nombre: string;
    apellido_p?: string;
    apellido_m?: string;
    ci: string;
    celular?: string;
    profesion?: string;
    institucion?: string;
    titulo_academico?: string;
    tipo?: 'interno' | 'externo';
    activo?: boolean;
  }> = [];

  // UI: sección de tribunales designados (listado global)
  showDesignados = false;
  selectedPostulanteCodCeta: string | null = null;
  loadingDesignados = false;
  errorDesignados: string | null = null;
  tribunalesDesignados: Array<{
    defensa_id: number;
    cod_ceta: string | number | null;
    fecha_defensa: string | null;
    hora_inicio: string | null;
    hora_fin: string | null;
    aula: string | null;
    grupo: string | null;
    rol_nombre: string;
    rol_codigo: string;
    tipo: 'interno' | 'externo';
    miembro_id: number;
    nombre: string | null;
    convocatoria_id?: number | null;
    convocatoria_nombre?: string | null;
    convocatoria_numero?: number | null;
    fechas_label?: string | null;
    horarios_label?: string | null;
    horarios_list?: string[] | null;
    tiene_doc_tribunal?: boolean;
  }> = [];

  // Filtros para tribunales designados (similar a Tutores designados)
  designadosConvocatorias: any[] = [];
  loadingConvocatoriasDesignados = false;
  selectedConvocatoriaDesignados: number | null = null;
  designadosSearchTerm = '';

  // Modal de designación de tribunal (3 miembros)
  designacionModalVisible = false;
  designacionSaving = false;
  designacionShowErrors = false;

  miembros: Array<{
    tipo: 'interno' | 'externo';
    miembroId: number | null;
    rol: 'PRESIDENTE' | 'DELEGADO_INTERNO' | 'DELEGADO_EXTERNO' | '';
  }> = [];

  readonly rolesTribunal = [
    { value: 'PRESIDENTE', label: 'Presidente de tribunal' },
    { value: 'DELEGADO_INTERNO', label: 'Delegado interno' },
    { value: 'DELEGADO_EXTERNO', label: 'Delegado externo' },
  ] as const;

  // Modal de registro de nuevo tribunal
  registroModalVisible = false;
  registroSaving = false;
  registroShowErrors = false;
  editingTribunalId: number | null = null;
  editingTutorId: number | null = null;
  registroCondicionInterna: '' | 'planta' | 'consultor' = '';
  // Registro de tribunal (interno o externo)
  registroExterno: {
    nombre: string;
    apellido_p: string;
    apellido_m: string;
    ci: string;
    celular: string;
    profesion: string;
    institucion: string;
    titulo_academico: string;
    tipo: 'interno' | 'externo';
  } = {
    nombre: '',
    apellido_p: '',
    apellido_m: '',
    ci: '',
    celular: '',
    profesion: '',
    institucion: '',
    titulo_academico: '',
    tipo: 'externo',
  };

  // Opciones de título académico (alineadas con tutores)
  tituloAcademicoOpciones: string[] = ['T.S.', 'Ing.', 'Lic.', 'MSc.', 'Dr.', 'Sr.'];

  // Confirmación para deshabilitar "es tribunal" (interno/externo)
  confirmDisableModalVisible = false;
  disableSaving = false;
  pendingDisableTribunal: { tipo: 'interno' | 'externo'; id: number; nombre?: string; apellido_p?: string; apellido_m?: string } | null = null;

  // Confirmación para generación de documento de designación de tribunal
  confirmDocModalVisible = false;
  confirmDocRow: any | null = null;
  confirmDocLoading = false;

  constructor(private sga: SgaService, private loadingService: LoadingService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.loadTribunalesDisponibles();
  }

  loadTribunalesDisponibles() {
    this.loadingDisponibles = true;
    this.errorDisponibles = null;
    this.tribunalesInternos = [];
    this.tribunalesExternos = [];

    this.sga.getTutores().subscribe({
      next: (resp) => {
        const list = (resp as any)?.data ?? resp;
        this.tribunalesInternos = Array.isArray(list) ? list as TutorReg[] : [];
        this.loadingDisponibles = false;
      },
      error: (err) => {
        this.loadingDisponibles = false;
        this.errorDisponibles = err?.message || 'Error al cargar tribunales internos';
      }
    });

    this.sga.getTribunalesExternos().subscribe({
      next: (resp) => {
        const list = (resp as any)?.data ?? resp;
        this.tribunalesExternos = Array.isArray(list) ? list as any[] : [];
      },
      error: (err) => {
        console.error('Error al cargar tribunales externos', err);
      }
    });
  }

  // --- Designación de tribunales ---

  toggleDisponiblesSection() {
    const newVal = !this.showDisponibles;
    this.showDisponibles = newVal;
    if (newVal) {
      this.showDesignados = false;
    }
  }

  // --- Registro de nuevo tribunal ---

  openRegistroTribunalModal() {
    this.registroShowErrors = false;
    this.registroSaving = false;
    this.editingTribunalId = null;
    this.editingTutorId = null;
    this.registroCondicionInterna = '';
    this.registroExterno = {
      nombre: '',
      apellido_p: '',
      apellido_m: '',
      ci: '',
      celular: '',
      profesion: '',
      institucion: '',
      titulo_academico: '',
      tipo: 'externo',
    };
    this.registroModalVisible = true;
  }

  openEditarInterno(t: TutorReg) {
    this.registroShowErrors = false;
    this.registroSaving = false;
    this.editingTutorId = t.id;
    this.editingTribunalId = null;
    this.registroCondicionInterna = (t as any).condicion_interna || '';

    this.registroExterno = {
      nombre: t.nombre || '',
      apellido_p: t.apellido_p || '',
      apellido_m: t.apellido_m || '',
      ci: t.ci || '',
      celular: t.celular || '',
      profesion: (t as any).titulo || '',
      institucion: '',
      titulo_academico: t.titulo_academico || '',
      tipo: 'interno',
    };

    this.registroModalVisible = true;
  }

  closeRegistroTribunalModal() {
    if (this.registroSaving) {
      return;
    }
    this.registroModalVisible = false;
  }

  isRegistroValido(): boolean {
    const f = this.registroExterno;
    if (!(f.nombre && f.apellido_p && f.ci && f.celular && f.profesion && f.titulo_academico)) {
      return false;
    }

    const ciOk = /^\d{7,8}$/.test(f.ci.trim());
    const celOk = /^\d{8}$/.test(f.celular.trim());

    return ciOk && celOk;
  }

  isCiInvalido(): boolean {
    const ci = (this.registroExterno.ci || '').trim();
    if (!ci) return true;
    return !/^\d{7,8}$/.test(ci);
  }

  isCelularInvalido(): boolean {
    const cel = (this.registroExterno.celular || '').trim();
    if (!cel) return true;
    return !/^\d{8}$/.test(cel);
  }

  guardarRegistroTribunal() {
    this.registroShowErrors = true;
    if (!this.isRegistroValido()) {
      return;
    }
    this.registroSaving = true;
    this.loadingService.showModal();

    const payload = {
      ...this.registroExterno,
    };

    let obs;
    if (this.editingTutorId) {
      // Actualizar datos del tutor (tribunal interno) en la tabla tutores
      obs = this.sga.updateTutor(this.editingTutorId, {
        nombre: payload.nombre,
        apellido_p: payload.apellido_p,
        apellido_m: payload.apellido_m,
        ci: payload.ci,
        celular: payload.celular,
        titulo: payload.profesion,
        titulo_academico: payload.titulo_academico,
        condicion_interna: this.registroCondicionInterna || null,
      } as any);
    } else if (this.editingTribunalId) {
      // Actualizar tribunal externo existente
      obs = this.sga.updateTribunal(this.editingTribunalId, payload);
    } else {
      // Crear nuevo tribunal (por defecto externo)
      obs = this.sga.createTribunalExterno(payload);
    }

    obs.subscribe({
      next: () => {
        this.registroSaving = false;
        this.registroModalVisible = false;
        this.loadingService.hideModal();
        this.loadTribunalesDisponibles();
      },
      error: (err) => {
        console.error('[RegistroTribunal] Error al guardar tribunal', err);
        this.registroSaving = false;
        this.loadingService.hideModal();
      }
    });
  }

  openEditarTribunal(t: {
    id: number;
    nombre: string;
    apellido_p?: string;
    apellido_m?: string;
    ci: string;
    celular?: string;
    profesion?: string;
    institucion?: string;
    titulo_academico?: string;
    tipo?: 'interno' | 'externo';
  }) {
    this.registroShowErrors = false;
    this.registroSaving = false;
    this.editingTribunalId = t.id;
    this.editingTutorId = null;

    this.registroExterno = {
      nombre: t.nombre || '',
      apellido_p: t.apellido_p || '',
      apellido_m: t.apellido_m || '',
      ci: t.ci || '',
      celular: t.celular || '',
      profesion: t.profesion || '',
      institucion: t.institucion || '',
      titulo_academico: t.titulo_academico || '',
      tipo: (t.tipo as any) || 'externo',
    };

    this.registroModalVisible = true;
  }

  // Solo permitir números en inputs de CI y celular
  onNumericKeyPress(event: KeyboardEvent) {
    const key = event.key;
    // Permitir teclas de control básicas (backspace, tab, flechas)
    if (key === 'Backspace' || key === 'Tab' || key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Delete') {
      return;
    }
    if (!/^[0-9]$/.test(key)) {
      event.preventDefault();
    }
  }

  // Click en switch Es tribunal: internos usan es_tribunal, externos usan activo
  onClickEsTribunal(tipo: 'interno' | 'externo', t: any, event: MouseEvent) {
    const isExterno = tipo === 'externo';
    const list = isExterno ? this.tribunalesExternos : this.tribunalesInternos;
    const idx = list.findIndex((row: any) => Number(row.id) === Number(t.id));
    if (idx < 0) return;
    const target = list[idx] as any;
    const isActive = isExterno ? !!target.activo : !!target.es_tribunal;

    // Si está activo y se quiere deshabilitar: NO cambiar switch todavía, solo confirmar
    if (isActive) {
      event.preventDefault();
      this.pendingDisableTribunal = {
        tipo,
        id: Number(target.id),
        nombre: target.nombre,
        apellido_p: target.apellido_p,
        apellido_m: target.apellido_m,
      };
      this.confirmDisableModalVisible = true;
      return;
    }

    // Si está inactivo y se quiere habilitar: cambio directo
    if (isExterno) {
      this.sga.toggleTribunal(target.id, true).subscribe({
        next: (resp) => {
          target.activo = (resp as any)?.data?.activo ?? true;
        },
        error: (err) => {
          console.error('[Tribunales] Error al habilitar tribunal externo', err);
          target.activo = false;
        },
      });
    } else {
      // Interno: actualizar es_tribunal en BD y en memoria
      this.sga.toggleTutorEsTribunal(target.id, true).subscribe({
        next: (resp) => {
          target.es_tribunal = (resp as any)?.data?.es_tribunal ?? true;
        },
        error: (err) => {
          console.error('[Tribunales] Error al habilitar tutor como tribunal', err);
          target.es_tribunal = false;
        },
      });
    }
  }

  cancelarDeshabilitarTribunal() {
    this.confirmDisableModalVisible = false;
    this.pendingDisableTribunal = null;
  }

  confirmarDeshabilitarTribunal() {
    const ref = this.pendingDisableTribunal;
    if (!ref) {
      this.confirmDisableModalVisible = false;
      return;
    }

    this.disableSaving = true;

    if (ref.tipo === 'externo') {
      const ext = this.tribunalesExternos.find((row) => Number(row.id) === ref.id) as any;
      if (!ext) {
        this.disableSaving = false;
        this.confirmDisableModalVisible = false;
        this.pendingDisableTribunal = null;
        return;
      }
      this.sga.toggleTribunal(ext.id, false).subscribe({
        next: (resp) => {
          this.disableSaving = false;
          const activo = (resp as any)?.data?.activo ?? false;
          ext.activo = !!activo;
          this.confirmDisableModalVisible = false;
          this.pendingDisableTribunal = null;
        },
        error: (err) => {
          console.error('[Tribunales] Error al deshabilitar tribunal externo', err);
          this.disableSaving = false;
          this.confirmDisableModalVisible = false;
          this.pendingDisableTribunal = null;
        },
      });
    } else {
      const interno = this.tribunalesInternos.find((row) => Number(row.id) === ref.id) as any;
      if (!interno) {
        this.disableSaving = false;
        this.confirmDisableModalVisible = false;
        this.pendingDisableTribunal = null;
        return;
      }
      this.sga.toggleTutorEsTribunal(interno.id, false).subscribe({
        next: (resp) => {
          interno.es_tribunal = (resp as any)?.data?.es_tribunal ?? false;
          this.disableSaving = false;
          this.confirmDisableModalVisible = false;
          this.pendingDisableTribunal = null;
          console.debug('[Tribunales] desmarcar interno como tribunal', { tutorId: interno.id, es_tribunal: interno.es_tribunal });
        },
        error: (err) => {
          console.error('[Tribunales] Error al deshabilitar tutor como tribunal', err);
          this.disableSaving = false;
          this.confirmDisableModalVisible = false;
          this.pendingDisableTribunal = null;
        },
      });
    }
  }

  toggleDesignadosSection() {
    const newVal = !this.showDesignados;
    this.showDesignados = newVal;
    if (newVal) {
      this.showDisponibles = false;
      this.ensureDesignadosConvocatorias();
      this.cargarTribunalesDesignados();
    } else {
      this.errorDesignados = null;
    }
  }

  ensureDesignadosConvocatorias() {
    if (this.designadosConvocatorias.length || this.loadingConvocatoriasDesignados) {
      return;
    }
    this.loadingConvocatoriasDesignados = true;
    this.sga.getConvocatorias({ per_page: 100 }).subscribe({
      next: (resp) => {
        const raw: any = (resp as any)?.data ?? resp;
        const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        this.designadosConvocatorias = list as any[];
        this.loadingConvocatoriasDesignados = false;
      },
      error: () => {
        this.designadosConvocatorias = [];
        this.loadingConvocatoriasDesignados = false;
      },
    });
  }

  onDesignadosConvocatoriaChange() {
    this.cargarTribunalesDesignados();
  }

  onDesignadosSearchEnter() {
    this.cargarTribunalesDesignados();
  }

  clearDesignadosFilters() {
    this.designadosSearchTerm = '';
    this.selectedConvocatoriaDesignados = null;
    this.cargarTribunalesDesignados();
  }

  get totalTribunalesDesignados(): number {
    const ids = new Set<number>();
    for (const row of this.tribunalesDesignados) {
      if (row.miembro_id) {
        ids.add(Number(row.miembro_id));
      }
    }
    return ids.size;
  }

  get totalDesignacionesTribunal(): number {
    return this.tribunalesDesignados.length;
  }

  cargarTribunalesDesignados() {
    this.errorDesignados = null;
    this.loadingDesignados = true;
    this.tribunalesDesignados = [];

    this.sga.getTribunalesDesignados({
      convocatoria_id: this.selectedConvocatoriaDesignados,
      search: this.designadosSearchTerm || null,
    }).subscribe({
      next: (resp) => {
        const base = (resp as any)?.data ?? resp;
        const list: any[] = Array.isArray(base) ? base : [];

        // Mapear filas crudas
        const mapped = list.map((row) => {
          const nombreRaw = (row.nombre ?? '').toString().trim();
          return {
            defensa_id: Number(row.defensa_id),
            cod_ceta: row.cod_ceta ?? null,
            fecha_defensa: row.fecha_defensa ?? null,
            hora_inicio: row.hora_inicio ?? null,
            hora_fin: row.hora_fin ?? null,
            aula: row.aula ?? null,
            grupo: row.grupo ?? null,
            rol_nombre: row.rol_nombre || row.rol_codigo || '',
            rol_codigo: row.rol_codigo || '',
            tipo: row.tipo === 'externo' ? 'externo' : 'interno',
            miembro_id: Number(row.miembro_id),
            nombre: nombreRaw || null,
            convocatoria_id: row.convocatoria_id ?? null,
            convocatoria_nombre: row.convocatoria_nombre ?? null,
            convocatoria_numero: row.convocatoria_numero ?? null,
            tiene_doc_tribunal: !!(row.tiene_doc_tribunal ?? row.doc_tribunal ?? false),
          } as any;
        });

        // Agrupar por miembro + tipo + rol + convocatoria, acumulando fechas y horarios
        const grouped = new Map<string, any>();

        for (const row of mapped) {
          const keyParts = [
            row.miembro_id,
            row.tipo,
            row.rol_codigo || '',
            row.convocatoria_id != null ? row.convocatoria_id : 'null',
          ];
          const key = keyParts.join('|');

          let agg = grouped.get(key);
          if (!agg) {
            agg = {
              ...row,
              fechas_label: '',
              horarios_label: '',
            };
            agg._items = [] as any[];
            grouped.set(key, agg);
          }

          agg._items.push(row);
        }

        // Construir etiquetas de fechas y horarios acumulados ordenados por fecha+hora
        const finalList: any[] = [];
        grouped.forEach((agg) => {
          const items: any[] = Array.isArray(agg._items) ? agg._items.slice() : [];
          items.sort((a, b) => {
            const fa = (a.fecha_defensa || '') + ' ' + (a.hora_inicio || '');
            const fb = (b.fecha_defensa || '') + ' ' + (b.hora_inicio || '');
            return fa.localeCompare(fb);
          });

          const fechasUnicas = new Set<string>();
          const horariosUnicos = new Set<string>();

          for (const it of items) {
            const fechaRaw = (it.fecha_defensa || '').toString();
            let fecha = '';
            if (fechaRaw) {
              // Normalizar fecha tipo ISO (YYYY-MM-DD...) a DD/MM/YYYY
              const isoDate = fechaRaw.substring(0, 10); // 2025-08-18
              const parts = isoDate.split('-');
              if (parts.length === 3) {
                const [y, m, d] = parts;
                fecha = `${d}/${m}/${y}`;
              } else {
                fecha = fechaRaw;
              }
            }

            const horaIniRaw = (it.hora_inicio || '').toString();
            const horaFinRaw = (it.hora_fin || '').toString();
            const horaIni = horaIniRaw ? horaIniRaw.substring(0, 5) : '';
            const horaFin = horaFinRaw ? horaFinRaw.substring(0, 5) : '';
            if (fecha && horaIni && horaFin) {
              // Para fechas_label usamos solo la fecha formateada; para horarios_label solo el rango HH:mm-HH:mm
              // Aula se muestra en su propia columna.
            }

            if (fecha) {
              fechasUnicas.add(fecha);
            }

            if (horaIni && horaFin) {
              horariosUnicos.add(`${horaIni}-${horaFin}`);
            }
          }

          const fechasArr = Array.from(fechasUnicas.values());
          const horariosArr = Array.from(horariosUnicos.values());

          agg.fechas_label = fechasArr.length ? fechasArr.join(', ') : null;
          // Horarios como solo rangos "HH:mm-HH:mm" separados por viñetas
          agg.horarios_list = horariosArr.length ? horariosArr : null;
          agg.horarios_label = horariosArr.length ? horariosArr.join(' • ') : null;

          delete agg._items;
          finalList.push(agg);
        });

        this.tribunalesDesignados = finalList;
      },
      error: (err) => {
        console.error('[Tribunales] Error al cargar tribunales designados', err);
        this.errorDesignados = err?.message || 'Error al cargar tribunales designados.';
        this.tribunalesDesignados = [];
      },
      complete: () => {
        this.loadingDesignados = false;
      },
    });
  }

  openDesignacionModal() {
    this.designacionShowErrors = false;
    this.miembros = [
      { tipo: 'interno', miembroId: null, rol: 'PRESIDENTE' },
      { tipo: 'interno', miembroId: null, rol: 'DELEGADO_INTERNO' },
      { tipo: 'externo', miembroId: null, rol: 'DELEGADO_EXTERNO' },
    ];
    this.designacionModalVisible = true;
  }

  getCondicionInternaLabel(t: any): string {
    const v = (t && (t as any).condicion_interna) as string | undefined;
    if (v === 'planta') {
      return 'Planta';
    }
    if (v === 'consultor') {
      return 'Consultor';
    }
    return '-';
  }

  closeDesignacionModal() {
    if (this.designacionSaving) {
      return;
    }
    this.designacionModalVisible = false;
  }

  get internosOptions(): TutorReg[] {
    return this.tribunalesInternos || [];
  }

  get externosOptions(): Array<{ id: number; nombre: string }> {
    return this.tribunalesExternos || [];
  }

  get todosTribunalesDisponibles(): Array<any> {
    const internos = (this.tribunalesInternos || []).map(t => ({ ...t, tipo: (t as any).tipo || 'interno' as const }));
    const externos = (this.tribunalesExternos || []).map(e => ({
      ...e,
      // Respetar el tipo real almacenado en BD; si viene vacío, asumir externo
      tipo: (e as any).tipo === 'interno' ? 'interno' as const : 'externo' as const,
    }));
    return [...internos, ...externos];
  }

  onGenerarDocTribunal(row: any) {
    this.confirmDocRow = row;
    this.confirmDocModalVisible = true;
  }

  closeConfirmDocTribunal() {
    if (this.confirmDocLoading) {
      return;
    }
    this.confirmDocModalVisible = false;
    this.confirmDocRow = null;
  }

  confirmarGenerarDocTribunal() {
    if (!this.confirmDocRow) {
      return;
    }

    const row = this.confirmDocRow;
    const payload = {
      miembro_id: Number(row.miembro_id),
      tipo: row.tipo === 'externo' ? ('externo' as const) : ('interno' as const),
      rol: row.rol_codigo || row.rol_nombre || '',
      convocatoria_id: row.convocatoria_id ?? null,
    };

    if (!payload.miembro_id || !payload.rol) {
      console.error('[Tribunales] Faltan datos para generar documento de tribunal', payload);
      return;
    }

    this.confirmDocLoading = true;
    this.loadingService.showModal();

    this.sga.downloadDocDesignacionTribunal(payload).subscribe({
      next: (resp) => {
        this.confirmDocLoading = false;
        this.loadingService.hideModal();
        this.confirmDocModalVisible = false;
        this.confirmDocRow = null;

        const blob = resp.body as Blob;
        const contentDisposition = resp.headers.get('Content-Disposition') || '';
        let filename = 'designacion-tribunal.docx';
        const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
        if (match && match[1]) {
          filename = decodeURIComponent(match[1]);
        }
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);

        // Refrescar la lista para que se marque como "Documento generado"
        this.cargarTribunalesDesignados();
      },
      error: (err) => {
        console.error('[Tribunales] Error al generar documento de tribunal', err);
        this.confirmDocLoading = false;
        this.loadingService.hideModal();
      },
    });
  }

  canSaveDesignacion(): boolean {
    if (!this.miembros || this.miembros.length !== 3) {
      return false;
    }
    const roles = new Set<string>();
    for (const m of this.miembros) {
      if (!m.miembroId || !m.rol) {
        return false;
      }
      if (roles.has(m.rol)) {
        return false;
      }
      roles.add(m.rol);
    }
    return true;
  }

  guardarDesignacionTribunal() {
    this.designacionShowErrors = true;
    if (!this.canSaveDesignacion()) {
      return;
    }
    this.designacionSaving = true;

    // TODO: conectar con backend cuando existan los endpoints.
    // Por ahora, solo mostramos en consola la estructura que se enviaría.
    const payload = this.miembros.map((m) => ({
      tipo: m.tipo,
      miembro_id: m.miembroId,
      rol: m.rol,
    }));
    console.debug('[DesignacionTribunal] payload listo', payload);

    // Simular guardado local sin backend
    setTimeout(() => {
      this.designacionSaving = false;
      this.designacionModalVisible = false;
    }, 400);
  }
}
