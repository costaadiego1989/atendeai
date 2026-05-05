export abstract class BaseException extends Error {
  constructor(
    public readonly message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class DomainException extends BaseException {
  constructor(message: string, code = 'DOMAIN_ERROR') {
    super(message, code);
  }
}

export class EntityNotFoundException extends BaseException {
  constructor(entity: string, id: string) {
    super(`${entity} with ID ${id} not found`, 'ENTITY_NOT_FOUND');
  }
}

export class ValidationErrorException extends BaseException {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class UnauthorizedException extends BaseException {
  constructor(message: string, code = 'UNAUTHORIZED') {
    super(message, code);
  }
}

export class ForbiddenException extends BaseException {
  constructor(message: string, code = 'FORBIDDEN') {
    super(message, code);
  }
}
