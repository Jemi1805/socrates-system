import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Postulante } from './postulante.model';

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
  private apiUrl = 'http://192.168.0.78:8080/api/postulantes'; // Ajusta la URL según tu backend
  private apiUrlDocumentos = 'http://192.168.0.78:8080/api/documentos-postulantes'; // Ajusta la URL según tu backend
  private apiUrlModalidades = 'http://192.168.0.78:8080/api/modalidades-postulantes'; // Ajusta la URL según tu backend

  constructor(private http: HttpClient) {}

  getAll(): Observable<Postulante[]> {
    return this.http.get<Postulante[]>(this.apiUrl);
  }

  getById(id: number): Observable<Postulante> {
    return this.http.get<Postulante>(`${this.apiUrl}/${id}`);
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

  updateDocumentoRequerido(postulanteId: number, tipoDocumento: string, requerido: boolean): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${postulanteId}/documentos/requerido`, {
      tipo_documento: tipoDocumento,
      requerido: requerido
    });
  }
}