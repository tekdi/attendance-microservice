import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './common/database/database.module';
import { ConfigModule } from '@nestjs/config';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { PermissionMiddleware } from './common/middleware/permission.middleware';
import { RolePermissionModule } from './modules/permissionRbac/rolePermissionMapping/role-permission.module';
import { KafkaModule } from './kafka/kafka.module';
import kafkaConfig from './kafka/kafka.config';

@Module({
  imports: [
    AttendanceModule,
    ConfigModule.forRoot({
      load: [kafkaConfig], // Load the Kafka config
      isGlobal: true,
    }),
    DatabaseModule,
    // CacheModule.register({ isGlobal: true, store: MemoryStore }),
    RolePermissionModule,
    KafkaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
