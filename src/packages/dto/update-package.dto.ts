import { IsString, MinLength, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePackageDto {
  @ApiPropertyOptional({
    description: 'New cargo tracking code. Omit to keep the existing value.',
    minLength: 1,
    example: 'XYZ987654321',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  trackCode?: string;

  @ApiPropertyOptional({
    description: 'New display name. Omit to keep the existing value.',
    minLength: 1,
    example: 'Updated order #42',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
