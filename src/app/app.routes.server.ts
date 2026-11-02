import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'dashboard',
    renderMode: RenderMode.Client,
  },
  {
    path: 'orders',
    renderMode: RenderMode.Client,
  },
  {
    path: 'drivers',
    renderMode: RenderMode.Client,
  },
  {
    path: 'vehicles',
    renderMode: RenderMode.Client,
  },
  {
    path: 'trips',
    renderMode: RenderMode.Client,
  },
  {
    path: 'quotation',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
