import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { JobDescription } from '../value-objects/evaluation-request.vo';

export function JobDescriptionValidator(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'JobDescriptionValidator',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any): boolean {
          try {
            JobDescription.from(value);
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          return 'JobDescription debe tener al menos 50 caracteres';
        },
      },
    });
  };
}