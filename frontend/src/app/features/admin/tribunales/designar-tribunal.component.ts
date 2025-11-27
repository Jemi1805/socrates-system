import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { SgaService, TutorReg } from '../../../shared/services/sga.service';
import { LoadingService } from '../../../core/services/loading.service';

@Component({
  selector: 'app-designar-tribunal',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent, RouterModule],
  templateUrl: './designar-tribunal.component.html',
  styleUrls: ['./designar-tribunal.component.scss'],
})
export class DesignarTribunalComponent implements OnInit {
  // Contexto del estudiante / defensa (simplificado por ahora)
  estudiante: any = null;
  proyecto: any = null;
  codCeta: string | null = null;
  defensa: any = null;

  // Número de miembros de tribunal a designar (se toma de la convocatoria)
  numeroTribunales = 3;

  // Tribunales disponibles (internos y externos)
  tribunalesInternos: Array<TutorReg & { es_tribunal?: boolean }> = [];
  tribunalesExternos: Array<{
    id: number;
    nombre: string;
    apellido_p?: string;
    apellido_m?: string;
    ci: string;
    celular?: string;
    profesion?: string;
    titulo_academico?: string;
    activo?: boolean;
  }> = [];

  loadingTribunales = false;

  // Selección de miembros (3 cargos fijos)
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

  saving = false;
  showErrors = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sga: SgaService,
    private loadingService: LoadingService,
  ) {}

  ngOnInit(): void {
    // Recuperar contexto desde sessionStorage si existe
    try {
      const raw = sessionStorage.getItem('datos_postulacion');
      if (raw) {
        const parsed = JSON.parse(raw);
        this.estudiante = parsed?.estudiante || null;
        this.proyecto = parsed?.proyecto_cache || null;
        this.defensa = parsed?.defensa || null;
      }
      const pc = sessionStorage.getItem('proyecto_cache');
      if (pc && !this.proyecto) {
        this.proyecto = JSON.parse(pc);
      }
      // Si no hay defensa aún, intentar recuperar desde la fila seleccionada en la lista
      if (!this.defensa) {
        const rawDef = sessionStorage.getItem('defensa_actual');
        if (rawDef) {
          this.defensa = JSON.parse(rawDef);
        } else {
          const rawPost = sessionStorage.getItem('postulante_defensa_actual');
          if (rawPost) {
            const parsedPost = JSON.parse(rawPost);
            this.defensa = parsedPost?.defensa || null;
            if (!this.estudiante) {
              this.estudiante = {
                cod_ceta: parsedPost?.cod_ceta,
                nombres_est: parsedPost?.nombres_est,
                ap_pat: parsedPost?.ap_pat,
                ap_mat: parsedPost?.ap_mat,
                carrera: parsedPost?.carrera,
              };
            }
          }
        }
      }
    } catch {}

    const params = this.route.snapshot.queryParamMap;
    const cod = params.get('cod_ceta');
    this.codCeta = (cod || this.estudiante?.cod_ceta || '').toString() || null;

    // Cargas HTTP una sola vez en OnInit usando snapshot
    // this.loadTribunalesDisponibles(); // Desactivado temporalmente por error de NG0103
    this.loadNumeroTribunales();
  }

  private resetMiembros() {
    const baseRoles: Array<'PRESIDENTE' | 'DELEGADO_INTERNO' | 'DELEGADO_EXTERNO'> = [
      'PRESIDENTE',
      'DELEGADO_INTERNO',
      'DELEGADO_EXTERNO',
    ];

    const total = this.numeroTribunales && this.numeroTribunales > 0 ? this.numeroTribunales : 3;

    this.miembros = Array.from({ length: total }, (_, idx) => ({
      tipo: idx === total - 1 ? 'externo' : 'interno',
      miembroId: null,
      rol: (baseRoles[idx] as any) || '',
    }));
  }

  private loadNumeroTribunales() {
    // 1) Intentar leer directamente desde la defensa o el postulante almacenado
    const direct =
      (this.defensa && (this.defensa as any).numero_tribunales != null
        ? Number((this.defensa as any).numero_tribunales)
        : null) ??
      (this.defensa && (this.defensa as any).convocatoria?.numero_tribunales != null
        ? Number((this.defensa as any).convocatoria.numero_tribunales)
        : null);

    if (direct != null && !isNaN(direct) && direct > 0) {
      this.numeroTribunales = direct;
      console.debug('[DesignarTribunal] numero_tribunales tomado desde defensa/postulante:', direct, this.defensa);
      this.resetMiembros();
      return;
    }

    // 2) Si no viene en la defensa, consultar la convocatoria al backend
    const convId = this.defensa?.convocatoria_id || this.defensa?.convocatoria?.id;
    console.debug('[DesignarTribunal] defensa actual para numero_tribunales:', this.defensa, 'convId:', convId);

    if (!convId) {
      this.numeroTribunales = 3;
      this.resetMiembros();
      return;
    }

    this.sga.getConvocatoriaById(convId).subscribe({
      next: (conv) => {
        const n = conv && (conv as any).numero_tribunales != null ? Number((conv as any).numero_tribunales) : 3;
        this.numeroTribunales = n > 0 ? n : 3;
        console.debug('[DesignarTribunal] numero_tribunales desde API convocatoria:', this.numeroTribunales, conv);
        this.resetMiembros();
      },
      error: (err) => {
        console.error('[DesignarTribunal] Error obteniendo convocatoria para numero_tribunales', err);
        this.numeroTribunales = 3;
        this.resetMiembros();
      },
    });
  }

  private loadTribunalesDisponibles() {
    this.loadingTribunales = true;
    this.tribunalesInternos = [];
    this.tribunalesExternos = [];

    this.sga.getTutores().subscribe({
      next: (resp) => {
        const list = (resp as any)?.data ?? resp;
        this.tribunalesInternos = Array.isArray(list) ? (list as TutorReg[]) : [];
        this.loadingTribunales = false;
      },
      error: () => {
        this.loadingTribunales = false;
      },
    });

    this.sga.getTribunalesExternos().subscribe({
      next: (resp) => {
        const list = (resp as any)?.data ?? resp;
        this.tribunalesExternos = Array.isArray(list) ? (list as any[]) : [];
      },
      error: () => {},
    });
  }

  get internosOptions(): TutorReg[] {
    return this.tribunalesInternos || [];
  }

  get externosOptions(): Array<{ id: number; nombre: string }> {
    return (this.tribunalesExternos || []).map((e: any) => ({ id: e.id, nombre: `${e.apellido_p || ''} ${e.nombre || ''} ${e.apellido_m || ''}`.trim() || e.nombre }));
  }

  get tribunalesDisponiblesCombinados(): Array<{ value: string; label: string }> {
    const internos = (this.tribunalesInternos || [])
      .filter((t: any) => t && t.es_tribunal && t.activo !== false)
      .map((t) => ({
        value: `i:${t.id}`,
        label: `[INT] ${`${t.apellido_p || ''} ${t.nombre || ''} ${t.apellido_m || ''}`.trim() || t.nombre}`,
      }));

    const externos = (this.tribunalesExternos || [])
      .filter((e: any) => e && e.activo !== false)
      .map((e: any) => ({
        value: `e:${e.id}`,
        label: `[EXT] ${`${e.apellido_p || ''} ${e.nombre || ''} ${e.apellido_m || ''}`.trim() || e.nombre}`,
      }));

    return [...internos, ...externos];
  }

  buildMiembroSelectValue(index: number): string | null {
    const m = this.miembros[index];
    if (!m || !m.miembroId) {
      return null;
    }
    const prefix = m.tipo === 'externo' ? 'e' : 'i';
    return `${prefix}:${m.miembroId}`;
  }

  onMiembroSeleccionChange(index: number, value: string | null) {
    if (!value) {
      this.miembros[index].miembroId = null;
      return;
    }
    const [prefix, idStr] = value.split(':');
    const idNum = Number(idStr);
    if (!idNum) {
      this.miembros[index].miembroId = null;
      return;
    }
    this.miembros[index].tipo = prefix === 'e' ? 'externo' : 'interno';
    this.miembros[index].miembroId = idNum;
  }

  canSaveDesignacion(): boolean {
    if (!this.miembros || this.miembros.length !== this.numeroTribunales) return false;
    const roles = new Set<string>();
    for (const m of this.miembros) {
      if (!m.miembroId || !m.rol) return false;
      if (roles.has(m.rol)) return false;
      roles.add(m.rol);
    }
    return !!this.codCeta && !!this.defensa?.id;
  }

  guardarDesignacionTribunal() {
    this.showErrors = true;
    if (!this.canSaveDesignacion()) {
      return;
    }
    const cod = (this.codCeta || '').toString().trim();
    const defensaId = this.defensa?.id;
    if (!cod || !defensaId) return;

    const miembrosPayload = this.miembros.map((m) => ({
      tipo: m.tipo,
      miembro_id: m.miembroId as number,
      rol: m.rol,
    }));

    this.saving = true;
    this.loadingService.showModal();
    console.debug('[DesignacionTribunal] payload listo', { defensaId, cod_ceta: cod, miembros: miembrosPayload });

    this.sga
      .setDefensaTribunal(defensaId, miembrosPayload)
      .subscribe({
        next: () => {
          this.saving = false;
          this.loadingService.hideModal();
          this.router.navigate(['/postulantes']);
        },
        error: () => {
          this.saving = false;
          this.loadingService.hideModal();
        },
      });
  }

  volverALista() {
    this.router.navigate(['/postulantes']);
  }
}
