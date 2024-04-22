import {Module } from '@nestjs/common';
import { RoleController } from './role.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/rbac.entity';
import { PostgresModule } from 'src/adapters/postgres/potsgres-module';
import { PostgresRoleService } from 'src/adapters/postgres/rbac/role-adapter';
import { HttpModule } from '@nestjs/axios';
import { RoleAdapter } from './roleadapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role]),
    HttpModule,
    PostgresModule,
  ],
  controllers: [RoleController],
  providers: [RoleAdapter,PostgresRoleService],
})
export class RoleModule {}
