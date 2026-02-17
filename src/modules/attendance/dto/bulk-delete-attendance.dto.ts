import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { 
  IsArray, 
  IsNotEmpty, 
  IsString, 
  ValidateNested,
  ArrayMinSize,
  IsOptional,
  ValidateIf
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

  @ApiPropertyOptional({
    description: 'Single Context ID (use this OR contextIds, not both)',
    example: 'dcb80783-0619-485f-b2a7-ec4df21e7a60',
  })
  @IsString()
  @IsOptional()
  @ValidateIf((o) => !o.contextIds || o.contextIds.length === 0)
  @IsNotEmpty({ message: 'Either contextId or contextIds must be provided' })
  contextId?: string;

  @ApiPropertyOptional({
    description: 'Array of Context IDs for bulk deletion (use this OR contextId, not both)',
    example: ['dcb80783-0619-485f-b2a7-ec4df21e7a60', 'edc91894-1720-596g-c3b8-fd5eg32f8b7d'],
    type: [String],
  })
  @IsArray()
  @IsOptional()
  @ValidateIf((o) => !o.contextId)
  @ArrayMinSize(1, { message: 'contextIds array must contain at least one contextId' })
  @IsString({ each: true, message: 'Each contextId must be a string' })
  contextIds?: string[];

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
