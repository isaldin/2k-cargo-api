import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({
    description: 'Opaque Bearer token for subsequent requests',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  token: string;
}
