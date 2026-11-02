import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Host } from './host';

export type IncidentCategory = 'Vehicle' | 'Driver' | 'Trip' | 'Payment' | 'Application' | 'Other';
export type IncidentPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type IncidentStatus = 'Open' | 'In Progress' | 'Resolved';
export type IncidentStatusRequest = 'Open' | 'In_Progress' | 'Resolved';

export interface Incident {
  id: number;
  incidentCode: string;
  title: string;
  category: IncidentCategory;
  priority: IncidentPriority;
  status: IncidentStatus;
  description: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentComment {
  id: number;
  incidentId: number;
  commentText: string;
  commentedBy: string;
  createdAt: string;
}

export interface CreateIncidentRequest {
  title: string;
  category: IncidentCategory;
  priority: IncidentPriority;
  createdBy: string;
  description: string;
}

@Injectable({ providedIn: 'root' })
export class IncidentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = Host.API_URL.replace(/\/+$/, '');
  private readonly incidentsUrl = `${this.apiUrl}/api/incidents`;

  listIncidents(): Observable<Incident[]> {
    return this.http.get<Incident[]>(this.incidentsUrl);
  }

  createIncident(request: CreateIncidentRequest): Observable<Incident> {
    return this.http.post<Incident>(this.incidentsUrl, request);
  }

  getIncident(id: number): Observable<Incident> {
    return this.http.get<Incident>(`${this.incidentsUrl}/${id}`);
  }

  updateIncidentStatus(id: number, status: IncidentStatusRequest): Observable<Incident> {
    return this.http.patch<Incident>(`${this.incidentsUrl}/${id}/status`, { status });
  }

  listComments(id: number): Observable<IncidentComment[]> {
    return this.http.get<IncidentComment[]>(`${this.incidentsUrl}/${id}/comments`);
  }

  addComment(id: number, comment: string): Observable<IncidentComment> {
    return this.http.post<IncidentComment>(`${this.incidentsUrl}/${id}/comments`, {
      comment,
      commentedBy: 'Admin',
    });
  }
}
