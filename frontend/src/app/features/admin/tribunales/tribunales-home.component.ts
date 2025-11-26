import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
  // Placeholder: tribunales externos (a futuro se cargarán desde backend)
  tribunalesExternos: Array<{ id: number; nombre: string; apellido_p?: string; apellido_m?: string; ci: string; celular?: string; profesion?: string; titulo_academico?: string }> = [];

  // UI: sección de tribunales designados por postulante
  showDesignados = false;
  selectedPostulanteCodCeta: string | null = null;

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
  // Solo registro de tribunal externo
  registroExterno: {
    nombre: string;
    apellido_p: string;
    apellido_m: string;
    ci: string;
    celular: string;
    profesion: string;
    titulo_academico: string;
  } = {
    nombre: '',
    apellido_p: '',
    apellido_m: '',
    ci: '',
    celular: '',
    profesion: '',
    titulo_academico: '',
  };

  // Opciones de título académico (alineadas con tutores)
  tituloAcademicoOpciones: string[] = ['T.S.', 'Ing.', 'Lic.', 'MSc.', 'Dr.', 'Sr.'];

  constructor(private sga: SgaService, private loadingService: LoadingService) {}

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
    this.registroExterno = {
      nombre: '',
      apellido_p: '',
      apellido_m: '',
      ci: '',
      celular: '',
      profesion: '',
      titulo_academico: '',
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

    this.sga.createTribunalExterno(payload).subscribe({
      next: () => {
        this.registroSaving = false;
        this.registroModalVisible = false;
        this.loadingService.hideModal();
      },
      error: (err) => {
        console.error('[RegistroTribunal] Error al guardar tribunal externo', err);
        this.registroSaving = false;
        this.loadingService.hideModal();
      }
    });
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

  // Switch en tabla de disponibles: internos usan es_tribunal, externos usan activo
  onToggleTribunal(t: any, checked: boolean) {
    if (t.tipo === 'externo') {
      t.activo = checked;
      this.sga.toggleTribunal(t.id, checked).subscribe({
        next: () => {},
        error: (err) => {
          console.error('[Tribunales] Error al togglear tribunal externo', err);
        },
      });
    } else {
      t.es_tribunal = checked;
      console.debug('[Tribunales] toggle es_tribunal interno', { tutorId: t.id, es_tribunal: checked });
    }
  }

  toggleDesignadosSection() {
    const newVal = !this.showDesignados;
    this.showDesignados = newVal;
    if (newVal) {
      this.showDisponibles = false;
    }
  }

  openDesignacionModal() {
    const cod = (this.selectedPostulanteCodCeta || '').toString().trim();
    if (!cod) {
      this.designacionShowErrors = true;
      return;
    }
    this.designacionShowErrors = false;
    this.miembros = [
      { tipo: 'interno', miembroId: null, rol: 'PRESIDENTE' },
      { tipo: 'interno', miembroId: null, rol: 'DELEGADO_INTERNO' },
      { tipo: 'externo', miembroId: null, rol: 'DELEGADO_EXTERNO' },
    ];
    this.designacionModalVisible = true;
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
    const internos = (this.tribunalesInternos || []).map(t => ({
      ...t,
      tipo: 'interno' as const,
    }));
    const externos = (this.tribunalesExternos || []).map(e => ({
      ...e,
      tipo: 'externo' as const,
    }));
    return [...internos, ...externos];
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
    const cod = (this.selectedPostulanteCodCeta || '').toString().trim();
    if (!cod) {
      return;
    }
    this.designacionSaving = true;

    // TODO: conectar con backend cuando existan los endpoints.
    // Por ahora, solo mostramos en consola la estructura que se enviaría.
    const payload = this.miembros.map((m) => ({
      cod_ceta_est: cod,
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
