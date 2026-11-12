export class ConnectionPoolManager {
  private static instance: ConnectionPoolManager | undefined;
  private readonly endpoints = new Map<string, boolean>();

  private constructor() {}

  static getInstance(): ConnectionPoolManager {
    return (this.instance ??= new ConnectionPoolManager());
  }

  setEndpointState(endpoint: string, ready: boolean): void {
    this.endpoints.set(endpoint, ready);
  }

  isEndpointReady(endpoint: string): boolean {
    return this.endpoints.get(endpoint) ?? false;
  }
}
