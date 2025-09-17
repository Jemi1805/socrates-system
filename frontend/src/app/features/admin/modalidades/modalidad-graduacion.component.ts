import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap, catchError, finalize, map } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { Estudiante, EstudianteService } from '../../../core/services/estudiante.service';
import { PostulanteService } from '../postulantes/postulante.service';
import { Postulante } from '../postulantes/postulante.model';

interface ModalidadGraduacion {
  id: number;
  nombre: string;
  descripcion: string;
  monto_arancel?: string;
}

@Component({
  selector: 'app-modalidad-graduacion',
  templateUrl: './modalidad-graduacion.component.html',
  styleUrls: ['./modalidad-graduacion.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent],
})
export class ModalidadGraduacionComponent implements OnInit {
  
  // Formulario de búsqueda
  codigoCeta: string = '';
  nombres: string = '';
  ap_pat: string = '';
  ap_mat: string = '';
  carreraSeleccionada: string = 'mecanica';
  carreras = [
    { valor: 'mecanica', nombre: 'Mecánica Automotriz' },
    { valor: 'electricidad', nombre: 'Electricidad y Electrónica Automotriz' }
  ];
  tiposBusqueda: 'ceta' | 'nombre' = 'ceta';
  intentoBusqueda = false;
  
  // Información del estudiante
  estudiante: Estudiante | null = null;
  estudiantes: Estudiante[] = [];
  estudianteEncontrado = false;
  estudiantesEncontrados = false;
  
  // Modalidades de graduación
  modalidades: ModalidadGraduacion[] = [];
  
  modalidadSeleccionada: ModalidadGraduacion | null = null;
  
  // Estados
  loading = false;
  error = '';
  modalVisible = false;
  loadingModalidades = false;
  loadingInscripcion = false;

  // Inscripción actual (si ya está inscrito en alguna modalidad)
  inscripcionActual: { modalidad_id: number; nombre: string; estado?: string; fecha_inscripcion?: string } | null = null;

  // Validaciones
  private readonly CETA_REGEX = /^\d{9}$/; // exactamente 9 dígitos
  private readonly NOMBRE_REGEX = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'\-\s]+$/; // letras, espacios, apóstrofe, guion

  constructor(
    private estudianteService: EstudianteService,
    private router: Router,
    private postulanteService: PostulanteService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.cargarModalidades();
  }

  // --- Utilidades de mapeo/merge ---
  private mapPostulanteToEstudiante(p: Postulante): Estudiante {
    return {
      cod_ceta: String(p.cod_ceta),
      ap_pat: p.ap_pat,
      ap_mat: p.ap_mat,
      nombres: p.nombres_est,
      ci: p.ci,
      procedencia: (p as any).procedencia || (p as any).expedido || '',
      carrera: (p as any).carrera_nombre || p.carrera,
      pensum: p.pensum || undefined,
      fecha_nacimiento: (p as any).fecha_nacimiento || undefined,
      lugar_nacimiento: p.lugar_nacimiento || undefined,
    } as Estudiante;
  }

  private addOrMergeEstudiante(e: Estudiante) {
    if (!e) return;
    const cod = (e.cod_ceta || '').toString().trim();
    const arr = this.estudiantes || [];
    const idx = arr.findIndex(x => (x.cod_ceta || '').toString().trim() === cod);
    if (idx === -1) {
      this.estudiantes = [...arr, e];
    } else {
      const merged = { ...arr[idx], ...Object.fromEntries(Object.entries(e).filter(([_, v]) => v !== undefined && v !== null && v !== '')) } as any;
      const newArr = arr.slice();
      newArr[idx] = merged;
      this.estudiantes = newArr;
    }
  }
 
  cargarModalidades() {
    this.loadingModalidades = true;
    this.postulanteService.getModalidades().subscribe({
      next: (res: any) => {
        const lista = Array.isArray(res) ? res : (res && Array.isArray(res.data) ? res.data : []);
        this.modalidades = (lista || []).map((m: any) => ({
          id: m.id,
          nombre: m.nombre,
          descripcion: m.descripcion || '',
          monto_arancel: m.monto_arancel || ''
        }));
        this.loadingModalidades = false;
      },
      error: (err) => {
        console.error('Error al cargar modalidades:', err);
        this.modalidades = [];
        this.loadingModalidades = false;
      }
    });
  }

  cambiarTipoBusqueda(tipo: 'ceta' | 'nombre') {
    this.tiposBusqueda = tipo;
    this.limpiarFormulario();
  }

  buscarPorCeta() {
    this.intentoBusqueda = true;
    // Sanitizar y validar CETA (solo dígitos, 9 caracteres)
    this.codigoCeta = (this.codigoCeta || '').replace(/\D+/g, '').slice(0, 9);
    if (!this.CETA_REGEX.test(this.codigoCeta)) {
      this.error = 'El código CETA debe tener exactamente 9 dígitos numéricos';
      return;
    }

    if (!this.carreraSeleccionada) {
      this.error = 'Por favor, seleccione una carrera';
      return;
    }

    this.loading = true;
    this.error = '';
    this.estudiante = null;
    this.estudiantes = [];
    this.estudianteEncontrado = false;
    this.estudiantesEncontrados = false;

    // Banderas para terminar loading cuando ambas fuentes respondan
    let doneSga = false;
    let doneLocal = false;
    let sgaError: string | null = null;
    let localError: string | null = null;
    const finish = () => {
      if (doneSga && doneLocal) {
        this.loading = false;
        console.log('[BUSCAR CETA] Finalizado. SGA:', !sgaError, 'Local:', !localError, 'Total:', this.estudiantes.length, 'Estudiantes:', this.estudiantes);
        if (!this.estudiantesEncontrados && (!this.estudiantes || this.estudiantes.length === 0)) {
          // Priorizar error de SGA si existe, sino el local
          this.error = sgaError || localError || 'No se encontraron estudiantes con los criterios proporcionados';
        } else {
          this.error = '';
        }
      }
    };

    // 1) Búsqueda en SGA
    this.estudianteService.buscarPorCeta(this.codigoCeta, this.carreraSeleccionada).subscribe({
      next: (response: any) => {
        doneSga = true;
        console.log('Respuesta API estudiante (CETA):', response);
        
        if (response.success) {
          try {
            // Crear lista del SGA y fusionar sin sobreescribir los locales
            let listaSga: Estudiante[] = [];
            if (response.data && response.data.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
              listaSga = response.data.data;
            } else if (response.data && Array.isArray(response.data) && response.data.length > 0) {
              listaSga = response.data;
            } else if (response.data && !Array.isArray(response.data)) {
              listaSga = [response.data];
            }
            for (const e of (listaSga || [])) {
              if (this.tieneDatosEstudiante(e)) this.addOrMergeEstudiante(e);
            }

            console.log('Estudiantes encontrados (CETA) tras fusionar:', this.estudiantes.length, this.estudiantes);
            this.estudiantesEncontrados = (this.estudiantes || []).length > 0;
            if (this.estudiantesEncontrados) this.intentoBusqueda = false;
          } catch (e) {
            console.error('Error al procesar datos (CETA):', e);
            this.error = 'Error al procesar los datos del estudiante';
          }
        } else {
          console.error('No se encontraron datos del estudiante (CETA):', response);
          sgaError = response.message || 'No se encontró ningún estudiante con el código CETA proporcionado';
        }
        finish();
      },
      error: (error) => {
        doneSga = true;
        sgaError = 'Error al conectar con el servidor. Intente nuevamente.';
        console.error('Error:', error);
        finish();
      }
    });

    // 2) Búsqueda en DB local por CETA exacto (usar string, sin convertir a número)
    const codStr = (this.codigoCeta || '').trim();
    if (codStr) {
      this.postulanteService.getById(codStr as any).subscribe({
        next: (p: Postulante) => {
          if (p && (p as any)?.cod_ceta) {
            console.log('[BUSCAR CETA][LOCAL] Postulante encontrado:', p);
            const e = this.mapPostulanteToEstudiante(p);
            this.addOrMergeEstudiante(e);
            console.log('[BUSCAR CETA][LOCAL] Estudiantes luego de merge:', this.estudiantes);
            this.estudiantesEncontrados = (this.estudiantes || []).length > 0;
            // Mostrar inmediatamente los resultados locales
            if (this.estudiantesEncontrados) {
              this.loading = false;
              this.cdr.detectChanges();
            }
            if (this.estudiantesEncontrados) this.intentoBusqueda = false;
          }
          doneLocal = true; finish();
        },
        error: (err) => {
          // Si 404, no existe localmente
          localError = (err && err.status !== 404) ? 'Error al consultar base de datos local' : null;
          doneLocal = true; finish();
        }
      });
    } else {
      doneLocal = true; finish();
    }
  }

  buscarPorNombre() {
    this.intentoBusqueda = true;
    
    // Verificar que al menos uno de los campos de nombre tenga contenido
    if (!this.nombres.trim() && !this.ap_pat.trim() && !this.ap_mat.trim()) {
      this.error = 'Por favor, ingrese al menos un criterio de búsqueda (nombres, apellido paterno o apellido materno)';
      return;
    }

    // Sanitizar entradas: quitar números y caracteres inválidos
    this.nombres = this.sanitizarNombre(this.nombres);
    this.ap_pat = this.sanitizarNombre(this.ap_pat);
    this.ap_mat = this.sanitizarNombre(this.ap_mat);

    // Validar que lo ingresado no contenga números
    const nombresValid = !this.nombres || this.NOMBRE_REGEX.test(this.nombres);
    const apPatValid = !this.ap_pat || this.NOMBRE_REGEX.test(this.ap_pat);
    const apMatValid = !this.ap_mat || this.NOMBRE_REGEX.test(this.ap_mat);
    if (!nombresValid || !apPatValid || !apMatValid) {
      this.error = 'Los campos de nombre y apellidos solo admiten letras y espacios (sin números)';
      return;
    }

    if (!this.carreraSeleccionada) {
      this.error = 'Por favor, seleccione una carrera';
      return;
    }

    this.loading = true;
    this.error = '';
    this.estudiante = null;
    this.estudiantes = [];
    this.estudianteEncontrado = false;
    this.estudiantesEncontrados = false;

    let doneSga = false;
    let doneLocal = false;
    let sgaError: string | null = null;
    let localError: string | null = null;
    const finish = () => {
      if (doneSga && doneLocal) {
        this.loading = false;
        console.log('[BUSCAR NOMBRE] Finalizado. SGA:', !sgaError, 'Local:', !localError, 'Total:', this.estudiantes.length, 'Estudiantes:', this.estudiantes);
        if (!this.estudiantesEncontrados && (!this.estudiantes || this.estudiantes.length === 0)) {
          this.error = sgaError || localError || 'No se encontraron estudiantes con los criterios proporcionados';
        } else {
          this.error = '';
        }
      }
    };

    // 1) Búsqueda SGA por nombre
    this.estudianteService.buscarPorNombre(this.nombres, this.ap_pat, this.ap_mat, this.carreraSeleccionada).subscribe({
      next: (response: any) => {
        doneSga = true;
        console.log('Respuesta API (Nombre):', response);
        
        if (response.success) {
          try {
            // Fusionar resultados del SGA sin borrar los locales
            if (response.data) {
              let listaSga: Estudiante[] = [];
              if (Array.isArray(response.data)) {
                listaSga = response.data;
              } else if (response.data.data && Array.isArray(response.data.data)) {
                listaSga = response.data.data;
              } else {
                listaSga = [response.data];
              }
              for (const e of (listaSga || [])) {
                if (this.tieneDatosEstudiante(e)) this.addOrMergeEstudiante(e);
              }

              console.log('Estudiantes encontrados (SGA+LOCAL):', this.estudiantes.length, this.estudiantes);
              this.estudiantesEncontrados = (this.estudiantes || []).length > 0;
              if (this.estudiantesEncontrados && this.estudiantes.length === 1) {
                this.estudiante = this.estudiantes[0];
                this.estudianteEncontrado = true;
              }
              if (this.estudiantesEncontrados) this.intentoBusqueda = false;
              if (!this.estudiantesEncontrados) this.error = 'No se encontraron estudiantes con los criterios proporcionados';
            } else {
              sgaError = 'No se recibieron datos de estudiantes';
            }
            finish();
          } catch (e) {
            console.error('Error al procesar datos (Nombre):', e);
            sgaError = 'Error al procesar los datos del estudiante';
            finish();
          }
        } else {
          console.error('No se encontraron datos del estudiante:', response);
          sgaError = response.message || 'No se encontró ningún estudiante con los criterios proporcionados';
          finish();
        }
      },
      error: (error) => {
        doneSga = true;
        sgaError = 'Error al conectar con el servidor. Intente nuevamente.';
        console.error('Error:', error);
        finish();
      }
    });

    // 2) Búsqueda local por nombre (filtrado en cliente)
    this.postulanteService.getAll().subscribe({
      next: (lista: Postulante[]) => {
        const needle = {
          nombres: this.nombres.trim().toLowerCase(),
          ap_pat: this.ap_pat.trim().toLowerCase(),
          ap_mat: this.ap_mat.trim().toLowerCase(),
        };
        const matches = (lista || []).filter(p => {
          const n = (p.nombres_est || '').toLowerCase();
          const ap = (p.ap_pat || '').toLowerCase();
          const am = (p.ap_mat || '').toLowerCase();
          const okN = !needle.nombres || n.includes(needle.nombres);
          const okAp = !needle.ap_pat || ap.includes(needle.ap_pat);
          const okAm = !needle.ap_mat || am.includes(needle.ap_mat);
          return okN && okAp && okAm;
        });
        console.log('[BUSCAR NOMBRE][LOCAL] Coincidencias locales:', matches);
        for (const p of matches) {
          this.addOrMergeEstudiante(this.mapPostulanteToEstudiante(p));
        }
        console.log('[BUSCAR NOMBRE][LOCAL] Estudiantes luego de merge:', this.estudiantes);
        this.estudiantesEncontrados = (this.estudiantes || []).length > 0 || this.estudiantesEncontrados;
        if (this.estudiantesEncontrados && this.estudiantes.length === 1) {
          this.estudiante = this.estudiantes[0];
          this.estudianteEncontrado = true;
        }
        // Mostrar inmediatamente los resultados locales
        if ((this.estudiantes || []).length > 0) {
          this.loading = false;
          this.cdr.detectChanges();
        }
        if (this.estudiantesEncontrados) this.intentoBusqueda = false;
        doneLocal = true; finish();
      },
      error: (err) => { localError = 'Error al consultar base de datos local'; doneLocal = true; finish(); }
    });
  }

  seleccionarModalidad(modalidad: ModalidadGraduacion) {
    this.modalidadSeleccionada = modalidad;
    // Desplazar la vista hacia el bloque de información para dar visibilidad inmediata
    setTimeout(() => {
      const el = document.getElementById('infoModalidad');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        try {
          (el as HTMLElement).focus({ preventScroll: true });
        } catch {}
      }
    }, 0);
  }
  
  seleccionarEstudiante(estudiante: Estudiante) {
    this.estudiante = estudiante;
    this.estudianteEncontrado = true;
    this.modalidadSeleccionada = null;
    // No cargar inscripción aquí; se hará en seleccionarEstudianteYAbrirModal
    this.inscripcionActual = null;
  }

  seleccionarEstudianteYAbrirModal(estudiante: Estudiante) {
    this.seleccionarEstudiante(estudiante);
    const cod = (estudiante as any)?.cod_ceta || (estudiante as any)?.codCeta || (estudiante as any)?.codigo_ceta;
    if (cod) {
      this.cargarInscripcionActual$(cod).subscribe({
        next: () => {},
        complete: () => {
          this.abrirModal();
        }
      });
    } else {
      this.inscripcionActual = null;
      this.abrirModal();
    }
  }
  
  abrirModal() {
    this.modalVisible = true;
    document.body.classList.add('modal-open');
  }
  
  cerrarModal() {
    this.modalVisible = false;
    document.body.classList.remove('modal-open');
  }

  continuarConModalidad() {
    if (!this.estudiante || !this.modalidadSeleccionada) {
      this.error = 'Debe seleccionar un estudiante y una modalidad';
      return;
    }

    // Guardar datos en sessionStorage para pasarlos a postulantes
    const datosPostulacion = {
      estudiante: this.estudiante,
      modalidad: this.modalidadSeleccionada
    };
    sessionStorage.setItem('datos_postulacion', JSON.stringify(datosPostulacion));
    
    // Cerrar el modal
    this.cerrarModal();

    // Navegar a la página de postulantes
    this.router.navigate(['/postulantes']);
  }

  // --- Helpers de validación/sanitización ---
  onCodigoCetaInput(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const clean = (input.value || '').replace(/\D+/g, '').slice(0, 9);
    input.value = clean;
    this.codigoCeta = clean;
  }

  onNombreInput(campo: 'nombres' | 'ap_pat' | 'ap_mat', ev: Event) {
    const input = ev.target as HTMLInputElement;
    let clean = this.sanitizarNombre(input.value || '');
    // Capitalizar automáticamente la primera letra de cada palabra
    clean = this.capitalizarPalabras(clean);
    input.value = clean;
    (this as any)[campo] = clean;
  }

  get cetaValido(): boolean {
    return this.CETA_REGEX.test((this.codigoCeta || '').trim());
  }

  get nombresValidos(): boolean {
    const check = (v: string) => !v || this.NOMBRE_REGEX.test(v);
    return check(this.nombres) && check(this.ap_pat) && check(this.ap_mat);
  }

  private sanitizarNombre(v: string): string {
    // eliminar números y caracteres no permitidos, permitir letras con acentos, espacios, apóstrofe y guion
    return (v || '')
      .replace(/\d+/g, '')
      .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ'\-\s]+/g, '')
      .replace(/\s{2,}/g, ' ')
      .trimStart();
  }

  private capitalizarPalabras(v: string): string {
    // Convierte todo a minúsculas y luego capitaliza la primera letra de cada palabra
    // Palabras separadas por espacio, guion o apóstrofe. Soporta Unicode.
    const lower = (v || '').toLocaleLowerCase();
    return lower.replace(/(?:^|[\s\-'])\p{L}/gu, (m) => m.toUpperCase());
  }

  limpiarFormulario() {
    this.codigoCeta = '';
    this.nombres = '';
    this.ap_pat = '';
    this.ap_mat = '';
    this.estudiante = null;
    this.estudiantes = [];
    this.estudianteEncontrado = false;
    this.estudiantesEncontrados = false;
    this.modalidadSeleccionada = null;
    this.error = '';
    this.intentoBusqueda = false;
    this.inscripcionActual = null;
  }

  registrarNuevoPostulante() {
    // Limpiar cualquier dato previo y navegar a la interfaz de Postulantes vacía
    try {
      sessionStorage.removeItem('datos_postulacion');
    } catch (e) {
      console.warn('No se pudo limpiar sessionStorage', e);
    }
    this.router.navigate(['/postulantes']);
  }

  tieneDatosEstudiante(e: any): boolean {
    if (!e || typeof e !== 'object') {
      return false;
    }
    const cod = ((e.cod_ceta ?? e.codCeta ?? e.codigo_ceta) ?? '').toString().trim();
    const nombres = (e.nombres ?? '').toString().trim();
    const apPat = (e.ap_pat ?? '').toString().trim();
    const apMat = (e.ap_mat ?? '').toString().trim();
    const ci = (e.ci ?? '').toString().trim();
    // Consideramos válido si existe al menos un dato identificatorio
    return !!(cod || ci || nombres || apPat || apMat);
  }

  // Métodos para mejorar la UI de modalidades
  getModalidadIcon(modalidadId: number): string {
    const icons = {
      1: 'bi bi-journal-text',     // Tesis
      2: 'bi bi-gear-fill',        // Proyecto Sociocomunitario Productivo
      3: 'bi bi-building',         // Proyecto de Emprendimiento Productivo
      4: 'bi bi-clipboard-check',   // Trabajo Dirigido Externo
      5: 'bi bi-award-fill',       // Graduacion por Experiencia Laboral
      6: 'bi bi-lightning-fill'    // Graduación por Excelencia Académica
    };
    return icons[modalidadId as keyof typeof icons] || 'bi bi-mortarboard';
  }

  getModalidadDuration(modalidadId: number): string {
    const durations = {
      1: '4 meses',
      2: '4 meses',
      3: '4 meses',
      4: '4 meses',
      5: 'Variable',
      6: '4 meses'
    };
    return durations[modalidadId as keyof typeof durations] || 'Variable';
  }

  getModalidadRequirements(modalidadId: number): string {
    const requirements = {
      1: 'Definición de Tema o área de trabajo, Formulario 1 (FDMG-1), Tutor Asignado, Perfil de Proyecto de Grado, Informe de Suficiencia, Perfil de Proyecto de Grado Aprobado',
      2: 'Equipo de 2-3 estudiantes (mismo instituto), Equipo 2-5 (diferentes institutos), Definición de Tema o área de trabajo, Formulario 1 (FDMG-1), Tutor Asignado, Perfil del Proyecto Sociocomunitario, Informe de Suficiencia, Perfil de Proyecto Sociocomunitario Aprobado',
      3: 'Equipo de 1-3 estudiantes, Definición de Tema o área de trabajo, Formulario 1 (FDMG-1), Tutor Asignado, Perfil del Proyecto de Emprendimiento Productivo, Enriquecimiento del proyecto, Perfil del Proyecto de Emprendimiento Productivo Aprobado',
      4: 'Definición de área de trabajo, Formulario 1 (FDMG-1), Tutor Asignado, Perfil de Trabajo Dirigido, Informe Técnico de Tutor y Supervisor de la Institución/Empresa/Emprendimiento, Perfil de Trabajo Dirigido Aprobado',
      5: 'Promedio general >= 90, No haber reprobado ninguna materia, Solicitud con nota a Dirección Académica',
      6: 'Definición Propuesta de Mejora Técnica/Tecnológica de Innoovación, Documentación de respaldo, Formulario 1 (FDMG-1), Tutor Asignado, Aprobación de la propuesta por inmediato superior, Informe de Tutor, Informe de Supervisor, Propuesta Aprobada'
    };
    return requirements[modalidadId as keyof typeof requirements] || 'Consultar reglamento';
  }

  getModalidadProcess(modalidadId: number): string {
    const processes = {
      1: 'Desarrollo del Proyecto de Grado → Pre-Defensa → Defensa → Graduación',
      2: 'Desarrollo del Proyecto Sociocomunitario → Pre-Defensa → Defensa → Graduación',
      3: 'Postulación → Asignación → Desarrollo → Informe → Graduación',
      4: 'Desarrollo del Trabajo Dirigido Externo → Informes de Trabajo → Exposición de su trabajo en sus etapas teórico-prácticas → Graduación',
      5: 'Nota de aceptación a la solicitud → Acta de Modalidad de Graduación por Excelencia Académica → Graduación',
      6: 'Desarrollo de la Propuesta de Mejora Técnica/Tecnológica → Informe Final → Defensa de la Propuesta → Graduación'
    };
    return processes[modalidadId as keyof typeof processes] || 'Proceso estándar';
  }

  // Métodos para mejorar la UI de modalidades (existentes arriba)
  onToggleSidebar() {
    console.log('Toggle sidebar clicked');
  }

// --- Inscripción existente y navegación a registro de proyecto ---
  private cargarInscripcionActual$(codCeta: string | number): Observable<void> {
    this.inscripcionActual = null;
    this.loadingInscripcion = true;
    return this.postulanteService.getModalidadPostulante(Number(codCeta)).pipe(
      tap((res: any) => {
        const mod = res?.modalidad || null;
        if (mod) {
          this.inscripcionActual = {
            modalidad_id: Number(mod.id || mod.modalidad_id || 0),
            nombre: mod.nombre || '',
            estado: res?.estado || undefined,
            fecha_inscripcion: res?.fecha_inscripcion || undefined
          };
        } else if (res?.modalidad_id) {
          const mid = Number(res.modalidad_id);
          const found = (this.modalidades || []).find(m => m.id === mid);
          this.inscripcionActual = {
            modalidad_id: mid,
            nombre: found?.nombre || 'Modalidad #' + mid,
            estado: res?.estado || undefined,
            fecha_inscripcion: res?.fecha_inscripcion || undefined
          };
        } else {
          this.inscripcionActual = null;
        }
      }),
      catchError((err) => {
        if (err && err.status === 404) {
          this.inscripcionActual = null;
        } else {
          console.warn('No se pudo obtener la modalidad/inscripción actual:', err);
          this.inscripcionActual = null;
        }
        return of(void 0);
      }),
      finalize(() => {
        this.loadingInscripcion = false;
      }),
      map(() => void 0)
    );
  }

  esExcelencia(modId?: number, nombre?: string | null): boolean {
    if (!modId && !nombre) return false;
    if (modId && Number(modId) === 6) return true;
    const s = (nombre || '').toString().toLowerCase();
    return s.includes('excelencia');
  }

  registrarProyecto() {
    if (!this.estudiante || !this.inscripcionActual) return;
    // Preparar modalidad a enviar a Postulantes desde la inscripción existente
    const mid = this.inscripcionActual.modalidad_id;
    const found = (this.modalidades || []).find(m => m.id === mid) || null;
    const modalidad = found || {
      id: mid,
      nombre: this.inscripcionActual.nombre || 'Modalidad #' + mid,
      descripcion: '',
      monto_arancel: ''
    };

    const datosPostulacion = {
      estudiante: this.estudiante,
      modalidad: modalidad
    };
    try {
      sessionStorage.setItem('datos_postulacion', JSON.stringify(datosPostulacion));
    } catch {}

    // Cerrar modal y navegar a Postulantes para continuar con el flujo de proyecto
    this.cerrarModal();
    this.router.navigate(['/postulantes']);
  }
}