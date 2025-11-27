import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { SgaService, Usuario, Pertinencia, Rol, Carrera, Convocatoria, ApiResponse } from '../../../shared/services/sga.service';
import { LoadingService } from '../../../core/services/loading.service';
import { finalize } from 'rxjs/operators';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

interface ConvocatoriaToggleResponse {
  message?: string;
  es_activo?: boolean;
}

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [CommonModule, HeaderComponent, RouterLink, ReactiveFormsModule],
  templateUrl: './configuracion.component.html',
  styleUrls: ['./configuracion.component.scss']
})
export class ConfiguracionComponent implements OnInit {
  // Usuarios
  usuariosOpen = false;
  usuarios: Usuario[] = [];
  loadingUsuarios = false;
  errorUsuarios: string | null = null;

  // Pertinencias
  pertinenciasOpen = false;
  pertinencias: Pertinencia[] = [];
  loadingPertinencias = false;
  errorPertinencias: string | null = null;
  // Editar Pertinencia (UI local)
  editPertVisible = false;
  editPertForm!: FormGroup;
  editingPert: Pertinencia | null = null;
  // Nueva Pertinencia
  newPertVisible = false;
  newPertForm!: FormGroup;
  // Carreras para select
  carreras: Carrera[] = [];
  loadingCarreras = false;
  errorCarreras: string | null = null;

  convocatoriasOpen = false;
  convocatorias: Convocatoria[] = [];
  loadingConvocatorias = false;
  errorConvocatorias: string | null = null;
  newConvVisible = false;
  newConvForm!: FormGroup;
  editConvVisible = false;
  editConvForm!: FormGroup;
  editingConv: Convocatoria | null = null;
  convModalSaving = false;
  togglingConvocatoriaId: number | null = null;
  deletingConvocatoriaId: number | null = null;
  anioActual = new Date().getFullYear();
  anioFechaMin = `${new Date().getFullYear()}-01-01`;
  anioFechaMax = `${new Date().getFullYear()}-12-31`;
  anioMesMin = `${new Date().getFullYear()}-01`;
  anioMesMax = `${new Date().getFullYear()}-12`;
  ultimaFechaInicio: string | null = null;
  siguienteNumeroConvocatoria = 1;
  convFormError: string | null = null;

  // Roles
  roles: Rol[] = [];
  loadingRoles = false;
  errorRoles: string | null = null;

  // Nuevo Usuario Form
  newUserOpen = false;
  newUserForm!: FormGroup;

  // Editar Usuario
  editUserOpen = false;
  editUserForm!: FormGroup;
  editingUser: Usuario | null = null;

  // Modal (Crear/Editar Usuario)
  userModalVisible = false;
  isCreateUserMode = true;
  modalSaving = false;
  modalError: string | null = null;
  togglingUsuarioId: number | null = null;

  confirmModalVisible = false;
  confirmModalTitle = '';
  confirmModalMessage = '';
  confirmModalConfirmText = 'Confirmar';
  confirmModalCancelText = 'Cancelar';
  private confirmModalOnConfirm: (() => void) | null = null;

  // Permisos (modal)
  permsModalVisible = false;
  permsLoading = false;
  permsError: string | null = null;
  permsTargetUser: Usuario | null = null;
  permsOptions: Array<{ id: number; codigo: string; nombre: string; assigned: boolean }> = [];
  savingPerms = false;

  constructor(private sga: SgaService, private fb: FormBuilder, private loading: LoadingService) {}

  ngOnInit(): void {
    this.buildNewUserForm();
    this.loadRoles();
    this.buildNewConvForm();
  }

  private actualizarMetadatosConvocatorias() {
    if (!this.convocatorias.length) {
      this.ultimaFechaInicio = null;
      this.siguienteNumeroConvocatoria = 1;
      return;
    }

    const fechas = this.convocatorias
      .map((c) => (c.fecha_inicio ? c.fecha_inicio.substring(0, 10) : null))
      .filter((f): f is string => !!f)
      .sort();

    this.ultimaFechaInicio = fechas.length ? fechas[fechas.length - 1] : null;

    const actuales = this.convocatorias.filter((c) => c.anio === this.anioActual);
    if (actuales.length) {
      const maxNumero = Math.max(...actuales.map((c) => Number(c.numero_convocatoria) || 0));
      this.siguienteNumeroConvocatoria = maxNumero + 1;
    } else {
      this.siguienteNumeroConvocatoria = 1;
    }
  }

  private obtenerFechaMinimaPermitidaParaEdicion(convId: number): string | null {
    if (!this.convocatorias.length) {
      return null;
    }

    const restantes = this.convocatorias
      .filter((c) => c.id !== convId)
      .map((c) => (c.fecha_inicio ? c.fecha_inicio.substring(0, 10) : null))
      .filter((f): f is string => !!f)
      .sort();

    if (restantes.length === 0) {
      return null;
    }

    return restantes[restantes.length - 1];
  }

  private buildNewUserForm() {
    this.newUserForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(150)]],
      apellido_p: ['', [Validators.maxLength(150)]],
      apellido_m: ['', [Validators.maxLength(150)]],
      nombre_usuario: ['', [Validators.required, Validators.maxLength(255), Validators.pattern(/^[A-Za-z0-9_]+$/)]],
      contrasena: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^\S+$/)]],
      contrasena_confirmation: ['', [Validators.required, Validators.pattern(/^\S+$/)]],
      rol_id: [null, [Validators.required]],
      activo: [true],
    });
  }

  // === Nueva Pertinencia ===
  openNewPert() {
    if (!this.newPertForm) {
      this.newPertForm = this.fb.group({
        nombre_pert: ['', [Validators.required, Validators.maxLength(255)]],
        cod_carrera: [null, [Validators.required]],
        activo: [true]
      });
    }
    this.newPertForm.reset({ nombre_pert: '', cod_carrera: null, activo: true });
    this.newPertVisible = true;
    this.setBodyModalOpen(true);
    if (!this.carreras.length) {
      this.loadCarreras();
    }
  }

  cancelNewPert() {
    this.newPertVisible = false;
    this.setBodyModalOpen(false);
  }

  private loadCarreras() {
    this.loadingCarreras = true;
    this.errorCarreras = null;
    this.sga.getCarreras().subscribe({
      next: (resp) => {
        this.loadingCarreras = false;
        if (resp?.success) {
          const raw: any = resp.data;
          let items: any[] = [];
          if (Array.isArray(raw)) items = raw;
          else if (raw && Array.isArray(raw.data)) items = raw.data;
          else if (raw && Array.isArray(raw.items)) items = raw.items;
          else if (raw && Array.isArray(raw.carreras)) items = raw.carreras;
          this.carreras = (items || []).map((c: any) => ({
            cod_carrera: c?.cod_carrera,
            nom_carrera: c?.nom_carrera || c?.nombre_carrera || c?.nombre,
            num_materias: c?.num_materias ?? 0,
          }));
          if (!this.carreras.length) {
            this.errorCarreras = 'No hay carreras disponibles.';
          }
        } else {
          this.carreras = [];
          this.errorCarreras = resp?.message || 'No se pudo cargar carreras';
        }
      },
      error: (err) => {
        this.loadingCarreras = false;
        this.carreras = [];
        this.errorCarreras = err?.message || 'Error al cargar carreras';
      }
    });
  }

  submitNewPert() {
    if (this.newPertForm.invalid) {
      this.newPertForm.markAllAsTouched();
      return;
    }
    const val = this.newPertForm.value;
    const payload: Partial<Pertinencia> = {
      nombre_pert: val.nombre_pert,
      cod_carrera: String(val.cod_carrera),
      activo: !!val.activo
    };
    this.sga.createPertinencia(payload).subscribe({
      next: (resp) => {
        if (resp?.success) {
          this.loadPertinencias();
          this.cancelNewPert();
        } else {
          this.errorPertinencias = resp?.message || 'No se pudo crear la pertinencia';
        }
      },
      error: (err) => {
        this.errorPertinencias = err?.message || 'Error al crear la pertinencia';
      }
    });
  }

  formatNumeroConvocatoria(numero: number): string {
    const n = Number(numero) || 0;
    if (!n) {
      return 'Convocatoria';
    }

    const ordinales = [
      '',
      'Primera', 'Segunda', 'Tercera', 'Cuarta', 'Quinta', 'Sexta', 'Séptima', 'Octava', 'Novena', 'Décima',
      'Undécima', 'Duodécima', 'Decimotercera', 'Decimocuarta', 'Decimoquinta', 'Decimosexta', 'Decimoséptima', 'Decimoctava', 'Decimonovena', 'Vigésima',
    ];

    const ordinal = ordinales[n];
    return ordinal ? `${ordinal} Convocatoria` : `Convocatoria ${n}`;
  }

  private buildNewConvForm() {
    this.newConvForm = this.fb.group({
      anio: [{ value: this.anioActual, disabled: true }, [Validators.required]],
      numero_convocatoria: [{ value: this.siguienteNumeroConvocatoria, disabled: true }, [Validators.required, Validators.min(1)]],
      nombre: ['', [Validators.required, Validators.maxLength(30)]],
      fecha_inicio: ['', [Validators.required, this.validarFechaEnAnioActual()]],
      fecha_fin: ['', [Validators.required, this.validarFechaEnAnioActual()]],
      mes_defensa: [''],
      descripcion: ['', [Validators.maxLength(100)]],
      numero_tribunales: [3, [Validators.required, Validators.min(1), Validators.max(10)]],
      es_activo: [true],
    }, { validators: this.validarRangoFechas() });
  }

  // --- Roles ---
  loadRoles() {
    this.loadingRoles = true;
    this.errorRoles = null;
    this.sga.getRoles().subscribe({
      next: (resp) => {
        this.loadingRoles = false;
        if (resp?.success) {
          this.roles = resp.data || [];
        } else {
          this.roles = [];
          this.errorRoles = resp?.message || 'No se pudo cargar roles';
        }
      },
      error: (err) => {
        this.loadingRoles = false;
        this.roles = [];
        this.errorRoles = err?.message || 'Error al cargar roles';
      }
    });
  }

  // --- Toggle y carga: Usuarios ---
  toggleUsuarios() {
    this.usuariosOpen = !this.usuariosOpen;
    if (this.usuariosOpen && this.usuarios.length === 0) {
      this.loadUsuarios();
    }
  }

  loadUsuarios() {
    this.loadingUsuarios = true;
    this.errorUsuarios = null;
    this.sga.getUsuarios().subscribe({
      next: (resp) => {
        this.loadingUsuarios = false;
        if (resp?.success) {
          this.usuarios = (resp.data || []).slice().sort((a: any, b: any) => Number(a?.id ?? 0) - Number(b?.id ?? 0));
        } else {
          this.usuarios = [];
          this.errorUsuarios = resp?.message || 'No se pudo cargar usuarios';
        }
      },
      error: (err) => {
        this.loadingUsuarios = false;
        this.usuarios = [];
        this.errorUsuarios = err?.message || 'Error al cargar usuarios';
      }
    });
  }

  // --- Nuevo Usuario ---
  toggleNewUser() {
    // Backward-compat: abrir modal de creación
    this.openCreateModal();
  }

  openCreateModal() {
    this.isCreateUserMode = true;
    this.userModalVisible = true;
    this.modalError = null;
    this.setBodyModalOpen(true);
    // Asegurar estado limpio de edición
    this.editingUser = null;
    // Resetear formulario de creación (todos los campos vacíos)
    this.newUserForm.reset({
      nombre: '', apellido_p: '', apellido_m: '',
      nombre_usuario: '',
      contrasena: '', contrasena_confirmation: '',
      rol_id: null, activo: true,
    });
    // Limpiar estados de touched/dirty para evitar validaciones previas
    this.newUserForm.markAsPristine();
    this.newUserForm.markAsUntouched();
    this.newUserForm.updateValueAndValidity();

    // Mitigar autofill del navegador: limpiar valores tras el render del modal
    this.clearAutofillInputs();

    if (!this.roles.length) {
      this.loadRoles();
    }
  }

  private clearAutofillInputs() {
    const clearNow = () => {
      const fields = [
        'nombre_usuario', 'contrasena', 'contrasena_confirmation'
      ];
      fields.forEach(fc => this.newUserForm.get(fc)?.setValue(''));
      // Forzar limpieza visual en inputs (por si el navegador completó fuera del control)
      const selectors = [
        'input[formControlName="nombre_usuario"]',
        'input[formControlName="contrasena"]',
        'input[formControlName="contrasena_confirmation"]'
      ];
      selectors.forEach(sel => {
        const el = document.querySelector<HTMLInputElement>(sel);
        if (el) {
          el.value = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    };
    // Intento inmediato y reintento tras un breve delay
    setTimeout(clearNow, 0);
    setTimeout(clearNow, 300);
  }

  submitNewUser() {
    if (this.newUserForm.invalid) {
      this.newUserForm.markAllAsTouched();
      return;
    }
    const payload = this.newUserForm.value;
    this.sga.createUsuario(payload).subscribe({
      next: (resp) => {
        if (resp?.success && resp.data) {
          // Refrescar listado y limpiar formulario
          this.loadUsuarios();
          this.newUserForm.reset({ activo: true });
          this.newUserOpen = false;
          this.closeUserModal();
        } else {
          this.errorUsuarios = resp?.message || 'No se pudo crear el usuario';
        }
      },
      error: (err) => {
        this.errorUsuarios = err?.message || 'Error al crear usuario';
      }
    });
  }

  // --- Editar Usuario ---
  startEdit(user: Usuario) {
    this.editingUser = user;
    this.editUserOpen = false; // usamos modal
    if (!this.editUserForm) {
      this.editUserForm = this.fb.group({
        nombre: ['', [Validators.required, Validators.maxLength(150)]],
        apellido_p: ['', [Validators.maxLength(150)]],
        apellido_m: ['', [Validators.maxLength(150)]],
        nombre_usuario: ['', [Validators.required, Validators.maxLength(255), Validators.pattern(/^[A-Za-z0-9_]+$/)]],
        contrasena: ['', [Validators.minLength(8), Validators.pattern(/^\S+$/)]],
        contrasena_confirmation: ['', [Validators.pattern(/^\S+$/)]],
        rol_id: [null, [Validators.required]],
        activo: [true],
      });
    }
    this.editUserForm.reset({
      nombre: user.nombre || '',
      apellido_p: user.apellido_p || '',
      apellido_m: user.apellido_m || '',
      nombre_usuario: user.nombre_usuario,
      contrasena: '',
      contrasena_confirmation: '',
      rol_id: user.rol_id,
      activo: user.activo,
    });
    // Abrir modal en modo edición
    this.isCreateUserMode = false;
    this.userModalVisible = true;
    this.modalError = null;
    this.setBodyModalOpen(true);

    if (!this.roles.length) {
      this.loadRoles();
    }
  }

  cancelEdit() {
    this.editUserOpen = false;
    this.editingUser = null;
    this.closeUserModal();
  }

  submitEdit() {
    if (!this.editingUser) return;
    if (this.editUserForm.invalid) {
      this.editUserForm.markAllAsTouched();
      return;
    }
    const formVal = this.editUserForm.value;
    const payload: any = {
      nombre: formVal.nombre,
      apellido_p: formVal.apellido_p,
      apellido_m: formVal.apellido_m,
      nombre_usuario: formVal.nombre_usuario,
      rol_id: formVal.rol_id,
      activo: formVal.activo,
    };
    if (formVal.contrasena) {
      payload.contrasena = formVal.contrasena;
      payload.contrasena_confirmation = formVal.contrasena_confirmation || '';
    }
    this.sga.updateUsuario(this.editingUser.id, payload).subscribe({
      next: (resp) => {
        if (resp?.success && resp.data) {
          this.loadUsuarios();
          this.cancelEdit();
        } else {
          this.errorUsuarios = resp?.message || 'No se pudo actualizar el usuario';
        }
      },
      error: (err) => {
        this.errorUsuarios = err?.message || 'Error al actualizar usuario';
      }
    });
  }

  // Modal helpers
  closeUserModal() {
    this.userModalVisible = false;
    this.modalSaving = false;
    this.modalError = null;
    this.setBodyModalOpen(false);
  }

  private setBodyModalOpen(open: boolean) {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('modal-open', open);
    }
  }

  private openConfirmModal(title: string, message: string, confirmText: string, onConfirm: () => void, cancelText = 'Cancelar') {
    this.confirmModalTitle = title;
    this.confirmModalMessage = message;
    this.confirmModalConfirmText = confirmText;
    this.confirmModalCancelText = cancelText;
    this.confirmModalOnConfirm = onConfirm;
    this.confirmModalVisible = true;
    this.setBodyModalOpen(true);
  }

  private closeConfirmModal() {
    this.confirmModalVisible = false;
    this.confirmModalOnConfirm = null;
    const otherModalOpen = this.newPertVisible || this.editPertVisible || this.newConvVisible || this.editConvVisible || this.userModalVisible || this.permsModalVisible;
    this.setBodyModalOpen(otherModalOpen);
  }

  confirmModalConfirm() {
    const callback = this.confirmModalOnConfirm;
    this.closeConfirmModal();
    if (callback) {
      callback();
    }
  }

  confirmModalCancel() {
    this.closeConfirmModal();
  }

  // --- Permisos por Usuario ---
  openPerms(u: Usuario) {
    this.permsTargetUser = u;
    this.permsModalVisible = true;
    this.permsLoading = true;
    this.permsError = null;
    this.permsOptions = [];
    this.setBodyModalOpen(true);
    this.sga.getUserPermissions(u.id).subscribe({
      next: (resp) => {
        this.permsLoading = false;
        if (resp?.success) {
          this.permsOptions = resp.data || [];
        } else {
          this.permsError = resp?.message || 'No se pudo cargar permisos';
        }
      },
      error: (err) => {
        this.permsLoading = false;
        this.permsError = err?.message || 'Error al cargar permisos';
      }
    });
  }

  closePermsModal() {
    this.permsModalVisible = false;
    this.permsLoading = false;
    this.savingPerms = false;
    this.permsError = null;
    this.permsTargetUser = null;
    this.permsOptions = [];
    this.setBodyModalOpen(false);
  }

  onTogglePerm(item: { assigned: boolean }, ev: Event) {
    const target = ev.target as HTMLInputElement;
    if (target) {
      item.assigned = !!target.checked;
    }
  }

  savePerms() {
    if (!this.permsTargetUser) return;
    this.savingPerms = true;
    const ids = this.permsOptions.filter(p => p.assigned).map(p => p.id);
    this.sga.setUserPermissions(this.permsTargetUser.id, ids).subscribe({
      next: (resp) => {
        this.savingPerms = false;
        if (resp?.success) {
          // Opcional: refrescar usuario listado
          this.loadUsuarios();
          this.closePermsModal();
        } else {
          this.permsError = resp?.message || 'No se pudo guardar permisos';
        }
      },
      error: (err) => {
        this.savingPerms = false;
        this.permsError = err?.message || 'Error al guardar permisos';
      }
    });
  }

  // --- Toggle y carga: Pertinencias ---
  togglePertinencias() {
    this.pertinenciasOpen = !this.pertinenciasOpen;
    if (this.pertinenciasOpen && this.pertinencias.length === 0) {
      this.loadPertinencias();
    }
  }

  loadPertinencias() {
    this.loadingPertinencias = true;
    this.errorPertinencias = null;
    // Sin filtro de carrera: lista completa
    this.sga.getPertinencias().subscribe({
      next: (resp) => {
        this.loadingPertinencias = false;
        if (resp?.success) {
          this.pertinencias = (resp.data || []).slice().sort((a: any, b: any) => Number(a?.id ?? 0) - Number(b?.id ?? 0));
        } else {
          this.pertinencias = [];
          this.errorPertinencias = resp?.message || 'No se pudo cargar pertinencias';
        }
      },
      error: (err) => {
        this.loadingPertinencias = false;
        this.pertinencias = [];
        this.errorPertinencias = err?.message || 'Error al cargar pertinencias';
      }
    });
  }

  // --- Editar Pertinencia (UI local) ---
  startEditPert(p: Pertinencia) {
    this.editingPert = p;
    if (!this.editPertForm) {
      this.editPertForm = this.fb.group({
        nombre_pert: ['', [Validators.required, Validators.maxLength(255)]],
        cod_carrera: [{ value: '', disabled: true }],
        activo: [true]
      });
    }
    this.editPertForm.reset({
      nombre_pert: p.nombre_pert || '',
      cod_carrera: p.cod_carrera || '-',
      activo: p.activo !== false
    });
    this.editPertVisible = true;
    this.setBodyModalOpen(true);
  }

  cancelEditPert() {
    this.editPertVisible = false;
    this.editingPert = null;
    this.setBodyModalOpen(false);
  }

  submitEditPert() {
    if (!this.editingPert) return;
    if (this.editPertForm.invalid) {
      this.editPertForm.markAllAsTouched();
      return;
    }
    const val = this.editPertForm.getRawValue();
    const payload: Partial<Pertinencia> = {
      nombre_pert: val.nombre_pert,
      activo: !!val.activo
    };
    this.sga.updatePertinencia(this.editingPert.id, payload).subscribe({
      next: (resp) => {
        if (resp?.success) {
          this.loadPertinencias();
          this.cancelEditPert();
        } else {
          this.errorPertinencias = resp?.message || 'No se pudo actualizar la pertinencia';
        }
      },
      error: (err) => {
        this.errorPertinencias = err?.message || 'Error al actualizar la pertinencia';
      }
    });
  }

  private ensureEditConvForm() {
    if (!this.editConvForm) {
      this.editConvForm = this.fb.group({
        anio: [{ value: this.anioActual, disabled: true }, [Validators.required]],
        numero_convocatoria: [{ value: 1, disabled: true }, [Validators.required, Validators.min(1)]],
        nombre: ['', [Validators.required, Validators.maxLength(30)]],
        fecha_inicio: ['', [Validators.required, this.validarFechaEnAnioActual()]],
        fecha_fin: ['', [Validators.required, this.validarFechaEnAnioActual()]],
        mes_defensa: [''],
        descripcion: ['', [Validators.maxLength(100)]],
        numero_tribunales: [3, [Validators.required, Validators.min(1), Validators.max(10)]],
        es_activo: [true],
      }, { validators: this.validarRangoFechas() });
    }
  }

  private validarFechaEnAnioActual(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value ? control.value.toString().slice(0, 10) : '';
      if (!value) return null;
      if (value < this.anioFechaMin || value > this.anioFechaMax) {
        return { fueraDeRango: true };
      }
      return null;
    };
  }

  private validarRangoFechas(): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const inicio = group.get('fecha_inicio')?.value;
      const fin = group.get('fecha_fin')?.value;
      if (inicio && fin && fin <= inicio) {
        return { finAntesQueInicio: true };
      }
      return null;
    };
  }

  // Utilidad para inputs date: retorna fecha_inicio + 1 día en formato YYYY-MM-DD
  addOneDay(dateStr?: string | null): string {
    if (!dateStr) return '';
    try {
      // Asegurar formato YYYY-MM-DD
      const s = String(dateStr).slice(0, 10);
      const d = new Date(s);
      if (isNaN(d.getTime())) return '';
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    } catch {
      return '';
    }
  }

  toggleConvocatorias() {
    this.convocatoriasOpen = !this.convocatoriasOpen;
    if (this.convocatoriasOpen && this.convocatorias.length === 0) {
      this.loadConvocatorias();
    }
  }

  loadConvocatorias() {
    this.loadingConvocatorias = true;
    this.errorConvocatorias = null;
    this.sga.getConvocatorias({ with_counts: true, per_page: 100, order_by: 'fecha_inicio', order_dir: 'desc' }).subscribe({
      next: (resp) => {
        this.loadingConvocatorias = false;
        let items: any[] = [];
        if (Array.isArray(resp)) {
          items = resp;
        } else if (Array.isArray(resp?.data)) {
          items = resp.data;
        } else if (Array.isArray(resp?.items)) {
          items = resp.items;
        }
        this.convocatorias = (items || []).map((c: any) => ({
          ...c,
          anio: Number(c.anio ?? c.anio_convocatoria ?? this.anioActual),
          numero_convocatoria: Number(c.numero_convocatoria ?? c.numero ?? 1),
          numero_tribunales: c.numero_tribunales != null ? Number(c.numero_tribunales) : 3,
          es_activo: !!c.es_activo,
        }));
        this.actualizarMetadatosConvocatorias();
      },
      error: (err) => {
        this.loadingConvocatorias = false;
        this.convocatorias = [];
        this.errorConvocatorias = err?.message || 'Error al cargar convocatorias';
      }
    });
  }

  openNewConv() {
    if (!this.newConvForm) {
      this.buildNewConvForm();
    }
    this.convFormError = null;
    this.actualizarMetadatosConvocatorias();
    const numero = this.siguienteNumeroConvocatoria > 0 ? this.siguienteNumeroConvocatoria : 1;
    const anioCtrl = this.newConvForm.get('anio');
    const numeroCtrl = this.newConvForm.get('numero_convocatoria');
    anioCtrl?.enable({ emitEvent: false });
    numeroCtrl?.enable({ emitEvent: false });
    this.newConvForm.reset({
      anio: this.anioActual,
      numero_convocatoria: numero,
      nombre: this.formatNumeroConvocatoria(numero),
      fecha_inicio: '',
      fecha_fin: '',
      mes_defensa: '',
      descripcion: '',
      numero_tribunales: 3,
      es_activo: true,
    });
    anioCtrl?.disable({ emitEvent: false });
    numeroCtrl?.disable({ emitEvent: false });
    this.convModalSaving = false;
    this.newConvVisible = true;
    this.setBodyModalOpen(true);
  }

  cancelNewConv() {
    this.newConvVisible = false;
    this.setBodyModalOpen(false);
  }

  submitNewConv() {
    if (this.newConvForm.invalid) {
      this.newConvForm.markAllAsTouched();
      return;
    }
    const val = this.newConvForm.getRawValue();
    this.convFormError = null;
    if (this.ultimaFechaInicio && val.fecha_inicio && val.fecha_inicio < this.ultimaFechaInicio) {
      this.convFormError = `La fecha de inicio debe ser posterior o igual a ${this.ultimaFechaInicio}.`;
      return;
    }
    const payload: Partial<Convocatoria> = {
      anio: Number(val.anio) || this.anioActual,
      numero_convocatoria: Number(val.numero_convocatoria) || this.siguienteNumeroConvocatoria,
      nombre: val.nombre,
      fecha_inicio: val.fecha_inicio,
      fecha_fin: val.fecha_fin,
      mes_defensa: val.mes_defensa || undefined,
      descripcion: val.descripcion || '',
      numero_tribunales: Number(val.numero_tribunales) || 3,
      es_activo: !!val.es_activo,
    };
    this.convModalSaving = true;
    this.loading.showModal();
    this.sga.createConvocatoria(payload)
      .pipe(finalize(() => {
        this.loading.hideModal();
        this.convModalSaving = false;
      }))
      .subscribe({
        next: () => {
          this.cancelNewConv();
          this.loadConvocatorias();
        },
        error: (err) => {
          this.errorConvocatorias = err?.message || 'Error al crear la convocatoria';
        }
      });
  }

  startEditConv(conv: Convocatoria) {
    this.editingConv = conv;
    this.ensureEditConvForm();
    const inicio = conv.fecha_inicio ? conv.fecha_inicio.substring(0, 10) : '';
    const fin = conv.fecha_fin ? conv.fecha_fin.substring(0, 10) : '';
    this.convFormError = null;
    this.editConvForm.reset({
      anio: conv.anio || this.anioActual,
      numero_convocatoria: conv.numero_convocatoria || 1,
      nombre: conv.nombre || '',
      fecha_inicio: inicio,
      fecha_fin: fin,
      mes_defensa: conv.mes_defensa || '',
      descripcion: conv.descripcion || '',
      numero_tribunales: conv.numero_tribunales != null ? conv.numero_tribunales : 3,
      es_activo: conv.es_activo,
    });
    this.editConvForm.get('anio')?.disable();
    this.editConvForm.get('numero_convocatoria')?.disable();
    this.convModalSaving = false;
    this.editConvVisible = true;
    this.setBodyModalOpen(true);
  }

  cancelEditConv() {
    this.editConvVisible = false;
    this.editingConv = null;
    this.setBodyModalOpen(false);
  }

  submitEditConv() {
    if (!this.editingConv) {
      return;
    }
    if (this.editConvForm.invalid) {
      this.editConvForm.markAllAsTouched();
      return;
    }
    const val = this.editConvForm.getRawValue();
    this.convFormError = null;
    // Edición: se permite ajustar la fecha de inicio dentro del año en curso.
    const payload: Partial<Convocatoria> = {
      anio: Number(val.anio) || this.editingConv.anio || this.anioActual,
      numero_convocatoria: Number(val.numero_convocatoria) || this.editingConv.numero_convocatoria || 1,
      nombre: val.nombre,
      fecha_inicio: val.fecha_inicio,
      fecha_fin: val.fecha_fin,
      mes_defensa: val.mes_defensa || undefined,
      descripcion: val.descripcion || '',
      numero_tribunales: val.numero_tribunales != null ? Number(val.numero_tribunales) : this.editingConv.numero_tribunales ?? 3,
      es_activo: !!val.es_activo,
    };
    this.convModalSaving = true;
    this.loading.showModal();
    this.sga.updateConvocatoria(this.editingConv.id, payload)
      .pipe(finalize(() => {
        this.loading.hideModal();
        this.convModalSaving = false;
      }))
      .subscribe({
        next: () => {
          this.cancelEditConv();
          this.loadConvocatorias();
        },
        error: (err) => {
          this.errorConvocatorias = err?.message || 'Error al actualizar la convocatoria';
        }
      });
  }

  onConvocatoriaToggleChange(conv: Convocatoria, ev: Event) {
    if (this.togglingConvocatoriaId === conv.id) {
      return;
    }
    const input = ev.target as HTMLInputElement;
    const desiredActive = !!input?.checked;
    const previousState = conv.es_activo;

    if (!desiredActive) {
      if (input) {
        input.checked = previousState;
      }
      this.openConfirmModal(
        'Desactivar convocatoria',
        `¿Seguro que deseas desactivar "${conv.nombre}"?`,
        'Desactivar',
        () => this.executeConvocatoriaToggle(conv, previousState)
      );
      return;
    }

    if (desiredActive !== previousState) {
      conv.es_activo = desiredActive;
      this.executeConvocatoriaToggle(conv, previousState);
    }
  }

  private executeConvocatoriaToggle(conv: Convocatoria, previousState: boolean) {
    this.togglingConvocatoriaId = conv.id;
    this.sga.toggleConvocatoria(conv.id)
      .pipe(finalize(() => {
        this.togglingConvocatoriaId = null;
      }))
      .subscribe({
        next: (resp: ConvocatoriaToggleResponse) => {
          if (resp && typeof resp.es_activo === 'boolean') {
            conv.es_activo = resp.es_activo;
          } else {
            conv.es_activo = !previousState;
          }
        },
        error: (err: any) => {
          conv.es_activo = previousState;
          this.errorConvocatorias = err?.message || 'Error al actualizar el estado de la convocatoria';
        }
      });
  }

  onUsuarioToggleChange(user: Usuario, ev: Event) {
    if (this.togglingUsuarioId === user.id) {
      return;
    }
    const input = ev.target as HTMLInputElement;
    const desiredActive = !!input?.checked;
    const previousState = user.activo;

    if (!desiredActive) {
      if (input) {
        input.checked = previousState;
      }
      this.openConfirmModal(
        'Desactivar usuario',
        `¿Seguro que deseas desactivar al usuario "${user.nombre_usuario}"?`,
        'Desactivar',
        () => this.executeUsuarioToggle(user, previousState)
      );
      return;
    }

    if (desiredActive !== previousState) {
      user.activo = desiredActive;
      this.executeUsuarioToggle(user, previousState);
    }
  }

  private executeUsuarioToggle(user: Usuario, previousState: boolean) {
    this.togglingUsuarioId = user.id;
    this.sga.toggleUsuario(user.id)
      .pipe(finalize(() => {
        this.togglingUsuarioId = null;
      }))
      .subscribe({
        next: (resp: ApiResponse<Usuario>) => {
          if (resp?.success && resp.data) {
            user.activo = !!resp.data.activo;
          } else if ((resp as unknown as Usuario)?.activo !== undefined) {
            user.activo = !!(resp as unknown as Usuario).activo;
          } else {
            user.activo = !previousState;
          }
        },
        error: (err: any) => {
          user.activo = previousState;
          this.errorUsuarios = err?.message || 'Error al actualizar el estado del usuario';
        }
      });
  }

  deleteConvocatoria(conv: Convocatoria) {
    if (this.deletingConvocatoriaId === conv.id) {
      return;
    }
    const confirmed = typeof window !== 'undefined' ? window.confirm('¿Eliminar esta convocatoria?') : true;
    if (!confirmed) {
      return;
    }
    this.deletingConvocatoriaId = conv.id;
    this.sga.deleteConvocatoria(conv.id).subscribe({
      next: () => {
        this.convocatorias = this.convocatorias.filter(c => c.id !== conv.id);
        this.deletingConvocatoriaId = null;
      },
      error: (err) => {
        this.errorConvocatorias = err?.message || 'Error al eliminar la convocatoria';
        this.deletingConvocatoriaId = null;
      }
    });
  }

  onNewUsernameInput(ev: Event) {
    const el = ev.target as HTMLInputElement;
    const v = (el.value || '').replace(/[^A-Za-z0-9_]/g, '');
    if (v !== el.value) el.value = v;
    this.newUserForm.get('nombre_usuario')?.setValue(v);
  }

  onEditUsernameInput(ev: Event) {
    const el = ev.target as HTMLInputElement;
    const v = (el.value || '').replace(/[^A-Za-z0-9_]/g, '');
    if (v !== el.value) el.value = v;
    this.editUserForm.get('nombre_usuario')?.setValue(v);
  }

  onNewPasswordInput(ev: Event, control: 'contrasena' | 'contrasena_confirmation') {
    const el = ev.target as HTMLInputElement;
    const v = (el.value || '').replace(/\s+/g, '');
    if (v !== el.value) el.value = v;
    this.newUserForm.get(control)?.setValue(v);
  }

  onEditPasswordInput(ev: Event, control: 'contrasena' | 'contrasena_confirmation') {
    const el = ev.target as HTMLInputElement;
    const v = (el.value || '').replace(/\s+/g, '');
    if (v !== el.value) el.value = v;
    this.editUserForm.get(control)?.setValue(v);
  }
}
