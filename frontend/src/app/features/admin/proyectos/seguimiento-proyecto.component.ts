import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { ProyectoService } from './proyecto.service';
import { PostulanteService } from '../postulantes/postulante.service';
import { SgaService } from '../../../shared/services/sga.service';
import { LoadingService } from '../../../core/services/loading.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-seguimiento-proyecto',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HeaderComponent],
  templateUrl: './seguimiento-proyecto.component.html',
  styleUrls: ['./seguimiento-proyecto.component.scss']
})
export class SeguimientoProyectoComponent implements OnInit {
  codCeta: string = '';
  proyecto: any = null;
  postulante: any = null;
  tutor: any = null;

  estadoSeleccionado: string | null = null;
  pdfFile: File | null = null;
  saving = false;
  error: string | null = null;
  success: string | null = null;

  estados = ['Aprobado','Reprobado','Reprogramado','Abandono'];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private proyectoService: ProyectoService,
    private postulanteService: PostulanteService,
    private sgaService: SgaService,
    private loading: LoadingService,
  ) {}

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    const cod = qp.get('cod_ceta') || qp.get('cod') || qp.get('ceta');
    const pid = qp.get('proyecto_id');
    this.codCeta = cod ? String(cod) : '';

    // Cargar postulante (encabezado)
    if (this.codCeta) {
      const num = Number(this.codCeta);
      this.postulanteService.getInscripcionByCodCeta(num).subscribe({
        next: (res: any) => { this.postulante = res || null; },
        error: () => { this.postulante = null; }
      });
      this.sgaService.getTutoresDesignados({ cod_ceta: this.codCeta }).subscribe({
        next: (resp: any) => {
          const list = resp?.data ?? resp;
          const arr: any[] = Array.isArray(list) ? list : [];
          // Tomar el primero que coincida con el cod
          const found = arr.find((it: any) => (it?.estudiantes || []).some((e: any) => String(e?.cod_ceta) === this.codCeta));
          this.tutor = found || null;
        },
        error: () => { this.tutor = null; }
      });
    }

    // Cargar proyecto
    if (pid) {
      this.proyectoService.getProyectoById(String(pid)).subscribe({
        next: (p) => { this.setProyecto(p); },
        error: () => { this.loadProyectoByCod(); }
      });
    } else {
      this.loadProyectoByCod();
    }
  }

  private loadProyectoByCod() {
    if (!this.codCeta) return;
    this.proyectoService.getByCod(this.codCeta).subscribe({
      next: (res) => {
        const p = this.pickProyecto(res);
        this.setProyecto(p);
      },
      error: () => { this.proyecto = null; }
    });
  }

  getSeguimientoUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    const raw = String(path).trim();
    if (!raw) return null;
    const apiRoot = environment.apiUrl.replace(/\/+api\/?$/, '');
    const normalized = raw.startsWith('storage/') ? raw : `storage/${raw}`;
    return `${apiRoot}/${normalized}`;
  }

  private pickProyecto(res: any): any {
    if (!res) return null;
    if (Array.isArray(res)) return res[0] || null;
    if (res?.data) return Array.isArray(res.data) ? (res.data[0] || null) : res.data;
    if (res?.proyecto) return Array.isArray(res.proyecto) ? (res.proyecto[0] || null) : res.proyecto;
    return res;
  }

  private setProyecto(p: any) {
    this.proyecto = p || null;
    if (this.proyecto) {
      const est = (this.proyecto as any).seguimiento_estado || null;
      this.estadoSeleccionado = est ? this.ucfirst(String(est)) : null;
    }
  }

  onFileChange(ev: any) {
    const f = ev?.target?.files?.[0] as File | undefined;
    this.pdfFile = f || null;
  }

  guardar() {
    if (!this.proyecto?.id) {
      this.error = 'No se encontró el proyecto';
      return;
    }
    this.error = null; this.success = null;
    this.saving = true;
    this.loading.showModal();
    const estado = this.estadoSeleccionado ? this.estadoSeleccionado : undefined;
    this.proyectoService.uploadSeguimientoPdf(this.proyecto.id, { pdf: this.pdfFile || undefined, estado }).subscribe({
      next: (resp: any) => {
        this.success = 'Seguimiento actualizado';
        this.setProyecto(resp);
      },
      error: (err) => {
        this.error = err?.error?.message || err?.message || 'No se pudo guardar el seguimiento';
      },
      complete: () => { this.saving = false; this.loading.hideModal(); }
    });
  }

  getSeguimientoNombre(): string | null {
    const path = (this.proyecto as any)?.seguimiento_pdf;
    if (!path) return null;
    const s = String(path);
    const parts = s.split('/');
    const last = parts[parts.length - 1];
    return last || s;
  }

  volver() {
    this.router.navigate(['/postulantes']);
  }

  ucfirst(s: string): string {
    if (!s) return s;
    const low = s.toLowerCase();
    return low.charAt(0).toUpperCase() + low.slice(1);
  }
}
