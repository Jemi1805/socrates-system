import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../app/environments/environment';

export interface Estudiante {
  cod_ceta: string;
  ap_pat: string;
  ap_mat: string;
  nombres: string;
  ci: string;
  procedencia: string;
  carrera: string;
}

export interface EstudianteResponse {
  success: boolean;
  message?: string;
  data?: Estudiante | Estudiante[] | null;
  carrera?: string;
  total?: number;
}

@Injectable({
  providedIn: 'root'
})
export class EstudianteService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  buscarPorCeta(codCeta: string, carrera: string = 'mecanica'): Observable<EstudianteResponse> {
    return this.http.get<EstudianteResponse>(`${this.apiUrl}/sga/estudiantes?carrera=${carrera}&cod_ceta=${codCeta}`);
  }

  buscarPorNombre(nombres: string = '', ap_pat: string = '', ap_mat: string = '', carrera: string = 'mecanica', limit: number = 100, offset: number = 0): Observable<EstudianteResponse> {
    // Validar que la carrera sea obligatoria
    if (!carrera || carrera.trim() === '') {
      console.error('Error: El parámetro carrera es obligatorio');
      throw new Error('El parámetro carrera es obligatorio');
    }

    // Validar que al menos un parámetro de búsqueda esté presente
    if ((!nombres || nombres.trim() === '') && 
        (!ap_pat || ap_pat.trim() === '') && 
        (!ap_mat || ap_mat.trim() === '')) {
      console.error('Error: Se requiere al menos un parámetro de búsqueda (nombres, ap_pat o ap_mat)');
      throw new Error('Se requiere al menos un parámetro de búsqueda (nombres, ap_pat o ap_mat)');
    }
    
    // Inicializar parámetros con carrera (obligatorio)
    let params = new HttpParams().set('carrera', carrera.trim());
    
    // Añadir parámetros de búsqueda si tienen valor
    if (nombres && nombres.trim() !== '') {
      params = params.set('nombres', nombres.trim());
    }
    
    if (ap_pat && ap_pat.trim() !== '') {
      params = params.set('ap_pat', ap_pat.trim());
    }
    
    if (ap_mat && ap_mat.trim() !== '') {
      params = params.set('ap_mat', ap_mat.trim());
    }
    
    // Añadir paginación
    params = params.set('limit', limit.toString())
                   .set('offset', offset.toString());
                   
    console.log('Parámetros enviados para búsqueda por nombre:', params.toString());
    
    // Convertir parámetros HTTP a objeto para enviar como body en POST
    const body: Record<string, any> = {
      carrera: carrera.trim(),
      limit: limit,
      offset: offset
    };
    
    // Añadir parámetros de búsqueda si tienen valor
    if (nombres && nombres.trim() !== '') {
      body['nombres'] = nombres.trim();
    }
    
    if (ap_pat && ap_pat.trim() !== '') {
      body['ap_pat'] = ap_pat.trim();
    }
    
    if (ap_mat && ap_mat.trim() !== '') {
      body['ap_mat'] = ap_mat.trim();
    }
    
    console.log('Body enviado para búsqueda por nombre:', body);
    // Cambiado a POST como requiere el backend
    return this.http.post<EstudianteResponse>(`${this.apiUrl}/sga/buscar-estudiantes`, body);
  }

  listarEstudiantes(): Observable<EstudianteResponse> {
    return this.http.get<EstudianteResponse>(`${this.apiUrl}/sga/estudiantes`);
  }
}