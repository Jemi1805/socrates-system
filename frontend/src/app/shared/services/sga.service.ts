import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// --- INTERFACES (ajusta según tu backend) ---

export interface Rol {
  id: number;
  nombre: string;
}

export interface TutorDesignacionItem {
  tutor_id: number;
  tutor_ci: string | null;
  tutor_nombre: string;
  tutor_celular: string | null;
  tutor_titulo: string | null;
  tutor_titulo_academico?: string | null;
  cod_carrera: string | null;
  carrera_nombre: string | null;
  area?: string | null;
  tipo_tutor_id: number | null;
  tipo_tutor_nombre: string | null;
  convocatoria_id: number | null;
  convocatoria_label: string | null;
  convocatoria_fecha_inicio?: string | null;
  convocatoria_fecha_fin?: string | null;
  cronograma_inicio?: string | null;
  cronograma_fin?: string | null;
  numero_documento?: string | null;
  cite?: string | null;
  total_estudiantes: number;
  estudiantes: Array<{
    cod_ceta: number;
    estudiante_nombre: string | null;
    proyecto_id: number | null;
    proyecto_nombre: string | null;
    fecha_designacion: string | null;
    documento_generado?: boolean;
  }>;
}

export interface Usuario {
  id: number;
  nombre?: string;
  apellido_p?: string;
  apellido_m?: string;
  nombre_usuario: string;
  contrasena?: string;
  rol_id: number;
  rol?: Rol;
  activo: boolean;
}

export interface Postulante {
  cod_ceta: number;
  nombres_est: string;
  apellidos_est: string;
  ci: string;
  expedido: string;
  celular: string;
  reg_ini_c: string;
  gestion_ini: string;
  reg_con_c: string;
  gestion_fin: string;
  incrip_uni: boolean;
}

export interface PostulanteCarrera {
  id: number;
  cod_carrera: number;
  cod_ceta: number;
}

export interface Carrera {
  cod_carrera: string | number;
  nom_carrera: string;
  num_materias: number;
}

export interface Docente {
  id?: number; // id local (si existe en BD)
  nombre: string;
  apellido_p: string;
  apellido_m: string;
  ci: string;
  profesion: string;
  celular: string;
  titulo_academico?: string | null;
  pertinencia?: string;
  pertinencia_acad_id?: number | null;
  pertinencia_ids?: number[];
  pertinencias?: string[];
  tipo_tutor_id?: number | null;
  tipo_tutor?: string;
  activo?: boolean;
  tutor_reg_id?: number;
  tutor_activo?: boolean;
  cod_carrera?: string | null;
  carrera_label?: string | null;
  carreras?: string[];
}

export interface Pertinencia {
  id: number;
  nombre_pert: string;
  cod_carrera?: string;
  activo?: boolean;
}

export interface TutorBulkItem {
  ci: string;
  nombre: string;
  apellido_p?: string;
  apellido_m?: string;
  celular: string;
  profesion?: string;
  titulo_academico?: string | null;
  cod_carrera?: string; // MEA/EEA
  pertinencia_acad_id?: number | null;
  pertinencia_acad_ids?: number[]; // soporte multi-pertinencias
  pertinencia?: string; // nombre de pertinencia si viene del SGA
  activo?: boolean;
}

export interface TutorReg {
  id: number;
  nombre: string;
  apellido_p?: string;
  apellido_m?: string;
  ci: string;
  celular?: string;
  titulo?: string;
  titulo_academico?: string | null;
  cod_carrera?: string;
  carrera?: string;
  pertinencia?: string;
  pertinencia_acad_id?: number | null;
  pertinencia_ids?: number[];
  pertinencias?: string[];
  activo?: boolean;
  es_tribunal?: boolean;
  tipo_tutor_id?: number | null;
  tipo_tutor?: string;
}

export interface TutorTipo {
  id: number;
  nombre: string;
  is_active?: boolean;
}

export interface ArancelEst {
  id: number;
  cod_ceta_est: number;
  concepto: string;
  monto: number;
  pagado: boolean;
  fecha_pago: string;
}

export interface Modalidad {
  id: number;
  nombre: string;
  descripcion: string;
}

export interface Convocatoria {
  id: number;
  anio: number;
  numero_convocatoria: number;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  mes_defensa?: string;
  descripcion?: string;
  numero_tribunales?: number;
  es_activo: boolean;
  creado_por?: number | null;
  created_at?: string;
  updated_at?: string;
  inscripciones_count?: number;
  designaciones_tutor_count?: number;
  convocatoria_nom?: string;
}

export interface Proyecto {
  id: number;
  modalidad_nom: number;
  nombre: string;
  tipo: string;
  objetivo: string;
}

export interface InscripModalidad {
  id: number;
  cod_ceta_est: number;
  modalidad_id: number;
  pract_ind_id: number;
  aranceles_id: number;
  fecha_inscripcion: string;
  estado: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  total?: number;
}

// --- SERVICIO ---

@Injectable({
  providedIn: 'root'
})
export class SgaService {
  private baseUrl = environment.apiUrl + '/sga';

  constructor(private http: HttpClient) {}

  // --- ROLES (Local BD) ---
  getRoles(): Observable<ApiResponse<Rol[]>> {
    return this.http.get<ApiResponse<Rol[]>>(`${environment.apiUrl}/users/roles`)
      .pipe(catchError(this.handleError));
  }

  // --- USUARIOS (Local BD) ---
  getUsuarios(params?: Record<string, any>): Observable<ApiResponse<Usuario[]>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get<ApiResponse<Usuario[]>>(`${environment.apiUrl}/users`, { params: httpParams })
      .pipe(catchError(this.handleError));
  }

  // Permisos directos por usuario
  getUserPermissions(userId: number): Observable<ApiResponse<Array<{ id: number; codigo: string; nombre: string; assigned: boolean }>>> {
    return this.http
      .get<ApiResponse<Array<{ id: number; codigo: string; nombre: string; assigned: boolean }>>>(`${environment.apiUrl}/users/${userId}/permissions`)
      .pipe(catchError(this.handleError));
  }

  setUserPermissions(userId: number, permissionIds: number[]): Observable<ApiResponse<{ assigned_ids: number[] }>> {
    return this.http
      .post<ApiResponse<{ assigned_ids: number[] }>>(`${environment.apiUrl}/users/${userId}/permissions`, { permission_ids: permissionIds })
      .pipe(catchError(this.handleError));
  }

  getUsuarioById(id: number): Observable<ApiResponse<Usuario>> {
    return this.http.get<ApiResponse<Usuario>>(`${environment.apiUrl}/users/${id}`)
      .pipe(catchError(this.handleError));
  }

  createUsuario(data: Partial<Usuario> & { contrasena: string; contrasena_confirmation?: string }): Observable<ApiResponse<Usuario>> {
    return this.http.post<ApiResponse<Usuario>>(`${environment.apiUrl}/users`, data)
      .pipe(catchError(this.handleError));
  }

  updateUsuario(id: number, data: Partial<Usuario>): Observable<ApiResponse<Usuario>> {
    return this.http.put<ApiResponse<Usuario>>(`${environment.apiUrl}/users/${id}`, data)
      .pipe(catchError(this.handleError));
  }

  toggleUsuario(id: number): Observable<ApiResponse<Usuario>> {
    return this.http.patch<ApiResponse<Usuario>>(`${environment.apiUrl}/users/${id}/toggle-status`, {})
      .pipe(catchError(this.handleError));
  }

  deleteUsuario(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${environment.apiUrl}/users/${id}`)
      .pipe(catchError(this.handleError));
  }

  // --- POSTULANTE ---
  getPostulantes(params?: any): Observable<ApiResponse<Postulante[]>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get<ApiResponse<Postulante[]>>(`${this.baseUrl}/estudiantes`, { params: httpParams })
      .pipe(catchError(this.handleError));
  }

  getPostulanteById(cod_ceta: number): Observable<ApiResponse<Postulante>> {
    return this.http.get<ApiResponse<Postulante>>(`${this.baseUrl}/estudiantes/${cod_ceta}`)
      .pipe(catchError(this.handleError));
  }

  getPostulanteByName(nombres: string = '', apPat: string = '', apMat: string = '', limit: number = 100, offset: number = 0, carrera: string): Observable<ApiResponse<Postulante[]>> {
    let params = new HttpParams()
      .set('carrera', carrera)
      .set('limit', limit.toString())
      .set('offset', offset.toString());
      
    // Solo agregar parámetros que no están vacíos
    if (nombres) params = params.set('nombres', nombres);
    if (apPat) params = params.set('ap_pat', apPat);
    if (apMat) params = params.set('ap_mat', apMat);
    
    return this.http.get<ApiResponse<Postulante[]>>(`${this.baseUrl}/estudiantes`, { params })
      .pipe(catchError(this.handleError));
  }

  createPostulante(data: Postulante): Observable<ApiResponse<Postulante>> {
    return this.http.post<ApiResponse<Postulante>>(`${this.baseUrl}/postulantes`, data)
      .pipe(catchError(this.handleError));
  }

  updatePostulante(cod_ceta: number, data: Partial<Postulante>): Observable<ApiResponse<Postulante>> {
    return this.http.put<ApiResponse<Postulante>>(`${this.baseUrl}/postulantes/${cod_ceta}`, data)
      .pipe(catchError(this.handleError));
  }

  deletePostulante(cod_ceta: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.baseUrl}/postulantes/${cod_ceta}`)
      .pipe(catchError(this.handleError));
  }

  // --- POSTULANTE-CARRERA ---
  getCarrerasByPostulante(cod_ceta: number): Observable<ApiResponse<PostulanteCarrera[]>> {
    return this.http.get<ApiResponse<PostulanteCarrera[]>>(`${this.baseUrl}/postulantes/${cod_ceta}/carreras`)
      .pipe(catchError(this.handleError));
  }

  // --- CARRERA ---
  getCarreras(): Observable<ApiResponse<Carrera[]>> {
    return this.http.get<ApiResponse<Carrera[]>>(`${this.baseUrl}/carreras`)
      .pipe(catchError(this.handleError));
  }

  // --- PENSUMS ---
  getPensums(carrera?: string): Observable<ApiResponse<string[]>> {
    let params = new HttpParams();
    if (carrera) {
      params = params.set('carrera', carrera);
    }
    return this.http.get<ApiResponse<string[]>>(`${this.baseUrl}/pensums`, { params })
      .pipe(catchError(this.handleError));
  }

  // --- DOCENTES (SGA legacy) ---
  getDocentes(): Observable<ApiResponse<Docente[]>> {
    return this.http.get<ApiResponse<Docente[]>>(`${this.baseUrl}/docentes`)
      .pipe(catchError(this.handleError));
  }

  // --- DOCENTES (Local BD) ---
  getDocentesLocales(): Observable<ApiResponse<Docente[]>> {
    // Usar tutores locales como fuente y mapear a forma Docente para el flujo de importación
    return this.http.get<ApiResponse<TutorReg[]>>(`${environment.apiUrl}/tutores`).pipe(
      map((resp) => {
        const list = (resp?.data || []).map(t => ({
          nombre: t.nombre,
          apellido_p: t.apellido_p || '',
          apellido_m: t.apellido_m || '',
          ci: t.ci,
          profesion: t.titulo || '',
          titulo_academico: t.titulo_academico ?? null,
          celular: t.celular || '',
          pertinencia: t.pertinencia || '',
          pertinencia_acad_id: t.pertinencia_acad_id ?? null,
          pertinencia_ids: t.pertinencia_ids,
          pertinencias: t.pertinencias,
          tipo_tutor_id: t.tipo_tutor_id ?? null,
          tipo_tutor: t.tipo_tutor,
          activo: t.activo ?? false,
          cod_carrera: (t as any).cod_carrera ?? null,
          carrera_label: (t as any).cod_carrera ?? null,
          carreras: ((t as any).cod_carrera ? [(t as any).cod_carrera] : []),
        }) as Docente);
        return { success: true, data: list } as ApiResponse<Docente[]>;
      }),
      catchError(this.handleError)
    );
  }

  // Guardar/actualizar Docente por CI (fuera de /sga)
  // Acepta opcionalmente ci_original para permitir cambio de CI
  saveDocenteByCi(data: Partial<Docente> & { ci: string; cod_carrera?: string | null; ci_original?: string | null }): Observable<ApiResponse<Docente>> {
    const url = `${environment.apiUrl}/docentes/upsert_by_ci`;
    return this.http.post<ApiResponse<Docente>>(url, data)
      .pipe(catchError(this.handleError));
  }

  // --- TUTORES: registro masivo ---
  // options.updateOnly => si true, el backend no crea nuevos, solo actualiza existentes
  registerTutoresBulk(items: TutorBulkItem[], options?: { updateOnly?: boolean }): Observable<ApiResponse<any>> {
    const url = `${environment.apiUrl}/tutores/register_bulk`;
    const body: any = { items };
    if (options?.updateOnly) body.update_only = true;
    return this.http.post<ApiResponse<any>>(url, body)
      .pipe(catchError(this.handleError));
  }

  // --- TUTORES: listado ---
  getTutores(params?: { carrera?: string; gestion?: string }): Observable<ApiResponse<TutorReg[]>> {
    let httpParams = new HttpParams();
    if (params?.carrera) httpParams = httpParams.set('carrera', params.carrera);
    if (params?.gestion) httpParams = httpParams.set('gestion', params.gestion);
    return this.http.get<ApiResponse<TutorReg[]>>(`${environment.apiUrl}/tutores`, { params: httpParams })
      .pipe(
        map(resp => {
          const data = Array.isArray(resp?.data) ? resp.data.map(item => ({
            ...item,
            activo: !!(item as any).activo,
          })) : [];
          return { ...(resp || {}), data } as ApiResponse<TutorReg[]>;
        }),
        catchError(this.handleError)
      );
  }

  // --- TUTORES: tipos ---
  getTutorTipos(): Observable<ApiResponse<TutorTipo[]>> {
    return this.http.get<ApiResponse<TutorTipo[]>>(`${environment.apiUrl}/tutores/tipos`)
      .pipe(catchError(this.handleError));
  }

  // --- TUTORES: actualizar ---
  updateTutor(id: number, data: Partial<TutorReg>): Observable<ApiResponse<TutorReg>> {
    return this.http.put<ApiResponse<TutorReg>>(`${environment.apiUrl}/tutores/${id}`, data)
      .pipe(catchError(this.handleError));
  }

  // --- TUTORES: toggle activo ---
  toggleTutor(id: number, activo: boolean): Observable<ApiResponse<{ id: number; activo: boolean }>> {
    return this.http.patch<ApiResponse<{ id: number; activo: boolean }>>(`${environment.apiUrl}/tutores/${id}/toggle`, { activo })
      .pipe(catchError(this.handleError));
  }

  // --- TUTORES: designación ---
  designarTutor(data: { tutor_id: number; cod_ceta: number; proyecto_id?: number; convocatoria_id?: number; convocatoria_nom?: string }): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${environment.apiUrl}/tutores/designar`, data)
      .pipe(catchError(this.handleError));
  }

  designarTutorNueva(data: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${environment.apiUrl}/tutores/designaciones`, data)
      .pipe(catchError(this.handleError));
  }

  getTutoresDesignados(params?: Record<string, any>): Observable<ApiResponse<TutorDesignacionItem[]>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach((key) => {
        const val = params[key];
        if (val !== undefined && val !== null && val !== '') {
          httpParams = httpParams.set(key, val);
        }
      });
    }
    return this.http
      .get<ApiResponse<TutorDesignacionItem[]>>(`${environment.apiUrl}/tutores/designaciones`, { params: httpParams })
      .pipe(catchError(this.handleError));
  }

  getDocDesignacionesByCorrelativo(correlativo: string | number): Observable<ApiResponse<any>> {
    const value = correlativo != null ? String(correlativo) : '';
    const cleaned = value.trim();
    return this.http
      .get<ApiResponse<any>>(`${environment.apiUrl}/tutores/doc-designaciones/${encodeURIComponent(cleaned)}`)
      .pipe(catchError(this.handleError));
  }

  // --- TUTORES: generar documento de designación on-demand ---
  generateDocDesignacion(payload: { tutor_id: number; cod_ceta: number; seleccionados_cod_ceta?: number[] }): Observable<ApiResponse<{ designacion_id: number; numero_documento?: string; cite?: string }>> {
    return this.http
      .post<ApiResponse<{ designacion_id: number; numero_documento?: string; cite?: string }>>(`${environment.apiUrl}/tutores/generar-doc-designacion`, payload)
      .pipe(catchError(this.handleError));
  }

  // Alias para compatibilidad con componentes antiguos (uso de nombre en español)
  generarDocDesignacion(payload: { tutor_id: number; cod_ceta: number; seleccionados_cod_ceta?: number[] }) {
    return this.generateDocDesignacion(payload);
  }

  // --- DEFENSAS: designación de tribunal ---
  setDefensaTribunal(defensaId: number, miembros: Array<{ tipo: 'interno' | 'externo'; miembro_id: number; rol: string }>): Observable<ApiResponse<any>> {
    const url = `${environment.apiUrl}/defensas/${defensaId}/tribunal`;
    return this.http
      .post<ApiResponse<any>>(url, { miembros })
      .pipe(catchError(this.handleError));
  }

  getDefensaTribunal(defensaId: number): Observable<ApiResponse<Array<{ rol: string; tipo: 'interno' | 'externo'; miembro_id: number; nombre: string }>>> {
    const url = `${environment.apiUrl}/defensas/${defensaId}/tribunal`;
    return this.http
      .get<ApiResponse<Array<{ rol: string; tipo: 'interno' | 'externo'; miembro_id: number; nombre: string }>>>(url)
      .pipe(catchError(this.handleError));
  }

  getTribunalesDesignadosPorPostulante(codCeta: number | string): Observable<ApiResponse<any[]>> {
    const cod = encodeURIComponent(String(codCeta));
    const url = `${environment.apiUrl}/defensas/por-postulante/${cod}`;
    return this.http
      .get<ApiResponse<any[]>>(url)
      .pipe(catchError(this.handleError));
  }

  getTribunalesDesignados(params?: { convocatoria_id?: number | null; search?: string | null }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams();
    if (params?.convocatoria_id != null) {
      httpParams = httpParams.set('convocatoria_id', String(params.convocatoria_id));
    }
    if (params?.search && params.search.toString().trim()) {
      httpParams = httpParams.set('search', params.search.toString().trim());
    }
    const url = `${environment.apiUrl}/defensas/tribunales-designados`;
    return this.http
      .get<ApiResponse<any[]>>(url, { params: httpParams })
      .pipe(catchError(this.handleError));
  }

  // --- ROLES DE TRIBUNAL ---
  getRolesTribunal(): Observable<ApiResponse<Array<{ id: number; codigo: string; nombre: string }>>> {
    return this.http
      .get<ApiResponse<Array<{ id: number; codigo: string; nombre: string }>>>(`${environment.apiUrl}/roles_tribunal`)
      .pipe(catchError(this.handleError));
  }

  // --- TRIBUNALES EXTERNOS ---
  createTribunalExterno(data: {
    nombre: string;
    apellido_p: string;
    apellido_m?: string;
    ci: string;
    celular: string;
    profesion: string;
    institucion?: string;
    titulo_academico: string;
    tipo?: 'interno' | 'externo';
  }): Observable<ApiResponse<any>> {
    return this.http
      .post<ApiResponse<any>>(`${environment.apiUrl}/tribunales`, data)
      .pipe(catchError(this.handleError));
  }

  updateTribunal(id: number, data: {
    nombre?: string;
    apellido_p?: string;
    apellido_m?: string;
    ci?: string;
    celular?: string;
    profesion?: string;
    institucion?: string;
    titulo_academico?: string;
    tipo?: 'interno' | 'externo';
  }): Observable<ApiResponse<any>> {
    return this.http
      .put<ApiResponse<any>>(`${environment.apiUrl}/tribunales/${id}`, data)
      .pipe(catchError(this.handleError));
  }

  getTribunalesExternos(): Observable<ApiResponse<any[]>> {
    return this.http
      .get<ApiResponse<any[]>>(`${environment.apiUrl}/tribunales`)
      .pipe(catchError(this.handleError));
  }

  toggleTribunal(id: number, activo: boolean): Observable<ApiResponse<{ id: number; activo: boolean }>> {
    return this.http
      .patch<ApiResponse<{ id: number; activo: boolean }>>(`${environment.apiUrl}/tribunales/${id}/toggle`, { activo })
      .pipe(catchError(this.handleError));
  }

  toggleTutorEsTribunal(id: number, es_tribunal: boolean): Observable<ApiResponse<{ id: number; es_tribunal: boolean }>> {
    return this.http
      .patch<ApiResponse<{ id: number; es_tribunal: boolean }>>(`${environment.apiUrl}/tutores/${id}/es-tribunal`, { es_tribunal })
      .pipe(catchError(this.handleError));
  }

  // --- TUTORES: Planilla de Seguimiento DOCX ---
  downloadPlanillaSeguimiento(codCeta: number | string) {
    const cod = encodeURIComponent(String(codCeta));
    return this.http.get(`${environment.apiUrl}/tutores/planilla-seguimiento/${cod}`,
      { observe: 'response', responseType: 'blob' as 'json' }
    );
  }

  getPlanillaSeguimientoUrl(codCeta: number | string): string {
    const cod = encodeURIComponent(String(codCeta));
    return `${environment.apiUrl}/tutores/planilla-seguimiento/${cod}`;
  }

  // --- PERTINENCIAS ACADÉMICAS ---
  getPertinencias(carrera?: string): Observable<ApiResponse<Pertinencia[]>> {
    let params = new HttpParams();
    if (carrera) {
      params = params.set('carrera', carrera);
    }
    return this.http.get<ApiResponse<Pertinencia[]>>(`${this.baseUrl}/pertinencias`, { params })
      .pipe(catchError(this.handleError));
  }

  createPertinencia(data: Partial<Pertinencia>): Observable<ApiResponse<Pertinencia>> {
    return this.http.post<ApiResponse<Pertinencia>>(`${environment.apiUrl}/pertinencias`, data)
      .pipe(catchError(this.handleError));
  }

  updatePertinencia(id: number, data: Partial<Pertinencia>): Observable<ApiResponse<Pertinencia>> {
    return this.http.put<ApiResponse<Pertinencia>>(`${environment.apiUrl}/pertinencias/${id}`, data)
      .pipe(catchError(this.handleError));
  }

  // --- ARANCELES ESTUDIANTE ---
  getArancelesEst(cod_ceta_est: number): Observable<ApiResponse<ArancelEst[]>> {
    return this.http.get<ApiResponse<ArancelEst[]>>(`${this.baseUrl}/estudiantes/${cod_ceta_est}/pagos/material-extra`)
      .pipe(catchError(this.handleError));
  }

  getInscripModalidadByPostulante(cod_ceta_est: number): Observable<ApiResponse<InscripModalidad[]>> {
    return this.http.get<ApiResponse<InscripModalidad[]>>(`${this.baseUrl}/inscripciones/${cod_ceta_est}`)
      .pipe(catchError(this.handleError));
  }

  // --- MODALIDAD ---
  getModalidades(): Observable<ApiResponse<Modalidad[]>> {
    return this.http.get<ApiResponse<Modalidad[]>>(`${this.baseUrl}/modalidades`)
      .pipe(catchError(this.handleError));
  }

  // --- PROYECTO ---
  getProyectos(): Observable<ApiResponse<Proyecto[]>> {
    return this.http.get<ApiResponse<Proyecto[]>>(`${this.baseUrl}/proyectos`)
      .pipe(catchError(this.handleError));
  }

  getProyectoById(id: number): Observable<ApiResponse<Proyecto>> {
    return this.http.get<ApiResponse<Proyecto>>(`${this.baseUrl}/proyectos/${id}`)
      .pipe(catchError(this.handleError));
  }

  createProyecto(data: Proyecto): Observable<ApiResponse<Proyecto>> {
    return this.http.post<ApiResponse<Proyecto>>(`${this.baseUrl}/proyectos`, data)
      .pipe(catchError(this.handleError));
  }

  updateProyecto(id: number, data: Partial<Proyecto>): Observable<ApiResponse<Proyecto>> {
    return this.http.put<ApiResponse<Proyecto>>(`${this.baseUrl}/proyectos/${id}`, data)
      .pipe(catchError(this.handleError));
  }

  deleteProyecto(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.baseUrl}/proyectos/${id}`)
      .pipe(catchError(this.handleError));
  }

  // --- CONVOCATORIAS ---
  getConvocatorias(params?: Record<string, any>): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach((key) => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http
      .get<any>(`${environment.apiUrl}/convocatorias`, { params: httpParams })
      .pipe(catchError(this.handleError));
  }

  getConvocatoriaById(id: number, params?: Record<string, any>): Observable<Convocatoria> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach((key) => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http
      .get<Convocatoria>(`${environment.apiUrl}/convocatorias/${id}`, { params: httpParams })
      .pipe(catchError(this.handleError));
  }

  createConvocatoria(data: Partial<Convocatoria>): Observable<Convocatoria> {
    return this.http
      .post<Convocatoria>(`${environment.apiUrl}/convocatorias`, data)
      .pipe(catchError(this.handleError));
  }

  updateConvocatoria(id: number, data: Partial<Convocatoria>): Observable<Convocatoria> {
    return this.http
      .put<Convocatoria>(`${environment.apiUrl}/convocatorias/${id}`, data)
      .pipe(catchError(this.handleError));
  }

  deleteConvocatoria(id: number): Observable<any> {
    return this.http
      .delete<any>(`${environment.apiUrl}/convocatorias/${id}`)
      .pipe(catchError(this.handleError));
  }

  toggleConvocatoria(id: number): Observable<{ message: string; es_activo: boolean }> {
    return this.http
      .patch<{ message: string; es_activo: boolean }>(`${environment.apiUrl}/convocatorias/${id}/toggle`, {})
      .pipe(catchError(this.handleError));
  }

  getConvocatoriasActivas(params?: Record<string, any>): Observable<Convocatoria[]> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach((key) => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http
      .get<Convocatoria[]>(`${environment.apiUrl}/convocatorias/activas`, { params: httpParams })
      .pipe(catchError(this.handleError));
  }

  // --- AUTENTICACIÓN Y CONEXIÓN ---
  checkConnection(): Observable<ApiResponse<boolean>> {
    return this.http.get<ApiResponse<boolean>>(`${this.baseUrl}/check-connection`)
      .pipe(catchError(this.handleError));
  }

  authenticate(username: string, password: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/authenticate`, { username, password })
      .pipe(catchError(this.handleError));
  }

  // --- MANEJO DE ERRORES ---
  private handleError(error: any): Observable<never> {
    console.error('Error en SGA Service:', error);
    let errorMessage = 'Error desconocido';
    if (error?.error?.message) {
      errorMessage = error.error.message;
    } else if (error?.message) {
      errorMessage = error.message;
    } else if (error?.status) {
      switch (error.status) {
        case 401:
          errorMessage = 'No autorizado';
          break;
        case 404:
          errorMessage = 'Recurso no encontrado';
          break;
        case 500:
          errorMessage = 'Error interno del servidor';
          break;
        default:
          errorMessage = `Error ${error.status}: ${error.statusText}`;
      }
    }
    return throwError(() => new Error(errorMessage));
  }
}