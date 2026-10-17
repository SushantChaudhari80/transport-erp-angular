import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AdminAuthService } from '../services/admin-auth.service';

export const adminAuthGuard: CanActivateFn = () => {
  const auth = inject(AdminAuthService);
  return auth.isAuthenticated() || inject(Router).createUrlTree(['/admin/login']);
};
