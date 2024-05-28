import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './common/database/database.module';
import { CacheModule } from '@nestjs/cache-manager';
import { MemoryStore } from 'cache-manager-memory-store';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from "@nestjs/typeorm";
import { AttendanceModule } from './modules/attendance/attendance.module';
// import { AssessmentTracking } from "src/modules/tracking_assesment/entities/tracking-assessment-entity";

@Module({
  imports: [
    AttendanceModule,
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    CacheModule.register({ isGlobal: true, store: MemoryStore })
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
