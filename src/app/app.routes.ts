import { Routes } from '@angular/router';
import { adminAuthGuard } from './core/guards/admin-auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login').then(({ LoginComponent }) => LoginComponent),
  },
  {
    path: 'admin',
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./pages/admin-login/admin-login.component').then(
            ({ AdminLoginComponent }) => AdminLoginComponent,
          ),
      },
      {
        path: '',
        canActivate: [adminAuthGuard],
        loadComponent: () =>
          import('./layout/admin-layout.component').then(
            ({ AdminLayoutComponent }) => AdminLayoutComponent,
          ),
        children: [
          {
            path: '',
            pathMatch: 'full',
            redirectTo: 'chatbot',
          },
          {
            path: 'chatbot',
            loadComponent: () =>
              import('./pages/admin-chatbot/admin-chatbot.component').then(
                ({ AdminChatbotComponent }) => AdminChatbotComponent,
              ),
          },
        ],
      },
    ],
  },
  {
    path: '',
    loadComponent: () =>
      import('./layout/app-layout').then(({ AppLayoutComponent }) => AppLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(
            ({ DashboardComponent }) => DashboardComponent,
          ),
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./pages/orders/orders.component').then(
            ({ OrdersComponent }) => OrdersComponent,
          ),
      },
      {
        path: 'drivers',
        loadComponent: () =>
          import('./pages/drivers/drivers.component').then(
            ({ DriversComponent }) => DriversComponent,
          ),
      },
      {
        path: 'driver-payment',
        loadComponent: () =>
          import('./pages/driver-payment/driver-payment.component').then(
            ({ DriverPaymentComponent }) => DriverPaymentComponent,
          ),
      },
      {
        path: 'vehicles',
        loadComponent: () =>
          import('./pages/vehicles/vehicles.component').then(
            ({ VehiclesComponent }) => VehiclesComponent,
          ),
      },
      {
        path: 'vehicle-details',
        loadComponent: () =>
          import('./pages/vehicle-details/vehicle-details.component').then(
            ({ VehicleDetailsComponent }) => VehicleDetailsComponent,
          ),
      },
      {
        path: 'trips',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./pages/treep/treep.component').then(
                ({ TreepComponent }) => TreepComponent,
              ),
          },
          {
            path: 'billed',
            loadComponent: () =>
              import('./pages/billed-trips/billed-trips.component').then(
                ({ BilledTripsComponent }) => BilledTripsComponent,
              ),
          },
          {
            path: 'unbilled',
            loadComponent: () =>
              import('./pages/unbilled-trips/unbilled-trips.component').then(
                ({ UnbilledTripsComponent }) => UnbilledTripsComponent,
              ),
          },
        ],
      },
      {
        path: 'machine-reading',
        children: [
          {
            path: 'unbilled',
            loadComponent: () =>
              import('./pages/unbilled-reading/unbilled-reading.component').then(
                ({ UnbilledReadingComponent }) => UnbilledReadingComponent,
              ),
          },
          {
            path: 'billed',
            loadComponent: () =>
              import('./pages/billed-reading/billed-reading.component').then(
                ({ BilledReadingComponent }) => BilledReadingComponent,
              ),
          },
        ],
      },
      {
        path: 'treep',
        redirectTo: 'trips',
        pathMatch: 'full',
      },
      {
        path: 'quotation',
        loadComponent: () =>
          import('./pages/quotation/quotation.component').then(
            ({ QuotationComponent }) => QuotationComponent,
          ),
      },
      {
        path: 'diesel',
        loadComponent: () =>
          import('./pages/diesel-report/diesel-report.component').then(
            ({ DieselReportComponent }) => DieselReportComponent,
          ),
      },
      {
        path: 'payments',
        loadComponent: () =>
          import('./pages/payments/payments.component').then(
            ({ PaymentsComponent }) => PaymentsComponent,
          ),
      },
      {
        path: 'payment-details',
        loadComponent: () =>
          import('./pages/payment-details/payment-details.component').then(
            ({ PaymentDetailsComponent }) => PaymentDetailsComponent,
          ),
      },
      {
        path: 'vouchers',
        loadComponent: () =>
          import('./pages/vouchers/vouchers.component').then(
            ({ VouchersComponent }) => VouchersComponent,
          ),
      },
      {
        path: 'invoices',
        loadComponent: () =>
          import('./pages/invoices/invoices.component').then(
            ({ InvoicesComponent }) => InvoicesComponent,
          ),
      },
      {
        path: 'portfolio',
        loadComponent: () =>
          import('./pages/portfolio/portfolio.component').then(
            ({ PortfolioComponent }) => PortfolioComponent,
          ),
      },
      {
        path: 'support',
        loadComponent: () =>
          import('./pages/support/support.component').then(
            ({ SupportComponent }) => SupportComponent,
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
