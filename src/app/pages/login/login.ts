import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent {
  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
  ) {}

  readonly showPassword = signal(false);
  readonly loading = signal(false);

  readonly username = signal('');
  readonly password = signal('');
  readonly error = signal('');

  login(): void {
    if (this.loading()) {
      return;
    }

    if (!this.username().trim() || !this.password()) {
      this.error.set('Please enter username and password.');
      return;
    }

    this.error.set('');
    this.loading.set(true);

    this.authService.login(
      this.username().trim(),
      this.password(),
    ).pipe(
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: (response) => {
        if (response.message === 'success') {
          void this.router.navigate(['/dashboard']);
        } else {
          this.error.set(response.message || 'Invalid username or password.');
        }
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(
          error.status === 401 || error.status === 403
            ? 'Invalid username or password.'
            : error.status === 0
              ? 'Unable to reach the sign-in service. Please try again.'
              : 'Sign-in failed. Please try again.',
        );
      }
    });
  }
}