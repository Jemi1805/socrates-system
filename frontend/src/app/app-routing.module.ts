import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PostulantesListComponent } from './features/admin/postulantes/postulantes-list.component';
import { ModalidadGraduacionComponent } from './features/admin/modalidades/modalidad-graduacion.component';
import { PostulantesComponent } from './components/postulantes.component';

export const routes: Routes = [
  { path: '', component: ModalidadGraduacionComponent },
  { path: 'postulantes', component: PostulantesListComponent },
  { path: 'modalidad-graduacion', component: ModalidadGraduacionComponent },
  { path: 'postulantes', component: PostulantesComponent },
  { path: '', redirectTo: 'postulantes', pathMatch: 'full' }
  // Puedes agregar más rutas aquí
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }