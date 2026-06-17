import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'isPhoneNumber', async: false })
export class IsPhoneNumberConstraint implements ValidatorConstraintInterface {
  validate(phone: string): boolean {
    if (typeof phone !== 'string') {
      return false;
    }
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must contain between 10 and 15 digits`;
  }
}
