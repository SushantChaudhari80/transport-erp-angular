import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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

  showPassword = false;
  loading = false;

  username = '';
  password = '';
  error = '';

  login(): void {
    if (this.loading) {
      return;
    }

    if (!this.username.trim() || !this.password) {
      this.error = 'Please enter username and password.';
      return;
    }

    this.error = '';
    this.loading = true;

    this.authService.login(
      this.username.trim(),
      this.password
    ).subscribe({

      next: (response) => {

        console.log('Login API response:', response);

        this.loading = false;

        if (response.message === 'success') {

          void this.router.navigate(['/dashboard']);

        } else {

          this.error = response.message || 'Invalid username or password.';

        }
      },

      error: (error: HttpErrorResponse) => {

        this.loading = false;

        console.error('Login API error:', error);

        this.error =
          error.status === 401 || error.status === 403
            ? 'Invalid username or password.'
            : error.status === 0
              ? 'Unable to reach the sign-in service. Please try again.'
              : 'Sign-in failed. Please try again.';
      }
    });
  }
}