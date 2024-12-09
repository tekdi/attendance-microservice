import {
  ApiTags,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiQuery,
  ApiOperation,
} from '@nestjs/swagger';
import {
  Controller,
  Post,
  Body,
  SerializeOptions,
  Req,
  Request,
  UploadedFile,
  Headers,
  UsePipes,
  ValidationPipe,
  Res,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { AttendanceDto, BulkAttendanceDTO } from './dto/attendance.dto';
import { AttendanceSearchDto } from './dto/attendance-search.dto';
import { Response } from 'express';
import { AttendanceService } from './attendance.service';
import { createAttendanceExamplesForSwagger, createBulkAttendanceExamplesForSwagger, searchAttendanceExamples } from './dto/attendance.examples';

@ApiTags('Attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) { }

  @Post()
  @ApiCreatedResponse({
    description: 'Attendance has been created successfully.',
  })
  @ApiOperation({ summary: "Create Attendance" })
  @ApiBody({ type: AttendanceDto, examples: createAttendanceExamplesForSwagger })
  @ApiHeader({
    name: 'tenantid',
  })
  @ApiQuery({
    name: 'userId', required: true, type: 'string', description: 'userId required',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @UsePipes(ValidationPipe)
  public async createAttendance(
    @Headers() headers,
    @Body() attendanceDto: AttendanceDto,
    @Res() response: Response,
    @Query('userId') userId: string, // Now using userId from query
    @UploadedFile() image,
  ) {
    if (!headers['tenantid']) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        errorMessage: 'tenantId is missing in headers',
      });
    }

    attendanceDto.tenantId = headers['tenantid'];
    attendanceDto.image = image?.filename;
    attendanceDto.scope = 'student'; // Set default value to 'student'

    const result = await this.attendanceService.updateAttendanceRecord(
      userId, // Pass userId from query param
      attendanceDto,
      response,
    );
    return result;
  }

  @Post('list')
  @ApiOkResponse({ description: 'Attendance List' })
  @ApiBadRequestResponse({ description: 'Bad Request' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error' })
  @ApiOperation({ summary: "Attendance Search" })
  @ApiBody({ type: AttendanceSearchDto, examples: searchAttendanceExamples })
  // @UseInterceptors(ClassSerializerInterceptor)
  @UsePipes(ValidationPipe)
  @SerializeOptions({
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: "Search Attendance" })
  @ApiHeader({
    name: 'tenantid',
  })
  public async searchAttendanceNew(
    @Headers() headers,
    @Req() request: Request,
    @Body() studentSearchDto: AttendanceSearchDto,
    @Res() response: Response,
  ) {
    let tenantid = headers['tenantid'];
    if (!tenantid) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        errorMessage: 'tenantId is missing in headers',
      });
    }
    const result = await this.attendanceService.searchAttendance(
      tenantid,
      studentSearchDto,
      response,
    );
    return result;
  }

  @Post('bulkAttendance')
  @ApiCreatedResponse({
    description: 'Attendance has been created successfully.',
  })
  @ApiBadRequestResponse({ description: 'Bad Request' })
  @ApiOkResponse({ description: 'Attendance updated successfully' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  @ApiBody({ type: BulkAttendanceDTO, examples: createBulkAttendanceExamplesForSwagger })
  @ApiOperation({ summary: "Create Bulk Attendance" })
  @ApiHeader({
    name: 'tenantid',
  })
  @ApiQuery({
    name: 'userId', required: true, type: 'string', description: 'userId required',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @UsePipes(ValidationPipe)
  public async multipleAttendance(
    @Headers() headers,
    @Res() response: Response,
    @Body() attendanceDtos: BulkAttendanceDTO,
    @Query('userId') userId: string, // Now using userId from query
  ) {
    const tenantId = headers['tenantid'];
    if (!tenantId) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        errorMessage: 'tenantId is missing in headers',
      });
    }

    attendanceDtos.scope = 'student'; // Set default value to 'student'
    const result = await this.attendanceService.multipleAttendance(
      tenantId,
      userId, // Pass userId from query param
      attendanceDtos,
      response,
    );
    return result;
  }
}
