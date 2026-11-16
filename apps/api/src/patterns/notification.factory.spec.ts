import {
  PushMentionDispatcher,
  TaskDomainEvent,
} from './notification.factory.js';

describe('Notification Factory Method', () => {
  it('uses high priority for a mention', async () => {
    const event: TaskDomainEvent = {
      eventId: 'evt-1',
      workspaceId: 'ws-901',
      projectCode: 'PAY',
      taskKey: 'PAY-42',
      eventType: 'USER_MENTIONED',
      recipientUserId: 'usr-olena',
      summary: '@o.koval, please review',
    };
    const dispatcher = new PushMentionDispatcher();

    expect(dispatcher.formatPayload(event).priority).toBe('HIGH');
    await expect(dispatcher.dispatchEvent(event)).resolves.toMatchObject({
      success: true,
      channelName: 'WebPush',
    });
  });
});
