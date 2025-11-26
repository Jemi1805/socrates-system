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

    this.route.queryParamMap.subscribe((params) => {
      const cod = params.get('cod_ceta');
      this.codCeta = (cod || this.estudiante?.cod_ceta || '').toString() || null;
      this.loadTribunalesDisponibles();
      this.resetMiembros();
    });
  }

  private resetMiembros() {
    this.miembros = [
      { tipo: 'interno', miembroId: null, rol: 'PRESIDENTE' },
      { tipo: 'interno', miembroId: null, rol: 'DELEGADO_INTERNO' },
      { tipo: 'externo', miembroId: null, rol: 'DELEGADO_EXTERNO' },
    ];
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
    if (!this.miembros || this.miembros.length !== 3) return false;
    const roles = new Set<string>();
    for (const m of this.miembros) {
      if (!m.miembroId || !m.rol) return false;
      if (roles.has(m.rol)) return false;
      roles.add(m.rol);
    }
    return !!this.codCeta;
  }

  guardarDesignacionTribunal() {
    this.showErrors = true;
    if (!this.canSaveDesignacion()) {
      return;
    }
    const cod = (this.codCeta || '').toString().trim();
    if (!cod) return;

    const payload = this.miembros.map((m) => ({
      cod_ceta_est: cod,
      tipo: m.tipo,
      miembro_id: m.miembroId,
      rol: m.rol,
    }));

    this.saving = true;
    this.loadingService.showModal();
    console.debug('[DesignacionTribunal] payload listo', payload);
    // TODO: conectar con backend cuando existan los endpoints reales
    setTimeout(() => {
      this.saving = false;
      this.loadingService.hideModal();
      this.router.navigate(['/postulantes']);
    }, 400);
  }

  volverALista() {
    this.router.navigate(['/postulantes']);
  }
}
