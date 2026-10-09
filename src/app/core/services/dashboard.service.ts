import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Customer, DashboardStats } from '../../models/dashboard.model';
import { Host } from './host';

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${Host.API_URL}api/customers`;

  getStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.baseUrl}/dashboard/utilitis`);
  }

  getCustomer(): Observable<Customer> {
    return this.http.get<Customer>(`${this.baseUrl}/get`);
  }
}