import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { SgaService, Usuario, Pertinencia, Rol } from '../../../shared/services/sga.service';
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
          this.usuarios = resp.data || [];
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
    // Resetear formulario de creación
    this.newUserForm.reset({
      nombre: '', apellido_p: '', apellido_m: '',
      nombre_usuario: '', email: '',
      contrasena: '', contrasena_confirmation: '',
      rol_id: null, activo: true,
    });
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
          this.pertinencias = resp.data || [];
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
}
