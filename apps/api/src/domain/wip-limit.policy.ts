import { BoardColumn } from './entities.js';

export class WipLimitViolation extends Error {}

export class WipLimitPolicy {
  assertCanAccept(target: BoardColumn): void {
    this.assertCapacity(target.tasks.length, target.wipLimit, target.title);
  }

  assertCapacity(count: number, limit: number, title: string): void {
    if (count >= limit) {
      throw new WipLimitViolation(
        `WIP limit reached for ${title}: ${count}/${limit}`,
      );
    }
  }
}
