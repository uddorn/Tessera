import { BoardColumn, Task } from './entities.js';
import { TaskStateContext } from './task-state.pattern.js';
import { WipLimitPolicy, WipLimitViolation } from './wip-limit.policy.js';

describe('coursework domain migration', () => {
  it('blocks a full Code Review column', () => {
    const tasks = [1, 2, 3].map(
      (index) =>
        new Task(
          `task-${index}`,
          'ws-901',
          `PAY-${index}`,
          `Task ${index}`,
          'NORMAL',
          'CODE_REVIEW',
          1,
        ),
    );
    const column = new BoardColumn(
      'col-03',
      'ws-901',
      'Code Review',
      'CODE_REVIEW',
      3,
      tasks,
    );

    expect(() => new WipLimitPolicy().assertCanAccept(column)).toThrow(WipLimitViolation);
  });

  it('blocks Planned -> Done', () => {
    expect(() => new TaskStateContext().assertTransition('PLANNED', 'DONE')).toThrow();
  });
});
