import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { ChatHistoryEntry, ChatService, ChatSession } from '../../core/services/chat.service';

type BusyState = {
  documents: boolean;
  sessions: boolean;
  history: boolean;
  upload: boolean;
  send: boolean;
  clear: boolean;
};

@Component({
  selector: 'app-admin-chatbot',
  imports: [DatePipe, FormsModule],
  templateUrl: './admin-chatbot.component.html',
  styleUrl: './admin-chatbot.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminChatbotComponent implements OnInit {
  readonly documents = signal<string[]>([]);
  readonly sessions = signal<ChatSession[]>([]);
  readonly history = signal<ChatHistoryEntry[]>([]);
  readonly selectedSessionId = signal('admin-session-001');
  readonly selectedSession = computed(
    () => this.sessions().find((session) => session.sessionId === this.selectedSessionId()) ?? null,
  );
  readonly messageDraft = signal('');
  readonly busy = signal<BusyState>({
    documents: false,
    sessions: false,
    history: false,
    upload: false,
    send: false,
    clear: false,
  });
  readonly error = signal('');
  readonly notice = signal('');

  constructor(private readonly chat: ChatService) {}

  ngOnInit(): void {
    this.loadDocuments();
    this.loadSessions();
    this.loadHistory(this.selectedSessionId());
  }

  loadDocuments(): void {
    this.setBusy('documents', true);
    this.chat
      .getDocuments()
      .pipe(finalize(() => this.setBusy('documents', false)))
      .subscribe({
        next: (documents) => this.documents.set(documents),
        error: (error: unknown) => this.showError(error),
      });
  }

  loadSessions(): void {
    this.setBusy('sessions', true);
    this.chat
      .getSessions()
      .pipe(finalize(() => this.setBusy('sessions', false)))
      .subscribe({
        next: (sessions) => this.sessions.set(sessions),
        error: (error: unknown) => this.showError(error),
      });
  }

  selectSession(sessionId: string): void {
    this.selectedSessionId.set(sessionId);
    this.loadHistory(sessionId);
  }

  loadHistory(sessionId = this.selectedSessionId()): void {
    if (!sessionId.trim()) return;
    this.setBusy('history', true);
    this.chat
      .getHistory(sessionId)
      .pipe(finalize(() => this.setBusy('history', false)))
      .subscribe({
        next: (history) => this.history.set(history),
        error: (error: unknown) => this.showError(error),
      });
  }

  uploadDocument(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.clearFeedback();
    this.setBusy('upload', true);
    this.chat
      .uploadDocument(file)
      .pipe(
        finalize(() => {
          this.setBusy('upload', false);
          input.value = '';
        }),
      )
      .subscribe({
        next: (response) => {
          this.notice.set(`${response.documentName} indexed successfully (${response.chunksStored} chunks).`);
          this.loadDocuments();
        },
        error: (error: unknown) => this.showError(error),
      });
  }

  deleteDocument(documentName: string): void {
    if (!window.confirm(`Delete ${documentName} from the chatbot knowledge base?`)) return;
    this.clearFeedback();
    this.chat.deleteDocument(documentName).subscribe({
      next: (response) => {
        this.notice.set(`${response.documentName} deleted (${response.chunksDeleted} chunks removed).`);
        this.loadDocuments();
      },
      error: (error: unknown) => this.showError(error),
    });
  }

  sendMessage(): void {
    const sessionId = this.selectedSessionId().trim();
    const message = this.messageDraft().trim();
    if (!sessionId || !message || message.length > 10000) return;

    this.clearFeedback();
    this.setBusy('send', true);
    this.chat
      .sendMessage(sessionId, message)
      .pipe(finalize(() => this.setBusy('send', false)))
      .subscribe({
        next: () => {
          this.messageDraft.set('');
          this.loadHistory(sessionId);
          this.loadSessions();
        },
        error: (error: unknown) => this.showError(error),
      });
  }

  clearHistory(): void {
    const sessionId = this.selectedSessionId().trim();
    if (!sessionId || !window.confirm(`Clear all messages in ${sessionId}?`)) return;

    this.clearFeedback();
    this.setBusy('clear', true);
    this.chat
      .clearHistory(sessionId)
      .pipe(finalize(() => this.setBusy('clear', false)))
      .subscribe({
        next: () => {
          this.history.set([]);
          this.notice.set(`Chat history cleared for ${sessionId}.`);
          this.loadSessions();
        },
        error: (error: unknown) => this.showError(error),
      });
  }

  private setBusy(key: keyof BusyState, value: boolean): void {
    this.busy.update((state) => ({ ...state, [key]: value }));
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
        : 'The chatbot service could not complete that request. Check that the API is running and try again.';
    this.error.set(message);
  }
}