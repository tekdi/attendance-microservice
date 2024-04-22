import { Module } from '@nestjs/common';
import { PrivilegeController } from './privilege.controller';
import { Privilege } from './entities/privilege.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { PostgresModule } from 'src/adapters/postgres/potsgres-module';
import { PrivilegeAdapter } from './privilegeadapter';
import { PostgresRoleService } from 'src/adapters/postgres/rbac/role-adapter';
import { PostgresPrivilegeService } from 'src/adapters/postgres/rbac/privilege-adapter';
import { Role } from '../role/entities/rbac.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Privilege,Role]),
    HttpModule,
    PostgresModule,
  ],
  controllers: [PrivilegeController],
  providers: [PrivilegeAdapter,PostgresPrivilegeService,PostgresRoleService]
})
export class PrivilegeModule {}



