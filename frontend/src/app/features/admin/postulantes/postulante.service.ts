import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpRequest } from '@angular/common/http';
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

  // --- Fallback simple: obtener inscrip_modalidad por cod_ceta_est (para aranceles_completos) ---
  getInscripModalidadByCodCeta(codCeta: number | string): Observable<any> {
    const params: any = { cod_ceta_est: codCeta };
    return this.http.get<any>(`${this.baseUrl}/inscrip_modalidad`, { params });
  }
}