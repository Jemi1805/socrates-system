import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { SgaService, Carrera, Convocatoria } from '../../../shared/services/sga.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, HeaderComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  loading = false;
  error: string | null = null;

  totalCarreras = 0;
  totalConvocatorias = 0;
  convocatoriasActivas = 0;
  totalPostulantesInscritos = 0;

  modalidadesResumen = [
    {
      id: 1,
      nombre: 'Proyecto de Grado',
      descripcion:
        'Trabajo aplicado o propuesta orientado a resolver un problema práctico, traducido en un documento final.',
    },
    {
      id: 2,
      nombre: 'Proyecto Sociocomunitario Productivo',
      descripcion:
        'Experiencia aplicada a necesidades socioeconómicas de una comunidad, desarrollada de manera participativa.',
    },
    {
      id: 3,
      nombre: 'Proyecto de Emprendimiento Productivo',
      descripcion:
        'Propuesta de innovación basada en un emprendimiento exitoso, propio, familiar o comunitario.',
    },
    {
      id: 4,
      nombre: 'Trabajo Dirigido Externo',
      descripcion:
        'Sistematización de una experiencia laboral en una institución o empresa, con propuesta de solución viable.',
    },
    {
      id: 5,
      nombre: 'Graduación por Excelencia Académica',
      descripcion:
        'Modalidad para estudiantes con excelente rendimiento académico o reconocimiento en eventos de innovación.',
    },
    {
      id: 6,
      nombre: 'Graduación por Experiencia Laboral',
      descripcion:
        'Dirigida a estudiantes que hayan trabajado durante su formación, presentando una propuesta de mejora avalada por la empresa.',
    },
  ];

  constructor(private sga: SgaService) {}

  ngOnInit(): void {
    this.cargarResumen();
  }

  private cargarResumen(): void {
    this.loading = true;
    this.error = null;

    // Cargar carreras y convocatorias en paralelo
    this.sga.getCarreras().subscribe({
      next: (resp) => {
        const carreras = resp?.data || [];
        this.totalCarreras = carreras.length;
      },
      error: () => {
        this.error = this.error || 'No se pudieron cargar todas las estadísticas.';
      },
    });

    this.sga
      .getConvocatorias({ with_counts: true, per_page: 100, order_by: 'fecha_inicio', order_dir: 'desc' })
      .subscribe({
        next: (resp: any) => {
          let items: any[] = [];
          if (Array.isArray(resp)) {
            items = resp;
          } else if (Array.isArray(resp?.data)) {
            items = resp.data;
          } else if (Array.isArray(resp?.items)) {
            items = resp.items;
          }
          const convs: Convocatoria[] = (items || []).map((c: any) => ({
            id: c.id,
            anio: Number(c.anio ?? c.anio_convocatoria ?? new Date().getFullYear()),
            numero_convocatoria: Number(c.numero_convocatoria ?? c.numero ?? 1),
            nombre: c.nombre,
            fecha_inicio: c.fecha_inicio,
            fecha_fin: c.fecha_fin,
            mes_defensa: c.mes_defensa,
            descripcion: c.descripcion,
            numero_tribunales: c.numero_tribunales != null ? Number(c.numero_tribunales) : undefined,
            es_activo: !!c.es_activo,
            inscripciones_count: c.inscripciones_count,
            designaciones_tutor_count: c.designaciones_tutor_count,
          }));

          this.totalConvocatorias = convs.length;
          this.convocatoriasActivas = convs.filter((c) => c.es_activo).length;
          this.totalPostulantesInscritos = convs.reduce(
            (sum, c) => sum + (Number(c.inscripciones_count ?? 0) || 0),
            0,
          );
        },
        error: () => {
          this.error = this.error || 'No se pudieron cargar todas las estadísticas.';
        },
        complete: () => {
          this.loading = false;
        },
      });
  }
}
