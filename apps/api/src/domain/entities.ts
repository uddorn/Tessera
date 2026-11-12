export type TaskStatus = 'PLANNED' | 'IN_PROGRESS' | 'CODE_REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export abstract class User {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly fullName: string,
    public readonly handle: string,
  ) {}
}

export class ProjectManager extends User {
  readonly department = 'PMO';
  readonly canOverrideWip = true;
}

export class TeamMember extends User {
  readonly specialization = 'Backend Architect';
  constructor(
    userId: string,
    email: string,
    fullName: string,
    handle: string,
    public activeTasksCount = 0,
    public readonly maxWipTasks = 3,
  ) {
    super(userId, email, fullName, handle);
  }
}

export class Comment {
  readonly mentions: string[];
  constructor(
    public readonly commentId: string,
    public readonly authorId: string,
    public readonly markdownText: string,
    public readonly createdAt = new Date().toISOString(),
  ) {
    this.mentions = [...new Set(markdownText.match(/@[a-zA-Z0-9_.]+/g) ?? [])];
  }
}

export class FileAttachment {
  constructor(
    public readonly attachmentId: string,
    public readonly fileName: string,
    public readonly sha256: string,
    public readonly sizeBytes: number,
    public readonly version = 1,
  ) {}
}

export class Task {
  constructor(
    public readonly taskId: string,
    public readonly workspaceId: string,
    public readonly taskKey: string,
    public title: string,
    public priority: TaskPriority,
    public status: TaskStatus,
    public storyPoints: number,
    public version = 1,
    public assignee: User | null = null,
    public comments: Comment[] = [],
    public attachments: FileAttachment[] = [],
  ) {}
}

export class BoardColumn {
  constructor(
    public readonly columnId: string,
    public readonly workspaceId: string,
    public readonly title: string,
    public readonly status: TaskStatus,
    public wipLimit: number,
    public tasks: Task[] = [],
  ) {}
}

export class KanbanBoard {
  constructor(
    public readonly boardId: string,
    public readonly workspaceId: string,
    public readonly name: string,
    public columns: BoardColumn[],
  ) {}
}

export class Project {
  constructor(
    public readonly projectId: string,
    public readonly workspaceId: string,
    public readonly code: string,
    public readonly name: string,
    public boards: KanbanBoard[],
  ) {}
}

export class Workspace {
  constructor(
    public readonly workspaceId: string,
    public readonly title: string,
    public readonly tenantIsolationKey: string,
    public members: User[],
    public projects: Project[],
  ) {}
}
