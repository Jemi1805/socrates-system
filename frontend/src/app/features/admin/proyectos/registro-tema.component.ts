import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { ProyectoService } from './proyecto.service';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { PostulanteService } from '../postulantes/postulante.service';
import { PdfService } from '../../../shared/services/pdf.service';
import { LoadingService } from '../../../core/services/loading.service';
import { SgaService } from '../../../shared/services/sga.service';

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

  // --- Edición en resumen ---
  editResumen = false;
  editFromResumen = false; // cuando se edita en el formulario original
  editModalidadId: number | null = null;
  editModalidadNombre: string = '';
  editTema: string = '';
  editObjetivos: string = '';
  // Cuando se edita modalidad desde el resumen, diferir persistencia hasta Guardar
  private editModalidadEnResumen = false;

  // Modal de cambios guardados
  showModalCambios = false;
  cambiosGuardados: Array<{ campo: string; anterior: any; nuevo: any }> = [];

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
  loadingModalidades = false;

  constructor(
    private proyectoService: ProyectoService,
    private router: Router,
    private postulanteService: PostulanteService,
    private pdfService: PdfService,
    private route: ActivatedRoute,
    private loadingService: LoadingService,
    private sgaService: SgaService,
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
        try {
          const pc = JSON.parse(rawProyecto);
          const estado = pc?.estado ?? '';
          const tipo = pc?.tipo ?? '';
          const nombreSeed = (pc?.nombre ?? pc?.tema ?? pc?.nombre_tema ?? pc?.titulo ?? pc?.title ?? pc?.nombre_proyecto ?? pc?.proyecto ?? pc?.tema_nombre ?? '') as any;
          const objSeed = (pc?.objetivo ?? pc?.objetivos ?? pc?.objetivo_general ?? pc?.objetivo_especifico ?? pc?.descripcion ?? pc?.resumen ?? '') as any;
          this.proyectoGuardado = {
            ...(this.proyectoGuardado || {}),
            estado: estado || (this.proyectoGuardado?.estado || undefined),
            tipo: tipo || (this.proyectoGuardado?.tipo || undefined),
            nombre: (nombreSeed || (this.proyectoGuardado as any)?.nombre || undefined),
            objetivo: (objSeed || (this.proyectoGuardado as any)?.objetivo || undefined),
          };
          if (nombreSeed && !this.tema) this.tema = String(nombreSeed);
          if (objSeed && !this.objetivos) this.objetivos = String(objSeed);
        } catch {
          // Ignorar cache inválido
        }
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
    this.route.queryParamMap.subscribe((qp: any) => {
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

        const codNum = Number(qpCod);
        if (!isNaN(codNum)) {
          this.sgaService.getPostulanteById(codNum).subscribe({
            next: (resp: any) => {
              const data = resp?.data ?? resp;
              const obj = Array.isArray(data?.data) ? data.data[0] : data;
              if (!obj) return;
              let cel: any = obj.celular ?? obj.telf_movil ?? obj.telefono ?? obj.celular_est ?? null;
              if (!cel) {
                let raw: any = obj.raw ?? obj.raw_data ?? null;
                if (raw && typeof raw === 'string') {
                  try { raw = JSON.parse(raw); } catch { raw = null; }
                }
                if (raw && typeof raw === 'object') {
                  cel = raw.Celular ?? raw.celular ?? raw.TELF_MOVIL ?? raw.telf_movil ?? raw.telefono ?? raw.Telefono ?? raw.cel ?? raw.MOVIL ?? raw.movil ?? raw['Teléfono'] ?? null;
                }
              }
              if (cel) {
                const celStr = String(cel).trim();
                this.celular = celStr;
                this.estudiante = { ...(this.estudiante || {}), celular: celStr } as any;
                try {
                  const raw = sessionStorage.getItem('datos_postulacion');
                  const datos = raw ? JSON.parse(raw) : {};
                  datos.estudiante = { ...(datos.estudiante || {}), celular: celStr };
                  sessionStorage.setItem('datos_postulacion', JSON.stringify(datos));
                } catch {}
              }
            },
            error: () => {}
          });
        }

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
              const nombreTema = (p as any).nombre ?? (p as any).tema ?? (p as any).nombre_tema ?? (p as any).titulo ?? (p as any).title ?? (p as any).nombre_proyecto ?? (p as any).proyecto ?? (p as any).tema_nombre;
              if (nombreTema) this.tema = String(nombreTema);
              const obj = (p as any).objetivo ?? (p as any).objetivos ?? (p as any).objetivo_general ?? (p as any).objetivo_especifico ?? (p as any).descripcion ?? (p as any).resumen;
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
        const stableCod = this.codCeta || qpCod || '';
        const codNum2 = Number(stableCod);
        if (!this.celular && stableCod && !isNaN(codNum2)) {
          this.sgaService.getPostulanteById(codNum2).subscribe({
            next: (resp: any) => {
              const data = resp?.data ?? resp;
              const obj = Array.isArray(data?.data) ? data.data[0] : data;
              if (!obj) return;
              let cel: any = obj.celular ?? obj.telf_movil ?? obj.telefono ?? obj.celular_est ?? null;
              if (!cel) {
                let raw: any = obj.raw ?? obj.raw_data ?? null;
                if (raw && typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = null; } }
                if (raw && typeof raw === 'object') {
                  cel = raw.Celular ?? raw.celular ?? raw.TELF_MOVIL ?? raw.telf_movil ?? raw.telefono ?? raw.Telefono ?? raw.cel ?? raw.MOVIL ?? raw.movil ?? raw['Teléfono'] ?? null;
                }
              }
              if (cel) {
                const celStr = String(cel).trim();
                this.celular = celStr;
                this.estudiante = { ...(this.estudiante || {}), celular: celStr } as any;
                try {
                  const raw = sessionStorage.getItem('datos_postulacion');
                  const datos = raw ? JSON.parse(raw) : {};
                  datos.estudiante = { ...(datos.estudiante || {}), celular: celStr };
                  sessionStorage.setItem('datos_postulacion', JSON.stringify(datos));
                } catch {}
              }
            },
            error: () => {}
          });
        }
      }
    });

    // Prefetch de modalidades para que el selector tenga datos disponibles
    if (!this.modalidades || this.modalidades.length === 0) {
      this.cargarModalidades();
    }
    console.log('[RegistroTema] ngOnInit listo. modalidades.length:', (this.modalidades || []).length);
  }

  
  get codCeta(): string {
    const c = this.estudiante?.cod_ceta;
    return c !== undefined && c !== null ? String(c) : '';
  }

  cancelar() {
    // Volver a la pantalla de selección de modalidad
    this.router.navigate(['/postulantes']);
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

    const payload: any = {
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
    } as any;

    const crear = (body: any) => {
      this.loading = true;
      this.proyectoService.createProyecto(body).subscribe({
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
    };

    // Resolver inscrip_modalidad_id por cod_ceta antes de crear
    const cod = this.codCeta;
    if (cod) {
      this.postulanteService.getInscripModalidadByCodCeta(cod).subscribe({
        next: (res: any) => {
          const row = this.extractFirstRow(res);
          const inscId = this.extractInscripModalidadId(row);
          if (inscId) payload.inscrip_modalidad_id = inscId;
          crear(payload);
        },
        error: () => {
          // Si falla la consulta, continuar sin el campo
          crear(payload);
        }
      });
    } else {
      crear(payload);
    }
  }

  cerrarModalExito() {
    console.log('[RegistroTema] cerrarModalExito');
    this.modalExitoVisible = false;
    this.resumenVisible = true;
  }

  irListaPostulantes() {
    this.router.navigate(['/postulantes']);
  }

  irPostulantes() {
    this.router.navigate(['/postulantes'], { queryParams: { ver: 1 } });
  }

  // --- Modo edición del resumen ---
  iniciarEdicionResumen() {
    // Mostrar formulario completo con datos prellenados al estilo del registro inicial
    this.editResumen = false;
    this.editFromResumen = true;
    this.resumenVisible = false;
    // Asegurar lista de modalidades mínima (si no está cargada)
    if (!this.modalidades || this.modalidades.length === 0) {
      this.postulanteService.getModalidades().subscribe({ next: (lista: any[]) => {
        this.modalidades = (lista || []).map(m => ({ id: m.id, nombre: m.nombre, descripcion: m.descripcion || '' }));
      }, error: () => {} });
    }
    const tipoActual = (this.proyectoGuardado?.tipo || this.modalidadNombre || '').toString();
    const found = (this.modalidades || []).find(m => (m.nombre || '').toString().toLowerCase() === tipoActual.toLowerCase());
    this.editModalidadId = found?.id ?? (this.modalidad as any)?.id ?? null;
    this.editModalidadNombre = found?.nombre || tipoActual;
    // Prellenar campos visibles del formulario
    this.modalidadNombre = this.editModalidadNombre;
    this.tema = (this.proyectoGuardado?.nombre || this.tema || '').toString();
    this.objetivos = (this.proyectoGuardado?.objetivo || this.objetivos || '').toString();
    // Asegurar que el campo celular esté visible con el valor consolidado
    const cel = (this.proyectoGuardado as any)?.celular ?? this.estudiante?.celular ?? this.celular ?? '';
    this.celular = String(cel);
    // Mantener cabecera ya cargada (nombres, apellidos, etc.)
  }

  cancelarEdicionResumen() {
    // Si estábamos editando en el formulario, volver al resumen
    if (this.editFromResumen) {
      this.editFromResumen = false;
      this.resumenVisible = true;
    }
    this.editResumen = false;
    this.editModalidadEnResumen = false;
  }

  guardarEdicionResumen() {
    if (!this.proyectoGuardado?.id) { this.editResumen = false; this.editFromResumen = false; return; }
    // Tomar de los campos del formulario cuando venimos desde el formulario original
    const nombreTema = (this.editFromResumen ? (this.tema || '') : (this.editTema || '')).trim();
    const objetivos = (this.editFromResumen ? (this.objetivos || '') : (this.editObjetivos || '')).trim();
    const tipoNom = (this.editFromResumen ? (this.modalidadNombre || '') : (this.editModalidadNombre || '')).trim();
    const payload: any = { nombre: nombreTema, objetivo: objetivos, tipo: tipoNom };
    // Calcular diffs contra estado actual antes de enviar
    const prev = this.proyectoGuardado || {};
    const diffs: Array<{ campo: string; anterior: any; nuevo: any }> = [];
    const pushDiff = (campo: string, a: any, n: any) => {
      const aStr = (a ?? '').toString();
      const nStr = (n ?? '').toString();
      if (aStr !== nStr) diffs.push({ campo, anterior: aStr, nuevo: nStr });
    };
    pushDiff('tipo', prev.tipo ?? this.modalidadNombre, tipoNom);
    pushDiff('nombre', prev.nombre ?? this.tema, nombreTema);
    pushDiff('objetivo', prev.objetivo ?? this.objetivos, objetivos);
    // Persistir proyecto
    this.proyectoService.updateProyecto(this.proyectoGuardado.id, payload).subscribe({
      next: (resp) => {
        // Actualizar estado local
        this.proyectoGuardado = { ...(this.proyectoGuardado || {}), ...resp };
        this.tema = this.proyectoGuardado?.nombre || nombreTema || this.tema;
        this.objetivos = this.proyectoGuardado?.objetivo || objetivos || this.objetivos;
        // Mantener el nombre elegido en variables locales para sincronizaciones subsiguientes
        const nombreElegido = tipoNom;
        this.modalidadNombre = this.proyectoGuardado?.tipo || nombreElegido || this.modalidadNombre;
        // Sincronizar inscrip_modalidad.modalidad_nom/modalidad_id
        const cod = this.codCeta;
        if (cod && nombreElegido) {
          // Resolver modalidad_id: priorizar editModalidadId; si falta, buscar por nombre en la lista cargada
          let mid = this.editModalidadId ?? (this.modalidad as any)?.id ?? null;
          if (!mid && nombreElegido && Array.isArray(this.modalidades) && this.modalidades.length) {
            const byName = this.modalidades.find(m => (m.nombre || '').toString().toLowerCase() === nombreElegido.toLowerCase());
            if (byName?.id) mid = byName.id;
          }
          this.postulanteService.getInscripModalidadByCodCeta(cod).subscribe({
            next: (res: any) => {
              const row = this.extractFirstRow(res);
              const id = this.extractInscripModalidadId(row);
              console.log('[RegistroTema] getInscripModalidadByCodCeta -> row:', row, 'id:', id);
              const toSend: any = { modalidad_nom: nombreElegido };
              if (mid) toSend.modalidad_id = mid;
              const onOk = () => {
                this.editResumen = false; this.editFromResumen = false; this.resumenVisible = true;
                this.cambiosGuardados = diffs;
                this.showModalCambios = true;
              };
              if (id) {
                console.log('[RegistroTema] updateInscripModalidad(id, body):', id, toSend);
                this.postulanteService.updateInscripModalidad(id, toSend).subscribe({ next: (u) => { console.log('[RegistroTema] updateInscripModalidad OK:', u); onOk(); this.verificarInscripModalidad(String(cod), nombreElegido, (toSend as any).modalidad_id ?? null); }, error: (err1) => {
                  console.warn('[RegistroTema] updateInscripModalidad FALLÓ, intento por COD:', err1);
                  this.postulanteService.updateInscripModalidadByCod(String(cod), toSend).subscribe({ next: (u2) => { console.log('[RegistroTema] updateInscripModalidadByCod OK:', u2); onOk(); this.verificarInscripModalidad(String(cod), nombreElegido, (toSend as any).modalidad_id ?? null); }, error: (err2) => { console.error('[RegistroTema] updateInscripModalidadByCod FALLÓ:', err2); this.editResumen = false; } });
                }});
              } else {
                console.log('[RegistroTema] No se detectó ID. updateInscripModalidadByCod(cod, body):', String(cod), toSend);
                this.postulanteService.updateInscripModalidadByCod(String(cod), toSend).subscribe({ next: (u3) => { console.log('[RegistroTema] updateInscripModalidadByCod OK:', u3); onOk(); this.verificarInscripModalidad(String(cod), nombreElegido, (toSend as any).modalidad_id ?? null); }, error: (err3) => { console.error('[RegistroTema] updateInscripModalidadByCod FALLÓ:', err3); this.editResumen = false; } });
              }
            },
            error: (e) => { console.error('[RegistroTema] getInscripModalidadByCodCeta error:', e); this.editResumen = false; }
          });
        } else {
          this.editResumen = false; this.editFromResumen = false; this.resumenVisible = true;
          this.cambiosGuardados = diffs;
          this.showModalCambios = true;
        }
      },
      error: () => { this.editResumen = false; this.editFromResumen = false; this.resumenVisible = true; }
    });
  }

  // Modal handlers
  continuarCambios() {
    // Mantener edición abierta: simplemente cerrar el modal y volver al formulario si se desea seguir editando
    this.showModalCambios = false;
  }
  cerrarModalCambios() {
    this.showModalCambios = false;
  }

  // Abrir selector de modalidad desde el modo edición del resumen
  abrirSelectorModalidadResumen() {
    this.editModalidadEnResumen = true;
    this.mostrarModal();
  }

  generarFMDG1() {
    if (this.generandoFmdg) return;
    this.generandoFmdg = true;
    this.loadingService.showModal();
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
      const finalize = () => {
        this.generandoFmdg = false;
        this.loadingService.hideModal();
      };
      try {
        const result = this.pdfService.generarFMDG1(data, { logoWidthMm: 24, logoMaxHeightMm: 24, logoFormat: 'JPEG', logoBgColor: '#FFFFFF' });
        if (result && typeof (result as Promise<void>)?.then === 'function') {
          (result as Promise<void>).then(() => finalize()).catch((err) => {
            console.error('Error generando FMDG-1', err);
            this.error = 'No fue posible generar el PDF.';
            finalize();
          });
          return;
        }
      } catch (e) {
        console.error('Error generando FMDG-1', e);
        this.error = 'No fue posible generar el PDF.';
        finalize();
        return;
      }
      finalize();
    }, 0);
  }

  // Valor consolidado del nombre del tema para el resumen (evita depender de una sola clave)
  get nombreTemaResumen(): string {
    const pg: any = this.proyectoGuardado || {};
    const v = pg.nombre ?? pg.tema ?? pg.nombre_tema ?? pg.titulo ?? pg.title ?? pg.nombre_proyecto ?? pg.proyecto ?? pg.tema_nombre ?? this.tema ?? '';
    return (v || '').toString().trim() || '-';
  }

  // --- Gestión de Modalidades (UI) ---
  private normalizeModalidades(input: any): ModalidadCtx[] {
    if (!input) return [];
    let list: any = input;
    if (Array.isArray(input)) list = input;
    else if (input.data) list = input.data;
    else if (input.modalidades) list = input.modalidades;
    else if (input.items) list = input.items;
    if (!Array.isArray(list)) list = [list];
    return (list || []).map((m: any) => ({
      id: Number(m?.id ?? m?.modalidad_id ?? 0),
      nombre: String(m?.nombre ?? m?.name ?? m?.titulo ?? ''),
      descripcion: String(m?.descripcion ?? m?.description ?? ''),
      icono: m?.icono,
    })).filter((x: ModalidadCtx) => !!x.nombre);
  }

  private cargarModalidades(): void {
    this.loadingModalidades = true;
    this.postulanteService.getModalidades().subscribe({
      next: (resp: any) => {
        console.log('[RegistroTema] getModalidades() resp:', resp);
        const arr = this.normalizeModalidades(resp);
        this.modalidades = arr;
        console.log('[RegistroTema] modalidades normalizadas:', this.modalidades);
        this.loadingModalidades = false;
      },
      error: (e) => { 
        console.error('[RegistroTema] getModalidades() error:', e);
        this.loadingModalidades = false; 
      }
    });
  }

  // Verifica que modalidad_nom/modalidad_id se hayan persistido; si no, reintenta por COD
  private verificarInscripModalidad(cod: string, esperadoNom: string, esperadoId: number | null) {
    if (!cod) return;
    this.postulanteService.getInscripModalidadByCodCeta(cod).subscribe({
      next: (res: any) => {
        const row = this.extractFirstRow(res);
        const id = this.extractInscripModalidadId(row);
        const dbNom = (row?.modalidad_nom ?? '').toString();
        const dbId = row?.modalidad_id !== undefined && row?.modalidad_id !== null ? Number(row.modalidad_id) : null;
        const needNom = esperadoNom && dbNom !== esperadoNom;
        const needId = esperadoId !== null && dbId !== esperadoId;
        console.log('[RegistroTema] verificarInscripModalidad -> id:', id, 'dbNom:', dbNom, 'dbId:', dbId, 'needNom:', needNom, 'needId:', needId);
        if ((needNom || needId) && id) {
          const body: any = { modalidad_nom: esperadoNom };
          if (esperadoId !== null) body.modalidad_id = esperadoId;
          console.warn('[RegistroTema] Corrigiendo por ID (no por COD) para evitar 405):', id, body);
          this.postulanteService.updateInscripModalidad(id, body).subscribe({
            next: (u) => console.log('[RegistroTema] Corrección por ID OK:', u),
            error: (e) => console.error('[RegistroTema] Corrección por ID FALLÓ:', e),
          });
        }
      },
      error: (e) => console.error('[RegistroTema] verificarInscripModalidad error:', e)
    });
  }

  // --- Utils de InscripModalidad ---
  private extractFirstRow(resp: any): any {
    if (!resp) return null;
    if (Array.isArray(resp)) return resp[0] || null;
    if (resp.data) {
      const d = resp.data;
      return Array.isArray(d) ? (d[0] || null) : d;
    }
    if (resp.result) {
      const r = resp.result;
      return Array.isArray(r) ? (r[0] || null) : r;
    }
    if (resp.record) return resp.record;
    if (resp.inscrip_modalidad) return resp.inscrip_modalidad;
    return resp;
  }

  private extractInscripModalidadId(row: any): number | null {
    if (!row) return null;
    const candidates = [
      row.id,
      row.inscripcion_id,
      row.inscrip_modalidad_id,
      row.id_inscrip_modalidad,
      row?.inscrip_modalidad?.id,
      row?.record?.id,
    ];
    const val = candidates.find(v => v !== undefined && v !== null);
    const n = Number(val);
    return isNaN(n) ? null : n;
  }

  mostrarModal() {
    console.log('[RegistroTema] abrir modal');
    // Mostrar inmediatamente el modal
    this.modalVisible = true;
    console.log('[RegistroTema] estado inicial modal -> modalidades.length:', (this.modalidades || []).length, 'loadingModalidades:', this.loadingModalidades);
    // Cargar modalidades en background si faltan
    if (!this.modalidades || this.modalidades.length === 0) {
      this.cargarModalidades();
    }
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

    // Si venimos desde el modo edición del resumen, solo actualizar campos de edición y no persistir todavía
    if ((this.editResumen && this.editModalidadEnResumen) || this.editFromResumen) {
      this.editModalidadId = (seleccionado as any)?.id ?? null;
      this.editModalidadNombre = seleccionado?.nombre || '';
      // Reflejar en el formulario si estamos en modo formulario
      if (this.editFromResumen) {
        this.modalidadNombre = this.editModalidadNombre;
      }
      this.editModalidadEnResumen = false;
      this.nuevaModalidad = null;
      return;
    }

    // Flujo normal (fuera del resumen): actualizar modalidad global y persistir
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