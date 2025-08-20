import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SgaService, Postulante, Carrera, InscripModalidad, PostulanteCarrera } from '../shared/services/sga.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms'; // necesarios para [formGroup] y formularios
import { RouterModule } from '@angular/router'; // opcional, si quieres usar rutas en el futuro

@Component({
  selector: 'app-postulantes',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule
  ],
  template: `
  <div class="container mt-4">
    <h2>Gestión de Postulantes - Integración SGA</h2>
    
    <!-- Verificar conexión -->
    <div class="card mb-4">
      <div class="card-header">
        <h5>Estado de Conexión</h5>
      </div>
      <div class="card-body">
        <button class="btn btn-primary" (click)="checkConnection()" [disabled]="checking">
          {{ checking ? 'Verificando...' : 'Verificar Conexión SGA' }}
        </button>
        <div *ngIf="connectionStatus" class="mt-2">
          <span class="badge" [ngClass]="connectionStatus.success ? 'bg-success' : 'bg-danger'">
            {{ connectionStatus.message }}
          </span>
        </div>
      </div>
    </div>

    <!-- Búsqueda de postulantes -->
    <div class="card mb-4">
      <div class="card-header">
        <h5>Búsqueda de Estudiantes</h5>
      </div>
      <div class="card-body">
        <form [formGroup]="searchForm" (ngSubmit)="searchPostulantes()">
          <div class="row mb-3">
            <div class="col-md-4">
              <label for="searchType" class="form-label">Tipo de búsqueda</label>
              <select id="searchType" class="form-select" formControlName="searchType">
                <option value="codigo">Por Código CETA</option>
                <option value="nombre">Por Nombre</option>
              </select>
            </div>
            
            <div class="col-md-8" *ngIf="searchForm.get('searchType')?.value === 'codigo'">
              <label for="searchValue" class="form-label">Código CETA</label>
              <input 
                type="text" 
                id="searchValue" 
                class="form-control" 
                formControlName="searchValue"
                placeholder="Ingrese código CETA">
            </div>
          </div>
          
          <!-- Campos para búsqueda por nombre (aparecen solo cuando se selecciona búsqueda por nombre) -->
          <div *ngIf="searchForm.get('searchType')?.value === 'nombre'">
            <div class="row mb-3">
              <div class="col-md-4">
                <label for="nombres" class="form-label">Nombres</label>
                <input 
                  type="text" 
                  id="nombres" 
                  class="form-control" 
                  formControlName="nombres"
                  placeholder="Nombres del estudiante">
              </div>
              <div class="col-md-4">
                <label for="ap_pat" class="form-label">Apellido Paterno</label>
                <input 
                  type="text" 
                  id="ap_pat" 
                  class="form-control" 
                  formControlName="ap_pat"
                  placeholder="Apellido paterno">
              </div>
              <div class="col-md-4">
                <label for="ap_mat" class="form-label">Apellido Materno</label>
                <input 
                  type="text" 
                  id="ap_mat" 
                  class="form-control" 
                  formControlName="ap_mat"
                  placeholder="Apellido materno">
              </div>
            </div>
            
            <div class="row mb-3">
              <div class="col-md-12">
                <p class="text-muted small">Ingrese al menos un criterio de búsqueda (nombres, apellido paterno o apellido materno)</p>
              </div>
            </div>
          </div>
          
          <!-- Selector de carrera (siempre visible) -->
          <div class="row mb-3">
            <div class="col-md-6">
              <label for="carrera" class="form-label">Carrera <span class="text-danger">*</span></label>
              <select id="carrera" class="form-select" formControlName="carrera" required>
                <option value="">-- Seleccione una carrera --</option>
                <option *ngFor="let c of carreras" [value]="c.nom_carrera">{{ c.nom_carrera }}</option>
              </select>
              <div *ngIf="searchForm.get('carrera')?.errors?.['required'] && searchForm.get('carrera')?.touched" class="text-danger">
                La carrera es obligatoria
              </div>
            </div>
            
            <div class="col-md-6 d-flex align-items-end">
              <button type="submit" class="btn btn-primary w-100" [disabled]="searching || !searchForm.valid">
                <i class="bi bi-search me-1"></i>
                {{ searching ? 'Buscando...' : 'Buscar Estudiantes' }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <!-- Resultados de postulantes -->
    <div class="card mb-4" *ngIf="postulantes.length > 0">
      <div class="card-header">
        <h5>Postulantes Encontrados ({{ postulantes.length }})</h5>
      </div>
      <div class="card-body">
        <div class="table-responsive">
          <table class="table table-striped">
            <thead>
              <tr>
                <th>Código CETA</th>
                <th>Apellidos</th>
                <th>Nombres</th>
                <th>CI</th>
                <th>Celular</th>
                <th>Carrera(s)</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let postulante of postulantes">
                <td>{{ postulante.cod_ceta }}</td>
                <td>{{ postulante.apellidos_est }}</td>
                <td>{{ postulante.nombres_est }}</td>
                <td>{{ postulante.ci }}</td>
                <td>{{ postulante.celular }}</td>
                <td>
                  <ng-container *ngIf="getCarrerasDePostulante(postulante.cod_ceta).length > 0; else noCarrera">
                    <span *ngFor="let carrera of getCarrerasDePostulante(postulante.cod_ceta); let last = last">
                      {{ carrera.nom_carrera }}<span *ngIf="!last">, </span>
                    </span>
                  </ng-container>
                  <ng-template #noCarrera>No registrado</ng-template>
                </td>
                <td>
                  <button class="btn btn-sm btn-info" (click)="viewPostulante(postulante.cod_ceta)">
                    Ver Detalles
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Detalles del postulante -->
    <div class="card mb-4" *ngIf="selectedPostulante">
      <div class="card-header">
        <h5>Detalles del Postulante</h5>
      </div>
      <div class="card-body">
        <div class="row">
          <div class="col-md-6">
            <p><strong>Código CETA:</strong> {{ selectedPostulante?.cod_ceta }}</p>
            <p><strong>Nombres:</strong> {{ selectedPostulante?.nombres_est }}</p>
            <p><strong>Apellidos:</strong> {{ selectedPostulante?.apellidos_est }}</p>
            <p><strong>CI:</strong> {{ selectedPostulante?.ci }}</p>
            <p><strong>Celular:</strong> {{ selectedPostulante?.celular }}</p>
            <p><strong>Carrera(s):</strong>
              <ng-container *ngIf="selectedCarreras.length > 0; else noCarreraDetalle">
                <span *ngFor="let carrera of selectedCarreras; let last = last">
                  {{ carrera.nom_carrera }}<span *ngIf="!last">, </span>
                </span>
              </ng-container>
              <ng-template #noCarreraDetalle>No registrado</ng-template>
            </p>
          </div>
          <div class="col-md-6">
            <p><strong>Expedido:</strong> {{ selectedPostulante?.expedido }}</p>
            <p><strong>Registro Inicial Carrera:</strong> {{ selectedPostulante?.reg_ini_c }}</p>
            <p><strong>Gestión Inicial:</strong> {{ selectedPostulante?.gestion_ini }}</p>
            <p><strong>Registro Concluido Carrera:</strong> {{ selectedPostulante?.reg_con_c }}</p>
            <p><strong>Gestión Final:</strong> {{ selectedPostulante?.gestion_fin }}</p>
            <p><strong>Inscripción Universidad:</strong> {{ selectedPostulante?.incrip_uni ? 'Sí' : 'No' }}</p>
          </div>
        </div>
        
        <!-- Inscripciones del postulante -->
        <div class="mt-3" *ngIf="inscripciones.length > 0">
          <h6>Inscripciones:</h6>
          <ul class="list-group">
            <li class="list-group-item" *ngFor="let inscripcion of inscripciones">
              {{ inscripcion.fecha_inscripcion }} - Modalidad: {{ inscripcion.modalidad_id }} - Estado: {{ inscripcion.estado }}
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Carreras -->
    <div class="row">
      <div class="col-md-6">
        <div class="card">
          <div class="card-header">
            <h5>Carreras Activas</h5>
          </div>
          <div class="card-body">
            <button class="btn btn-secondary mb-2" (click)="loadCarreras()" [disabled]="loadingCarreras">
              {{ loadingCarreras ? 'Cargando...' : 'Cargar Carreras' }}
            </button>
            <ul class="list-group" *ngIf="carreras.length > 0">
              <li class="list-group-item" *ngFor="let carrera of carreras">
                {{ carrera.nom_carrera }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .badge {
      font-size: 0.9em;
    }
    .table th {
      background-color: #f8f9fa;
    }
  `]
})
export class PostulantesComponent implements OnInit {
  searchForm: FormGroup;
  postulantes: Postulante[] = [];
  selectedPostulante: Postulante | null = null;
  inscripciones: InscripModalidad[] = [];
  carreras: Carrera[] = [];
  postulanteCarreras: PostulanteCarrera[] = [];
  selectedCarreras: Carrera[] = [];
  
  // Estados de carga
  checking = false;
  searching = false;
  loadingCarreras = false;
  connectionStatus: any = null;
  
  // Paginación y totales
  total: number = 0;
  limit: number = 100;
  offset: number = 0;
  selectedCarrera: string = '';

  constructor(
    private fb: FormBuilder,
    private sgaService: SgaService
  ) {
    this.searchForm = this.fb.group({
      searchType: ['nombre', Validators.required],
      searchValue: ['', Validators.required],
      nombres: [''],
      ap_pat: [''],
      ap_mat: [''],
      carrera: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.checkConnection();
    this.loadCarreras();
    this.loadAllPostulanteCarreras();
    
    // Si la carrera no está definida y hay carreras disponibles, seleccionar la primera por defecto
    this.searchForm.get('carrera')?.valueChanges.subscribe(value => {
      console.log('Carrera seleccionada:', value);
    });
  }

  checkConnection(): void {
    this.checking = true;
    this.sgaService.checkConnection().subscribe({
      next: (response) => {
        this.connectionStatus = response;
        this.checking = false;
      },
      error: (error) => {
        this.connectionStatus = { success: false, message: 'Error de conexión' };
        this.checking = false;
        console.error('Error al verificar conexión:', error);
      }
    });
  }

  searchPostulantes(): void {
    if (this.searchForm.valid) {
      this.searching = true;
      const { searchType, searchValue, nombres, ap_pat, ap_mat, carrera } = this.searchForm.value;
      this.selectedCarrera = carrera;
      
      if (searchType === 'codigo') {
        // La búsqueda por código sigue igual
        this.sgaService.getPostulanteById(Number(searchValue)).subscribe({
          next: (response) => {
            if (response.success && response.data) {
              this.postulantes = [response.data];
              this.total = 1;
            } else {
              this.postulantes = [];
              this.total = 0;
            }
            this.searching = false;
          },
          error: (error) => {
            console.error('Error al buscar postulante:', error);
            this.postulantes = [];
            this.total = 0;
            this.searching = false;
          }
        });
      } else {
        // Búsqueda por nombre usando el nuevo endpoint
        let nombreBusqueda = '';
        let apPatBusqueda = '';
        let apMatBusqueda = '';
        
        if (searchType === 'nombre') {
          // Si están llenos los campos específicos, usamos esos
          if (nombres || ap_pat || ap_mat) {
            nombreBusqueda = nombres || '';
            apPatBusqueda = ap_pat || '';
            apMatBusqueda = ap_mat || '';
          } else if (searchValue) {
            // Si no, intentamos extraer de searchValue (busca en todos los campos)
            nombreBusqueda = searchValue;
          }
        }
        
        this.sgaService.getPostulanteByName(
          nombreBusqueda, 
          apPatBusqueda, 
          apMatBusqueda, 
          this.limit, 
          this.offset,
          carrera
        ).subscribe({
          next: (response) => {
            if (response.success) {
              this.postulantes = response.data || [];
              this.total = response.total || this.postulantes.length;
            } else {
              this.postulantes = [];
              this.total = 0;
            }
            this.searching = false;
          },
          error: (error) => {
            console.error('Error al buscar estudiantes:', error);
            this.postulantes = [];
            this.total = 0;
            this.searching = false;
          }
        });
      }
    }
  }

  viewPostulante(codCeta: number): void {
    this.sgaService.getPostulanteById(codCeta).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.selectedPostulante = response.data;
          this.loadInscripciones(codCeta);
          this.loadCarrerasDePostulante(codCeta);
        }
      },
      error: (error) => {
        console.error('Error al obtener detalles del postulante:', error);
      }
    });
  }

  loadInscripciones(codCeta: number): void {
    this.sgaService.getInscripModalidadByPostulante(codCeta).subscribe({
      next: (response) => {
        this.inscripciones = response.data || [];
      },
      error: (error) => {
        console.error('Error al cargar inscripciones:', error);
        this.inscripciones = [];
      }
    });
  }

  loadCarreras(): void {
    this.loadingCarreras = true;
    this.sgaService.getCarreras().subscribe({
      next: (response) => {
        this.carreras = response.data || [];
        this.loadingCarreras = false;
      },
      error: (error) => {
        console.error('Error al cargar carreras:', error);
        this.carreras = [];
        this.loadingCarreras = false;
      }
    });
  }

  loadAllPostulanteCarreras(): void {
    // Si tienes un endpoint para obtener todas las relaciones postulante-carrera:
    // this.sgaService.getAllPostulanteCarreras().subscribe({
    //   next: (response) => {
    //     this.postulanteCarreras = response.data || [];
    //   },
    //   error: (error) => {
    //     console.error('Error al cargar relaciones postulante-carrera:', error);
    //     this.postulanteCarreras = [];
    //   }
    // });
    // Si no, puedes cargar las carreras de cada postulante individualmente cuando sea necesario.
  }

  loadCarrerasDePostulante(codCeta: number): void {
    this.sgaService.getCarrerasByPostulante(codCeta).subscribe({
      next: (response) => {
        const relaciones = response.data || [];
        this.selectedCarreras = relaciones
          .map(rel => this.carreras.find(c => c.cod_carrera === rel.cod_carrera))
          .filter((c): c is Carrera => !!c);
      },
      error: (error) => {
        console.error('Error al cargar carreras del postulante:', error);
        this.selectedCarreras = [];
      }
    });
  }

  getCarrerasDePostulante(codCeta: number): Carrera[] {
    // Si tienes todas las relaciones postulante-carrera cargadas en this.postulanteCarreras:
    const relaciones = this.postulanteCarreras.filter(rel => rel.cod_ceta === codCeta);
    return relaciones
      .map(rel => this.carreras.find(c => c.cod_carrera === rel.cod_carrera))
      .filter((c): c is Carrera => !!c);
    // Si no tienes todas las relaciones, puedes devolver un array vacío o cargarlo bajo demanda.
  }
}