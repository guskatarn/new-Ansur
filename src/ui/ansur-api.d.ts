import type { AnsurAPI } from '../../electron/preload';

declare global {
  interface Window {
    ansurAPI: AnsurAPI;
  }
}
