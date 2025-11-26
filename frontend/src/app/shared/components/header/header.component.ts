import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Input() pageTitle: string = '';
  @Input() showBreadcrumb: boolean = false;
  @Input() breadcrumbItems: Array<{label: string, route?: string}> = [];
  @Output() toggleSidebarEvent = new EventEmitter<void>();

  currentUser = { name: '', role: '' };

  private authSub?: Subscription;
  dropdownOpen = false;

  constructor(private auth: AuthService, private router: Router, private elRef: ElementRef) {}

  ngOnInit(): void {
    this.refreshCurrentUser();
    this.authSub = this.auth.isAuthenticated$.subscribe(() => {
      this.refreshCurrentUser();
    });
    // Refrescar desde backend si hay token
    if (this.auth.isLoggedIn()) {
      this.auth.me().subscribe({
        next: () => this.refreshCurrentUser(),
        error: () => {/* silencioso */}
      });
    }
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
  }

  private refreshCurrentUser(): void {
    const u = this.auth.getUser();
    this.currentUser = {
      name: this.computeDisplayName(u),
      role: this.computeDisplayRole(u)
    };
  }

  private computeDisplayName(u: any): string {
    if (!u) return 'Invitado';
    const fullName = [u?.nombre, u?.apellido_p, u?.apellido_m].filter(Boolean).join(' ').trim();
    return u?.nombre_usuario || fullName || u?.name || u?.email || 'Invitado';
  }

  private computeDisplayRole(u: any): string {
    if (!u) return '-';
    return u?.rol?.nombre || u?.role?.display_name || u?.role?.name || '-';
  }

  // Menú de navegación
  menuItems = [
    { label: 'Postulantes inscritos', route: '/postulantes', active: true },
    { label: 'Inscripción de postulantes', route: '/modalidad-graduacion', active: false },
    { label: 'Tutores', route: '/tutores', active: false },
    { label: 'Tribunales', route: '/tribunales', active: false },
    { label: 'Defensa', route: '/defensa', active: false },
    { label: 'Seguimiento del trámite', route: '/seguimiento-tramite', active: false }
  ];

  toggleSidebar() {
    this.toggleSidebarEvent.emit();
  }

  toggleUserMenu() {
    this.dropdownOpen = !this.dropdownOpen;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.dropdownOpen && this.elRef && !this.elRef.nativeElement.contains(event.target)) {
      this.dropdownOpen = false;
    }
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  setActiveItem(route: string) {
    this.menuItems.forEach(item => {
      item.active = item.route === route;
    });
  }
} 