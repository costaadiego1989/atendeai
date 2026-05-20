/**
 * AtendeAI Chat Widget SDK
 *
 * Usage:
 * <script src="https://cdn.atendeai.com/widget/sdk.js"></script>
 * <script>
 *   atendeai('init', { token: 'YOUR_PUBLIC_TOKEN' });
 * </script>
 */

interface WidgetConfig {
  id: string;
  name: string;
  greeting: string | null;
  color: string;
  position: 'bottom-right' | 'bottom-left';
  avatarUrl: string | null;
  collectName: boolean;
  collectPhone: boolean;
  proactiveDelay: number | null;
  proactiveMsg: string | null;
}

interface WidgetMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  contentType: string;
  content: { text?: string; url?: string };
  sentBy: string;
  createdAt: string;
}

interface InitOptions {
  token: string;
  baseUrl?: string;
}

const API_BASE = 'https://api.atendeai.com/api/v1';

class AtendeAiWidget {
  private token: string = '';
  private baseUrl: string = API_BASE;
  private config: WidgetConfig | null = null;
  private sessionId: string | null = null;
  private visitorId: string = '';
  private container: HTMLDivElement | null = null;
  private isOpen: boolean = false;
  private messages: WidgetMessage[] = [];
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  async init(options: InitOptions) {
    this.token = options.token;
    this.baseUrl = options.baseUrl || API_BASE;
    this.visitorId = this.getOrCreateVisitorId();

    // Fetch widget config
    const config = await this.fetchConfig();
    if (!config) return;
    this.config = config;

    // Init session
    await this.initSession();

    // Render widget
    this.render();

    // Setup proactive message
    if (config.proactiveDelay && config.proactiveMsg) {
      setTimeout(() => {
        if (!this.isOpen) this.showProactive();
      }, config.proactiveDelay * 1000);
    }
  }

  private getOrCreateVisitorId(): string {
    const key = 'atendeai_visitor_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  }

  private async fetchConfig(): Promise<WidgetConfig | null> {
    try {
      const res = await fetch(`${this.baseUrl}/widget/${this.token}/config`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  private async initSession() {
    try {
      const res = await fetch(`${this.baseUrl}/widget/${this.token}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId: this.visitorId,
          pageUrl: window.location.href,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        this.sessionId = data.sessionId;
        if (data.resumed && data.conversationId) {
          await this.loadMessages();
        }
      }
    } catch {
      // Silent fail — widget degrades gracefully
    }
  }

  private async loadMessages() {
    if (!this.sessionId) return;
    try {
      const res = await fetch(
        `${this.baseUrl}/widget/${this.token}/sessions/${this.sessionId}/messages`,
      );
      if (res.ok) {
        const data = await res.json();
        this.messages = data.messages || [];
      }
    } catch {
      // Silent
    }
  }

  async sendMessage(text: string) {
    if (!this.sessionId || !text.trim()) return;

    // Optimistic UI
    const tempMsg: WidgetMessage = {
      id: crypto.randomUUID(),
      direction: 'INBOUND',
      contentType: 'TEXT',
      content: { text },
      sentBy: 'CONTACT',
      createdAt: new Date().toISOString(),
    };
    this.messages.push(tempMsg);
    this.renderMessages();

    try {
      const res = await fetch(`${this.baseUrl}/widget/${this.token}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          visitorId: this.visitorId,
          text: text.trim(),
        }),
      });
      if (res.ok) {
        // Start polling for AI response
        this.startPolling();
      }
    } catch {
      // Mark as failed
    }
  }

  private startPolling() {
    if (this.pollInterval) return;
    this.pollInterval = setInterval(async () => {
      await this.loadMessages();
      this.renderMessages();
      // Stop polling if last message is outbound (AI replied)
      if (this.messages.length > 0) {
        const last = this.messages[this.messages.length - 1];
        if (last.direction === 'OUTBOUND') {
          this.stopPolling();
        }
      }
    }, 1500);
    // Auto-stop after 30s
    setTimeout(() => this.stopPolling(), 30000);
  }

  private stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private render() {
    if (!this.config) return;

    // Create shadow DOM container
    this.container = document.createElement('div');
    this.container.id = 'atendeai-widget-root';
    document.body.appendChild(this.container);

    const shadow = this.container.attachShadow({ mode: 'open' });
    shadow.innerHTML = this.getWidgetHTML();

    // Bind events
    this.bindEvents(shadow);
  }

  private getWidgetHTML(): string {
    const cfg = this.config!;
    const pos = cfg.position === 'bottom-left' ? 'left: 20px;' : 'right: 20px;';

    return `
      <style>${this.getStyles()}</style>
      <div class="aw-widget" style="${pos}">
        <div class="aw-chat-window ${this.isOpen ? 'aw-open' : ''}">
          <div class="aw-header" style="background: ${cfg.color}">
            <div class="aw-header-info">
              ${cfg.avatarUrl ? `<img src="${cfg.avatarUrl}" class="aw-avatar" alt="" />` : '<div class="aw-avatar-placeholder"></div>'}
              <span class="aw-header-title">${cfg.name}</span>
            </div>
            <button class="aw-close-btn" aria-label="Fechar chat">&times;</button>
          </div>
          <div class="aw-messages" id="aw-messages">
            ${cfg.greeting ? `<div class="aw-msg aw-msg-bot"><div class="aw-msg-bubble">${cfg.greeting}</div></div>` : ''}
          </div>
          <div class="aw-input-area">
            <input type="text" class="aw-input" placeholder="Digite sua mensagem..." aria-label="Mensagem" />
            <button class="aw-send-btn" style="background: ${cfg.color}" aria-label="Enviar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>
            </button>
          </div>
        </div>
        <button class="aw-fab" style="background: ${cfg.color}" aria-label="Abrir chat">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </button>
        <div class="aw-proactive ${this.isOpen ? 'aw-hidden' : ''}" id="aw-proactive" style="display:none;">
          <p class="aw-proactive-text"></p>
          <button class="aw-proactive-close" aria-label="Fechar">&times;</button>
        </div>
      </div>
    `;
  }

  private bindEvents(shadow: ShadowRoot) {
    const fab = shadow.querySelector('.aw-fab') as HTMLElement;
    const closeBtn = shadow.querySelector('.aw-close-btn') as HTMLElement;
    const input = shadow.querySelector('.aw-input') as HTMLInputElement;
    const sendBtn = shadow.querySelector('.aw-send-btn') as HTMLElement;
    const chatWindow = shadow.querySelector('.aw-chat-window') as HTMLElement;
    const proactive = shadow.querySelector('#aw-proactive') as HTMLElement;
    const proactiveClose = shadow.querySelector('.aw-proactive-close') as HTMLElement;

    fab?.addEventListener('click', () => {
      this.isOpen = true;
      chatWindow?.classList.add('aw-open');
      fab.style.display = 'none';
      proactive.style.display = 'none';
      input?.focus();
      this.renderMessages();
    });

    closeBtn?.addEventListener('click', () => {
      this.isOpen = false;
      chatWindow?.classList.remove('aw-open');
      fab.style.display = 'flex';
    });

    const doSend = () => {
      const text = input?.value?.trim();
      if (text) {
        this.sendMessage(text);
        input.value = '';
      }
    };

    sendBtn?.addEventListener('click', doSend);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSend();
    });

    proactiveClose?.addEventListener('click', () => {
      proactive.style.display = 'none';
    });
  }

  private showProactive() {
    if (!this.container || !this.config?.proactiveMsg) return;
    const shadow = this.container.shadowRoot;
    if (!shadow) return;
    const proactive = shadow.querySelector('#aw-proactive') as HTMLElement;
    const text = shadow.querySelector('.aw-proactive-text') as HTMLElement;
    if (proactive && text) {
      text.textContent = this.config.proactiveMsg;
      proactive.style.display = 'block';
    }
  }

  private renderMessages() {
    if (!this.container) return;
    const shadow = this.container.shadowRoot;
    if (!shadow) return;
    const messagesEl = shadow.querySelector('#aw-messages') as HTMLElement;
    if (!messagesEl) return;

    let html = '';
    if (this.config?.greeting) {
      html += `<div class="aw-msg aw-msg-bot"><div class="aw-msg-bubble">${this.config.greeting}</div></div>`;
    }

    for (const msg of this.messages) {
      const isBot = msg.direction === 'OUTBOUND';
      const cls = isBot ? 'aw-msg-bot' : 'aw-msg-user';
      const text = (msg.content as any)?.text || '';
      html += `<div class="aw-msg ${cls}"><div class="aw-msg-bubble">${this.escapeHtml(text)}</div></div>`;
    }

    messagesEl.innerHTML = html;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  private getStyles(): string {
    return `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      .aw-widget { position: fixed; bottom: 20px; z-index: 2147483647; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .aw-fab { width: 56px; height: 56px; border-radius: 50%; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: transform 0.2s, box-shadow 0.2s; }
      .aw-fab:hover { transform: scale(1.05); box-shadow: 0 6px 20px rgba(0,0,0,0.2); }
      .aw-chat-window { display: none; flex-direction: column; width: 370px; height: 520px; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.2); background: #fff; position: absolute; bottom: 70px; right: 0; }
      .aw-chat-window.aw-open { display: flex; }
      .aw-header { padding: 16px; color: white; display: flex; align-items: center; justify-content: space-between; }
      .aw-header-info { display: flex; align-items: center; gap: 10px; }
      .aw-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
      .aw-avatar-placeholder { width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.3); }
      .aw-header-title { font-weight: 600; font-size: 14px; }
      .aw-close-btn { background: none; border: none; color: white; font-size: 24px; cursor: pointer; padding: 0 4px; line-height: 1; }
      .aw-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; background: #f9fafb; }
      .aw-msg { display: flex; }
      .aw-msg-bot { justify-content: flex-start; }
      .aw-msg-user { justify-content: flex-end; }
      .aw-msg-bubble { max-width: 80%; padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.4; word-break: break-word; }
      .aw-msg-bot .aw-msg-bubble { background: #e5e7eb; color: #1f2937; border-bottom-left-radius: 4px; }
      .aw-msg-user .aw-msg-bubble { background: #00C59E; color: white; border-bottom-right-radius: 4px; }
      .aw-input-area { display: flex; padding: 12px; gap: 8px; border-top: 1px solid #e5e7eb; background: #fff; }
      .aw-input { flex: 1; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; font-size: 14px; outline: none; transition: border-color 0.2s; }
      .aw-input:focus { border-color: #00C59E; }
      .aw-send-btn { width: 38px; height: 38px; border-radius: 8px; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: opacity 0.2s; }
      .aw-send-btn:hover { opacity: 0.9; }
      .aw-proactive { position: absolute; bottom: 70px; right: 0; background: white; border-radius: 12px; padding: 12px 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 260px; display: flex; align-items: start; gap: 8px; }
      .aw-proactive-text { font-size: 13px; color: #374151; line-height: 1.4; }
      .aw-proactive-close { background: none; border: none; font-size: 16px; cursor: pointer; color: #9ca3af; padding: 0; line-height: 1; }
      .aw-hidden { display: none !important; }
      @media (max-width: 420px) {
        .aw-chat-window { width: calc(100vw - 20px); height: calc(100vh - 100px); bottom: 70px; right: -10px; border-radius: 12px; }
      }
    `;
  }
}

// Global instance
const widget = new AtendeAiWidget();

// Public API
(window as any).atendeai = (command: string, options?: any) => {
  switch (command) {
    case 'init':
      widget.init(options);
      break;
    case 'open':
      // Future: programmatic open
      break;
    case 'close':
      // Future: programmatic close
      break;
  }
};
