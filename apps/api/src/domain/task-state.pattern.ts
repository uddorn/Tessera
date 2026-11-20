import { TaskStatus } from './entities.js';

const allowedTransitions: Readonly<Record<TaskStatus, readonly TaskStatus[]>> =
  {
    PLANNED: ['IN_PROGRESS', 'CODE_REVIEW', 'DONE'],
    IN_PROGRESS: ['PLANNED', 'CODE_REVIEW', 'DONE'],
    CODE_REVIEW: ['PLANNED', 'IN_PROGRESS', 'DONE'],
    DONE: ['PLANNED', 'IN_PROGRESS', 'CODE_REVIEW'],
  };

export class TaskStateContext {
  assertTransition(current: TaskStatus, target: TaskStatus): void {
    if (!allowedTransitions[current].includes(target)) {
      throw new Error(
        `State transition ${current} -> ${target} is not allowed`,
      );
    }
  }
}
