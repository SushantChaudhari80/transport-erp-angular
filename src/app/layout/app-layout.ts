import { HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { DashboardService } from '../core/services/dashboard.service';
import { Customer } from '../models/dashboard.model';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const CHAT_HISTORY_STORAGE_KEY = 'transport-erp-chat-history';

function isChatMessage(value: unknown): value is ChatMessage {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const message = value as Record<string, unknown>;
  return (
    (message['role'] === 'user' || message['role'] === 'assistant') &&
    typeof message['text'] === 'string'
  );
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.css',
})
export class AppLayoutComponent {
  private readonly dashboardService = inject(DashboardService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

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
  readonly chatError = signal('');
  private chatHistoryLoaded = false;

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

    if (isPlatformBrowser(this.platformId)) {
      try {
        window.localStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
      } catch (error) {
        console.error('Unable to clear chatbot history on logout:', error);
      }
    }

    this.chatMessages.set([]);
    this.chatHistoryLoaded = false;
    void this.router.navigate(['/login']);
  }

  toggleChat(): void {
    if (this.chatOpen()) {
      this.chatOpen.set(false);
      return;
    }

    this.chatError.set('');
    this.loadChatHistory();
    this.chatCollapsed.set(false);
    this.chatOpen.set(true);
  }

  toggleChatCollapsed(): void {
    this.chatCollapsed.update((collapsed) => !collapsed);
  }

  updateChatDraft(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.chatDraft.set(input.value);
    }
  }

  sendChatMessage(): void {
    const text = this.chatDraft().trim();
    if (!text) {
      return;
    }

    const messages = [
      ...this.chatMessages(),
      { role: 'user' as const, text },
      {
        role: 'assistant' as const,
        text: 'Thanks for your message! I am a demo assistant for now. Chat support will be available soon.',
      },
    ];

    this.chatMessages.set(messages);
    this.chatDraft.set('');
    this.chatError.set('');
    this.saveChatHistory(messages);
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

  private loadChatHistory(): void {
    if (this.chatHistoryLoaded) {
      return;
    }

    this.chatHistoryLoaded = true;
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      const storedHistory = window.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
      if (storedHistory === null) {
        return;
      }

      const history: unknown = JSON.parse(storedHistory);
      if (!Array.isArray(history) || !history.every(isChatMessage)) {
        throw new Error('Stored chatbot history has an invalid format.');
      }

      this.chatMessages.set(history);
    } catch (error) {
      console.error('Unable to load chatbot history:', error);
      this.chatError.set('Chat history could not be loaded from this browser.');
    }
  }

  private saveChatHistory(messages: ChatMessage[]): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      window.localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(messages));
    } catch (error) {
      console.error('Unable to save chatbot history:', error);
      this.chatError.set('Your message was sent, but chat history could not be saved.');
    }
  }
}
