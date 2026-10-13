import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  Injector,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Host } from '../../core/services/host';

type IncidentCategory = 'Vehicle' | 'Driver' | 'Trip' | 'Payment' | 'Application' | 'Other';
type IncidentPriority = 'Low' | 'Medium' | 'High' | 'Critical';
type IncidentStatus = 'Open' | 'In Progress' | 'Resolved';
type IncidentStatusRequest = 'Open' | 'In_Progress' | 'Resolved';

interface Incident {
  id: number;
  incidentCode?: string;
  title: string;
  category: IncidentCategory;
  priority: IncidentPriority;
  status: IncidentStatus;
  description: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

interface IncidentComment {
  id: number;
  incidentId: number;
  commentText: string;
  commentedBy: string;
  createdAt: string;
}

interface IncidentForm {
  title: string;
  category: IncidentCategory | '';
  priority: IncidentPriority;
  description: string;
}

const CATEGORIES: IncidentCategory[] = [
  'Vehicle',
  'Driver',
  'Trip',
  'Payment',
  'Application',
  'Other',
];
const PRIORITIES: IncidentPriority[] = ['Low', 'Medium', 'High', 'Critical'];
const STATUSES: IncidentStatus[] = ['Open', 'In Progress', 'Resolved'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isIncidentCategory(value: unknown): value is IncidentCategory {
  return typeof value === 'string' && CATEGORIES.some((category) => category === value);
}

function isIncidentPriority(value: unknown): value is IncidentPriority {
  return typeof value === 'string' && PRIORITIES.some((priority) => priority === value);
}

function isIncidentStatus(value: unknown): value is IncidentStatus {
  return typeof value === 'string' && STATUSES.some((status) => status === value);
}

function normalizeIncidentStatus(value: unknown): IncidentStatus | null {
  if (value === 'In_Progress') {
    return 'In Progress';
  }
  return isIncidentStatus(value) ? value : null;
}

function isIncident(value: unknown): value is Incident {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value['id'] === 'number' &&
    (value['incidentCode'] === undefined || typeof value['incidentCode'] === 'string') &&
    typeof value['title'] === 'string' &&
    isIncidentCategory(value['category']) &&
    isIncidentPriority(value['priority']) &&
    normalizeIncidentStatus(value['status']) !== null &&
    typeof value['description'] === 'string' &&
    typeof value['createdBy'] === 'string' &&
    typeof value['createdAt'] === 'string'
  );
}

function isIncidentComment(value: unknown): value is IncidentComment {
  return (
    isRecord(value) &&
    typeof value['id'] === 'number' &&
    typeof value['incidentId'] === 'number' &&
    typeof value['commentText'] === 'string' &&
    typeof value['commentedBy'] === 'string' &&
    typeof value['createdAt'] === 'string'
  );
}

function getErrorMessage(error: HttpErrorResponse, fallback: string): string {
  if (typeof error.error === 'string' && error.error.trim()) {
    return error.error;
  }
  if (isRecord(error.error)) {
    for (const key of ['message', 'detail', 'title']) {
      const message = error.error[key];
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }
  }
  return fallback;
}

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './support.component.html',
  styleUrl: './support.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly injector = inject(Injector);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly apiUrl = Host.API_URL.replace(/\/+$/, '');
  private readonly incidentsUrl = `${this.apiUrl}/api/incidents`;

  readonly categories = CATEGORIES;
  readonly priorities = PRIORITIES;
  readonly statuses = STATUSES;
  incidents: Incident[] = [];
  incidentComments: IncidentComment[] = [];
  searchTerm = '';
  statusFilter: IncidentStatus | '' = '';
  loadingIncidents = false;
  savingIncident = false;
  updatingIncidentId: number | null = null;
  loadingComments = false;
  savingComment = false;
  showCreateForm = false;
  selectedIncident: Incident | null = null;
  commentDraft = '';
  errorMessage = '';
  commentErrorMessage = '';
  commentSuccessMessage = '';
  successMessage = '';
  form: IncidentForm = this.emptyForm();

  @ViewChild('commentList')
  private commentList?: ElementRef<HTMLOListElement>;

  get filteredIncidents(): Incident[] {
    const query = this.searchTerm.trim().toLowerCase();
    return this.incidents.filter((incident) => {
      const matchesStatus = !this.statusFilter || incident.status === this.statusFilter;
      const matchesSearch =
        !query ||
        [
          incident.incidentCode ?? String(incident.id),
          incident.title,
          incident.category,
          incident.priority,
          incident.description,
        ].some((value) => value.toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }

  get openCount(): number {
    return this.incidents.filter((incident) => incident.status === 'Open').length;
  }

  get inProgressCount(): number {
    return this.incidents.filter((incident) => incident.status === 'In Progress').length;
  }

  get resolvedCount(): number {
    return this.incidents.filter((incident) => incident.status === 'Resolved').length;
  }

  ngOnInit(): void {
    this.loadIncidents();
  }

  loadIncidents(): void {
    if (!this.browser) {
      return;
    }

    this.loadingIncidents = true;
    this.http.get<unknown>(this.incidentsUrl).subscribe({
      next: (response) => {
        if (!Array.isArray(response) || !response.every(isIncident)) {
          console.error('Unexpected incident response from API:', response);
          this.errorMessage = 'The incident service returned data in an unexpected format.';
          this.incidents = [];
        } else {
          this.incidents = response
            .map((incident) => ({
              ...incident,
              status: normalizeIncidentStatus(incident.status) ?? 'Open',
            }))
            .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
          this.errorMessage = '';
        }
        this.loadingIncidents = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load incidents:', error);
        this.errorMessage = getErrorMessage(error, 'Unable to load incidents. Please try again.');
        this.loadingIncidents = false;
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  openCreateForm(): void {
    this.form = this.emptyForm();
    this.errorMessage = '';
    this.showCreateForm = true;
  }

  closeCreateForm(): void {
    this.showCreateForm = false;
    this.errorMessage = '';
  }

  createIncident(): void {
    const title = this.form.title.trim();
    const description = this.form.description.trim();
    if (
      !title ||
      title.length > 200 ||
      !description ||
      description.length > 2000 ||
      !isIncidentCategory(this.form.category) ||
      !isIncidentPriority(this.form.priority)
    ) {
      this.errorMessage = 'Enter valid incident details before submitting.';
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.savingIncident = true;
    this.errorMessage = '';
    const request = {
      title,
      category: this.form.category,
      priority: this.form.priority,
      createdBy: 'Web UI User',
      description,
    };
    this.http.post<unknown>(this.incidentsUrl, request).subscribe({
      next: (response) => {
        if (!isIncident(response)) {
          console.error('Unexpected incident creation response from API:', response);
          this.errorMessage = 'The incident was submitted, but the service returned invalid data.';
          this.savingIncident = false;
          this.changeDetectorRef.markForCheck();
          return;
        }

        const incident: Incident = {
          ...response,
          status: normalizeIncidentStatus(response.status) ?? 'Open',
        };
        this.incidents = [incident, ...this.incidents]
          .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
        this.showCreateForm = false;
        this.form = this.emptyForm();
        this.successMessage = 'Incident created successfully.';
        this.savingIncident = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to create incident:', error);
        this.errorMessage = getErrorMessage(error, 'Unable to create incident. Please try again.');
        this.savingIncident = false;
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  updateStatus(incident: Incident, status: IncidentStatus): void {
    if (!STATUSES.includes(status) || status === incident.status || this.updatingIncidentId !== null) {
      return;
    }

    this.updatingIncidentId = incident.id;
    this.errorMessage = '';
    this.http
      .patch<unknown>(`${this.incidentsUrl}/${incident.id}/status`, {
        status: this.toStatusRequest(status),
      })
      .subscribe({
        next: (response) => {
          if (!isIncident(response)) {
            console.error('Unexpected incident status response from API:', response);
            this.errorMessage = 'The status may have changed, but the service returned invalid data.';
            this.updatingIncidentId = null;
            this.changeDetectorRef.markForCheck();
            return;
          }

          const updatedIncident: Incident = {
            ...response,
            status: normalizeIncidentStatus(response.status) ?? status,
          };
          this.incidents = this.incidents
            .map((item) => item.id === incident.id ? updatedIncident : item)
            .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
          if (this.selectedIncident?.id === incident.id) {
            this.selectedIncident = updatedIncident;
          }
          this.successMessage = `Incident status updated to ${updatedIncident.status}.`;
          this.updatingIncidentId = null;
          this.changeDetectorRef.markForCheck();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Unable to update incident status:', error);
          this.errorMessage = getErrorMessage(error, 'Unable to update incident status.');
          this.updatingIncidentId = null;
          this.changeDetectorRef.markForCheck();
        },
      });
  }

  onStatusChange(incident: Incident, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (isIncidentStatus(value)) {
      this.updateStatus(incident, value);
    }
  }

  openIncident(incident: Incident): void {
    this.selectedIncident = incident;
    this.incidentComments = [];
    this.commentDraft = '';
    this.commentErrorMessage = '';
    this.commentSuccessMessage = '';
    this.loadComments(incident);
  }

  closeIncidentDetails(): void {
    this.selectedIncident = null;
    this.incidentComments = [];
    this.commentDraft = '';
  }

  loadComments(incident: Incident): void {
    this.loadingComments = true;
    this.commentErrorMessage = '';
    this.http.get<unknown>(`${this.incidentsUrl}/${incident.id}/comments`).subscribe({
      next: (response) => {
        if (!Array.isArray(response) || !response.every(isIncidentComment)) {
          console.error('Unexpected incident comments response from API:', response);
          this.commentErrorMessage = 'The comment service returned data in an unexpected format.';
          this.incidentComments = [];
        } else if (this.selectedIncident?.id === incident.id) {
          this.incidentComments = [...response].sort(
            (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
          );
        }
        this.loadingComments = false;
        this.changeDetectorRef.markForCheck();
        this.scrollCommentsToLatest();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load incident comments:', error);
        this.commentErrorMessage = getErrorMessage(error, 'Unable to load comments. Please try again.');
        this.loadingComments = false;
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  addComment(): void {
    const incident = this.selectedIncident;
    const comment = this.commentDraft.trim();
    if (!incident || !comment || comment.length > 5000 || this.savingComment) {
      return;
    }

    this.savingComment = true;
    this.commentErrorMessage = '';
    this.http
      .post<unknown>(`${this.incidentsUrl}/${incident.id}/comments`, {
        comment,
        commentedBy: 'Web UI User',
      })
      .subscribe({
        next: (response) => {
          if (!isIncidentComment(response)) {
            console.error('Unexpected incident comment response from API:', response);
            this.commentErrorMessage =
              'The comment was submitted, but the service returned invalid data.';
            this.savingComment = false;
            this.changeDetectorRef.markForCheck();
            return;
          }

          if (this.selectedIncident?.id === incident.id) {
            this.incidentComments = [...this.incidentComments, response].sort(
              (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
            );
            this.commentDraft = '';
            this.commentSuccessMessage = 'Comment added successfully.';
          }
          this.savingComment = false;
          this.changeDetectorRef.markForCheck();
          this.scrollCommentsToLatest();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Unable to add incident comment:', error);
          this.commentErrorMessage = getErrorMessage(error, 'Unable to add comment. Please try again.');
          this.savingComment = false;
          this.changeDetectorRef.markForCheck();
        },
      });
  }

  formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(date);
  }

  incidentLabel(incident: Incident): string {
    return incident.incidentCode || `INC-${incident.id}`;
  }

  isUserComment(comment: IncidentComment): boolean {
    return comment.commentedBy.trim().toLowerCase() === 'web ui user';
  }

  private toStatusRequest(status: IncidentStatus): IncidentStatusRequest {
    return status === 'In Progress' ? 'In_Progress' : status;
  }

  private scrollCommentsToLatest(): void {
    afterNextRender(() => {
      const list = this.commentList?.nativeElement;
      if (list) {
        list.scrollTop = list.scrollHeight;
      }
    }, { injector: this.injector });
  }

  private emptyForm(): IncidentForm {
    return {
      title: '',
      category: '',
      priority: 'Medium',
      description: '',
    };
  }
}
