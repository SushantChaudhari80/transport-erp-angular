import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AdminAuthService } from '../../core/services/admin-auth.service';

@Component({
  selector: 'app-admin-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLoginComponent {
  readonly username = signal('');
  readonly password = signal('');
  readonly showPassword = signal(false);
  readonly error = signal('');

  constructor(
    private readonly auth: AdminAuthService,
    private readonly router: Router,
  ) {
    if (this.auth.isAuthenticated()) {
      void this.router.navigate(['/admin/chatbot']);
    }
  }

  login(): void {
    if (this.auth.authenticate(this.username(), this.password())) {
      this.error.set('');
      void this.router.navigate(['/admin/chatbot']);
      return;
    }

    this.error.set('Those credentials don’t match an admin account. Try again.');
  }
}
