import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AdminAuthService } from '../core/services/admin-auth.service';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayoutComponent {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly router: Router,
  ) {}

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/admin/login']);
  }
}
