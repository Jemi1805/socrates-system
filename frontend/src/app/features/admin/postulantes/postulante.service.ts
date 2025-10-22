import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpEvent, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Postulante } from './postulante.model';
import { environment } from '../../../environments/environment';

export interface DocumentoPostulante {
  id?: number;
  postulante_id: number;
  tipo_documento: string;
  nombre_archivo: string;
  ruta_archivo: string;
  estado: string;
  creado_at?: string;
  actualizado_at?: string;
}

export interface ModalidadPostulante {
  id?: number;
  postulante_id: number;
  modalidad_id: number;
  estado: string;
  creado_at?: string;
  actualizado_at?: string;
}

@Injectable({ providedIn: 'root' })
export class PostulanteService {
  private baseUrl = environment.apiUrl;
  private apiUrl = `${this.baseUrl}/postulantes`;
  private sgaUrl = `${this.baseUrl}/sga`; // Base para endpoints SGA
  private modalidadUrl = `${this.baseUrl}/modalidades`;
  private inscripcionesUrl = `${this.baseUrl}/inscripciones`;
  private datosCarreraUrl = `${this.baseUrl}/datos_carrera`;
  private transitabilidadEduRegUrl = `${this.baseUrl}/transitabilidad_edu_reg`;
  private transitabilidadInstTecUrl = `${this.baseUrl}/transitabilidad_inst_tec`;
  private diplomaBachillerUrl = `${this.baseUrl}/diploma_bachiller`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Postulante[]> {
    return this.http.get<Postulante[]>(this.apiUrl);
  }

  // --- Inscripciones ---
  registrarInscripcion(payload: any): Observable<any> {
    return this.http.post<any>(this.inscripcionesUrl, payload);
  }

  getById(id: number): Observable<Postulante> {
    return this.http.get<Postulante>(`${this.apiUrl}/${id}`);
  }

  // Endpoint composite para traer toda la inscripción en una sola llamada
  getInscripcionByCodCeta(codCeta: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${codCeta}/inscripcion`);
  }

  // --- Datos de Carrera (inicio/conclusión) ---
  upsertDatosCarrera(payload: {
    cod_ceta_est: number;
    regimen_ini?: string | null;
    regimen_fin?: string | null;
    gestion_ini?: string | null;
    gestion_fin?: string | null;
    is_active?: boolean;
  }): Observable<any> {
    return this.http.post<any>(`${this.datosCarreraUrl}/upsert`, payload);
  }

  // --- Transitabilidad Educación Regular ---
  saveTransitabilidadEduReg(payload: {
    cod_ceta_est: number;
    serie_titulo_tm?: string | null;
    numero_titulo_tm?: string | null;
    fecha_emision?: string | null;
    observacion?: string | null;
  }): Observable<any> {
    // apiResource disponible en backend, usar POST para crear/actualizar según lógica del servidor
    return this.http.post<any>(`${this.transitabilidadEduRegUrl}`, payload);
  }

  deleteTransitabilidadEduRegByCod(cod_ceta_est: number | string): Observable<any> {
    return this.http.post<any>(`${this.transitabilidadEduRegUrl}/delete_by_cod`, { cod_ceta_est });
  }

  // --- Transitabilidad Instituto Técnico (opcional) ---
  saveTransitabilidadInstTec(payload: {
    cod_ceta_est: number;
    serie_titulo_tm?: string | null;
    numero_titulo_tm?: string | null;
    fecha_emision?: string | null;
    observacion?: string | null;
  }): Observable<any> {
    return this.http.post<any>(`${this.transitabilidadInstTecUrl}`, payload);
  }

  deleteTransitabilidadInstTecByCod(cod_ceta_est: number | string): Observable<any> {
    return this.http.post<any>(`${this.transitabilidadInstTecUrl}/delete_by_cod`, { cod_ceta_est });
  }

  // --- Diploma de Bachiller ---
  saveDiplomaBachiller(payload: {
    cod_ceta_est: number;
    tipo_bachiller: 'nacional' | 'extranjero';
    nro_serie_titulo?: string | null;
    emision?: string | null;
    fecha_emision?: string | null;
    observacion?: string | null;
    gestion_bachillerato?: string | number | null;
    nro_resolucion?: string | null;
    fecha_resolucion?: string | null;
    is_active?: boolean;
  }): Observable<any> {
    return this.http.post<any>(`${this.diplomaBachillerUrl}/upsert`, payload);
  }

  // --- Traspasos e Homologación Cambio de Plan: delete-by-cod auxiliares ---
  deleteTraspasosByCod(cod_ceta_est: number | string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/traspasos_instituto/delete_by_cod`, { cod_ceta_est });
  }

  deleteHomolCambioPlanByCod(cod_ceta_est: number | string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/res_homol_cp/delete_by_cod`, { cod_ceta_est });
  }

  upsertTraspasoByCod(payload: {
    cod_ceta_est: number | string;
    instituto_origen?: string | null;
    grados_cursados?: string | null;
    gestiones_cursadas?: string | null;
    observacion?: string | null;
    grados_gestiones?: Array<{ grado?: string | null; gestion?: string | null; }>;
  }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/traspasos_instituto/upsert_by_cod`, payload);
  }

  upsertHomolCpByCod(payload: {
    cod_ceta_est: number | string;
    nro_resolucion?: string | null;
    fecha_emision?: string | null;
    grados_cursados?: string | null;
    gestiones_cursadas?: string | null;
    observacion?: string | null;
  }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/res_homol_cp/upsert_by_cod`, payload);
  }

  // --- Fetch por cod_ceta_est (fallback para visualización) ---
  getTraspasoByCod(cod_ceta_est: number | string): Observable<any> {
    const params = new HttpParams().set('cod_ceta_est', String(cod_ceta_est));
    return this.http.get<any>(`${this.baseUrl}/public/traspasos_instituto/get_by_cod`, { params });
  }

  getHomolCpByCod(cod_ceta_est: number | string): Observable<any> {
    const params = new HttpParams().set('cod_ceta_est', String(cod_ceta_est));
    return this.http.get<any>(`${this.baseUrl}/public/res_homol_cp/get_by_cod`, { params });
  }

  create(postulante: Postulante): Observable<Postulante> {
    return this.http.post<Postulante>(this.apiUrl, postulante);
  }

  update(id: number, postulante: Postulante): Observable<Postulante> {
    return this.http.put<Postulante>(`${this.apiUrl}/${id}`, postulante);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // Métodos para Documentos
  getDocumentosByPostulante(postulanteId: number): Observable<DocumentoPostulante[]> {
    return this.http.get<DocumentoPostulante[]>(`${this.apiUrl}/${postulanteId}/documentos`);
  }

  uploadDocumento(postulanteId: number, tipoDocumento: string, file: File): Observable<HttpEvent<any>> {
    const formData: FormData = new FormData();
    formData.append('file', file);
    formData.append('tipo_documento', tipoDocumento);

    const req = new HttpRequest('POST', `${this.apiUrl}/${postulanteId}/documentos`, formData, {
      reportProgress: true,
      responseType: 'json'
    });

    return this.http.request(req);
  }

  deleteDocumento(postulanteId: number, tipoDocumento: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${postulanteId}/documentos/${tipoDocumento}`);
  }

  // Métodos para Modalidades
  asignarModalidad(postulanteId: number, modalidadId: number): Observable<ModalidadPostulante> {
    return this.http.post<ModalidadPostulante>(`${this.apiUrl}/${postulanteId}/modalidad`, { modalidad_id: modalidadId });
  }

  getModalidadPostulante(postulanteId: number): Observable<ModalidadPostulante> {
    return this.http.get<ModalidadPostulante>(`${this.apiUrl}/${postulanteId}/modalidad`);
  }

  // Listado de modalidades desde backend (ruta pública /api/modalidades)
  getModalidades(): Observable<any[]> {
    return this.http.get<any[]>(this.modalidadUrl);
  }

  updateDocumentoRequerido(postulanteId: number, tipoDocumento: string, requerido: boolean): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${postulanteId}/documentos/requerido`, {
      tipo_documento: tipoDocumento,
      requerido: requerido
    });
  }

  // --- SGA: Pagos de Material Extra (Aranceles) ---
  getArancelesMaterialExtra(codCeta: number | string, carrera?: string): Observable<{ success: boolean; data: any[]; total: number; carrera?: string; }> {
    const params: any = {};
    if (carrera) params.carrera = carrera;
    return this.http.get<{ success: boolean; data: any[]; total: number; carrera?: string; }>(
      `${this.sgaUrl}/estudiantes/${codCeta}/pagos/material-extra`,
      { params }
    );
  }

  // --- Aranceles guardados en Laravel (tabla aranceles_est) ---
  getArancelesEstByCodCeta(codCeta: number | string, soloSeleccionados: boolean = true): Observable<any> {
    const params: any = { cod_ceta_est: codCeta, cod_ceta: codCeta };
    if (soloSeleccionados) params.seleccionado = 1;
    return this.http.get<any>(`${this.baseUrl}/aranceles_est/list`, { params });
  }

  upsertArancelEst(payload: {
    cod_ceta_est: number | string;
    gestion?: string | null;
    fecha?: string | null;
    concepto?: string | null;
    monto?: number | null;
    num_factura?: string | null;
    num_comprobante?: string | null;
    razon?: string | null;
    nit?: string | null;
    seleccionado?: boolean | number;
    origen?: string | null;
  }): Observable<any> {
    // Upsert robusto en backend: actualiza si existe, crea si no
    return this.http.post<any>(`${this.baseUrl}/aranceles_est/upsert_by_cod`, payload);
  }

  updateArancelEst(id: number | string, payload: {
    cod_ceta_est?: number | string;
    gestion?: string | null;
    fecha?: string | null;
    concepto?: string | null;
    monto?: number | null;
    num_factura?: string | null;
    num_comprobante?: string | null;
    razon?: string | null;
    nit?: string | null;
    seleccionado?: boolean | number;
    origen?: string | null;
    pagado?: boolean | number | null;
    fecha_pago?: string | null;
  }): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/aranceles_est/${id}`, payload);
  }

  deleteArancelEst(id: number | string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/aranceles_est/${id}`);
  }

  // --- Fallback simple: obtener inscrip_modalidad por cod_ceta_est (para aranceles_completos) ---
  getInscripModalidadByCodCeta(codCeta: number | string): Observable<any> {
    const params: any = { cod_ceta_est: codCeta };
    return this.http.get<any>(`${this.baseUrl}/inscrip_modalidad`, { params });
  }

  // Actualiza la fila de inscrip_modalidad por ID (por ejemplo, para sincronizar modalidad_nom)
  updateInscripModalidad(id: number | string, payload: { modalidad_nom?: string; modalidad_id?: number | string; estado?: string | null; convocatoria_id?: number | string | null; nom_convocatoria?: string | null }): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}/inscrip_modalidad/${id}`, payload);
  }

  // Fallback robusto: upsert por código CETA (si el backend no soporta PATCH por ID)
  updateInscripModalidadByCod(codCeta: number | string, payload: { modalidad_nom?: string; modalidad_id?: number | string; estado?: string | null; convocatoria_id?: number | string | null; nom_convocatoria?: string | null }): Observable<any> {
    const body = { cod_ceta_est: codCeta, ...payload } as any;
    return this.http.post<any>(`${this.baseUrl}/inscrip_modalidad/upsert_by_cod`, body);
  }
}