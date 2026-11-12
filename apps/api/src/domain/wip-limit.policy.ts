import { BoardColumn } from './entities.js';

export class WipLimitViolation extends Error {}

export class WipLimitPolicy {
  assertCanAccept(target: BoardColumn): void {
    if (target.tasks.length >= target.wipLimit) {
      throw new WipLimitViolation(
        `WIP limit reached for ${target.title}: ${target.tasks.length}/${target.wipLimit}`,
      );
    }
  }
}
