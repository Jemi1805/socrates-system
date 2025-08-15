import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Postulante } from './postulante.model';
import { PostulanteService } from './postulante.service';
import { HeaderComponent } from '../../../shared/components/header/header.component';

interface Estudiante {
  cod_ceta: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  ci: string;
  procedencia: string;
  telf_movil: string;
  carrera: string;
}

interface ModalidadGraduacion {
  id: number;
  nombre: string;
  descripcion: string;
}

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
  
  // Datos del estudiante y modalidad
  estudiante: Estudiante | null = null;
  modalidad: ModalidadGraduacion | null = null;

  constructor(private postulanteService: PostulanteService) {}

  ngOnInit() {
    this.cargarDatosPostulacion();
    this.cargarPostulantes();
  }

  cargarDatosPostulacion() {
    const datosPostulacion = sessionStorage.getItem('datos_postulacion');
    if (datosPostulacion) {
      const datos = JSON.parse(datosPostulacion);
      this.estudiante = datos.estudiante;
      this.modalidad = datos.modalidad;
      
      // Pre-llenar el formulario con los datos del estudiante
      if (this.estudiante) {
        this.postulanteActual = {
          cod_ceta: parseInt(this.estudiante.cod_ceta),
          nombres_est: this.estudiante.nombres,
          apellidos_est: `${this.estudiante.apellido_paterno} ${this.estudiante.apellido_materno}`,
          ci_completo: `${this.estudiante.ci} ${this.estudiante.procedencia}`,
          celular: this.estudiante.telf_movil,
          carrera: this.estudiante.carrera,
        };
      }
    }
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