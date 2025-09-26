import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ProyectoPayload {
  modalidad_id?: number;
  nombre?: string; // Nombre/Tema
  tipo?: string;
  objetivo?: string; // Objetivos
  estado?: string;
  porcentaje_avance?: number;
}

@Injectable({ providedIn: 'root' })
export class ProyectoService {
  private apiUrl = '/api/proyecto';

  constructor(private http: HttpClient) {}

  createProyecto(payload: ProyectoPayload): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}`, payload);
  }
}
