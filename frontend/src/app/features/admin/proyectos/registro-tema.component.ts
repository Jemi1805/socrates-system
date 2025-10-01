import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { ProyectoService } from './proyecto.service';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { PostulanteService } from '../postulantes/postulante.service';
import { PdfService } from '../../../shared/services/pdf.service';

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
export class RegistroTemaComponent implements OnInit {
  loading = false;
  error: string | null = null;
  success: string | null = null;
  // Estado del botón de generación de PDF
  generandoFmdg = false;
  modalExitoVisible = false;
  resumenVisible = false;
  proyectoGuardado: any = null;
  // Cargando silencioso del resumen para evitar parpadeos
  hydratingResumen = false;

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

  constructor(
    private proyectoService: ProyectoService,
    private router: Router,
    private postulanteService: PostulanteService,
    private pdfService: PdfService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    // 1) Cargar contexto desde sessionStorage si existe
    try {
      const raw = sessionStorage.getItem('datos_postulacion');
      if (raw) {
        const datos = JSON.parse(raw);
        this.estudiante = datos?.estudiante || null;
        this.modalidad = datos?.modalidad || null;
      }
      // Sembrar proyecto desde cache si existe para render inmediato
      const rawProyecto = sessionStorage.getItem('proyecto_cache');
      if (rawProyecto) {
        const pc = JSON.parse(rawProyecto);
        // No confiar ciegamente: solo tomar campos útiles
        const nombreTema = pc?.nombre ?? pc?.tema ?? pc?.titulo ?? pc?.title ?? '';
        const objetivo = pc?.objetivo ?? pc?.objetivos ?? '';
        const estado = pc?.estado ?? '';
        const tipo = pc?.tipo ?? '';
        this.tema = nombreTema ? String(nombreTema) : (this.tema || '');
        this.objetivos = objetivo ? String(objetivo) : (this.objetivos || '');
        this.proyectoGuardado = {
          ...(this.proyectoGuardado || {}),
          nombre: this.tema || undefined,
          objetivo: this.objetivos || undefined,
          estado: estado || (this.proyectoGuardado?.estado || undefined),
          tipo: tipo || (this.proyectoGuardado?.tipo || undefined),
        };
      }
    } catch {}

    // 2) Prellenar encabezado si tenemos estudiante
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

    // Importante: Angular puede reutilizar el componente en la misma ruta.
    // Nos suscribimos a cambios de query params para forzar sincronización.
    this.route.queryParamMap.subscribe(qp => {
      const qpCod = qp.get('cod_ceta') || qp.get('cod') || qp.get('ceta');
      const ver = (qp.get('ver') || '').toString().toLowerCase();
      const verResumen = ver === 'resumen' || ver === '1' || ver === 'true';
      if (qpCod && String(qpCod) !== String(this.codCeta)) {
        // Actualizar estado base
        if (!this.estudiante) this.estudiante = { cod_ceta: qpCod } as any;
        else this.estudiante.cod_ceta = qpCod;
        try {
          const raw = sessionStorage.getItem('datos_postulacion');
          const datos = raw ? JSON.parse(raw) : {};
          datos.estudiante = { ...(datos.estudiante || {}), cod_ceta: qpCod };
          sessionStorage.setItem('datos_postulacion', JSON.stringify(datos));
        } catch {}

        // Rehidratar cabecera desde BD local de postulantes
        this.postulanteService.getById(qpCod as any).subscribe({
          next: (p: any) => {
            if (p) {
              const nombres = (p.nombres_est || p.nombres || '').toString().trim();
              const apPat = (p.ap_pat || '').toString().trim();
              const apMat = (p.ap_mat || '').toString().trim();
              this.nombres = nombres;
              this.apellidos = [apPat, apMat].filter(Boolean).join(' ').trim();
              this.ci = (p.ci || '').toString();
              this.expedicion = ((p.procedencia || (p as any).expedido) || '').toString();
              this.carrera = ((p as any).carrera_nombre || p.carrera || '').toString();
              this.estudiante = {
                cod_ceta: qpCod,
                nombres: nombres,
                ap_pat: apPat,
                ap_mat: apMat,
                ci: this.ci,
                procedencia: this.expedicion,
                celular: (p as any).celular || this.celular,
                carrera: this.carrera,
                pensum: p.pensum,
              };
              try {
                const raw = sessionStorage.getItem('datos_postulacion');
                const datos = raw ? JSON.parse(raw) : {};
                datos.estudiante = { ...(datos.estudiante || {}), ...this.estudiante };
                sessionStorage.setItem('datos_postulacion', JSON.stringify(datos));
              } catch {}
            }
          },
          error: () => {}
        });

        // Reconsultar proyecto por el nuevo CETA y sincronizar resumen
        const cod = String(qpCod);
        // Si se solicita ver=resumen, mostramos el resumen de inmediato (optimista) y sembramos datos locales
        if (verResumen) {
          this.resumenVisible = true;
          this.hydratingResumen = true;
          const nombreCompleto = `${this.nombres || ''} ${this.apellidos || ''}`.trim();
          this.proyectoGuardado = {
            ...(this.proyectoGuardado || {}),
            cod_ceta: this.codCeta || qpCod,
            nombres: this.nombres || (this.estudiante?.nombres || ''),
            apellidos: this.apellidos || [this.estudiante?.ap_pat || '', this.estudiante?.ap_mat || ''].filter(Boolean).join(' ').trim(),
            ci: this.ci || (this.estudiante?.ci || ''),
            expedicion: this.expedicion || (this.estudiante?.procedencia || ''),
            celular: this.celular || (this.estudiante?.celular || ''),
            instituto: this.instituto,
            carrera: this.carrera || (this.estudiante?.carrera || ''),
            tipo: this.modalidadNombre || (this.modalidad?.nombre || ''),
            nombre: this.tema || '',
            objetivo: this.objetivos || '',
            estado: (this.proyectoGuardado && this.proyectoGuardado.estado) ? this.proyectoGuardado.estado : 'En progreso',
          };
        }
        this.proyectoService.getByCod(cod).subscribe({
          next: (res) => {
            const wanted = String(cod);
            const pickFromArray = (arr: any[]): any => {
              const found = (arr || []).find(it => {
                const v = (it?.cod_ceta ?? it?.codCeta ?? it?.codigo_ceta);
                return v !== undefined && v !== null && String(v) === wanted;
              });
              return found || (arr && arr.length ? arr[0] : null);
            };
            let p: any = null;
            if (!res) {
              p = null;
            } else if (Array.isArray(res)) {
              p = pickFromArray(res);
            } else if ((res as any).data) {
              const data = (res as any).data;
              p = Array.isArray(data) ? pickFromArray(data) : data;
            } else if ((res as any).proyecto) {
              const pr = (res as any).proyecto;
              p = Array.isArray(pr) ? pickFromArray(pr) : pr;
            } else {
              p = res;
            }
            if (p) {
              // Fusionar sobre el objeto existente para evitar reflow y parpadeo
              this.proyectoGuardado = { ...(this.proyectoGuardado || {}), ...p };
              // Sincronizar campos locales para que el resumen siempre tenga valores (acepta varias claves)
              const nombreTema = (p as any).nombre ?? (p as any).tema ?? (p as any).nombre_tema ?? (p as any).titulo ?? (p as any).title;
              if (nombreTema) this.tema = String(nombreTema);
              const obj = (p as any).objetivo ?? (p as any).objetivos;
              if (obj && !this.objetivos) this.objetivos = String(obj);
              // Limpiar cache de proyecto para no dejar datos viejos en futuras navegaciones
              try { sessionStorage.removeItem('proyecto_cache'); } catch {}
              const pCod = (p as any).cod_ceta ?? (p as any).codCeta ?? (p as any).codigo_ceta;
              const codMatch = pCod !== undefined && pCod !== null && String(pCod) === wanted;
              if (codMatch || !this.estudiante) {
                this.estudiante = {
                  cod_ceta: String(pCod || wanted),
                  nombres: (p as any).nombres || this.nombres,
                  ap_pat: (p as any).apellidos ? String((p as any).apellidos).split(' ')[0] : (this.estudiante?.ap_pat || ''),
                  ap_mat: (p as any).apellidos ? String((p as any).apellidos).split(' ').slice(1).join(' ') : (this.estudiante?.ap_mat || ''),
                  ci: (p as any).ci || this.ci,
                  procedencia: (p as any).expedicion || this.expedicion,
                  celular: (p as any).celular || this.celular,
                  carrera: (p as any).carrera || this.carrera,
                };
                const n = ((p as any).nombres || '').toString().trim();
                const aps = ((p as any).apellidos || '').toString().trim();
                if (n) this.nombres = n;
                if (aps) this.apellidos = aps;
                if ((p as any).ci) this.ci = String((p as any).ci);
                if ((p as any).expedicion) this.expedicion = String((p as any).expedicion);
                if ((p as any).carrera) this.carrera = String((p as any).carrera);
                if ((p as any).instituto) this.instituto = String((p as any).instituto);
                try {
                  const raw = sessionStorage.getItem('datos_postulacion');
                  const datos = raw ? JSON.parse(raw) : {};
                  datos.estudiante = { ...(datos.estudiante || {}), ...this.estudiante };
                  sessionStorage.setItem('datos_postulacion', JSON.stringify(datos));
                } catch {}
              }
              this.resumenVisible = true;
            } else {
              // Si no hay proyecto y no se forzó resumen, mostrar formulario
              this.proyectoGuardado = null;
              if (!verResumen) {
                this.resumenVisible = false;
              }
            }
            this.hydratingResumen = false;
          },
          error: () => {
            // En error: si no se forzó resumen, caer al formulario
            if (!verResumen) {
              this.resumenVisible = false;
            }
            this.hydratingResumen = false;
          }
        });
      } else {
        // Si no cambió el código pero ver=resumen está presente, mostrar resumen y también hidratar desde backend
        if (verResumen) {
          this.resumenVisible = true;
          this.hydratingResumen = true;
          // Siembra local para evitar salto visual
          this.proyectoGuardado = {
            ...(this.proyectoGuardado || {}),
            cod_ceta: this.codCeta || qpCod || undefined,
            nombres: this.nombres || (this.estudiante?.nombres || ''),
            apellidos: this.apellidos || [this.estudiante?.ap_pat || '', this.estudiante?.ap_mat || ''].filter(Boolean).join(' ').trim(),
            ci: this.ci || (this.estudiante?.ci || ''),
            expedicion: this.expedicion || (this.estudiante?.procedencia || ''),
            celular: this.celular || (this.estudiante?.celular || ''),
            instituto: this.instituto,
            carrera: this.carrera || (this.estudiante?.carrera || ''),
            tipo: this.modalidadNombre || (this.modalidad?.nombre || ''),
            nombre: this.tema || '',
            objetivo: this.objetivos || '',
            estado: (this.proyectoGuardado && this.proyectoGuardado.estado) ? this.proyectoGuardado.estado : 'En progreso',
          };
          const cod = String(this.codCeta || qpCod || '');
          if (cod) {
            this.proyectoService.getByCod(cod).subscribe({
              next: (res) => {
                const wanted = String(cod);
                const pickFromArray = (arr: any[]): any => {
                  const found = (arr || []).find(it => {
                    const v = (it?.cod_ceta ?? it?.codCeta ?? it?.codigo_ceta);
                    return v !== undefined && v !== null && String(v) === wanted;
                  });
                  return found || (arr && arr.length ? arr[0] : null);
                };
                let p: any = null;
                if (!res) p = null;
                else if (Array.isArray(res)) p = pickFromArray(res);
                else if ((res as any).data) { const data = (res as any).data; p = Array.isArray(data) ? pickFromArray(data) : data; }
                else if ((res as any).proyecto) { const pr = (res as any).proyecto; p = Array.isArray(pr) ? pickFromArray(pr) : pr; }
                else p = res;
                if (p) {
                  this.proyectoGuardado = { ...(this.proyectoGuardado || {}), ...p };
                  const nombreTema = (p as any).nombre ?? (p as any).tema ?? (p as any).nombre_tema ?? (p as any).titulo ?? (p as any).title;
                  if (nombreTema) this.tema = String(nombreTema);
                }
                this.hydratingResumen = false;
              },
              error: () => { this.hydratingResumen = false; }
            });
          } else {
            this.hydratingResumen = false;
          }
        }
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

  generarFMDG1() {
    if (this.generandoFmdg) return;
    this.generandoFmdg = true;
    // Construir datos desde el estado actual y delegar al servicio PDF
    const data = {
      codCeta: this.codCeta,
      nombreCompleto: `${this.nombres || ''} ${this.apellidos || ''}`.trim(),
      nombres: this.nombres,
      apellidos: this.apellidos,
      ci: this.ci,
      expedicion: this.expedicion,
      celular: (() => {
        const fromProyecto = (this.proyectoGuardado as any)?.celular;
        const fromEstudiante = this.estudiante?.celular;
        const fromLocal = this.celular;
        const v = (fromProyecto ?? fromEstudiante ?? fromLocal ?? '').toString().trim();
        return v;
      })(),
      instituto: this.instituto,
      carrera: this.carrera,
      modalidad: this.proyectoGuardado?.tipo || this.modalidadNombre || '-',
      tema: this.proyectoGuardado?.nombre || this.tema || '-',
      objetivo: this.proyectoGuardado?.objetivo || this.objetivos || '',
    };
    // Permitir que Angular pinte el spinner antes de la tarea pesada
    setTimeout(() => {
      try {
        this.pdfService.generarFMDG1(data);
      } catch (e) {
        console.error('Error generando FMDG-1', e);
        this.error = 'No fue posible generar el PDF.';
      } finally {
        this.generandoFmdg = false;
      }
    }, 0);
  }

  // Valor consolidado del nombre del tema para el resumen (evita depender de una sola clave)
  get nombreTemaResumen(): string {
    const pg: any = this.proyectoGuardado || {};
    const v = pg.nombre ?? pg.tema ?? pg.nombre_tema ?? pg.titulo ?? pg.title ?? this.tema ?? '';
    return (v || '').toString().trim() || '-';
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

    // Sincronizar también en inscrip_modalidad.modalidad_nom (y modalidad_id) usando cod_ceta
    const cod = this.codCeta;
    if (cod && this.modalidadNombre) {
      this.postulanteService.getInscripModalidadByCodCeta(cod).subscribe({
        next: (res: any) => {
          // Respuesta puede ser lista o un objeto con data
          let row: any = null;
          if (!res) row = null;
          else if (Array.isArray(res)) row = res[0] || null;
          else if (res.data) row = Array.isArray(res.data) ? (res.data[0] || null) : res.data;
          else row = res;
          const id = row?.id || row?.inscripcion_id || row?.inscrip_modalidad_id;
          if (id) {
            this.postulanteService.updateInscripModalidad(id, {
              modalidad_nom: this.modalidadNombre,
              modalidad_id: (this.modalidad as any)?.id,
            }).subscribe({ next: () => {}, error: () => {} });
          }
        },
        error: () => {}
      });
    }
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