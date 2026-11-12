export interface NotificationMessage {
  header: string;
  bodyMarkdown: string;
  priority: 'HIGH' | 'NORMAL';
  timestampIso: string;
}

export class NotificationReportBuilder {
  private header = '';
  private bodyMarkdown = '';
  private priority: NotificationMessage['priority'] = 'NORMAL';

  setHeader(projectCode: string, taskKey: string, type: string): this {
    this.header = `[${projectCode}] ${taskKey}: ${type}`;
    return this;
  }

  setBody(summary: string): this {
    this.bodyMarkdown = summary;
    return this;
  }

  setPriority(priority: NotificationMessage['priority']): this {
    this.priority = priority;
    return this;
  }

  build(): NotificationMessage {
    return {
      header: this.header,
      bodyMarkdown: this.bodyMarkdown,
      priority: this.priority,
      timestampIso: new Date().toISOString(),
    };
  }
}
