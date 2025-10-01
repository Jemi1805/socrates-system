import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ProyectoPayload {
  cod_ceta?: string;
  nombres?: string;
  apellidos?: string;
  ci?: string;
  expedicion?: string;
  celular?: string;
  instituto?: string;
  carrera?: string;
  nombre?: string; // Nombre/Tema
  tipo?: string;
  objetivo?: string; // Objetivos
  estado?: string;
  porcentaje_avance?: number;
}

@Injectable({ providedIn: 'root' })
export class ProyectoService {
  private baseUrl = environment.apiUrl;
  private apiUrl = `${this.baseUrl}/proyecto`;

  constructor(private http: HttpClient) {}

  createProyecto(payload: ProyectoPayload): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}`, payload);
  }

  getByCod(cod_ceta: string | number): Observable<any> {
    const params = { cod_ceta: String(cod_ceta) };
    return this.http.get<any>(`${this.apiUrl}/by_cod`, { params });
  }

  updateProyecto(id: number | string, payload: Partial<ProyectoPayload>): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, payload);
  }
}
