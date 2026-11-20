import {
  NotificationMessage,
  NotificationReportBuilder,
} from './notification-report.builder.js';

export type NotificationEventType =
  'TASK_MOVED' | 'USER_MENTIONED' | 'SPRINT_DEADLINE';

export interface TaskDomainEvent {
  eventId: string;
  workspaceId: string;
  projectCode: string;
  taskKey: string;
  eventType: NotificationEventType;
  recipientUserId: string;
  summary: string;
}

export interface DeliveryReceipt {
  success: boolean;
  channelName: string;
  deliveredAt: string;
}

export interface INotificationChannel {
  readonly channelName: string;
  send(
    recipient: string,
    message: NotificationMessage,
  ): Promise<DeliveryReceipt>;
}

export class WebSocketChannel implements INotificationChannel {
  readonly channelName = 'WebSocket';
  async send(
    _recipient: string,
    message: NotificationMessage,
  ): Promise<DeliveryReceipt> {
    return {
      success: true,
      channelName: this.channelName,
      deliveredAt: message.timestampIso,
    };
  }
}

export class PushMentionChannel implements INotificationChannel {
  readonly channelName = 'WebPush';
  async send(
    _recipient: string,
    message: NotificationMessage,
  ): Promise<DeliveryReceipt> {
    return {
      success: true,
      channelName: this.channelName,
      deliveredAt: message.timestampIso,
    };
  }
}

export class EmailDigestChannel implements INotificationChannel {
  readonly channelName = 'EmailDigest';
  async send(
    _recipient: string,
    message: NotificationMessage,
  ): Promise<DeliveryReceipt> {
    return {
      success: true,
      channelName: this.channelName,
      deliveredAt: message.timestampIso,
    };
  }
}

export abstract class NotificationDispatcher {
  abstract createChannel(event: TaskDomainEvent): INotificationChannel;

  formatPayload(event: TaskDomainEvent): NotificationMessage {
    return new NotificationReportBuilder()
      .setHeader(event.projectCode, event.taskKey, event.eventType)
      .setBody(event.summary)
      .setPriority(event.eventType === 'USER_MENTIONED' ? 'HIGH' : 'NORMAL')
      .build();
  }

  async dispatchEvent(event: TaskDomainEvent): Promise<DeliveryReceipt> {
    return this.createChannel(event).send(
      event.recipientUserId,
      this.formatPayload(event),
    );
  }
}

export class WebSocketDispatcher extends NotificationDispatcher {
  createChannel(): INotificationChannel {
    return new WebSocketChannel();
  }
}

export class PushMentionDispatcher extends NotificationDispatcher {
  createChannel(): INotificationChannel {
    return new PushMentionChannel();
  }
}

export class EmailDigestDispatcher extends NotificationDispatcher {
  createChannel(): INotificationChannel {
    return new EmailDigestChannel();
  }
}
