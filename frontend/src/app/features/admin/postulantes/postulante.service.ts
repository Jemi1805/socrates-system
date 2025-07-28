import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Postulante } from './postulante.model';

@Injectable({ providedIn: 'root' })
export class PostulanteService {
  private apiUrl = 'http://localhost:8080/api/postulantes'; // Ajusta la URL según tu backend

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
}