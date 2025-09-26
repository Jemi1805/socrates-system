import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PostulantesListComponent } from './features/admin/postulantes/postulantes-list.component';
import { ModalidadGraduacionComponent } from './features/admin/modalidades/modalidad-graduacion.component';
import { PostulantesComponent } from './components/postulantes.component';
import { RegistroTemaComponent } from './features/admin/proyectos/registro-tema.component';

export const routes: Routes = [
  { path: '', component: ModalidadGraduacionComponent },
  { path: 'postulantes', component: PostulantesListComponent },
  { path: 'modalidad-graduacion', component: ModalidadGraduacionComponent },
  { path: 'registro-tema', component: RegistroTemaComponent },
  // Nota: no usar redirección vacía para evitar conflictos con la ruta '' ya definida
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }