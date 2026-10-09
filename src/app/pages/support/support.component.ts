import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

type IncidentPriority = 'Low' | 'Medium' | 'High' | 'Critical';
type IncidentStatus = 'Open' | 'In Progress' | 'Resolved';

interface Incident {
  id: string;
  title: string;
  category: string;
  priority: IncidentPriority;
  status: IncidentStatus;
  description: string;
  createdAt: string;
}

interface IncidentForm {
  title: string;
  category: string;
  priority: IncidentPriority;
  description: string;
}

const STORAGE_KEY = 'transport-erp-incidents';
const CATEGORIES = ['Vehicle', 'Driver', 'Trip', 'Payment', 'Application', 'Other'];
const PRIORITIES: IncidentPriority[] = ['Low', 'Medium', 'High', 'Critical'];
const STATUSES: IncidentStatus[] = ['Open', 'In Progress', 'Resolved'];

function isIncident(value: unknown): value is Incident {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const incident = value as Record<string, unknown>;
  return (
    typeof incident['id'] === 'string' &&
    typeof incident['title'] === 'string' &&
    typeof incident['category'] === 'string' &&
    isIncidentPriority(incident['priority']) &&
    isIncidentStatus(incident['status']) &&
    typeof incident['description'] === 'string' &&
    typeof incident['createdAt'] === 'string'
  );
}

function isIncidentPriority(value: unknown): value is IncidentPriority {
  return typeof value === 'string' && PRIORITIES.some((priority) => priority === value);
}

function isIncidentStatus(value: unknown): value is IncidentStatus {
  return typeof value === 'string' && STATUSES.some((status) => status === value);
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
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly browser = isPlatformBrowser(this.platformId);

  readonly categories = CATEGORIES;
  readonly priorities = PRIORITIES;
  incidents: Incident[] = [];
  searchTerm = '';
  statusFilter: IncidentStatus | '' = '';
  showCreateForm = false;
  selectedIncident: Incident | null = null;
  errorMessage = '';
  successMessage = '';
  form: IncidentForm = this.emptyForm();

  get filteredIncidents(): Incident[] {
    const query = this.searchTerm.trim().toLowerCase();
    return this.incidents.filter((incident) => {
      const matchesStatus = !this.statusFilter || incident.status === this.statusFilter;
      const matchesSearch =
        !query ||
        [incident.id, incident.title, incident.category, incident.priority, incident.description]
          .some((value) => value.toLowerCase().includes(query));
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
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        this.incidents = [];
        return;
      }
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed) || !parsed.every(isIncident)) {
        console.error('Unexpected incident data in browser storage:', parsed);
        this.errorMessage = 'Saved incident data is invalid and could not be displayed.';
        this.incidents = [];
        return;
      }
      this.incidents = [...parsed].sort(
        (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
      );
      this.errorMessage = '';
    } catch (error) {
      console.error('Unable to read incidents from browser storage:', error);
      this.errorMessage = 'Unable to read saved incidents from this browser.';
      this.incidents = [];
    } finally {
      this.changeDetectorRef.markForCheck();
    }
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
    if (!this.browser) {
      this.errorMessage = 'Incidents can only be saved in a browser.';
      return;
    }
    const title = this.form.title.trim();
    const description = this.form.description.trim();
    if (!title || !description || !this.categories.includes(this.form.category)) {
      this.errorMessage = 'Enter a title and description, and select a category.';
      this.changeDetectorRef.markForCheck();
      return;
    }

    const incident: Incident = {
      id: this.createIncidentId(),
      title,
      category: this.form.category,
      priority: this.form.priority,
      status: 'Open',
      description,
      createdAt: new Date().toISOString(),
    };
    const updatedIncidents = [incident, ...this.incidents];
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedIncidents));
      this.incidents = updatedIncidents;
      this.showCreateForm = false;
      this.form = this.emptyForm();
      this.successMessage = 'Incident created and saved in this browser.';
      this.errorMessage = '';
    } catch (error) {
      console.error('Unable to save incident in browser storage:', error);
      this.errorMessage = 'Unable to save this incident in browser storage.';
    }
    this.changeDetectorRef.markForCheck();
  }

  updateStatus(incident: Incident, status: IncidentStatus): void {
    if (!this.browser || !STATUSES.includes(status)) {
      return;
    }
    const updatedIncidents = this.incidents.map((item) =>
      item.id === incident.id ? { ...item, status } : item,
    );
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedIncidents));
      this.incidents = updatedIncidents;
      if (this.selectedIncident?.id === incident.id) {
        this.selectedIncident = { ...this.selectedIncident, status };
      }
      this.errorMessage = '';
    } catch (error) {
      console.error('Unable to update incident in browser storage:', error);
      this.errorMessage = 'Unable to update incident status in browser storage.';
    }
    this.changeDetectorRef.markForCheck();
  }

  onStatusChange(incident: Incident, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (isIncidentStatus(value)) {
      this.updateStatus(incident, value);
    }
  }

  openIncident(incident: Incident): void {
    this.selectedIncident = incident;
    this.changeDetectorRef.markForCheck();
  }

  closeIncidentDetails(): void {
    this.selectedIncident = null;
    this.changeDetectorRef.markForCheck();
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

  private createIncidentId(): string {
    return `INC-${Date.now().toString(36).toUpperCase()}`;
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
