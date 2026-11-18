import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const projectRoleEnum = pgEnum('project_role', [
  'OWNER',
  'ADMIN',
  'MEMBER',
  'VIEWER',
]);

export const taskStatusEnum = pgEnum('task_status', [
  'PLANNED',
  'IN_PROGRESS',
  'CODE_REVIEW',
  'DONE',
]);

export const taskPriorityEnum = pgEnum('task_priority', [
  'LOW',
  'NORMAL',
  'HIGH',
  'CRITICAL',
]);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    keycloakSubject: varchar('keycloak_subject', { length: 255 }).unique(),
    email: varchar('email', { length: 320 }).notNull().unique(),
    displayName: varchar('display_name', { length: 160 }).notNull(),
    handle: varchar('handle', { length: 64 }).notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('users_handle_format', sql`${table.handle} ~ '^[a-z0-9_.-]+$'`),
  ],
);

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 80 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('workspaces_slug_unique').on(table.slug),
    check(
      'workspaces_slug_format',
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`,
    ),
  ],
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 12 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    description: text('description').notNull().default(''),
    nextTaskNumber: integer('next_task_number').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('projects_workspace_code_unique').on(
      table.workspaceId,
      table.code,
    ),
    index('projects_workspace_idx').on(table.workspaceId),
    check('projects_code_format', sql`${table.code} ~ '^[A-Z][A-Z0-9]*$'`),
    check(
      'projects_next_task_number_positive',
      sql`${table.nextTaskNumber} > 0`,
    ),
  ],
);

export const workspaceMemberships = pgTable(
  'workspace_memberships',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: projectRoleEnum('role').notNull().default('MEMBER'),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    index('workspace_memberships_user_idx').on(table.userId),
  ],
);

export const projectMemberships = pgTable(
  'project_memberships',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: projectRoleEnum('role').notNull().default('MEMBER'),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.userId] }),
    index('project_memberships_user_idx').on(table.userId),
  ],
);

export const boards = pgTable(
  'boards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 160 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex('boards_project_unique').on(table.projectId)],
);

export const boardColumns = pgTable(
  'board_columns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 120 }).notNull(),
    status: taskStatusEnum('status').notNull(),
    position: integer('position').notNull(),
    wipLimit: integer('wip_limit').notNull(),
  },
  (table) => [
    uniqueIndex('board_columns_board_status_unique').on(
      table.boardId,
      table.status,
    ),
    uniqueIndex('board_columns_board_position_unique').on(
      table.boardId,
      table.position,
    ),
    check('board_columns_position_non_negative', sql`${table.position} >= 0`),
    check('board_columns_wip_limit_positive', sql`${table.wipLimit} > 0`),
  ],
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    columnId: uuid('column_id')
      .notNull()
      .references(() => boardColumns.id, { onDelete: 'restrict' }),
    taskKey: varchar('task_key', { length: 32 }).notNull(),
    title: varchar('title', { length: 240 }).notNull(),
    priority: taskPriorityEnum('priority').notNull().default('NORMAL'),
    status: taskStatusEnum('status').notNull().default('PLANNED'),
    storyPoints: integer('story_points').notNull().default(0),
    version: integer('version').notNull().default(1),
    assigneeId: uuid('assignee_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('tasks_workspace_key_unique').on(
      table.workspaceId,
      table.taskKey,
    ),
    index('tasks_project_idx').on(table.projectId),
    index('tasks_column_idx').on(table.columnId),
    index('tasks_assignee_idx').on(table.assigneeId),
    check(
      'tasks_story_points_range',
      sql`${table.storyPoints} >= 0 AND ${table.storyPoints} <= 100`,
    ),
    check('tasks_version_positive', sql`${table.version} > 0`),
  ],
);

export type WorkspaceRow = typeof workspaces.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
