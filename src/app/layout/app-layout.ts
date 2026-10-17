import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { ChatHistoryEntry, ChatService, ChatSession } from '../core/services/chat.service';
import { DashboardService } from '../core/services/dashboard.service';
import { Customer } from '../models/dashboard.model';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.css',
})
export class AppLayoutComponent {
  private readonly chatService = inject(ChatService);
  private readonly dashboardService = inject(DashboardService);
  private readonly router = inject(Router);

  readonly mobileMenuOpen = signal(false);
  readonly sidebarCollapsed = signal(false);
  readonly tripsSubmenuOpen = signal(false);
  readonly machineReadingSubmenuOpen = signal(false);
  readonly profileOpen = signal(false);
  readonly profileLoading = signal(true);
  readonly profileError = signal('');
  readonly customer = signal<Customer | null>(null);
  readonly chatOpen = signal(false);
  readonly chatCollapsed = signal(false);
  readonly chatDraft = signal('');
  readonly chatMessages = signal<ChatMessage[]>([]);
  readonly chatSessions = signal<ChatSession[]>([]);
  readonly activeChatSessionId = signal<string | null>(null);
  readonly recentChatSessions = computed(() => {
    const sortedSessions = [...this.chatSessions()].sort(
      (first, second) =>
        new Date(second.lastMessageAt).getTime() - new Date(first.lastMessageAt).getTime(),
    );
    const activeSessionId = this.activeChatSessionId();
    if (!activeSessionId) {
      return sortedSessions.slice(0, 3);
    }

    const activeSession = sortedSessions.find(
      (session) => session.sessionId === activeSessionId,
    ) ?? {
      sessionId: activeSessionId,
      lastMessage: 'New conversation',
      messageCount: 0,
      lastMessageAt: '',
    };
    return [
      activeSession,
      ...sortedSessions
        .filter((session) => session.sessionId !== activeSessionId)
        .slice(0, 3),
    ];
  });
  readonly chatSessionsLoading = signal(false);
  readonly chatHistoryLoading = signal(false);
  readonly chatSending = signal(false);
  readonly chatError = signal('');

  constructor() {
    this.dashboardService.getCustomer().subscribe({
      next: (customer) => {
        this.customer.set(customer);
        this.profileLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load account profile:', error);
        this.profileError.set('Profile details could not be loaded.');
        this.profileLoading.set(false);
      },
    });
  }

  toggleMenu(): void {
    if (window.innerWidth <= 800) {
      this.mobileMenuOpen.update((isOpen) => !isOpen);
      return;
    }

    this.sidebarCollapsed.update((isCollapsed) => !isCollapsed);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  toggleTripsSubmenu(): void {
    this.tripsSubmenuOpen.update((isOpen) => !isOpen);
  }

  toggleMachineReadingSubmenu(): void {
    this.machineReadingSubmenuOpen.update((isOpen) => !isOpen);
  }

  toggleProfile(): void {
    this.profileOpen.update((isOpen) => !isOpen);
  }

  closeProfile(): void {
    this.profileOpen.set(false);
  }

  logout(): void {
    this.closeProfile();
    this.chatMessages.set([]);
    this.chatSessions.set([]);
    this.activeChatSessionId.set(null);
    void this.router.navigate(['/login']);
  }

  toggleChat(): void {
    if (this.chatOpen()) {
      this.chatOpen.set(false);
      return;
    }

    this.chatError.set('');
    if (!this.activeChatSessionId()) {
      this.startNewChat();
    }
    this.loadChatSessions();
    this.chatCollapsed.set(false);
    this.chatOpen.set(true);
  }

  closeChat(): void {
    this.chatOpen.set(false);
  }

  toggleChatCollapsed(): void {
    this.chatCollapsed.update((collapsed) => !collapsed);
  }

  startNewChat(): void {
    this.activeChatSessionId.set(crypto.randomUUID());
    this.chatMessages.set([]);
    this.chatDraft.set('');
    this.chatHistoryLoading.set(false);
    this.chatError.set('');
  }

  selectChatSession(session: ChatSession): void {
    this.activeChatSessionId.set(session.sessionId);
    this.chatMessages.set([]);
    this.chatError.set('');
    this.chatHistoryLoading.set(true);

    this.chatService.getHistory(session.sessionId).subscribe({
      next: (history) => {
        if (this.activeChatSessionId() === session.sessionId) {
          this.chatMessages.set(history.map((entry) => this.toChatMessage(entry)));
          this.chatHistoryLoading.set(false);
        }
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load chatbot session history:', error);
        if (this.activeChatSessionId() === session.sessionId) {
          this.chatHistoryLoading.set(false);
          this.chatError.set('This chat history could not be loaded.');
        }
      },
    });
  }

  updateChatDraft(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.chatDraft.set(input.value);
    }
  }

  sendChatMessage(): void {
    const text = this.chatDraft().trim();
    const sessionId = this.activeChatSessionId();
    if (!text || !sessionId || this.chatSending() || this.chatHistoryLoading()) {
      return;
    }

    this.chatMessages.update((messages) => [...messages, { role: 'user', text }]);
    this.chatDraft.set('');
    this.chatError.set('');
    this.chatSending.set(true);

    this.chatService.sendMessage(sessionId, text).subscribe({
      next: (response) => {
        if (this.activeChatSessionId() === sessionId) {
          this.chatMessages.update((messages) => [
            ...messages,
            { role: 'assistant', text: response.answer },
          ]);
          this.loadChatSessions();
        }
        this.chatSending.set(false);
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to send chatbot message:', error);
        this.chatSending.set(false);
        if (this.activeChatSessionId() === sessionId) {
          this.chatError.set('Your message could not be sent. Please try again.');
        }
      },
    });
  }

  formatAssistantMessage(text: string): string {
    const normalizedText = text
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+\*\s+(?=\*\*)/g, '\n* ');
    const lines = normalizedText.split('\n');
    const html: string[] = [];
    let paragraph: string[] = [];
    let listType: 'ul' | 'ol' | null = null;

    const flushParagraph = (): void => {
      if (paragraph.length > 0) {
        html.push(`<p>${formatInlineMarkdown(paragraph.join(' '))}</p>`);
        paragraph = [];
      }
    };
    const closeList = (): void => {
      if (listType) {
        html.push(`</${listType}>`);
        listType = null;
      }
    };

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        flushParagraph();
        closeList();
        continue;
      }

      const heading = /^(#{1,3})\s+(.+)$/.exec(trimmedLine);
      if (heading) {
        flushParagraph();
        closeList();
        const level = heading[1].length;
        html.push(`<h${level}>${formatInlineMarkdown(heading[2])}</h${level}>`);
        continue;
      }

      const unorderedItem = /^(?:[-*•])\s+(.+)$/.exec(trimmedLine);
      const orderedItem = /^\d+[.)]\s+(.+)$/.exec(trimmedLine);
      const item = unorderedItem ?? orderedItem;
      if (item) {
        flushParagraph();
        const nextListType = unorderedItem ? 'ul' : 'ol';
        if (listType !== nextListType) {
          closeList();
          listType = nextListType;
          html.push(`<${listType}>`);
        }
        html.push(`<li>${formatInlineMarkdown(item[1])}</li>`);
        continue;
      }

      closeList();
      paragraph.push(trimmedLine);
    }

    flushParagraph();
    closeList();
    return html.join('');
  }

  get customerPicture(): string | null {
    const picture = this.customer()?.picture;

    if (!picture) {
      return null;
    }

    return picture.startsWith('data:') ? picture : `data:image/png;base64,${picture}`;
  }

  get customerInitial(): string {
    return this.customer()?.name?.trim().charAt(0).toUpperCase() || 'A';
  }

  private loadChatSessions(): void {
    this.chatSessionsLoading.set(true);
    this.chatService.getSessions().subscribe({
      next: (sessions) => {
        this.chatSessions.set(sessions);
        this.chatSessionsLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load chatbot sessions:', error);
        this.chatSessionsLoading.set(false);
        this.chatError.set('Your chat sessions could not be loaded.');
      },
    });
  }

  private toChatMessage(entry: ChatHistoryEntry): ChatMessage {
    return { role: entry.role, text: entry.message };
  }
}
