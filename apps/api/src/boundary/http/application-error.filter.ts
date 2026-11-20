import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  NotFoundException,
} from '@nestjs/common';
import {
  ResourceConflictError,
  ResourceNotFoundError,
} from '../../modules/projects/application/application.errors.js';

@Catch(ResourceConflictError, ResourceNotFoundError)
export class ApplicationErrorFilter implements ExceptionFilter {
  catch(
    exception: ResourceConflictError | ResourceNotFoundError,
    host: ArgumentsHost,
  ): void {
    const response = host.switchToHttp().getResponse();
    const httpException =
      exception instanceof ResourceConflictError
        ? new ConflictException(exception.message)
        : new NotFoundException(exception.message);

    response
      .status(httpException.getStatus())
      .json(httpException.getResponse());
  }
}
