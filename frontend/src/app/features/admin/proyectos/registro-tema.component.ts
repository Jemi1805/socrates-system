import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ProyectoService } from './proyecto.service';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { PostulanteService } from '../postulantes/postulante.service';

interface EstudianteCtx {
  cod_ceta?: string | number;
  nombres?: string;
  ap_pat?: string;
  ap_mat?: string;
  ci?: string;
  procedencia?: string; // expedición
  celular?: string;
  carrera?: string;
  pensum?: string;
}

interface ModalidadCtx {
  id: number;
  nombre: string;
  descripcion?: string;
  monto_arancel?: string;
  icono?: string;
}

@Component({
  selector: 'app-registro-tema',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HeaderComponent],
  templateUrl: './registro-tema.component.html',
  styleUrls: ['./registro-tema.component.scss']
})
export class RegistroTemaComponent {
  loading = false;
  error: string | null = null;
  success: string | null = null;
  modalExitoVisible = false;
  resumenVisible = false;
  proyectoGuardado: any = null;

  estudiante: EstudianteCtx | null = null;
  modalidad: ModalidadCtx | null = null;

  // Constante: nombre del instituto
  private static readonly NOMBRE_INSTITUTO = 'INSTITUTO TECNOLÓGICO DE ENSEÑANZA AUTOMOTRIZ "CETA"';

  // Form fields
  nombres: string = '';
  apellidos: string = '';
  ci: string = '';
  expedicion: string = '';
  celular: string = '';
  instituto: string = RegistroTemaComponent.NOMBRE_INSTITUTO;
  carrera: string = '';
  modalidadNombre: string = '';
  tema: string = '';
  objetivos: string = '';

  // Modalidades: selección y confirmación (similar a Postulantes)
  modalidades: ModalidadCtx[] = [];
  modalVisible = false;
  modalConfirmCambioVisible = false;
  nuevaModalidad: ModalidadCtx | null = null;

  constructor(private proyectoService: ProyectoService, private router: Router, private postulanteService: PostulanteService) {
    // Cargar contexto desde sessionStorage si existe
    try {
      const raw = sessionStorage.getItem('datos_postulacion');
      if (raw) {
        const datos = JSON.parse(raw);
        this.estudiante = datos?.estudiante || null;
        this.modalidad = datos?.modalidad || null;
      }
    } catch {}

    // Prellenar encabezado si tenemos estudiante
    if (this.estudiante) {
      this.nombres = (this.estudiante.nombres || '').trim();
      const ap = [this.estudiante.ap_pat || '', this.estudiante.ap_mat || ''].filter(Boolean).join(' ').trim();
      this.apellidos = ap;
      this.ci = (this.estudiante.ci || '').toString();
      this.celular = (this.estudiante.celular || '').toString();
      this.expedicion = (this.estudiante.procedencia || '').toString();
      this.carrera = (this.estudiante.carrera || '').toString();
    }
    if (this.modalidad) {
      this.modalidadNombre = this.modalidad.nombre;
    }

    // Si tenemos cod CETA, verificar si ya existe un proyecto registrado para bloquear nuevos registros
    const cod = this.codCeta;
    if (cod) {
      this.proyectoService.getByCod(cod).subscribe({
        next: (p) => {
          if (p) {
            this.proyectoGuardado = p;
            this.resumenVisible = true; // Mostrar directamente el resumen si ya existe
          }
        },
        error: () => {}
      });
    }

    // Cargar modalidades disponibles para el modal de selección
    this.postulanteService.getModalidades().subscribe({
      next: (res: any) => {
        const lista = Array.isArray(res) ? res : (res && Array.isArray(res.data) ? res.data : []);
        this.modalidades = (lista || []).map((m: any) => ({
          id: m.id,
          nombre: m.nombre,
          descripcion: m.descripcion || '',
          monto_arancel: m.monto_arancel || '',
          icono: m.icono || ''
        }));
      },
      error: () => {
        this.modalidades = [];
      }
    });
  }

  get codCeta(): string {
    const c = this.estudiante?.cod_ceta;
    return c !== undefined && c !== null ? String(c) : '';
  }

  cancelar() {
    // Volver a la pantalla de selección de modalidad
    this.router.navigate(['/modalidad-graduacion']);
  }

  onSubmit() {
    this.error = null; this.success = null;
    if (!this.modalidad?.nombre) {
      this.error = 'No se ha determinado la modalidad.';
      return;
    }
    if (!this.tema || this.tema.trim().length < 3) {
      this.error = 'Ingrese un Nombre/Tema válido (mínimo 3 caracteres).';
      return;
    }

    const payload = {
      cod_ceta: this.codCeta || undefined,
      nombres: this.nombres?.trim() || undefined,
      apellidos: this.apellidos?.trim() || undefined,
      ci: this.ci?.toString() || undefined,
      expedicion: this.expedicion?.toString() || undefined,
      celular: this.celular?.toString() || undefined,
      instituto: this.instituto?.trim() || undefined,
      carrera: this.carrera?.trim() || undefined,
      nombre: this.tema.trim(),
      tipo: this.modalidad?.nombre || undefined,
      objetivo: this.objetivos?.trim() || undefined,
      estado: 'En progreso',
      porcentaje_avance: 0,
    } as const;

    this.loading = true;
    this.proyectoService.createProyecto(payload).subscribe({
      next: (res) => {
        this.success = 'Tema registrado correctamente.';
        this.proyectoGuardado = res || null;
        this.modalExitoVisible = true; // Mostrar modal primero; el resumen se muestra al cerrar
      },
      error: (err) => {
        console.error('Error al registrar tema:', err);
        this.error = (err?.error?.message || err?.message || 'No se pudo registrar el tema');
      },
      complete: () => this.loading = false,
    });
  }

  cerrarModalExito() {
    console.log('[RegistroTema] cerrarModalExito');
    this.modalExitoVisible = false;
    this.resumenVisible = true;
  }

  irModalidadGraduacion() {
    this.router.navigate(['/modalidad-graduacion']);
  }

  irPostulantes() {
    this.router.navigate(['/postulantes'], { queryParams: { ver: 1 } });
  }

  // --- Gestión de Modalidades (UI) ---
  mostrarModal() { 
    console.log('[RegistroTema] abrir modal');
    this.modalVisible = true; 
  }
  ocultarModal() { this.modalVisible = false; }

  seleccionarModalidad(mod: ModalidadCtx) {
    this.nuevaModalidad = mod;
    // Cerrar selección y abrir confirmación
    this.modalVisible = false;
    this.modalConfirmCambioVisible = true;
  }

  cancelarCambioModalidad() {
    this.modalConfirmCambioVisible = false;
    this.nuevaModalidad = null;
  }

  confirmarCambioModalidad() {
    if (!this.nuevaModalidad) return;
    this.modalConfirmCambioVisible = false;
    const seleccionado = this.nuevaModalidad;
    this.modalidad = { ...seleccionado };
    this.modalidadNombre = seleccionado.nombre;
    this.nuevaModalidad = null;
    // Persistir en sessionStorage para mantener coherencia entre páginas
    try {
      const raw = sessionStorage.getItem('datos_postulacion');
      const datos = raw ? JSON.parse(raw) : {};
      datos.modalidad = this.modalidad;
      sessionStorage.setItem('datos_postulacion', JSON.stringify(datos));
    } catch {}
  }

  // Iconos consistentes con el selector de modalidades (libros, persona, medalla, birrete)
  getModalidadIcon(mod: ModalidadCtx | null | undefined): string {
    if (!mod) return 'bi bi-award';
    const id = Number((mod as any).id || 0);
    const name = ((mod as any).nombre || '').toString().toLowerCase();
    // Priorizar icono definido en datos si existe
    if ((mod as any).icono) return (mod as any).icono as string;
    // Por ID conocido
    switch (id) {
      case 1: return 'bi bi-book'; // Proyecto de Grado
      case 2: return 'bi bi-book'; // Proyecto Sociocomunitario Productivo
      case 3: return 'bi bi-book'; // Proyecto de Emprendimiento Productivo
      case 4: return 'bi bi-person-badge'; // Trabajo Dirigido Externo
      case 5: return 'bi bi-award'; // Excelencia Académica
      case 6: return 'bi bi-mortarboard'; // Experiencia Laboral
    }
    // Heurística por nombre si no hay ID
    if (name.includes('grado') || name.includes('proyecto')) return 'bi bi-book';
    if (name.includes('dirigido') || name.includes('externo') || name.includes('trabajo')) return 'bi bi-person-badge';
    if (name.includes('excelencia') || name.includes('acad')) return 'bi bi-award';
    if (name.includes('experiencia') || name.includes('laboral')) return 'bi bi-mortarboard';
    return 'bi bi-award';
  }
}