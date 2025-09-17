import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { PostulantesListComponent } from './features/admin/postulantes/postulantes-list.component';
import { ModalidadGraduacionComponent } from './features/admin/modalidades/modalidad-graduacion.component';
import { TutoresHomeComponent } from './features/admin/tutores/tutores-home.component';
import { RegistrarTutorComponent } from './features/admin/tutores/registrar-tutor.component';
import { DesignarTutorComponent } from './features/admin/tutores/designar-tutor.component';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'modalidad-graduacion', component: ModalidadGraduacionComponent },
  { path: 'postulantes', component: PostulantesListComponent },
  { path: 'tutores', component: TutoresHomeComponent },
  { path: 'tutores/registrar', component: RegistrarTutorComponent },
  { path: 'tutores/designar', component: DesignarTutorComponent },
  // Puedes agregar más rutas aquí
];