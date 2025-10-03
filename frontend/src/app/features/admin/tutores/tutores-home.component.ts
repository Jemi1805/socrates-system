import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { SgaService, Docente, ApiResponse } from '../../../shared/services/sga.service';

@Component({
  selector: 'app-tutores-home',
  standalone: true,
  imports: [CommonModule, RouterLink, HeaderComponent, FormsModule],
  templateUrl: './tutores-home.component.html',
  styleUrls: ['./tutores-home.component.scss']
})
export class TutoresHomeComponent {
  // Importar Docentes (SGA)
  showImport = false;
  carreraSeleccionada: 'mecanica' | 'electricidad' = 'mecanica';
  docentes: Docente[] = [];
  loadingDocentes = false;
  errorDocentes: string | null = null;
  // Selección múltiple por checkbox (clave: ci)
  selectedCis: Set<string> = new Set<string>();
  // Modal de edición de docente
  modalEditarDocenteVisible: boolean = false;
  editingDocente: Partial<Docente> | null = null;

  constructor(private sga: SgaService, private router: Router) {}

  toggleImportar() {
    this.showImport = !this.showImport;
    // Limpia estado al ocultar
    if (!this.showImport) {
      this.docentes = [];
      this.errorDocentes = null;
    }
  }

  buscarDocentes() {
    this.loadingDocentes = true;
    this.errorDocentes = null;
    this.docentes = [];
    this.selectedCis.clear();
    this.sga.getDocentes(this.carreraSeleccionada).subscribe({
      next: (resp: ApiResponse<Docente[]>) => {
        this.loadingDocentes = false;
        if (resp && resp.success) {
          this.docentes = (resp.data || []).map(d => ({
            ...d,
            pertinencia: d.pertinencia || '' // no viene del SGA; reservado para edición futura
          }));
        } else {
          this.errorDocentes = resp?.message || 'No se pudieron cargar los docentes';
        }
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
      pertinencia: doc.pertinencia || ''
    } as Partial<Docente>;
    this.modalEditarDocenteVisible = true;
  }

  cerrarModalEditarDocente() {
    this.modalEditarDocenteVisible = false;
    this.editingDocente = null;
  }

  guardarDocenteEditado() {
    if (!this.editingDocente) return;
    // Actualizar la fila en memoria (por CI como clave). TODO: integrar backend cuando esté disponible
    const ciKey = (this.editingDocente.ci || '').toString().trim();
    const idx = this.docentes.findIndex(d => (d.ci || '').toString().trim() === ciKey);
    const updated: Docente = {
      nombre: this.editingDocente.nombre || '',
      apellido_p: this.editingDocente.apellido_p || '',
      apellido_m: this.editingDocente.apellido_m || '',
      ci: this.editingDocente.ci || '',
      profesion: this.editingDocente.profesion || '',
      celular: this.editingDocente.celular || '',
      pertinencia: this.editingDocente.pertinencia || ''
    } as Docente;
    if (idx >= 0) {
      this.docentes[idx] = updated;
    } else {
      this.docentes.push(updated);
    }
    this.cerrarModalEditarDocente();
  }

  // Helpers de selección
  isSelected(doc: Docente): boolean {
    return !!doc?.ci && this.selectedCis.has(doc.ci);
  }

  toggleSelect(doc: Docente, checked: boolean) {
    if (!doc?.ci) return;
    if (checked) this.selectedCis.add(doc.ci); else this.selectedCis.delete(doc.ci);
  }

  get hasSeleccion(): boolean {
    return this.selectedCis.size > 0;
  }

  registrarTutores() {
    // Por ahora, navega al registro con el primer docente seleccionado
    const seleccionados = this.docentes.filter(d => this.selectedCis.has(d.ci));
    if (!seleccionados.length) return;
    this.editarDocente(seleccionados[0]);
  }
}
