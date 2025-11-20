import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { PostulantesListComponent } from './features/admin/postulantes/postulantes-list.component';
import { ModalidadGraduacionComponent } from './features/admin/modalidades/modalidad-graduacion.component';
import { TutoresHomeComponent } from './features/admin/tutores/tutores-home.component';

import { DesignarTutorComponent } from './features/admin/tutores/designar-tutor.component';
import { RegistroTemaComponent } from './features/admin/proyectos/registro-tema.component';
import { ConfiguracionComponent } from './features/admin/configuracion/configuracion.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/postulantes', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'modalidad-graduacion', component: ModalidadGraduacionComponent, canActivate: [authGuard] },
  { path: 'postulantes/nuevo', component: PostulantesListComponent, canActivate: [authGuard] },
  { path: 'postulantes/nuevo/:cod_ceta', component: PostulantesListComponent, canActivate: [authGuard] },
  { path: 'postulantes/registro_nuevo', component: PostulantesListComponent, canActivate: [authGuard] },
  { path: 'postulantes/registro_nuevo/:cod_ceta', component: PostulantesListComponent, canActivate: [authGuard] },
  { path: 'postulantes/inscripcion/:cod_ceta', component: PostulantesListComponent, canActivate: [authGuard] },
  { path: 'postulantes/:cod_ceta', component: PostulantesListComponent, canActivate: [authGuard] },
  { path: 'postulantes', component: PostulantesListComponent, canActivate: [authGuard] },
  { path: 'registro-tema', component: RegistroTemaComponent, canActivate: [authGuard] },
  { path: 'tutores', component: TutoresHomeComponent, canActivate: [authGuard] },
  { path: 'tutores/designar', component: DesignarTutorComponent, canActivate: [authGuard] },
  { path: 'configuracion', component: ConfiguracionComponent, canActivate: [authGuard] },

  // Puedes agregar más rutas aquí
];