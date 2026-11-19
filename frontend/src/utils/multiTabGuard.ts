/**
 * Multi-Tab Guard: Prevents opening multiple browser/webview tabs of the application
 * Uses BroadcastChannel for real-time inter-tab communication and primary election.
 */

type TabMessage =
  | { type: 'TAB_PING'; tabId: string }
  | { type: 'TAB_PONG'; primaryTabId: string }
  | { type: 'CLAIM_PRIMARY'; tabId: string }
  | { type: 'TAB_CLOSED'; tabId: string };

class MultiTabGuard {
  private channel: BroadcastChannel | null = null;
  private tabId: string;
  private isDuplicate: boolean = false;
  private listeners: Array<(isDuplicate: boolean) => void> = [];

  constructor() {
    this.tabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.init();
  }

  private init() {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
      return;
    }

    try {
      this.channel = new BroadcastChannel('synoradesk_multi_tab_guard');
      this.channel.onmessage = (event: MessageEvent<TabMessage>) => {
        this.handleMessage(event.data);
      };

      // Broadcast PING to ask if any primary tab is already alive
      this.channel.postMessage({ type: 'TAB_PING', tabId: this.tabId });

      window.addEventListener('beforeunload', () => {
        try {
          this.channel?.postMessage({ type: 'TAB_CLOSED', tabId: this.tabId });
          this.channel?.close();
        } catch {}
      });
    } catch (e) {
      console.warn('BroadcastChannel not supported in current environment:', e);
    }
  }

  private handleMessage(msg: TabMessage) {
    if (!msg || typeof msg !== 'object') return;

    switch (msg.type) {
      case 'TAB_PING':
        // If we are currently active, respond with PONG to announce our existence
        if (!this.isDuplicate && msg.tabId !== this.tabId) {
          this.channel?.postMessage({
            type: 'TAB_PONG',
            primaryTabId: this.tabId,
          });
        }
        break;

      case 'TAB_PONG':
        // Another active tab responded! Mark this tab as duplicate
        if (msg.primaryTabId !== this.tabId) {
          this.setDuplicateState(true);
        }
        break;

      case 'CLAIM_PRIMARY':
        // Another tab explicitly claimed primary status
        if (msg.tabId !== this.tabId) {
          this.setDuplicateState(true);
        }
        break;

      case 'TAB_CLOSED':
        // When the other tab closes, we can take over if we were waiting
        break;
    }
  }

  private setDuplicateState(isDup: boolean) {
    this.isDuplicate = isDup;
    this.listeners.forEach((listener) => listener(isDup));
  }

  public subscribe(callback: (isDuplicate: boolean) => void): () => void {
    this.listeners.push(callback);
    callback(this.isDuplicate);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  public claimPrimary() {
    this.isDuplicate = false;
    this.channel?.postMessage({ type: 'CLAIM_PRIMARY', tabId: this.tabId });
    this.listeners.forEach((listener) => listener(false));
  }

  public getIsDuplicate(): boolean {
    return this.isDuplicate;
  }
}

export const tabGuard = new MultiTabGuard();
