import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class Initial1749660000000 implements MigrationInterface {
  name = 'Initial1749660000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'api_sessions',
        columns: [
          {
            name: 'token',
            type: 'varchar',
            isPrimary: true,
          },
          {
            name: 'phone',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'passwordEncrypted',
            type: 'blob',
            isNullable: false,
          },
          {
            name: 'siteCookies',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'userId',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'datetime',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'lastUsedAt',
            type: 'datetime',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('api_sessions');
  }
}
