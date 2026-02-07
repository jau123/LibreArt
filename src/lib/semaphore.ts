/**
 * Simple async semaphore for concurrency control.
 * Used to limit parallel generation requests per provider.
 */

export class Semaphore {
  private queue: (() => void)[] = []
  private running = 0

  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.running < this.max) {
      this.running++
      return
    }
    return new Promise(resolve => {
      this.queue.push(() => { this.running++; resolve() })
    })
  }

  release(): void {
    this.running--
    const next = this.queue.shift()
    if (next) next()
  }
}
