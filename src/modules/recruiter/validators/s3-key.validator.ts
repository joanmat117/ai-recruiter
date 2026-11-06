import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { S3Key } from '../value-objects/evaluation-request.vo';

export function S3KeyValidator(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'S3KeyValidator',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any): boolean {
          try {
            S3Key.from(value);
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          return `S3Key inválido: ${args.value}. Formato esperado: cvs/<uuid>.pdf`;
        },
      },
    });
  };
}