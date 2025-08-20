import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { PostulantesListComponent } from './features/admin/postulantes/postulantes-list.component';
import { ModalidadGraduacionComponent } from './features/admin/modalidades/modalidad-graduacion.component';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'modalidad-graduacion', component: ModalidadGraduacionComponent },
  { path: 'postulantes', component: PostulantesListComponent },
  // Puedes agregar más rutas aquí
]; 