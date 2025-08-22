import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PostulanteService, DocumentoPostulante, ModalidadPostulante } from './postulante.service';
import { Postulante } from './postulante.model';
import { HttpEventType, HttpResponse } from '@angular/common/http';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

interface Estudiante {
  cod_ceta: string;
  nombres: string;
  ap_pat: string;
  ap_mat: string;
  carrera: string;
  pensum: string;
  fecha_nacimiento: string;
  lugar_nacimiento: string;
  ci: string;
  procedencia: string;
  expedido?: string;
  nro_serie_titulo?: string;
  reg_ini_c?: string;
  gestion_ini?: string;
  reg_con_c?: string;
  gestion_fin?: string;
  incrip_uni?: boolean;
}

interface ModalidadGraduacion {
  id: number;
  nombre: string;
  descripcion: string;
  icono?: string;
  duracion?: string;
}

interface InscripcionModalidad {
  id: number;
  cod_ceta: number;
  modalidad_id: number;
  estado: string;
  fecha_inscripcion: string;
}

interface Arancel {
  id: number;
  cod_ceta: number;
  concepto: string;
  monto: number;
  fecha: string;
  pagado: boolean;
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
  modalidades: ModalidadGraduacion[] = [];
  inscripciones: InscripcionModalidad[] = [];
  
  // Control del modal
  modalVisible = false;
  showBiographicalData = false;
  
  // Aranceles
  aranceles: Arancel[] = [];
  arancelesGraduacion: Arancel[] = [];
  
  // Estados de carga
  loadingModalidades = false;
  loadingAranceles = false;
  
  // Gestión de documentos
  documentTypes: {
    id: string;
    name: string;
    enabled: boolean;
    file: File | null;
    uploaded: boolean;
    uploading: boolean;
    error?: string;
  }[] = [
    { id: 'resolucion', name: 'Resolución', enabled: false, file: null, uploaded: false, uploading: false },
    { id: 'homologacion', name: 'Homologación', enabled: false, file: null, uploaded: false, uploading: false },
    { id: 'practicas', name: 'Prácticas Industriales', enabled: false, file: null, uploaded: false, uploading: false },
    { id: 'certificado', name: 'Certificado de Calificaciones', enabled: false, file: null, uploaded: false, uploading: false }
  ];

  constructor(private postulanteService: PostulanteService) {
    // Inicializar modalidades para prueba
    this.modalidades = [
      { id: 1, nombre: 'Proyecto de Grado', descripcion: 'Trabajo de investigación y desarrollo', icono: 'bi-book', duracion: '6 meses' },
      { id: 2, nombre: 'Excelencia Académica', descripcion: 'Promedio superior al 80%', icono: 'bi-award', duracion: '3 meses' },
      { id: 3, nombre: 'Prácticas Industriales', descripcion: 'Prácticas en empresa del sector', icono: 'bi-building', duracion: '12 meses' },
      { id: 4, nombre: 'Trabajo Dirigido', descripcion: 'Trabajo dirigido por un profesional', icono: 'bi-person-workspace', duracion: '9 meses' }
    ];
  }

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
          apellidos_est: `${this.estudiante.ap_pat} ${this.estudiante.ap_mat}`,
          ci_completo: `${this.estudiante.ci} ${this.estudiante.procedencia}`,
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
    
    // Cargar documentos existentes y modalidad del postulante
    this.cargarDocumentosPostulante(postulante.cod_ceta);
    this.cargarModalidadPostulante(postulante.cod_ceta);
  }
  
  cargarDocumentosPostulante(postulanteId: number) {
    // Resetear estado de documentos
    this.documentTypes.forEach(doc => {
      doc.uploaded = false;
      doc.uploading = false;
      doc.file = null;
      doc.error = undefined;
    });
    
    this.postulanteService.getDocumentosByPostulante(postulanteId).subscribe({
      next: (documentos: DocumentoPostulante[]) => {
        // Marcar documentos existentes como cargados
        documentos.forEach(documento => {
          const docType = this.documentTypes.find(dt => dt.id === documento.tipo_documento);
          if (docType) {
            docType.uploaded = true;
          }
        });
      },
      error: (err) => {
        console.error('Error al cargar documentos del postulante:', err);
      }
    });
  }
  
  cargarModalidadPostulante(postulanteId: number) {
    this.postulanteService.getModalidadPostulante(postulanteId).subscribe({
      next: (modalidadPostulante: ModalidadPostulante) => {
        if (modalidadPostulante && modalidadPostulante.modalidad_id) {
          // Buscar la modalidad en la lista de modalidades
          const modalidadEncontrada = this.modalidades.find(m => m.id === modalidadPostulante.modalidad_id);
          if (modalidadEncontrada) {
            this.modalidad = modalidadEncontrada;
            this.actualizarDocumentosRequeridos(modalidadEncontrada.id);
          }
        }
      },
      error: (err) => {
        console.error('Error al cargar modalidad del postulante:', err);
        // Si no tiene modalidad asignada, dejar como null
        this.modalidad = null;
      }
    });
  }

  eliminar(id: number) {
    if (confirm('¿Seguro que deseas eliminar este postulante?')) {
      this.postulanteService.delete(id).subscribe(() => this.cargarPostulantes());
    }
  }

  cancelar() {
    this.postulanteActual = {};
    
    // Resetear estado de modalidad
    this.modalidad = null;
    
    // Resetear estado de documentos
    this.documentTypes.forEach(doc => {
      doc.uploaded = false;
      doc.uploading = false;
      doc.enabled = false;
      doc.file = null;
      doc.error = undefined;
    });
  }
  
  // Métodos para gestión de modalidades
  mostrarModal() {
    this.modalVisible = true;
  }

  ocultarModal() {
    this.modalVisible = false;
  }
  
  seleccionarModalidad(modalidad: ModalidadGraduacion) {
    this.modalidad = modalidad;
    this.ocultarModal();
    
    // Actualizar documentos requeridos según modalidad
    this.actualizarDocumentosRequeridos(modalidad.id);
    
    // Si hay un postulante seleccionado, actualizar la modalidad en el backend
    if (this.postulanteActual.cod_ceta) {
      this.postulanteService.asignarModalidad(this.postulanteActual.cod_ceta, modalidad.id).subscribe({
        next: (resultado) => {
          console.log('Modalidad asignada correctamente:', resultado);
        },
        error: (err) => {
          console.error('Error al asignar modalidad:', err);
          // Opcionalmente mostrar un mensaje de error
        }
      });
    }
  }
  
  actualizarDocumentosRequeridos(modalidadId: number) {
    // Por defecto, desactivar todos
    this.documentTypes.forEach(doc => doc.enabled = false);
    
    // Habilitar según modalidad seleccionada
    switch(modalidadId) {
      case 1: // Proyecto de Grado
        this.documentTypes.find(doc => doc.id === 'resolucion')!.enabled = true;
        this.documentTypes.find(doc => doc.id === 'certificado')!.enabled = true;
        break;
      case 2: // Excelencia Académica
        this.documentTypes.find(doc => doc.id === 'certificado')!.enabled = true;
        break;
      case 3: // Prácticas Industriales
        this.documentTypes.find(doc => doc.id === 'practicas')!.enabled = true;
        this.documentTypes.find(doc => doc.id === 'certificado')!.enabled = true;
        break;
      case 4: // Trabajo Dirigido
        this.documentTypes.find(doc => doc.id === 'homologacion')!.enabled = true;
        this.documentTypes.find(doc => doc.id === 'certificado')!.enabled = true;
        break;
    }
  }
  
  getModalidadNombre(): string {
    return this.modalidad ? this.modalidad.nombre : 'Seleccionar modalidad';
  }
  
  // Métodos para gestión de documentos
  onFileSelected(event: Event, documentTypeId: string) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const file = target.files[0];
      const docTypeObj = this.documentTypes.find(doc => doc.id === documentTypeId)!;
      
      // Validar tipo de archivo (solo PDF)
      if (file.type !== 'application/pdf') {
        docTypeObj.error = 'Solo se permiten archivos PDF';
        docTypeObj.file = null;
        return;
      }
      
      // Validar tamaño (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        docTypeObj.error = 'El archivo no debe exceder 5MB';
        docTypeObj.file = null;
        return;
      }
      
      // Asignar archivo
      docTypeObj.file = file;
      docTypeObj.error = undefined;
    }
  }
  
  uploadDocument(documentType: string) {
    if (!this.documentTypes.find(doc => doc.id === documentType)?.file || !this.postulanteActual.cod_ceta) {
      return;
    }

    const file = this.documentTypes.find(doc => doc.id === documentType)?.file;
    const docTypeObj = this.documentTypes.find(doc => doc.id === documentType)!;
    docTypeObj.uploading = true;

    this.postulanteService.uploadDocumento(this.postulanteActual.cod_ceta, documentType, file!)
      .subscribe({
        next: (event: any) => {
          if (event.type === HttpEventType.UploadProgress) {
            // Opcional: Mostrar progreso de carga
            const percentDone = Math.round(100 * event.loaded / event.total);
            console.log(`Progreso: ${percentDone}%`);
          } else if (event instanceof HttpResponse) {
            docTypeObj.uploaded = true;
            docTypeObj.uploading = false;
            // Después de cargar, ya no necesitamos mantener el archivo en memoria
            docTypeObj.file = null;
          }
        },
        error: (err) => {
          docTypeObj.uploading = false;
          docTypeObj.error = 'Error al cargar el documento';
          console.error(`Error al cargar documento ${documentType}:`, err);
        }
      });
  }
  
  removeDocument(documentTypeId: string) {
    const docTypeObj = this.documentTypes.find(doc => doc.id === documentTypeId)!;
    docTypeObj.file = null;
    docTypeObj.uploaded = false;
    docTypeObj.error = undefined;
    
    if (this.postulanteActual.cod_ceta) {
      this.postulanteService.deleteDocumento(this.postulanteActual.cod_ceta, documentTypeId).subscribe({
        next: () => {
          console.log(`Documento ${documentTypeId} eliminado correctamente`);
        },
        error: (err) => {
          console.error(`Error al eliminar documento ${documentTypeId}:`, err);
          // Opcionalmente mostrar mensaje de error
        }
      });
    }
  }
  
  toggleDocumentType(documentTypeId: string) {
    const docTypeObj = this.documentTypes.find(doc => doc.id === documentTypeId)!;
    docTypeObj.enabled = !docTypeObj.enabled;
    
    // Si hay un postulante seleccionado, actualizar en el backend
    if (this.postulanteActual.cod_ceta) {
      this.postulanteService.updateDocumentoRequerido(
        this.postulanteActual.cod_ceta, 
        documentTypeId, 
        docTypeObj.enabled
      ).subscribe({
        next: () => {
          console.log(`Documento ${documentTypeId} actualizado: ${docTypeObj.enabled ? 'requerido' : 'no requerido'}`);
        },
        error: (err) => {
          // Revertir cambio si hay error
          docTypeObj.enabled = !docTypeObj.enabled;
          console.error('Error al actualizar estado de documento:', err);
        }
      });
    }
    
    // Limpiar archivo si se deshabilita el documento
    if (!docTypeObj.enabled) {
      docTypeObj.file = null;
      docTypeObj.uploaded = false;
    }
  }
  
  todosDocumentosValidos(): boolean {
    // Verificar si todos los documentos habilitados están cargados
    const documentosRequeridos = this.documentTypes.filter(doc => doc.enabled);
    if (documentosRequeridos.length === 0) return false;
    
    return documentosRequeridos.every(doc => doc.uploaded);
  }
  
  toggleBiographicalData() {
    this.showBiographicalData = !this.showBiographicalData;
  }
}