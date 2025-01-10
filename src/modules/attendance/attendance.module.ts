import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { AttendanceEntity } from './entities/attendance.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerService } from 'src/common/logger/logger.service';
import { TypeormService } from 'src/common/services/typeorm.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AttendanceEntity]),
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService, LoggerService, TypeormService]
})
export class AttendanceModule { }
