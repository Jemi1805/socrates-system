import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { SgaService, TutorReg } from '../../../shared/services/sga.service';

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
  tribunalesDisponibles: TutorReg[] = [];
  // Placeholder: tribunales externos (a futuro se cargarán desde backend)
  tribunalesExternos: Array<{ id: number; nombre: string }> = [];

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

  constructor(private sga: SgaService) {}

  ngOnInit(): void {
    this.loadTribunalesDisponibles();
  }

  loadTribunalesDisponibles() {
    this.loadingDisponibles = true;
    this.errorDisponibles = null;
    this.tribunalesDisponibles = [];
    this.sga.getTutores().subscribe({
      next: (resp) => {
        const list = (resp as any)?.data ?? resp;
        this.tribunalesDisponibles = Array.isArray(list) ? list as TutorReg[] : [];
        this.loadingDisponibles = false;
      },
      error: (err) => {
        this.loadingDisponibles = false;
        this.errorDisponibles = err?.message || 'Error al cargar tribunales disponibles';
      }
    });
  }

  // --- Designación de tribunales ---

  toggleDesignadosSection() {
    this.showDesignados = !this.showDesignados;
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
    return this.tribunalesDisponibles || [];
  }

  get externosOptions(): Array<{ id: number; nombre: string }> {
    return this.tribunalesExternos || [];
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
