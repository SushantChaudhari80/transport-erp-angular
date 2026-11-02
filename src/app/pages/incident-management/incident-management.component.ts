import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import {
  CreateIncidentRequest,
  Incident,
  IncidentCategory,
  IncidentComment,
  IncidentPriority,
  IncidentService,
  IncidentStatus,
  IncidentStatusRequest,
} from '../../core/services/incident.service';

interface IncidentDraft {
  title: string;
  category: IncidentCategory;
  priority: IncidentPriority;
  description: string;
}

const INCIDENT_CATEGORIES: IncidentCategory[] = [
  'Vehicle',
  'Driver',
  'Trip',
  'Payment',
  'Application',
  'Other',
];
const INCIDENT_PRIORITIES: IncidentPriority[] = ['Low', 'Medium', 'High', 'Critical'];
const INCIDENT_STATUSES: IncidentStatus[] = ['Open', 'In Progress', 'Resolved'];

@Component({
  selector: 'app-incident-management',
  imports: [DatePipe, FormsModule],
  templateUrl: './incident-management.component.html',
  styleUrl: './incident-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncidentManagementComponent implements OnInit {
  readonly incidents = signal<Incident[]>([]);
  readonly selectedIncident = signal<Incident | null>(null);
  readonly comments = signal<IncidentComment[]>([]);
  readonly categories = INCIDENT_CATEGORIES;
  readonly priorities = INCIDENT_PRIORITIES;
  readonly statuses = INCIDENT_STATUSES;
  readonly loadingIncidents = signal(false);
  readonly loadingDetails = signal(false);
  readonly creatingIncident = signal(false);
  readonly savingComment = signal(false);
  readonly updatingStatus = signal(false);
  readonly showCreateForm = signal(false);
  readonly commentDraft = signal('');
  readonly error = signal('');
  readonly notice = signal('');
  draft: IncidentDraft = this.emptyDraft();
  searchTerm = '';
  statusFilter = '';

  constructor(private readonly incidentService: IncidentService) {}

  ngOnInit(): void {
    this.loadIncidents();
  }

  get filteredIncidents(): Incident[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.incidents().filter(
      (incident) =>
        (!this.statusFilter || incident.status === this.statusFilter) &&
        (!term ||
          incident.incidentCode.toLowerCase().includes(term) ||
          incident.title.toLowerCase().includes(term) ||
          incident.category.toLowerCase().includes(term)),
    );
  }

  get openIncidentCount(): number {
    return this.incidents().filter((incident) => incident.status === 'Open').length;
  }

  get inProgressIncidentCount(): number {
    return this.incidents().filter((incident) => incident.status === 'In Progress').length;
  }

  get resolvedIncidentCount(): number {
    return this.incidents().filter((incident) => incident.status === 'Resolved').length;
  }

  loadIncidents(): void {
    this.error.set('');
    this.loadingIncidents.set(true);
    this.incidentService
      .listIncidents()
      .pipe(finalize(() => this.loadingIncidents.set(false)))
      .subscribe({
        next: (incidents) => this.incidents.set(incidents),
        error: (error: unknown) => this.showError(error),
      });
  }

  openIncident(incident: Incident): void {
    this.error.set('');
    this.notice.set('');
    this.selectedIncident.set(incident);
    this.comments.set([]);
    this.commentDraft.set('');
    this.loadingDetails.set(true);
    this.incidentService
      .getIncident(incident.id)
      .pipe(finalize(() => this.loadingDetails.set(false)))
      .subscribe({
        next: (details) => {
          this.selectedIncident.set(details);
          this.loadComments(details.id);
        },
        error: (error: unknown) => this.showError(error),
      });
  }

  closeIncident(): void {
    this.selectedIncident.set(null);
    this.comments.set([]);
    this.error.set('');
    this.notice.set('');
  }

  createIncident(): void {
    const request: CreateIncidentRequest = {
      ...this.draft,
      title: this.draft.title.trim(),
      description: this.draft.description.trim(),
      createdBy: 'Admin',
    };
    if (
      !request.title ||
      request.title.length > 200 ||
      !request.description ||
      request.description.length > 2000
    ) {
      this.error.set('Enter a title (up to 200 characters) and description (up to 2000 characters).');
      return;
    }

    this.clearFeedback();
    this.creatingIncident.set(true);
    this.incidentService
      .createIncident(request)
      .pipe(finalize(() => this.creatingIncident.set(false)))
      .subscribe({
        next: (incident) => {
          this.showCreateForm.set(false);
          this.draft = this.emptyDraft();
          this.loadIncidents();
          this.openIncident(incident);
          this.notice.set(`${incident.incidentCode} was created.`);
        },
        error: (error: unknown) => this.showError(error),
      });
  }

  changeStatus(status: IncidentStatus): void {
    const incident = this.selectedIncident();
    if (!incident || incident.status === status || this.updatingStatus()) return;

    const requestStatus: IncidentStatusRequest =
      status === 'In Progress' ? 'In_Progress' : status;
    this.clearFeedback();
    this.updatingStatus.set(true);
    this.incidentService
      .updateIncidentStatus(incident.id, requestStatus)
      .pipe(finalize(() => this.updatingStatus.set(false)))
      .subscribe({
        next: (updated) => {
          this.selectedIncident.set(updated);
          this.replaceIncident(updated);
          this.notice.set('Incident status updated.');
        },
        error: (error: unknown) => this.showError(error),
      });
  }

  addComment(): void {
    const incident = this.selectedIncident();
    const comment = this.commentDraft().trim();
    if (!incident || !comment || comment.length > 5000 || this.savingComment()) return;

    this.clearFeedback();
    this.savingComment.set(true);
    this.incidentService
      .addComment(incident.id, comment)
      .pipe(finalize(() => this.savingComment.set(false)))
      .subscribe({
        next: (created) => {
          this.comments.update((comments) => [...comments, created]);
          this.commentDraft.set('');
          this.notice.set('Comment added.');
        },
        error: (error: unknown) => this.showError(error),
      });
  }

  toggleCreateForm(): void {
    this.showCreateForm.update((showing) => !showing);
    this.clearFeedback();
  }

  private loadComments(id: number): void {
    this.incidentService.listComments(id).subscribe({
      next: (comments) => this.comments.set(comments),
      error: (error: unknown) => this.showError(error),
    });
  }

  private replaceIncident(updated: Incident): void {
    this.incidents.update((incidents) =>
      incidents.map((incident) => (incident.id === updated.id ? updated : incident)),
    );
  }

  private emptyDraft(): IncidentDraft {
    return {
      title: '',
      category: 'Vehicle',
      priority: 'Medium',
      description: '',
    };
  }

  private clearFeedback(): void {
    this.error.set('');
    this.notice.set('');
  }

  private showError(error: unknown): void {
    const response = error instanceof HttpErrorResponse ? error.error : null;
    const message =
      response && typeof response === 'object' && 'message' in response
        ? String(response.message)
        : 'The incident service could not complete that request. Check that the API is available and try again.';
    this.error.set(message);
  }
}
