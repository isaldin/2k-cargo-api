import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePackageDto {
  @ApiProperty({
    description: 'Cargo tracking code',
    minLength: 1,
    example: 'ABC123456789',
  })
  @IsString()
  @MinLength(1)
  trackCode: string;

  @ApiProperty({
    description: 'Display name or description for the package',
    minLength: 1,
    example: 'Sneakers order #42',
  })
  @IsString()
  @MinLength(1)
  name: string;
}
