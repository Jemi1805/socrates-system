import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// --- INTERFACES (ajusta según tu backend) ---

export interface Rol {
  id: number;
  nombre: string;
}

export interface Usuario {
  id: number;
  nombre_usuario: string;
  contrasena: string;
  email: string;
  rol_id: number;
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
  cod_carrera: number;
  nom_carrera: string;
  num_materias: number;
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
  private baseUrl = environment.apiUrl + '/api/sga';

  constructor(private http: HttpClient) {}

  // --- ROL ---
  getRoles(): Observable<ApiResponse<Rol[]>> {
    return this.http.get<ApiResponse<Rol[]>>(`${this.baseUrl}/roles`)
      .pipe(catchError(this.handleError));
  }

  // --- USUARIO ---
  getUsuarios(): Observable<ApiResponse<Usuario[]>> {
    return this.http.get<ApiResponse<Usuario[]>>(`${this.baseUrl}/usuarios`)
      .pipe(catchError(this.handleError));
  }

  getUsuarioById(id: number): Observable<ApiResponse<Usuario>> {
    return this.http.get<ApiResponse<Usuario>>(`${this.baseUrl}/usuarios/${id}`)
      .pipe(catchError(this.handleError));
  }

  createUsuario(data: Usuario): Observable<ApiResponse<Usuario>> {
    return this.http.post<ApiResponse<Usuario>>(`${this.baseUrl}/usuarios`, data)
      .pipe(catchError(this.handleError));
  }

  updateUsuario(id: number, data: Partial<Usuario>): Observable<ApiResponse<Usuario>> {
    return this.http.put<ApiResponse<Usuario>>(`${this.baseUrl}/usuarios/${id}`, data)
      .pipe(catchError(this.handleError));
  }

  deleteUsuario(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.baseUrl}/usuarios/${id}`)
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
    return this.http.get<ApiResponse<Postulante[]>>(`${this.baseUrl}/postulantes`, { params: httpParams })
      .pipe(catchError(this.handleError));
  }

  getPostulanteById(cod_ceta: number): Observable<ApiResponse<Postulante>> {
    return this.http.get<ApiResponse<Postulante>>(`${this.baseUrl}/postulantes/${cod_ceta}`)
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

  // --- ARANCELES ESTUDIANTE ---
  getArancelesEst(cod_ceta_est: number): Observable<ApiResponse<ArancelEst[]>> {
    return this.http.get<ApiResponse<ArancelEst[]>>(`${this.baseUrl}/postulantes/${cod_ceta_est}/aranceles`)
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

  // --- INSCRIPCIÓN MODALIDAD ---
  getInscripModalidadByPostulante(cod_ceta_est: number): Observable<ApiResponse<InscripModalidad[]>> {
    return this.http.get<ApiResponse<InscripModalidad[]>>(`${this.baseUrl}/postulantes/${cod_ceta_est}/inscripciones`)
      .pipe(catchError(this.handleError));
  }

  // --- AUTENTICACIÓN Y CONEXIÓN ---
  checkConnection(): Observable<ApiResponse<boolean>> {
    return this.http.get<ApiResponse<boolean>>(`${this.baseUrl}/connection`)
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
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    } else if (error.status) {
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