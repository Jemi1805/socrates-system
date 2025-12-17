import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Observable, of, firstValueFrom } from 'rxjs';
import { tap, catchError, finalize, map, switchMap, take } from 'rxjs/operators';

import { CommonModule, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { Estudiante, EstudianteService } from '../../../core/services/estudiante.service';
import { PostulanteService } from '../postulantes/postulante.service';
import { Postulante } from '../postulantes/postulante.model';
import { ProyectoService } from '../proyectos/proyecto.service';
import { LoadingService } from '../../../core/services/loading.service';
import { SgaService, TutorDesignacionItem } from '../../../shared/services/sga.service';
import { Estudiante as EstudianteSga } from '../../../core/services/estudiante.service';
import { AuthService } from '../../../core/services/auth.service';
import { PdfService, TutorDesignacionEstudiante } from '../../../shared/services/pdf.service';

interface PostulanteInscrito {
  cod_ceta: number;
  nombres_est: string;
  ap_pat: string;
  ap_mat: string;
  ci?: string | null;
  procedencia?: string | null;
  celular?: string | null;
  correo?: string | null;
  email?: string | null;
  fecha_nacimiento?: string | null;
  lugar_nacimiento?: string | null;
  pensum?: string | null;
  modo?: string | null;
  fecha_inscripcion?: string | null;
  estado?: string | null;
  carrera?: string | null;
}

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
  imports: [CommonModule, FormsModule, HeaderComponent, RouterModule],
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

  postulantesInscritos: PostulanteInscrito[] = [];
  loadingInscritos = false;
  tablaInscritosVisible = true;
  
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
  inscripcionActual: { modalidad_id: number; nombre: string; estado?: string; fecha_inscripcion?: string; aranceles_completos?: boolean | number | string; convocatoria_nom?: string | null } | null = null;
  // Proyecto/Tema actual si existe
  proyectoActual: { id?: number; nombre?: string; estado?: string; objetivo?: string; tipo?: string; created_at?: string } | null = null;
  // Última designación de tutor (si existe)
  lastDesignation: any = null;

  // Validaciones
  private readonly CETA_REGEX = /^\d{9}$/; // exactamente 9 dígitos
  private readonly NOMBRE_REGEX = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'\-\s]+$/; // letras, espacios, apóstrofe, guion

  constructor(
    private estudianteService: EstudianteService,
    private router: Router,
    private postulanteService: PostulanteService,
    private sgaService: SgaService,
    private cdr: ChangeDetectorRef,
    private proyectoService: ProyectoService,
    private loadingService: LoadingService,
    private auth: AuthService,
    private pdfService: PdfService
  ) {}

  ngOnInit() {
    this.cargarModalidades();
    this.cargarPostulantesInscritos();
  }

  private buildPdfPayloadFromDesignation(designation: any, correlativo: string | number, docData: any | null): { documento: any; opciones?: { fileName?: string } } | null {
    if (!designation) {
      return null;
    }

    const modalDescripcion = this.getModalidadDescripcion();
    const tutorNombre = this.dedupeNombreTexto(this.resolvePdfTutorNombre(docData || designation)) || this.resolvePdfTutorNombre(docData || designation);

    const resolveDocEstudiantes = () => {
      const candidates: any[] = [];
      if (docData) {
        if (Array.isArray(docData.estudiantes)) {
          candidates.push(docData.estudiantes);
        }
        if (Array.isArray(docData.doc_estudiantes_resumen)) {
          candidates.push(docData.doc_estudiantes_resumen);
        }
        if (typeof docData.doc_estudiantes_resumen === 'string') {
          try {
            const parsed = JSON.parse(docData.doc_estudiantes_resumen);
            if (Array.isArray(parsed)) candidates.push(parsed);
          } catch {}
        }
        if (typeof docData.estudiantes_resumen === 'string') {
          try {
            const parsed = JSON.parse(docData.estudiantes_resumen);
            if (Array.isArray(parsed)) candidates.push(parsed);
          } catch {}
        }
      }
      if (Array.isArray(designation?.doc_estudiantes_resumen)) {
        candidates.push(designation.doc_estudiantes_resumen);
      }
      if (typeof designation?.doc_estudiantes_resumen === 'string') {
        try {
          const parsed = JSON.parse(designation.doc_estudiantes_resumen);
          if (Array.isArray(parsed)) candidates.push(parsed);
        } catch {}
      }
      return candidates.find((entry) => Array.isArray(entry) && entry.length) || null;
    };

    const estudiantesFuente = resolveDocEstudiantes();

    const estudiantes = this.mapDocEstudiantesToPdf(
      estudiantesFuente,
      docData,
      designation,
      modalDescripcion
    ) || this.resolvePdfEstudiantes(designation, docData?.area ?? designation?.area, docData?.proyecto_nombre ?? designation?.proyecto_nombre, modalDescripcion) || [];

    const estudiantesOrdenados = this.sortEstudiantesParaPdf(estudiantes);

    const fechaRaw = docData?.fecha_designacion || designation?.fecha_designacion || designation?.doc_fecha || new Date();
    const fechaDocumento = fechaRaw ? new Date(fechaRaw) : new Date();

    const tutorApellidoP = this.resolveFirstNonEmpty(docData?.tutor_apellido_p, docData?.tutor_ap_pat, designation?.tutor_apellido_p, designation?.tutor?.apellido_p);
    const tutorApellidoM = this.resolveFirstNonEmpty(docData?.tutor_apellido_m, docData?.tutor_ap_mat, designation?.tutor_apellido_m, designation?.tutor?.apellido_m);
    const tutorNombres = this.resolveFirstNonEmpty(docData?.tutor_nombres, docData?.tutor_nombre_simple, designation?.tutor_nombres, designation?.tutor?.nombre);
    const tutorTituloAcademico = this.resolvePdfTutorTituloAcademico(docData || designation);
    const tutorNombreNormalizado = this.dedupeNombreTexto(tutorNombre) || tutorNombre;
    const cargoAcademico = (tutorTituloAcademico || '').toString().trim();
    const cargoSegmento = (() => {
      if (!cargoAcademico) {
        return 'DOCENTE TÉCNICO';
      }
      const cleaned = cargoAcademico.replace(/\s+/g, ' ').trim().toUpperCase();
      return cleaned.endsWith('.') ? cleaned : `${cleaned}.`;
    })();
    const paraCargo = 'DOCENTE TÉCNICO';
    const nombrePara = tutorNombreNormalizado
      ? (tutorNombreNormalizado.toUpperCase().startsWith(cargoSegmento)
        ? tutorNombreNormalizado
        : `${cargoSegmento} ${tutorNombreNormalizado}`.trim())
      : cargoSegmento;

    const modalidadDoc = this.resolveFirstNonEmpty(
      docData?.modalidad,
      docData?.modalidad_nombre,
      docData?.doc_modalidad,
      designation?.modalidad_nombre,
      modalDescripcion
    );

    const yearDoc = (docData && (docData.year || docData.anio))
      || (designation && (designation.year || designation.anio))
      || fechaDocumento.getFullYear();
    const numeroDocRaw = docData?.correlativo || correlativo || designation?.numero_documento || null;
    const citeDoc = (() => {
      if (docData?.cite && String(docData.cite).trim().length) return String(docData.cite).trim();
      if (designation?.cite && String(designation.cite).trim().length) return String(designation.cite).trim();
      if (numeroDocRaw != null) {
        const num = String(numeroDocRaw).trim();
        if (num) {
          return `CETA/DA/COMINT/${yearDoc}/${num}`;
        }
      }
      return undefined;
    })();

    const firstEst = estudiantesOrdenados && estudiantesOrdenados.length ? estudiantesOrdenados[0] : undefined;

    const documento = {
      tutorNombre,
      tutorApellidoP: tutorApellidoP || undefined,
      tutorApellidoM: tutorApellidoM || undefined,
      tutorNombres: tutorNombres || undefined,
      tutorTipo: this.resolvePdfTutorTipo(docData || designation),
      tutorCi: this.resolvePdfTutorCi(docData || designation),
      tutorCelular: this.resolvePdfTutorCelular(docData || designation),
      tutorTitulo: this.resolvePdfTutorTitulo(docData || designation),
      tutorTituloAcademico: tutorTituloAcademico || undefined,
      area: docData?.area ?? docData?.designacion_area ?? designation?.area ?? undefined,
      carrera:
        docData?.carrera_nombre
        || this.estudiante?.carrera
        || (firstEst && firstEst.carrera)
        || designation?.carrera_nombre
        || undefined,
      convocatoria: docData?.convocatoria_nom || designation?.convocatoria_nom || undefined,
      convocatoriaFechaInicio: docData?.convocatoria_fecha_inicio || designation?.convocatoria_fecha_inicio || undefined,
      convocatoriaFechaFin: docData?.convocatoria_fecha_fin || designation?.convocatoria_fecha_fin || undefined,
      cronogramaInicio: docData?.cronograma_inicio || docData?.convocatoria_fecha_inicio || designation?.cronograma_inicio || designation?.convocatoria_fecha_inicio || fechaDocumento,
      cronogramaFin: docData?.cronograma_fin || docData?.convocatoria_fecha_fin || designation?.cronograma_fin || designation?.convocatoria_fecha_fin || fechaDocumento,
      // Forzar que numeroDocumento tenga siempre algo razonable: primero correlativo del backend,
      // luego el correlativo recibido por parámetro, y por último el numero_documento de la designación
      numeroDocumento: docData?.correlativo || correlativo || designation?.numero_documento || undefined,
      // Enviar siempre un cite completo al servicio de PDF
      cite: citeDoc,
      modalidad: modalidadDoc || undefined,
      fecha: fechaDocumento,
      lugar: 'Cochabamba',
      elaboradoPor: docData?.elaborado_por || designation?.user_name || undefined,
      cargoElaborador: 'Responsable de Modalidad de Graduación',
      paraNombre: nombrePara,
      paraCargo,
      estudiantes: estudiantesOrdenados,
    };

    const fileNameBase = (docData?.correlativo || correlativo || tutorNombre || 'documento').toString().replace(/\s+/g, '-').toLowerCase();
    const opciones = {
      fileName: `designacion-${fileNameBase}.pdf`
    };

    return { documento, opciones };
  }

  private formatNombreApellidosPrimero(
    apellidoP?: string | null,
    apellidoM?: string | null,
    nombres?: string | null,
    fallback?: string | null
  ): string {
    const parts = [apellidoP, apellidoM, nombres]
      .map(value => (value || '').toString().trim())
      .filter(segment => segment.length > 0);
    const result = parts.length ? parts.join(' ') : (fallback || '');
    return result ? this.capitalizarPalabras(result) : '';
  }

  private estudianteNombre(est?: any): string {
    const src: any = est ?? this.estudiante ?? {};
    const nombres = src?.nombres || src?.nombres_est || '';
    const apPat = src?.ap_pat || src?.apellido_p || '';
    const apMat = src?.ap_mat || src?.apellido_m || '';
    const full = [apPat, apMat, nombres].map(v => (v || '').toString().trim()).filter(Boolean).join(' ').trim();
    if (full) {
      return this.capitalizarPalabras(full);
    }
    const cod = this.getEstudianteCodCeta(src);
    return cod || '';
  }

  private resolveEstudianteModalidad(est: any, modalidadGeneral?: string | null): string | undefined {
    const candidates: Array<any> = [
      est?.proyecto?.tipo,
      est?.proyecto?.modalidad,
      est?.proyecto_tipo,
      est?.proyecto_modalidad,
      est?.modalidad,
      est?.modalidad_nombre,
      est?.modalidad_nom,
      est?.modalidadNombre,
      est?.modalidadGraduacion,
      est?.modalidadGraduacionNombre,
      est?.tipo,
      est?.tema?.modalidad,
      est?.tema?.modalidad_nombre,
      est?.tema?.modalidadNom,
      est?.tema_registro?.modalidad,
      est?.tema_registro?.modalidad_nombre,
      est?.proyecto?.modalidad,
      est?.proyecto?.modalidad_nombre,
      modalidadGeneral,
    ];
    for (const value of candidates) {
      if (typeof value === 'string' && value.trim().length) {
        return value.trim();
      }
    }
    return undefined;
  }

  private lastDesignationEstudiantes(): any[] | null {
    const designation: any = this.lastDesignation || null;
    if (!designation) return null;

    if (Array.isArray(designation.estudiantes) && designation.estudiantes.length) {
      return designation.estudiantes;
    }

    if (designation.doc_estudiantes_resumen) {
      const resumen = designation.doc_estudiantes_resumen;
      if (Array.isArray(resumen) && resumen.length) {
        return resumen;
      }
      if (typeof resumen === 'string') {
        try {
          const parsed = JSON.parse(resumen);
          if (Array.isArray(parsed) && parsed.length) {
            return parsed;
          }
        } catch {}
      }
    }

    const candidateKeys = ['detalles', 'detalle', 'estudiantes_asignados', 'postulantes', 'lista_estudiantes'];
    for (const key of candidateKeys) {
      const value = (designation as any)[key];
      if (Array.isArray(value) && value.length) {
        return value;
      }
    }

    if (designation.estudiante_nombre) {
      return [{
        estudiante_nombre: designation.estudiante_nombre,
        carrera: designation.carrera_nombre,
        modalidad: designation.modalidad || designation.modalidad_nombre,
        area: designation.area,
        proyecto_nombre: designation.proyecto_nombre,
        fecha_designacion: designation.fecha_designacion,
      }];
    }

    return null;
  }

  hasLastDesignationDocument(): boolean {
    const designation: any = this.lastDesignation;
    if (!designation) {
      return false;
    }

    const resumenes = [
      designation.doc_estudiantes_resumen,
      designation.estudiantes_resumen,
      designation.estudiantes
    ];

    for (const resumen of resumenes) {
      if (!resumen) {
        continue;
      }
      if (Array.isArray(resumen)) {
        if (resumen.length > 0) {
          return true;
        }
        continue;
      }
      if (typeof resumen === 'string') {
        try {
          const parsed = JSON.parse(resumen);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return true;
          }
        } catch {}
      }
    }

    const correlativo = designation.numero_documento
      || designation.numeroDocumento
      || designation.doc_correlativo
      || designation.correlativo
      || designation.docNumero;
    const cite = designation.cite || designation.doc_cite;

    return Boolean(correlativo || cite);
  }

  cargarPostulantesInscritos() {
    this.loadingInscritos = true;
    this.postulanteService.getInscritos({ per_page: 200 }).subscribe({
      next: (resp: any) => {
        const payload = resp?.data ?? resp;
        const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
        this.postulantesInscritos = rows.map((row: any) => ({
          cod_ceta: Number(row?.cod_ceta_est ?? row?.cod_ceta ?? row?.codCeta ?? 0),
          nombres_est: row?.nombres_est ?? row?.nombres ?? '',
          ap_pat: row?.ap_pat ?? row?.apellido_p ?? '',
          ap_mat: row?.ap_mat ?? row?.apellido_m ?? '',
          ci: row?.ci ?? row?.ci_est ?? null,
          procedencia: row?.procedencia ?? row?.expedido ?? null,
          celular: row?.celular ?? row?.telf_movil ?? row?.telefono ?? row?.celular_est ?? null,
          correo: row?.correo ?? row?.email ?? row?.email_est ?? null,
          email: row?.email ?? row?.email_est ?? null,
          fecha_nacimiento: row?.fecha_nacimiento ?? row?.fec_nac ?? null,
          lugar_nacimiento: row?.lugar_nacimiento ?? row?.lugar_nac ?? null,
          pensum: row?.pensum ?? row?.pensum_actual ?? null,
          modo: row?.modalidad_nom ?? row?.modalidad ?? null,
          fecha_inscripcion: row?.fecha_inscripcion ?? row?.created_at ?? null,
          estado: row?.estado ?? null,
          carrera: row?.carrera ?? row?.carrera_nombre ?? null,
        })).filter((row: PostulanteInscrito) => !!row.cod_ceta);
        this.loadingInscritos = false;
      },
      error: () => {
        this.loadingInscritos = false;
      }
    });
  }

  private mapInscritoToEstudiante(p: PostulanteInscrito): Estudiante {
    const carreraKey = this.normalizeCarreraKey(p.carrera || null);
    const carreraLabel = this.formatCarreraLabel(carreraKey);
    const fechaNacimiento = this.parseNullableDate(p.fecha_nacimiento);
    return {
      cod_ceta: String(p.cod_ceta),
      ap_pat: p.ap_pat || '',
      ap_mat: p.ap_mat || '',
      nombres: p.nombres_est || '',
      ci: p.ci || '',
      procedencia: p.procedencia || '',
      celular: p.celular || (p as any)?.telf_movil || (p as any)?.telefono || undefined,
      correo: p.correo || p.email || undefined,
      fecha_nacimiento: fechaNacimiento,
      lugar_nacimiento: p.lugar_nacimiento ?? undefined,
      pensum: p.pensum ?? undefined,
      carrera: carreraLabel,
    };
  }

  private parseNullableDate(value?: string | Date | null): Date | undefined {
    if (!value) {
      return undefined;
    }
    // Si ya es Date, validar y devolver
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? undefined : value;
    }
    const s = String(value).trim();
    if (!s) return undefined;
    // Formato dd/mm/yyyy o d/m/yyyy
    const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m1) {
      const d = parseInt(m1[1], 10);
      const mo = parseInt(m1[2], 10) - 1;
      const y = parseInt(m1[3], 10);
      const dt = new Date(y, mo, d);
      return isNaN(dt.getTime()) ? undefined : dt;
    }
    // Formato YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const dt = new Date(`${s}T00:00:00`);
      return isNaN(dt.getTime()) ? undefined : dt;
    }
    // Intentar parseo general (ISO u otros con espacio)
    const normalized = s.includes('T') ? s : s.replace(' ', 'T');
    const parsed = new Date(normalized);
    return isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private persistEstudianteContext(estudiante: Estudiante) {
    try {
      const raw = sessionStorage.getItem('datos_postulacion');
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.estudiante = { ...(parsed.estudiante || {}), ...estudiante };
      sessionStorage.setItem('datos_postulacion', JSON.stringify(parsed));
    } catch {}
  }

  private enrichEstudianteFromSga(estudiante: Estudiante) {
    const cod = this.normalizeCodCeta((estudiante as any)?.cod_ceta ?? (estudiante as any)?.codCeta ?? (estudiante as any)?.codigo_ceta);
    if (!cod) {
      return;
    }
    const carreraCandidate = this.normalizeCarreraKey((estudiante as any)?.carrera)
      || this.normalizeCarreraKey(this.carreraSeleccionada)
      || this.carreraSeleccionada;
    const carrera = carreraCandidate || 'mecanica';
    this.estudianteService.buscarPorCeta(cod, carrera).pipe(take(1)).subscribe({
      next: (resp: any) => {
        const list = this.extractEstudiantesFromSgaResponse(resp);
        if (!list || list.length === 0) {
          return;
        }
        const match = list.find((item: any) => this.normalizeCodCeta(item?.cod_ceta ?? item?.codCeta ?? item?.codigo_ceta) === cod)
          || list[0];
        if (!match) {
          return;
        }
        const mapped = this.mapSgaEstudianteToCtx(match, estudiante);
        this.addOrMergeEstudiante(mapped);
        const merged = (this.estudiantes || []).find(x => this.normalizeCodCeta((x as any)?.cod_ceta ?? (x as any)?.codCeta ?? (x as any)?.codigo_ceta) === cod);
        if (merged) {
          this.estudiante = merged;
          this.persistEstudianteContext(merged);
        }
      },
      error: (err) => {
        console.warn('[SGA] No se pudo enriquecer estudiante', { cod, carrera, err });
      }
    });
  }

  private extractEstudiantesFromSgaResponse(resp: any): any[] {
    if (!resp) return [];
    const firstLayer = resp?.data ?? resp;
    if (Array.isArray(firstLayer)) return firstLayer;
    if (firstLayer && Array.isArray(firstLayer?.data)) return firstLayer.data;
    const secondLayer = firstLayer?.data;
    if (secondLayer && Array.isArray(secondLayer?.data)) return secondLayer.data;
    if (secondLayer && Array.isArray(secondLayer)) return secondLayer;
    if (firstLayer?.success && Array.isArray(firstLayer?.data)) return firstLayer.data;
    return [];
  }

  private mapSgaEstudianteToCtx(record: any, fallback: Estudiante | null): Estudiante {
    const base = fallback ? { ...fallback } : ({} as Estudiante);
    const celular = this.resolveFirstNonEmpty(
      record?.celular,
      record?.telefono,
      record?.telf_movil,
      record?.telfMovil,
      record?.telefono_movil,
      record?.raw?.Celular
    );
    const carrera = this.resolveFirstNonEmpty(record?.carrera, base.carrera);
    const fechaNacRaw = this.resolveFirstNonEmpty(record?.fecha_nacimiento, record?.fechaNacimiento, record?.raw?.['Fecha de Nacimiento']);
    const codCeta = this.resolveFirstNonEmpty(record?.cod_ceta, record?.codCeta, record?.codigo_ceta, base.cod_ceta);
    const mapped: Estudiante = {
      ...base,
      cod_ceta: codCeta ? String(codCeta) : base.cod_ceta,
      nombres: this.resolveFirstNonEmpty(record?.nombres, base.nombres) || base.nombres || '',
      ap_pat: this.resolveFirstNonEmpty(record?.ap_pat, base.ap_pat) || base.ap_pat || '',
      ap_mat: this.resolveFirstNonEmpty(record?.ap_mat, base.ap_mat) || base.ap_mat || '',
      ci: this.resolveFirstNonEmpty(record?.ci, base.ci) || base.ci || '',
      procedencia: this.resolveFirstNonEmpty(record?.procedencia, base.procedencia) || base.procedencia || '',
      carrera: carrera || base.carrera || '',
      celular: celular ? String(celular).trim() : base.celular,
      pensum: this.resolveFirstNonEmpty(record?.pensum, base.pensum) || base.pensum,
      fecha_nacimiento: this.parseNullableDate(fechaNacRaw) ?? base.fecha_nacimiento,
      lugar_nacimiento: this.resolveFirstNonEmpty(record?.lugar_nacimiento, record?.lugarNacimiento, base.lugar_nacimiento) || base.lugar_nacimiento,
    };
    return mapped;
  }

  private formatCarreraLabel(key: string | null | undefined): string {
    switch (key) {
      case 'electricidad':
        return 'Electricidad y Electrónica Automotriz';
      case 'mecanica':
        return 'Mecánica Automotriz';
      default:
        return key ? this.capitalizarPalabras(key) : '';
    }
  }

  private formatFechaInscripcion(value?: string | null): string {
    if (!value) {
      return '-';
    }
    const raw = value.trim();
    if (!raw) {
      return '-';
    }

    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
    const date = new Date(normalized);
    if (!isNaN(date.getTime())) {
      try {
        return formatDate(date, 'dd/MM/yyyy HH:mm', 'es-BO', 'UTC-04:00');
      } catch {}
    }

    const [fechaPart, timePart] = raw.split(/[T ]/);
    if (fechaPart) {
      const [y, m, d] = fechaPart.split('-');
      if (y && m && d) {
        const hora = (timePart || '').slice(0, 5);
        const horaLabel = hora ? ` ${hora}` : '';
        return `${d}/${m}/${y}${horaLabel}`;
      }
    }
    return raw;
  }

  get mostrarTablaInscritos(): boolean {
    if (!this.tablaInscritosVisible) {
      return false;
    }
    if (this.loading) {
      return false;
    }
    if (this.estudiantesEncontrados || this.estudiantes.length > 0) {
      return false;
    }
    return true;
  }

  seleccionarInscrito(postulante: PostulanteInscrito) {
    const estudiante = this.mapInscritoToEstudiante(postulante);
    const carreraKey = this.normalizeCarreraKey(postulante.carrera || null);
    if (carreraKey) {
      this.carreraSeleccionada = carreraKey;
    }
    this.tablaInscritosVisible = false;
    this.seleccionarEstudianteYAbrirModal(estudiante);
  }

  getCarreraLabel(ins: PostulanteInscrito): string {
    return this.formatCarreraLabel(this.normalizeCarreraKey(ins.carrera || null));
  }

  getFechaInscripcion(ins: PostulanteInscrito): string {
    return this.formatFechaInscripcion(ins.fecha_inscripcion);
  }

  // --- Proyecto/Tema existente ---
  private cargarProyectoActual(codCeta: string | number) {
    if (!codCeta) { this.proyectoActual = null; return; }
    // Limpiar estado previo para evitar mostrar datos antiguos mientras carga
    this.proyectoActual = null;
    this.proyectoService.getByCod(codCeta).subscribe({
      next: (res) => {
        // Normalizar posibles formatos de respuesta
        let p: any = null;
        if (!res) {
          p = null;
        } else if (Array.isArray(res)) {
          p = res.length > 0 ? res[0] : null;
        } else if (res.data) {
          p = Array.isArray(res.data) ? res.data[0] : res.data;
        } else if (res.proyecto) {
          p = res.proyecto;
        } else {
          p = res;
        }
        // Considerar 'vacío' si no hay campos clave
        const hasMeaningful = !!(p && (p.id || p.nombre || (p.cod_ceta ?? p.codCeta ?? p.codigo_ceta)));
        this.proyectoActual = hasMeaningful ? p : null;
        console.log('[Modalidad] Proyecto actual:', this.proyectoActual);
        // Sincronizar visual y backend: si la modalidad de inscripción y la del proyecto difieren, actualizar inscrip_modalidad.modalidad_nom
        try {
          const nombreIns = this.inscripcionActual?.nombre || '';
          const nombreProj = (this.proyectoActual as any)?.tipo || '';
          // Resolver modalidad_id por nombre (si está cargada la lista)
          const foundMod = (this.modalidades || []).find(m => (m.nombre || '').toString().toLowerCase() === (nombreProj || '').toString().toLowerCase());
          const modalidadId = foundMod?.id;
          if (this.inscripcionActual && this.proyectoActual && nombreIns && nombreProj && nombreIns !== nombreProj) {
            this.postulanteService.getInscripModalidadByCodCeta(String(codCeta)).subscribe({
              next: (r: any) => {
                let row: any = null;
                if (!r) row = null; else if (Array.isArray(r)) row = r[0] || null; else if (r.data) row = Array.isArray(r.data) ? (r.data[0] || null) : r.data; else row = r;
                const id = row?.id || row?.inscripcion_id || row?.inscrip_modalidad_id;
                if (id) {
                  this.postulanteService.updateInscripModalidad(id, { modalidad_nom: nombreProj, modalidad_id: modalidadId }).subscribe({
                    next: (resp) => {
                      console.log('[Sync modalidad] PATCH por id OK:', resp);
                      this.inscripcionActual = { ...(this.inscripcionActual as any), nombre: nombreProj } as any;
                    },
                    error: (err) => {
                      console.warn('[Sync modalidad] PATCH por id falló, fallback por cod', err);
                      // Fallback por código
                      this.postulanteService.updateInscripModalidadByCod(String(codCeta), { modalidad_nom: nombreProj, modalidad_id: modalidadId })
                        .subscribe({ next: (resp2) => {
                          console.log('[Sync modalidad] upsert_by_cod OK:', resp2);
                          this.inscripcionActual = { ...(this.inscripcionActual as any), nombre: nombreProj } as any;
                        }, error: (err2) => console.error('[Sync modalidad] upsert_by_cod ERROR:', err2) });
                    }
                  });
                } else {
                  // Sin id: usar fallback por código
                  this.postulanteService.updateInscripModalidadByCod(String(codCeta), { modalidad_nom: nombreProj, modalidad_id: modalidadId })
                    .subscribe({ next: (resp) => {
                      console.log('[Sync modalidad] upsert_by_cod OK (sin id):', resp);
                      this.inscripcionActual = { ...(this.inscripcionActual as any), nombre: nombreProj } as any;
                    }, error: (err) => console.error('[Sync modalidad] upsert_by_cod ERROR (sin id):', err) });
                }
              },
              error: () => {}
            });
          }
        } catch {}
      },
      error: (err) => {
        console.warn('[Modalidad] No se pudo obtener proyecto por cod_ceta', codCeta, err);
        this.proyectoActual = null;
      }
    });
  }

  private cargarProyectoActual$(codCeta: string | number): Observable<void> {
    if (!codCeta) {
      this.proyectoActual = null;
      return of(void 0);
    }
    this.proyectoActual = null;
    return this.proyectoService.getByCod(codCeta).pipe(
      tap((res) => {
        let p: any = null;
        if (!res) p = null; else if (Array.isArray(res)) p = res[0] || null; else if ((res as any).data) p = Array.isArray((res as any).data) ? (res as any).data[0] : (res as any).data; else if ((res as any).proyecto) p = (res as any).proyecto; else p = res;
        const hasMeaningful = !!(p && (p.id || p.nombre || (p.cod_ceta ?? (p as any).codCeta ?? (p as any).codigo_ceta)));
        this.proyectoActual = hasMeaningful ? p : null;
      }),
      catchError(() => { this.proyectoActual = null; return of(void 0); }),
      map(() => void 0)
    );
  }

  private formatConvocatoriaLabel(conv: any): string {
    if (!conv) return '';
    const numero = conv?.numero_convocatoria ?? conv?.numero ?? conv?.numeroConvocatoria ?? conv?.convocatoria_numero;
    const nombreRaw = conv?.nombre ?? conv?.convocatoria_nom ?? conv?.titulo ?? '';
    const nombre = typeof nombreRaw === 'string' ? nombreRaw.trim() : nombreRaw;
    if (numero && nombre) return `${numero} - ${nombre}`;
    if (numero) return `Convocatoria ${numero}`;
    if (nombre) return String(nombre);
    const anio = conv?.anio ?? conv?.gestion;
    return anio ? `Convocatoria ${anio}` : '';
  }

  private normalizeCodCeta(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  private getEstudianteCodCeta(est?: any): string {
    const src: any = est ?? this.estudiante;
    if (!src || typeof src !== 'object') return '';
    return this.normalizeCodCeta(src.cod_ceta ?? src.codCeta ?? src.codigo_ceta ?? src.cod_ceta_est);
  }

  private updateLastDesignationFromSession(cod?: string | number) {
    try {
      const raw = sessionStorage.getItem('datos_postulacion');
      if (!raw) {
        this.lastDesignation = null;
        const expected = this.normalizeCodCeta(cod);
        if (expected) {
          this.fetchDesignationFromBackend(expected);
        }
        return;
      }
      const parsed = JSON.parse(raw);
      const stored = parsed?.last_designation || parsed?.designacion || parsed?.lastDesignation || null;
      if (!stored) {
        this.lastDesignation = null;
        this.persistLastDesignationInSession(null);
        const expected = this.normalizeCodCeta(cod);
        if (expected) {
          this.fetchDesignationFromBackend(expected);
        }
        return;
      }
      let expectedCod = this.normalizeCodCeta(cod);
      if (!expectedCod) {
        expectedCod = this.getEstudianteCodCeta();
      }
      if (!expectedCod && parsed?.estudiante) {
        expectedCod = this.getEstudianteCodCeta(parsed.estudiante);
      }
      const storedCod = this.normalizeCodCeta(stored?.cod_ceta ?? stored?.codCeta ?? stored?.cod_ceta_est);
      if (expectedCod && storedCod && expectedCod !== storedCod) {
        this.lastDesignation = null;
        this.persistLastDesignationInSession(null);
        this.fetchDesignationFromBackend(expectedCod);
        return;
      }
      this.lastDesignation = stored;
      this.persistLastDesignationInSession(stored);
      if (expectedCod) {
        this.fetchDesignationFromBackend(expectedCod);
      }
    } catch {
      this.lastDesignation = null;
      this.persistLastDesignationInSession(null);
      const expected = this.normalizeCodCeta(cod);
      if (expected) {
        this.fetchDesignationFromBackend(expected);
      }
    }
  }

  private persistLastDesignationInSession(designation: any | null) {
    try {
      const raw = sessionStorage.getItem('datos_postulacion');
      const parsed = raw ? JSON.parse(raw) : {};
      if (designation) {
        parsed.last_designation = designation;
      } else {
        delete parsed.last_designation;
      }
      sessionStorage.setItem('datos_postulacion', JSON.stringify(parsed));
    } catch {
      // Ignorar errores de almacenamiento
    }
  }

  private fetchDesignationFromBackend(codCeta: string | number) {
    const normalized = this.normalizeCodCeta(codCeta);
    if (!normalized) return;
    this.sgaService.getTutoresDesignados({ cod_ceta: normalized })
      .pipe(take(1), catchError(() => of(null)))
      .subscribe((resp) => {
        const rows = (resp as any)?.data ?? resp;
        const list = Array.isArray(rows) ? rows as TutorDesignacionItem[] : [];
        const first = list.length ? list[0] : null;
        if (first) {
          const merged = this.normalizeDesignationData(first, this.lastDesignation);
          this.lastDesignation = merged;
          this.persistLastDesignationInSession(merged);
        } else {
          this.lastDesignation = null;
          this.persistLastDesignationInSession(null);
        }
        this.cdr.detectChanges();
      });
  }

  private resolveFirstNonEmpty(...values: Array<any>): string | null {
    for (const value of values) {
      if (value === null || value === undefined) continue;
      const text = String(value).trim();
      if (!text || text === '-') continue;
      return text;
    }
    return null;
  }

  private normalizeDesignationData(data: any, fallback: any | null): any {
    const merged = { ...(fallback || {}) } as any;

    const tutorNombre = this.resolveFirstNonEmpty(
      data?.tutor_nombre,
      data?.tutor?.nombre_completo,
      (data?.tutor?.nombre && data?.tutor?.apellido_p) ? `${data.tutor.apellido_p} ${data.tutor.apellido_m || ''} ${data.tutor.nombre}` : null,
      fallback?.tutor_nombre,
    );
    if (tutorNombre) merged.tutor_nombre = tutorNombre;

    const area = this.resolveFirstNonEmpty(
      data?.area,
      (data as any)?.area_nombre,
      (data as any)?.area_label,
      (data as any)?.pertinencia,
      fallback?.area,
    );
    if (!area) {
      const areaFromStudents = Array.isArray(data?.estudiantes)
        ? data.estudiantes.map((est: any) => this.resolveFirstNonEmpty(
            est?.area,
            (est as any)?.area_nombre,
            (est as any)?.area_label,
            (est as any)?.pertinencia,
          )).find((val: string | null | undefined) => !!val)
        : null;
      if (areaFromStudents) {
        merged.area = areaFromStudents;
      }
    } else {
      merged.area = area;
    }

    const convocatoria = this.resolveFirstNonEmpty(
      data?.convocatoria_nom,
      data?.convocatoria_label,
      (data as any)?.convocatoria_nombre,
      (data as any)?.convocatoria,
      fallback?.convocatoria_nom,
    );
    if (convocatoria) merged.convocatoria_nom = convocatoria;

    const fecha = this.resolveFirstNonEmpty(
      data?.fecha_designacion,
      (Array.isArray(data?.estudiantes) ? data.estudiantes.map((est: any) => est?.fecha_designacion) : []),
      data?.fecha,
      data?.created_at,
      fallback?.fecha_designacion,
    );
    if (fecha) merged.fecha_designacion = fecha;

    const codCeta = data?.cod_ceta ?? data?.codCeta ?? fallback?.cod_ceta ?? fallback?.codCeta;
    if (codCeta) {
      merged.cod_ceta = codCeta;
    }

    merged.tutor_id = data?.tutor_id ?? merged.tutor_id;
    merged.convocatoria_id = data?.convocatoria_id ?? merged.convocatoria_id;
    merged.numero_documento = data?.numero_documento ?? merged.numero_documento;
    merged.cite = data?.cite ?? merged.cite;

    return merged;
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

  // Normaliza cualquier representación de carrera a una clave estable ('mecanica' | 'electricidad')
  private normalizeCarreraKey(v: string | null | undefined): 'mecanica' | 'electricidad' | null {
    const s = (v || '').toString().trim().toLowerCase();
    if (!s) return null;
    // Códigos y nombres conocidos
    if (s === 'mea' || s.includes('mecánica') || s.includes('mecanica')) return 'mecanica';
    if (s === 'eea' || s.includes('electricidad') || s.includes('electrónica') || s.includes('electronica')) return 'electricidad';
    return null;
  }

  // Valida si un Estudiante coincide con la carrera seleccionada en la UI
  private matchesSelectedCarrera(e: Estudiante): boolean {
    const selectedKey = this.normalizeCarreraKey(this.carreraSeleccionada);
    if (!selectedKey) return true; // si por alguna razón no hay selección válida, no filtrar
    const ek = this.normalizeCarreraKey((e as any).carrera || (e as any).carrera_nombre);
    return ek === selectedKey;
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
      if (!merged.celular && (e as any)?.celular) {
        merged.celular = (e as any).celular;
      }
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

    this.tablaInscritosVisible = false;
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
              if (!this.tieneDatosEstudiante(e)) continue;
              if (!this.matchesSelectedCarrera(e)) {
                console.warn('[BUSCAR CETA][SGA] Ignorado por carrera distinta a la seleccionada.', {
                  seleccionado: this.carreraSeleccionada, estudianteCarrera: (e as any).carrera
                });
                continue;
              }
              this.addOrMergeEstudiante(e);
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

    // 2) Búsqueda local por CETA exacto (usar string, sin convertir a número)
    const codStr = (this.codigoCeta || '').trim();
    if (codStr) {
      this.postulanteService.getById(codStr as any).subscribe({
        next: (p: Postulante) => {
          if (p && (p as any)?.cod_ceta) {
            console.log('[BUSCAR CETA][LOCAL] Postulante encontrado:', p);
            const e = this.mapPostulanteToEstudiante(p);
            if (!this.matchesSelectedCarrera(e)) {
              console.warn('[BUSCAR CETA][LOCAL] Ignorado por carrera distinta a la seleccionada.', {
                seleccionado: this.carreraSeleccionada, estudianteCarrera: e.carrera
              });
            } else {
              this.addOrMergeEstudiante(e);
            }
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

    this.tablaInscritosVisible = false;
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
          // Además, filtrar por carrera seleccionada
          const key = this.normalizeCarreraKey(((p as any).carrera_nombre || p.carrera));
          const sel = this.normalizeCarreraKey(this.carreraSeleccionada);
          const okCarr = !sel || key === sel;
          return okN && okAp && okAm && okCarr;
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
    const cod = (estudiante as any)?.cod_ceta || (estudiante as any)?.codCeta || (estudiante as any)?.codigo_ceta;
    this.updateLastDesignationFromSession(cod);
    this.persistEstudianteContext(estudiante);
    this.enrichEstudianteFromSga(estudiante);
  }

  seleccionarEstudianteYAbrirModal(estudiante: Estudiante) {
    this.seleccionarEstudiante(estudiante);
    const cod = (estudiante as any)?.cod_ceta || (estudiante as any)?.codCeta || (estudiante as any)?.codigo_ceta;
    if (cod) {
      this.loadingService.showModal();
      this.cargarInscripcionActual$(cod)
        .pipe(
          switchMap(() => this.cargarProyectoActual$(String(cod)))
        )
        .subscribe({
          error: () => { this.loadingService.hideModal(); this.abrirModal(); },
          complete: () => { this.loadingService.hideModal(); this.abrirModal(); }
        });
    } else {
      this.inscripcionActual = null;
      this.proyectoActual = null;
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

  // CETA del estudiante seleccionado, seguro para la plantilla
  get codCetaSeleccionado(): string | null {
    const e: any = this.estudiante as any;
    const v = e?.cod_ceta ?? e?.codCeta ?? e?.codigo_ceta;
    return v != null ? String(v) : null;
  }

  private getModalidadDescripcion(): string {
    if (this.inscripcionActual?.nombre) {
      return this.inscripcionActual.nombre;
    }
    if (this.modalidadSeleccionada?.nombre) {
      return this.modalidadSeleccionada.nombre;
    }
    const est: any = this.estudiante;
    const modalidadFromEst = est?.modalidad || est?.modalidad_nombre || est?.modo;
    if (typeof modalidadFromEst === 'string' && modalidadFromEst.trim().length) {
      return modalidadFromEst.trim();
    }
    return 'Proyecto de Grado';
  }

  private resolvePdfTutorNombre(designation: any): string {
    const tutor = designation?.tutor || {};
    const nombreFallback = designation?.tutor_nombre || tutor?.nombre_completo || 'Tutor designado';
    return this.formatNombreApellidosPrimero(
      tutor?.apellido_p,
      tutor?.apellido_m,
      tutor?.nombre,
      nombreFallback
    ) || nombreFallback;
  }

  private resolvePdfTutorTipo(designation: any): string | undefined {
    return designation?.tipo_tutor_nombre || designation?.tutor_tipo || designation?.tutor?.tipo_tutor || undefined;
  }

  private resolvePdfTutorCi(designation: any): string | undefined {
    return designation?.tutor_ci || designation?.tutor?.ci || undefined;
  }

  private resolvePdfTutorCelular(designation: any): string | undefined {
    return designation?.tutor_celular || designation?.tutor?.celular || undefined;
  }

  private resolvePdfTutorTitulo(designation: any): string | undefined {
    return designation?.doc_tutor_titulo || designation?.tutor_titulo || 'DOCENTE TÉCNICO';
  }

  private resolvePdfTutorTituloAcademico(designation: any): string | undefined {
    return designation?.tutor_titulo_academico || designation?.tutor?.titulo_academico || undefined;
  }

  private resolvePdfEstudiantes(
    designation: any,
    fallbackArea?: string | null,
    fallbackTema?: string | null,
    modalidadGeneral?: string | null
  ): TutorDesignacionEstudiante[] | undefined {
    const listadoBase = (() => {
      if (Array.isArray(designation?.estudiantes) && designation.estudiantes.length) {
        return designation.estudiantes;
      }
      if (Array.isArray(designation?.doc_estudiantes_resumen) && designation.doc_estudiantes_resumen.length) {
        return designation.doc_estudiantes_resumen;
      }
      if (typeof designation?.doc_estudiantes_resumen === 'string') {
        try {
          const parsed = JSON.parse(designation.doc_estudiantes_resumen);
          if (Array.isArray(parsed) && parsed.length) {
            return parsed;
          }
        } catch {}
      }
      return this.lastDesignationEstudiantes();
    })();

    if (!listadoBase || !listadoBase.length) {
      return undefined;
    }

    return listadoBase.map((est: any) => {
      const nombre = this.formatNombreApellidosPrimero(
        est?.apellido_p ?? est?.ap_pat,
        est?.apellido_m ?? est?.ap_mat,
        est?.nombres ?? est?.nombre,
        est?.estudiante_nombre ?? this.estudianteNombre(est)
      ) || this.estudianteNombre(est);

      return {
        nombre,
        codigo: est?.cod_ceta ? String(est.cod_ceta) : undefined,
        carrera: est?.carrera || this.estudiante?.carrera || designation?.carrera_nombre || undefined,
        modalidad: this.resolveEstudianteModalidad(est, modalidadGeneral) || modalidadGeneral || undefined,
        area: est?.area || fallbackArea || undefined,
        tema: est?.proyecto_nombre || est?.tema || fallbackTema || undefined,
        fechaDesignacion: est?.fecha_designacion || designation?.fecha_designacion || undefined,
      };
    });
  }

  private mapDocEstudiantesToPdf(
    docEstudiantes: any[] | null | undefined,
    docData: any | null,
    designation: any,
    modalidadGeneral: string
  ): TutorDesignacionEstudiante[] | undefined {
    if (!Array.isArray(docEstudiantes) || !docEstudiantes.length) {
      return undefined;
    }

    const fallbackArea = (docData && (docData.area || docData.designacion_area)) || designation?.area || null;
    const fallbackTema = (docData && docData.proyecto_nombre) || this.proyectoActual?.nombre || null;
    const fallbackCarrera = (docData && (docData.carrera_nombre || docData.carrera)) || designation?.carrera_nombre || this.estudiante?.carrera || undefined;
    const fallbackFecha = (docData && docData.fecha_designacion) || designation?.fecha_designacion || undefined;

    return docEstudiantes.map((item: any) => {
      const rawNombre = this.resolveFirstNonEmpty(
        item?.estudiante_nombre,
        item?.nombre,
        this.estudianteNombre(item)
      );
      const nombre = rawNombre ? this.capitalizarPalabras(String(rawNombre)) : this.estudianteNombre(item);
      const modalidadValor = this.resolveEstudianteModalidad(item, modalidadGeneral)
        || this.resolveFirstNonEmpty(item?.modalidad_nombre, item?.modalidad_label, docData?.modalidad_nombre, modalidadGeneral)
        || modalidadGeneral;
      const areaValor = this.resolveFirstNonEmpty(
        item?.area,
        item?.area_nombre,
        item?.area_label,
        docData?.area,
        fallbackArea
      ) || undefined;
      const temaValor = this.resolveFirstNonEmpty(
        item?.tema,
        item?.tema_proyecto,
        item?.tema_estudiante,
        item?.tema1,
        item?.proyecto_tema,
        item?.proyecto_nombre,
        fallbackTema
      ) || undefined;
      return {
        nombre,
        codigo: item?.cod_ceta ? String(item.cod_ceta) : undefined,
        carrera: item?.carrera || fallbackCarrera,
        modalidad: modalidadValor || undefined,
        area: areaValor,
        tema: temaValor,
        fechaDesignacion: item?.fecha_designacion || fallbackFecha,
      };
    });
  }

  private sortEstudiantesParaPdf(estudiantes: TutorDesignacionEstudiante[]): TutorDesignacionEstudiante[] {
    if (!Array.isArray(estudiantes)) {
      return [];
    }
    return [...estudiantes].sort((a, b) => {
      const tokens = (value?: string) => (value || '').toLocaleLowerCase().split(/\s+/).filter(Boolean);
      const [aPat, aMat, ...aNames] = tokens(a.nombre);
      const [bPat, bMat, ...bNames] = tokens(b.nombre);
      if (aPat !== bPat) return (aPat || '').localeCompare(bPat || '', 'es');
      if (aMat !== bMat) return (aMat || '').localeCompare(bMat || '', 'es');
      return (aNames.join(' ') || '').localeCompare(bNames.join(' ') || '', 'es');
    });
  }

  private dedupeNombreTexto(nombre?: string | null): string | undefined {
    if (!nombre) return undefined;
    const tokens = nombre.split(/\s+/).filter(Boolean);
    const seen = new Set<string>();
    const deduped = tokens.filter(tok => {
      const key = tok.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const result = deduped.join(' ').trim();
    return result || undefined;
  }

  async descargarDocumentoDesignacion() {
    if (!this.lastDesignation) {
      alert('No se encontró una designación previa para este postulante.');
      return;
    }
    const designation = this.lastDesignation;
    const correlativoRaw = designation?.numero_documento
      || designation?.numeroDocumento
      || designation?.doc_correlativo
      || designation?.correlativo
      || designation?.numero
      || null;

    if (!correlativoRaw) {
      alert('No se encontró correlativo asociado al documento.');
      return;
    }

    this.loadingService.showModal();
    try {
      let docData: any = null;
      try {
        const response = await firstValueFrom(this.sgaService.getDocDesignacionesByCorrelativo(correlativoRaw));
        docData = (response as any)?.data ?? response ?? null;
      } catch (fetchErr) {
        console.warn('No se pudo obtener detalle del documento desde el backend.', fetchErr);
      }

      const pdfPayload = this.buildPdfPayloadFromDesignation(designation, correlativoRaw, docData);
      if (!pdfPayload) {
        alert('No se pudo preparar el documento para descargar.');
        return;
      }

      console.log('PDF DESIGNACION DOC =>', {
        numeroDocumento: pdfPayload.documento?.numeroDocumento,
        cite: pdfPayload.documento?.cite,
        carrera: pdfPayload.documento?.carrera,
      });

      await this.pdfService.generarDesignacionTutorPdf(pdfPayload.documento, pdfPayload.opciones);
    } catch (err) {
      console.error('Error al descargar documento de designación:', err);
      alert('No se pudo descargar el documento. Intente nuevamente.');
    } finally {
      this.loadingService.hideModal();
    }
  }

  continuarConModalidad() {
    if (!this.estudiante || !this.modalidadSeleccionada) {
      this.error = 'Debe seleccionar un estudiante y una modalidad';
      return;
    }

    // Guardar datos en sessionStorage para pasarlos a postulantes
    const datosPostulacion = {
      estudiante: this.estudiante,
      modalidad: this.modalidadSeleccionada,
      last_designation: this.lastDesignation
    };
    sessionStorage.setItem('datos_postulacion', JSON.stringify(datosPostulacion));
    
    // Cerrar el modal
    this.cerrarModal();

    // Navegar a la página de postulantes (nuevo)
    this.router.navigate(['/postulantes/nuevo']);
  }

  // Navegar a Postulantes en modo "Ver inscripción" y pasar el estudiante en sessionStorage
  verInscripcion() {
    if (!this.estudiante || !this.inscripcionActual) {
      // Si no hay estudiante cargado, no tiene sentido entrar a ver
      return;
    }
    // Si hay una inscripción actual, mapearla a un objeto de modalidad simple
    const modalidad = this.inscripcionActual
      ? { id: this.inscripcionActual.modalidad_id, nombre: this.inscripcionActual.nombre, descripcion: '', monto_arancel: '' }
      : null;
    const datosPostulacion = { estudiante: this.estudiante, modalidad, last_designation: this.lastDesignation };
    try {
      sessionStorage.setItem('datos_postulacion', JSON.stringify(datosPostulacion));
    } catch {}
    // Cerrar modal y navegar con query param ver=1 para activar el modo lectura
    this.cerrarModal();
    this.router.navigate(['/postulantes'], { queryParams: { ver: 1 } });
  }

  // Navegar a Registro de tema mostrando el RESUMEN directamente (sin parpadeo)
  verRegistroTema() {
    if (!this.estudiante) return;
    const modalidad = this.inscripcionActual
      ? { id: this.inscripcionActual.modalidad_id, nombre: this.inscripcionActual.nombre, descripcion: '', monto_arancel: '' }
      : null;
    const datosPostulacion = { estudiante: this.estudiante, modalidad, last_designation: this.lastDesignation };
    try {
      sessionStorage.setItem('datos_postulacion', JSON.stringify(datosPostulacion));
      // Persistir un cache de proyecto actual (si existe) para hidratar inmediatamente el resumen
      if (this.proyectoActual) {
        sessionStorage.setItem('proyecto_cache', JSON.stringify(this.proyectoActual));
      }
    } catch {}
    this.cerrarModal();
    const cod = (this.estudiante as any)?.cod_ceta || (this.estudiante as any)?.codCeta || (this.estudiante as any)?.codigo_ceta;
    this.router.navigate(['/registro-tema'], { queryParams: { cod_ceta: cod, ver: 'resumen' } });
  }

  // Navegar a Designar Tutor con contexto del estudiante y proyecto actual
  irADesignarTutor() {
    if (!this.estudiante) return;
    const modalidad = this.inscripcionActual
      ? { id: this.inscripcionActual.modalidad_id, nombre: this.inscripcionActual.nombre, descripcion: '', monto_arancel: '' }
      : null;
    const datosPostulacion = { estudiante: this.estudiante, modalidad, last_designation: this.lastDesignation };
    try {
      sessionStorage.setItem('datos_postulacion', JSON.stringify(datosPostulacion));
      if (this.proyectoActual) {
        sessionStorage.setItem('proyecto_cache', JSON.stringify(this.proyectoActual));
      }
    } catch {}
    const cod = (this.estudiante as any)?.cod_ceta || (this.estudiante as any)?.codCeta || (this.estudiante as any)?.codigo_ceta;
    const carreraKey = this.normalizeCarreraKey(((this.estudiante as any)?.carrera || (this.estudiante as any)?.carrera_nombre) ?? this.carreraSeleccionada) || this.carreraSeleccionada as any;
    this.cerrarModal();
    this.router.navigate(['/tutores/designar'], { queryParams: { cod_ceta: cod, carrera: carreraKey } });
  }

  verSeguimientoDesignacion() {
    if (!this.estudiante || !this.lastDesignation) return;
    const modalidad = this.inscripcionActual
      ? { id: this.inscripcionActual.modalidad_id, nombre: this.inscripcionActual.nombre, descripcion: '', monto_arancel: '' }
      : null;
    const datosPostulacion = { estudiante: this.estudiante, modalidad, last_designation: this.lastDesignation };
    try {
      sessionStorage.setItem('datos_postulacion', JSON.stringify(datosPostulacion));
      if (this.proyectoActual) {
        sessionStorage.setItem('proyecto_cache', JSON.stringify(this.proyectoActual));
      }
    } catch {}
    const cod = (this.estudiante as any)?.cod_ceta || (this.estudiante as any)?.codCeta || (this.estudiante as any)?.codigo_ceta;
    this.cerrarModal();
    this.router.navigate(['/tutores/designaciones'], { queryParams: { cod_ceta: cod } });
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
    this.tablaInscritosVisible = true;
    if (!this.loadingInscritos && (!this.postulantesInscritos || this.postulantesInscritos.length === 0)) {
      this.cargarPostulantesInscritos();
    }
  }

  registrarNuevoPostulante() {
    // Limpiar cualquier dato previo y navegar a la interfaz de Postulantes vacía
    try {
      sessionStorage.removeItem('datos_postulacion');
    } catch (e) {
      console.warn('No se pudo limpiar sessionStorage', e);
    }
    this.router.navigate(['/postulantes/nuevo']);
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
      1: 'bi bi-journal-text',     // Proyecto de Grado
      2: 'bi bi-gear-fill',        // Proyecto Sociocomunitario Productivo
      3: 'bi bi-building',         // Proyecto de Emprendimiento Productivo
      4: 'bi bi-clipboard-check',   // Trabajo Dirigido Externo
      5: 'bi bi-award-fill',       // Graduación por Experiencia Laboral
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
            fecha_inscripcion: res?.fecha_inscripcion || undefined,
            convocatoria_nom: (res?.convocatoria_nom || this.formatConvocatoriaLabel(res?.convocatoria)) || undefined
          };
        } else if (res?.modalidad_id) {
          const mid = Number(res.modalidad_id);
          const found = (this.modalidades || []).find(m => m.id === mid) || null;
          this.inscripcionActual = {
            modalidad_id: mid,
            nombre: found?.nombre || 'Modalidad #' + mid,
            estado: res?.estado || undefined,
            fecha_inscripcion: res?.fecha_inscripcion || undefined,
            convocatoria_nom: res?.convocatoria_nom || undefined
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
      switchMap(() => {
        return this.postulanteService.getInscripModalidadByCodCeta(String(codCeta)).pipe(
          tap((r: any) => {
            try {
              let row: any = null;
              if (!r) row = null; else if (Array.isArray(r)) row = r[0] || null; else if (r.data) row = Array.isArray(r.data) ? (r.data[0] || null) : r.data; else row = r;
              const flag = row?.aranceles_completos ?? row?.inscripcion?.aranceles_completos;
              if (flag !== undefined && flag !== null && this.inscripcionActual) {
                const v = (typeof flag === 'string') ? flag.trim() : flag;
                const ok = (v === true || v === 1 || v === '1');
                // Solo actualizar el flag si ya existe una inscripción real
                this.inscripcionActual = { ...this.inscripcionActual, aranceles_completos: ok } as any;
              }
              const convNom = row?.convocatoria_nom || row?.nom_convocatoria || row?.inscripcion?.convocatoria_nom;
              if (convNom && this.inscripcionActual) {
                this.inscripcionActual = { ...this.inscripcionActual, convocatoria_nom: convNom } as any;
              }
            } catch {}
          }),
          catchError(() => of(void 0))
        );
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
    // Bloquear si ya existe un proyecto
    if (this.proyectoActual) {
      this.error = 'Este estudiante ya tiene un tema registrado.';
      return;
    }
    console.log('[registrarProyecto] estudiante:', this.estudiante, 'inscripcionActual:', this.inscripcionActual);
    // Validar contexto y preparar modalidad
    let modalidad: { id: number; nombre: string; descripcion: string; monto_arancel: string } | null = null;
    if (this.inscripcionActual) {
      const mid = this.inscripcionActual.modalidad_id;
      const found = (this.modalidades || []).find(m => m.id === mid) || null;
      modalidad = found
        ? {
            id: found.id,
            nombre: found.nombre,
            descripcion: found.descripcion || '',
            monto_arancel: found.monto_arancel || ''
          }
        : {
            id: mid,
            nombre: this.inscripcionActual.nombre || ('Modalidad #' + mid),
            descripcion: '',
            monto_arancel: ''
          };
    } else if (this.modalidadSeleccionada) {
      modalidad = {
        id: this.modalidadSeleccionada.id,
        nombre: this.modalidadSeleccionada.nombre,
        descripcion: this.modalidadSeleccionada.descripcion || '',
        monto_arancel: this.modalidadSeleccionada.monto_arancel || ''
      };
    }

    if (!this.estudiante || !modalidad) {
      this.error = 'No se pudo determinar el contexto (estudiante y modalidad). Seleccione un estudiante y asegure una inscripción activa.';
      console.warn('[registrarProyecto] Contexto insuficiente.');
      // Aún así intentar redirigir para no bloquear al usuario
    }

    const datosPostulacion = {
      estudiante: this.estudiante,
      modalidad: modalidad
    };
    try {
      sessionStorage.setItem('datos_postulacion', JSON.stringify(datosPostulacion));
    } catch (e) {
      console.warn('No se pudo guardar datos_postulacion en sessionStorage:', e);
    }

    // Cerrar modal y navegar a la página de Registro de Tema
    this.cerrarModal();
    const cod = (this.estudiante as any)?.cod_ceta || (this.estudiante as any)?.codCeta || (this.estudiante as any)?.codigo_ceta;
    this.router.navigate(['/registro-tema'], { queryParams: { cod_ceta: cod } }).then(ok => {
      if (!ok) {
        console.error('Navegación a /registro-tema falló');
      }
    });
  }
}