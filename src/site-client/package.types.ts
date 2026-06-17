import { ApiProperty } from '@nestjs/swagger';

export class PackageStatus {
  @ApiProperty({
    description: 'Human-readable status label',
    example: 'В пути',
  })
  label: string;

  @ApiProperty({
    description: 'Status timestamp as an ISO-8601 string with timezone offset',
    example: '2026-06-15T12:01:06+05:00',
    nullable: true,
    type: String,
  })
  timestamp: string | null;

  @ApiProperty({
    description: 'Raw timestamp text exactly as shown upstream',
    example: '2026-06-15 12:01:06',
    nullable: true,
    type: String,
  })
  rawTimestamp: string | null;

  @ApiProperty({
    description:
      'Whether the status is currently active (green) or inactive/future (gray)',
    example: true,
  })
  active: boolean;
}

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

  @ApiProperty({
    description: 'The most recent active status in upstream DOM order',
    type: PackageStatus,
    nullable: true,
  })
  currentStatus: PackageStatus | null;

  @ApiProperty({
    description: 'All status rows visible upstream in DOM order',
    type: [PackageStatus],
  })
  statuses: PackageStatus[];
}
