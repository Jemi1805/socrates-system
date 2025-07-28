import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Postulante } from './postulante.model';
import { PostulanteService } from './postulante.service';
import { HeaderComponent } from '../../../shared/components/header/header.component';

@Component({
  selector: 'app-postulantes-list',
  templateUrl: './postulantes-list.component.html',
  styleUrls: ['./postulantes-list.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent],
})
export class PostulantesListComponent implements OnInit {
  postulantes: Postulante[] = [];
  postulanteActual: Partial<Postulante> = {};

  constructor(private postulanteService: PostulanteService) {}

  ngOnInit() {
    this.cargarPostulantes();
  }

  cargarPostulantes() {
    this.postulanteService.getAll().subscribe((data: Postulante[]) => {
      this.postulantes = data;
    });
  }

  guardar() {
    if (this.postulanteActual.cod_ceta) {
      // Actualizar
      this.postulanteService.update(this.postulanteActual.cod_ceta, this.postulanteActual as Postulante)
        .subscribe(() => {
          this.cargarPostulantes();
          this.cancelar();
        });
    } else {
      // Crear
      this.postulanteService.create(this.postulanteActual as Postulante)
        .subscribe(() => {
          this.cargarPostulantes();
          this.cancelar();
        });
    }
  }

  editar(postulante: Postulante) {
    this.postulanteActual = { ...postulante };
  }

  eliminar(id: number) {
    if (confirm('¿Seguro que deseas eliminar este postulante?')) {
      this.postulanteService.delete(id).subscribe(() => this.cargarPostulantes());
    }
  }

  cancelar() {
    this.postulanteActual = {};
  }
}