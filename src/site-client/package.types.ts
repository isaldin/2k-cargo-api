import { ApiProperty } from '@nestjs/swagger';

export class Package {
  @ApiProperty({
    description: 'Upstream package item id',
    example: 12345,
  })
  id: number;

  @ApiProperty({
    description: 'Cargo tracking code',
    example: 'ABC123456789',
  })
  trackCode: string;

  @ApiProperty({
    description: 'Display name or description for the package',
    example: 'Sneakers order #42',
  })
  name: string;
}
