import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AdminAuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly sessionKey = 'transport-admin-authenticated';

  authenticate(username: string, password: string): boolean {
    const valid =
      username.trim().toLowerCase() === 'chaudharisushant80@gmail.com' &&
      password === 'Tanvi@2026';

    if (valid && isPlatformBrowser(this.platformId)) {
      sessionStorage.setItem(this.sessionKey, 'true');
    }

    return valid;
  }

  isAuthenticated(): boolean {
    return (
      isPlatformBrowser(this.platformId) &&
      sessionStorage.getItem(this.sessionKey) === 'true'
    );
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.removeItem(this.sessionKey);
    }
  }
}
