import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { SgaService, Usuario, Pertinencia, Rol, Carrera } from '../../../shared/services/sga.service';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

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

  constructor(private sga: SgaService, private fb: FormBuilder) {}

  ngOnInit(): void {
    this.buildNewUserForm();
    this.loadRoles();
  }

  private buildNewUserForm() {
    this.newUserForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(150)]],
      apellido_p: ['', [Validators.maxLength(150)]],
      apellido_m: ['', [Validators.maxLength(150)]],
      nombre_usuario: ['', [Validators.required, Validators.maxLength(255)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      contrasena: ['', [Validators.required, Validators.minLength(8)]],
      contrasena_confirmation: ['', [Validators.required]],
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
      nombre_usuario: '', email: '',
      contrasena: '', contrasena_confirmation: '',
      rol_id: null, activo: true,
    });
    // Limpiar estados de touched/dirty para evitar validaciones previas
    this.newUserForm.markAsPristine();
    this.newUserForm.markAsUntouched();
    this.newUserForm.updateValueAndValidity();

    // Mitigar autofill del navegador: limpiar valores tras el render del modal
    this.clearAutofillInputs();
  }

  private clearAutofillInputs() {
    const clearNow = () => {
      const fields = [
        'nombre_usuario', 'email', 'contrasena', 'contrasena_confirmation'
      ];
      fields.forEach(fc => this.newUserForm.get(fc)?.setValue(''));
      // Forzar limpieza visual en inputs (por si el navegador completó fuera del control)
      const selectors = [
        'input[formControlName="nombre_usuario"]',
        'input[formControlName="email"]',
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
        nombre_usuario: ['', [Validators.required, Validators.maxLength(255)]],
        email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
        contrasena: ['', [Validators.minLength(8)]],
        contrasena_confirmation: [''],
        rol_id: [null, [Validators.required]],
        activo: [true],
      });
    }
    this.editUserForm.reset({
      nombre: user.nombre || '',
      apellido_p: user.apellido_p || '',
      apellido_m: user.apellido_m || '',
      nombre_usuario: user.nombre_usuario,
      email: user.email,
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
      email: formVal.email,
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
}
