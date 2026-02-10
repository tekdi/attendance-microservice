import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { 
  IsArray, 
  IsNotEmpty, 
  IsString, 
  ValidateNested,
  ArrayMinSize 
} from 'class-validator';
import { IsValidDate } from 'src/common/utils/date.validator';
import { Matches } from 'class-validator';

export class DeleteAttendanceRecordDTO {
  @ApiProperty({
    description: 'User ID',
    example: 'e1a2f3b4-5c6d-7e8f-9a0b-1c2d3e4f5a6b',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Context ID (e.g., classId, cohortId)',
    example: 'dcb80783-0619-485f-b2a7-ec4df21e7a60',
  })
  @IsString()
  @IsNotEmpty()
  contextId: string;

  @ApiProperty({
    description: 'Attendance date in format yyyy-mm-dd',
    example: '2024-12-09',
  })
  @IsNotEmpty()
  @IsValidDate({ message: 'The date provided is not a valid calendar date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Please provide a valid date in the format yyyy-mm-dd' })
  date: string;
}

export class BulkDeleteAttendanceDTO {
  @ApiProperty({
    description: 'Array of attendance records to delete',
    type: [DeleteAttendanceRecordDTO],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one record must be provided for deletion' })
  @ValidateNested({ each: true })
  @Type(() => DeleteAttendanceRecordDTO)
  attendanceRecords: DeleteAttendanceRecordDTO[];
}
