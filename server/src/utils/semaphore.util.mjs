/**
 * In-memory concurrency semaphore for document extraction pipeline.
 * Restricts active extraction permits to MAX_CONCURRENT_EXTRACTIONS (default: 3).
 *
 * NOTE ON CPU & MEMORY PREEMPTION:
 * The semaphore bounds the number of *actively dispatched* extraction permits.
 * Releasing a permit after the emergency 30-second deadline prevents permanent server deadlock,
 * but does NOT terminate background V8 microtasks in unpdf.
 * True process-level CPU/memory isolation requires worker process isolation (deferred).
 */

export class ExtractionSemaphore {
  /**
   * @param {number} [maxConcurrent=3] - Maximum simultaneous permits
   * @param {number} [emergencyTimeoutMs=30000] - Hard safety ceiling to avoid permanent deadlock
   */
  constructor(maxConcurrent = 3, emergencyTimeoutMs = 30000) {
    this.maxConcurrent = maxConcurrent;
    this.emergencyTimeoutMs = emergencyTimeoutMs;
    this.activePermits = 0;
    this.unsettledTasks = 0;
    this.emergencyReleasedTasks = 0;
  }

  /**
   * Attempt to acquire an extraction permit.
   *
   * @param {string} [taskId='anonymous']
   * @returns {{ releasePermit: (reason?: string) => boolean, settleTask: () => void } | null}
   */
  tryAcquire(taskId = 'anonymous') {
    if (this.activePermits >= this.maxConcurrent) {
      return null;
    }

    this.activePermits += 1;
    this.unsettledTasks += 1;

    let permitReleased = false;
    let taskSettled = false;
    let emergencyTimer = null;
    let wasEmergencyReleased = false;

    const releasePermit = (reason = 'NORMAL_SETTLEMENT') => {
      if (permitReleased) return false;
      permitReleased = true;

      if (emergencyTimer) {
        clearTimeout(emergencyTimer);
        emergencyTimer = null;
      }

      this.activePermits = Math.max(0, this.activePermits - 1);

      if (reason === 'EMERGENCY_TIMEOUT') {
        wasEmergencyReleased = true;
        this.emergencyReleasedTasks += 1;
        console.warn(
          `[SEMAPHORE] Emergency release triggered at ${this.emergencyTimeoutMs}ms for task ${taskId}. Active permits: ${this.activePermits}/${this.maxConcurrent}. Task still running in background.`
        );
      } else {
        console.info(
          `[SEMAPHORE] Permit released (${reason}) for task ${taskId}. Active permits: ${this.activePermits}/${this.maxConcurrent}`
        );
      }
      return true;
    };

    const settleTask = () => {
      if (taskSettled) return;
      taskSettled = true;

      this.unsettledTasks = Math.max(0, this.unsettledTasks - 1);

      if (wasEmergencyReleased) {
        this.emergencyReleasedTasks = Math.max(0, this.emergencyReleasedTasks - 1);
        console.info(
          `[SEMAPHORE] Task ${taskId} settled after emergency release. Remaining unsettled tasks: ${this.unsettledTasks}`
        );
      } else {
        releasePermit('NORMAL_SETTLEMENT');
      }
    };

    if (this.emergencyTimeoutMs > 0) {
      emergencyTimer = setTimeout(() => {
        releasePermit('EMERGENCY_TIMEOUT');
      }, this.emergencyTimeoutMs);
      if (typeof emergencyTimer.unref === 'function') emergencyTimer.unref();
    }

    return {
      releasePermit,
      settleTask,
    };
  }

  /**
   * Return current metrics for telemetry and test assertions.
   */
  getMetrics() {
    return {
      activePermits: this.activePermits,
      unsettledTasks: this.unsettledTasks,
      emergencyReleasedTasks: this.emergencyReleasedTasks,
      maxConcurrent: this.maxConcurrent,
    };
  }
}

export const extractionSemaphore = new ExtractionSemaphore(3, 30000);

export default extractionSemaphore;
