import type {
  EjbReadyPayload,
  EjbFramePayload,
  EjbStatePayload,
  EjbErrorPayload,
  EjbControlPayload
} from '../contract/types';

export class EjbEmitter {
  private controlListener: ((e: CustomEvent<EjbControlPayload>) => void) | null = null;

  /**
   * Dispatches ejb:ready when media is detected and pipeline is prepared.
   */
  emitReady(payload: EjbReadyPayload): void {
    window.dispatchEvent(
      new CustomEvent<EjbReadyPayload>('ejb:ready', {
        detail: payload,
        bubbles: true,
        composed: true
      })
    );
  }

  /**
   * Dispatches ejb:frame every analysis tick (~12 Hz).
   */
  emitFrame(payload: EjbFramePayload): void {
    window.dispatchEvent(
      new CustomEvent<EjbFramePayload>('ejb:frame', {
        detail: payload,
        bubbles: true,
        composed: true
      })
    );
  }

  /**
   * Dispatches ejb:state on playback transitions (play, pause, seek, ended).
   */
  emitState(payload: EjbStatePayload): void {
    window.dispatchEvent(
      new CustomEvent<EjbStatePayload>('ejb:state', {
        detail: payload,
        bubbles: true,
        composed: true
      })
    );
  }

  /**
   * Dispatches ejb:error when media capture encounters a fatal error.
   */
  emitError(payload: EjbErrorPayload): void {
    window.dispatchEvent(
      new CustomEvent<EjbErrorPayload>('ejb:error', {
        detail: payload,
        bubbles: true,
        composed: true
      })
    );
  }

  /**
   * Subscribes to optional control channel from Pranav's synth engine.
   */
  onControl(callback: (control: EjbControlPayload) => void): void {
    if (this.controlListener) {
      window.removeEventListener('ejb:control', this.controlListener as EventListener);
    }
    this.controlListener = (e: CustomEvent<EjbControlPayload>) => {
      if (e.detail) {
        callback(e.detail);
      }
    };
    window.addEventListener('ejb:control', this.controlListener as EventListener);
  }

  destroy(): void {
    if (this.controlListener) {
      window.removeEventListener('ejb:control', this.controlListener as EventListener);
      this.controlListener = null;
    }
  }
}
