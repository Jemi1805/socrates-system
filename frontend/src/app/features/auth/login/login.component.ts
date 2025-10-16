import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  credentials = {
    nombre_usuario: '',
    password: ''
  };
  
  loading = false;
  error = '';
  passwordVisible = false;
  private returnUrl = '/modalidad-graduacion';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    const ret = this.route.snapshot.queryParamMap.get('returnUrl');
    if (ret) this.returnUrl = ret;
  }

  onSubmit() {
    this.loading = true;
    this.error = '';
    this.credentials = {
      nombre_usuario: (this.credentials.nombre_usuario || '').replace(/[^A-Za-z0-9_]/g, ''),
      password: (this.credentials.password || '').replace(/\s+/g, ''),
    };

    this.authService.login(this.credentials).subscribe({
      next: (response) => {
        this.loading = false;
        this.router.navigate([this.returnUrl]);
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Credenciales inválidas';
        console.error('Error de login:', error);
      }
    });
  }
  
  togglePasswordVisibility() {
    this.passwordVisible = !this.passwordVisible;
  }

  onUsernameInput(ev: Event) {
    const el = ev.target as HTMLInputElement;
    const sanitized = (el.value || '').replace(/[^A-Za-z0-9_]/g, '');
    if (sanitized !== el.value) {
      el.value = sanitized;
      this.credentials.nombre_usuario = sanitized;
    }
  }

  onPasswordInput(ev: Event) {
    const el = ev.target as HTMLInputElement;
    const sanitized = (el.value || '').replace(/\s+/g, '');
    if (sanitized !== el.value) {
      el.value = sanitized;
      this.credentials.password = sanitized;
    }
  }
}