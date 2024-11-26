import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { AttendanceEntity } from './entities/attendance.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from "src/common/guards/keycloak.strategy";
import { LoggerService } from 'src/common/logger/logger.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AttendanceEntity]),
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService, JwtStrategy, LoggerService]
})
export class AttendanceModule { }
