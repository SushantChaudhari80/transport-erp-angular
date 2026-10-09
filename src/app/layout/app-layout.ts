import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { DashboardService } from '../core/services/dashboard.service';
import { Customer } from '../models/dashboard.model';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.css',
})
export class AppLayoutComponent {
  private readonly dashboardService = inject(DashboardService);
  private readonly router = inject(Router);

  readonly mobileMenuOpen = signal(false);
  readonly sidebarCollapsed = signal(false);
  readonly tripsSubmenuOpen = signal(false);
  readonly machineReadingSubmenuOpen = signal(false);
  readonly profileOpen = signal(false);
  readonly profileLoading = signal(true);
  readonly profileError = signal('');
  readonly customer = signal<Customer | null>(null);

  constructor() {
    this.dashboardService.getCustomer().subscribe({
      next: (customer) => {
        this.customer.set(customer);
        this.profileLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load account profile:', error);
        this.profileError.set('Profile details could not be loaded.');
        this.profileLoading.set(false);
      },
    });
  }

  toggleMenu(): void {
    if (window.innerWidth <= 800) {
      this.mobileMenuOpen.update((isOpen) => !isOpen);
      return;
    }

    this.sidebarCollapsed.update((isCollapsed) => !isCollapsed);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  toggleTripsSubmenu(): void {
    this.tripsSubmenuOpen.update((isOpen) => !isOpen);
  }

  toggleMachineReadingSubmenu(): void {
    this.machineReadingSubmenuOpen.update((isOpen) => !isOpen);
  }

  toggleProfile(): void {
    this.profileOpen.update((isOpen) => !isOpen);
  }

  closeProfile(): void {
    this.profileOpen.set(false);
  }

  logout(): void {
    this.closeProfile();
    void this.router.navigate(['/login']);
  }

  get customerPicture(): string | null {
    const picture = this.customer()?.picture;

    if (!picture) {
      return null;
    }

    return picture.startsWith('data:') ? picture : `data:image/png;base64,${picture}`;
  }

  get customerInitial(): string {
    return this.customer()?.name?.trim().charAt(0).toUpperCase() || 'A';
  }
}
