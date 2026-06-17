import { IsString, MinLength, Validate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumberConstraint } from '../../common/validators/is-phone-number.validator';

export class LoginDto {
  @ApiProperty({
    description:
      'Phone number in Kazakh format. Accepts raw digits or formatted input; stored and sent upstream as digits only.',
    examples: ['77073006789', '+7 (707) 300-67-89'],
    minLength: 10,
    maxLength: 20,
  })
  @IsString()
  @Validate(IsPhoneNumberConstraint)
  phone: string;

  @ApiProperty({
    description: 'Upstream account password',
    minLength: 1,
    writeOnly: true,
  })
  @IsString()
  @MinLength(1)
  password: string;
}
