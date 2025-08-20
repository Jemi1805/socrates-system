import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  @Input() pageTitle: string = '';
  @Input() showBreadcrumb: boolean = false;
  @Input() breadcrumbItems: Array<{label: string, route?: string}> = [];
  @Output() toggleSidebarEvent = new EventEmitter<void>();

  currentUser = {
    name: 'Administrador',
    role: 'Admin'
  };

  // Menú de navegación
  menuItems = [
    { label: 'Modalidad de Graduación', route: '/modalidad-graduacion', active: true },
    { label: 'Tutores', route: '/tutores', active: false },
    { label: 'Seguimiento de Proyecto', route: '/seguimiento-proyecto', active: false },
    { label: 'Defensa', route: '/defensa', active: false },
    { label: 'Seguimiento del trámite', route: '/seguimiento-tramite', active: false }
  ];

  toggleSidebar() {
    this.toggleSidebarEvent.emit();
  }

  logout() {
    // Aquí puedes implementar la lógica de logout
    console.log('Logout');
  }

  setActiveItem(route: string) {
    this.menuItems.forEach(item => {
      item.active = item.route === route;
    });
  }
} 