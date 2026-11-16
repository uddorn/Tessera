export class ResourceNotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} ${id} was not found`);
    this.name = 'ResourceNotFoundError';
  }
}

export class ResourceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResourceConflictError';
  }
}
