import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Estudiante {
  cod_ceta: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  ci: string;
  carrera: string;
}

export interface EstudianteResponse {
  success: boolean;
  message?: string;
  data?: Estudiante | null;
  carrera?: string;
}

@Injectable({
  providedIn: 'root'
})
export class EstudianteService {
  private apiUrl = 'http://localhost:8080/api';

  constructor(private http: HttpClient) {}

  buscarPorCeta(codCeta: string, carrera: string = 'mecanica'): Observable<EstudianteResponse> {
    return this.http.get<EstudianteResponse>(`${this.apiUrl}/sga/estudiantes?carrera=${carrera}&cod_ceta=${codCeta}`);
  }

  buscarPorCI(ci: string, carrera: string = 'mecanica'): Observable<EstudianteResponse> {
    return this.http.get<EstudianteResponse>(`${this.apiUrl}/sga/estudiantes/ci?carrera=${carrera}&ci=${ci}`);
  }

  listarEstudiantes(): Observable<EstudianteResponse> {
    return this.http.get<EstudianteResponse>(`${this.apiUrl}/sga/estudiantes`);
  }
}