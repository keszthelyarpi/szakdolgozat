/**
 * Generic binary Min-Heap based priority queue.
 */
export interface PriorityQueueItem<T> {
  element: T;
  priority: number;
  order: number;
}

export class PriorityQueue<T> {
  private heap: PriorityQueueItem<T>[] = [];
  private counter: number = 0;

  /**
   * Pushes an element with an associated numeric priority.
   * Lower values indicate higher priority (Min-Heap).
   */
  public push(element: T, priority: number): void {
    const item: PriorityQueueItem<T> = {
      element,
      priority,
      order: this.counter++,
    };
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  /**
   * Removes and returns the element with the lowest priority value.
   * Returns undefined if the queue is empty.
   */
  public pop(): T | undefined {
    if (this.heap.length === 0) {
      return undefined;
    }
    const top = this.heap[0].element;
    const bottom = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this.bubbleDown(0);
    }
    return top;
  }

  /**
   * Returns the element with the lowest priority without removing it.
   */
  public peek(): T | undefined {
    return this.heap.length > 0 ? this.heap[0].element : undefined;
  }

  /**
   * Returns true if the queue contains no elements.
   */
  public isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /**
   * Returns the number of elements in the queue.
   */
  public size(): number {
    return this.heap.length;
  }

  /**
   * Clears all elements from the queue.
   */
  public clear(): void {
    this.heap = [];
    this.counter = 0;
  }

  private compare(a: PriorityQueueItem<T>, b: PriorityQueueItem<T>): number {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    // Stable tie-breaking using insertion sequence
    return a.order - b.order;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIdx = (index - 1) >> 1;
      if (this.compare(this.heap[index], this.heap[parentIdx]) < 0) {
        const temp = this.heap[index];
        this.heap[index] = this.heap[parentIdx];
        this.heap[parentIdx] = temp;
        index = parentIdx;
      } else {
        break;
      }
    }
  }

  private bubbleDown(index: number): void {
    const length = this.heap.length;

    while (true) {
      const leftIdx = (index << 1) + 1;
      const rightIdx = leftIdx + 1;
      let smallestIdx = index;

      if (leftIdx < length && this.compare(this.heap[leftIdx], this.heap[smallestIdx]) < 0) {
        smallestIdx = leftIdx;
      }
      if (rightIdx < length && this.compare(this.heap[rightIdx], this.heap[smallestIdx]) < 0) {
        smallestIdx = rightIdx;
      }

      if (smallestIdx !== index) {
        const temp = this.heap[index];
        this.heap[index] = this.heap[smallestIdx];
        this.heap[smallestIdx] = temp;
        index = smallestIdx;
      } else {
        break;
      }
    }
  }
}
