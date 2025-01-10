import { AttendanceEntity } from './entities/attendance.entity';
import { Between, In } from 'typeorm';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AttendanceSearchDto } from './dto/attendance-search.dto';
import { AttendanceDto, BulkAttendanceDTO } from './dto/attendance.dto';
import APIResponse from 'src/common/utils/response';
import { Response } from 'express';
import { LoggerService } from 'src/common/logger/logger.service';
import { TypeormService } from 'src/common/services/typeorm.service';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly loggerService: LoggerService,
    private readonly typeormService: TypeormService,
  ) { }

  /*
    Method to search attendance for all or for the key value pair provided in filter object 
    @body an object of details consisting of attendance details of user (attendance dto)  
    @return Attendance records from attendance table for provided filters
    */

  async searchAttendance(
    tenantId: string,
    attendanceSearchDto: AttendanceSearchDto,
    response: Response,
  ) {
    const apiId = 'api.post.searchAttendance';
    try {
      let { limit, page, filters, facets, sort } = attendanceSearchDto;
      // Set default limit to 20 if not provided
      if (!limit) {
        limit = 20;
      }

      let offset = 0;
      // Calculate offset based on page number
      if (page > 1) {
        offset = limit * (page - 1);
      }

      // Get column names from metadata

      const attendanceKeys = this.typeormService.getMetadata(AttendanceEntity).columns.map(
        (column) => column.propertyName,
      );

      // Default WHERE clause for filtering by tenantId
      let whereClause: any = { tenantId };

      // construct where clause from filters
      if (filters && Object.keys(filters).length > 0) {
        for (const [key, value] of Object.entries(filters)) {
          if (attendanceKeys.includes(key)) {
            if (key === 'attendanceDate') {
              // For attendanceDate, consider NULL values as well
              whereClause[key] = In([value, null]);
            } else {
              whereClause[key] = value;
            }
          } else if (filters.fromDate && filters.toDate) {
            // Convert fromDate and toDate strings to Date objects
            const fromDate = new Date(filters.fromDate);
            const toDate = new Date(filters.toDate);

            // Construct the whereClause with the date range using Between
            whereClause['attendanceDate'] = Between(fromDate, toDate);
          } else {
            // If filter key is invalid (key should be a part of columns), return a BadRequest response
            this.loggerService.error(
              `Please Enter Valid Key to Search. Invalid Key entered Is ${key}`,
              'BAD_REQUEST', apiId, JSON.stringify(attendanceSearchDto)
            );
            return APIResponse.error(
              response,
              apiId,
              'BAD_REQUEST',
              `Please Enter Valid Key to Search. Invalid Key entered Is ${key}`,
              HttpStatus.BAD_REQUEST,
            );
          }
        }
      }

      let attendanceList;

      if (!facets || facets.length === 0) {
        // no facets
        let orderOption: any = {};
        if (sort && Array.isArray(sort) && sort.length === 2) {
          const [column, order] = sort;  // sort on given column
          if (attendanceKeys.includes(column)) { // column to be sorted should exist
            orderOption[column] = order.toUpperCase();
          } else {
            // If sort key is invalid, return a BadRequest response
            this.loggerService.error(
              `${column} Invalid sort key provide column name`,
              'BAD_REQUEST', apiId, JSON.stringify(attendanceSearchDto)
            );
            return APIResponse.error(
              response,
              apiId,
              'BAD_REQUEST',
              `${column} Invalid sort key provide column name`,
              HttpStatus.BAD_REQUEST,
            );
          }
        }

        attendanceList = await this.typeormService.find(AttendanceEntity, {
          where: whereClause,
          order: orderOption, // Apply sorting option
        });
        const paginatedAttendanceList = attendanceList.slice(
          offset,
          offset + limit,
        );
        this.loggerService.log(
          'Attendance List Fetched Successfully',
          apiId,
        );
        return APIResponse.success(
          response,
          apiId,
          { data: { attendanceList: paginatedAttendanceList } },
          HttpStatus.OK,
          'Attendance List Fetched Successfully',
        );
      }
      if (facets && facets.length > 0) {
        // absent_percentage and present_percentage is valid sort key when facets are provided

        attendanceList = await this.typeormService.find(AttendanceEntity, {
          where: whereClause,
        });

        let facetFields = [];
        // Check for invalid facets
        for (const facet of facets) {
          if (!attendanceKeys.includes(facet)) {
            // If facet is not present in attendanceKeys, return a BadRequest response
            this.loggerService.error(
              `${facet} Invalid facet`,
              'BAD_REQUEST', apiId, JSON.stringify(attendanceSearchDto)
            );
            return APIResponse.error(
              response,
              apiId,
              'BAD_REQUEST',
              `${facet} Invalid facet`,
              HttpStatus.BAD_REQUEST,
            );
          }

          facetFields.push({ name: facet, field: facet });
        }

        let result = {};
        // Process the data to calculate counts based on each facet
        for (const facet of facetFields) {
          const { field } = facet;
          const tree = await this.facetedSearch(
            attendanceList,
            [facet],
            sort,
          );

          if (!tree) {
            this.loggerService.error(
              'Invalid Sort Key for facets it has to be present_percentage or absent_percentage',
              'BAD_REQUEST', apiId, JSON.stringify(attendanceSearchDto)
            );
            return APIResponse.error(
              response,
              apiId,
              'Invalid Sort Key for facets it has to be present_percentage or absent_percentage',
              'BAD_REQUEST',
              HttpStatus.BAD_REQUEST,
            );
          }
          result[field] = tree[field];
        }

        this.loggerService.log(
          'Attendance List Fetched Successfully',
          apiId,
        );
        return APIResponse.success(
          response,
          apiId,
          {
            data: {
              result: result,
            },
          },
          HttpStatus.OK,
          'Attendance List Fetched Successfully',
        );
      }
    } catch (error) {
      const errorMessage = error.message || 'Internal Server Error';
      this.loggerService.error(
        'INTERNAL_SERVER_ERROR',
        errorMessage, apiId, JSON.stringify(attendanceSearchDto)
      );
      return APIResponse.error(
        response,
        apiId,
        'INTERNAL_SERVER_ERROR',
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAttendance(userId, contextId, date) {
    const data = await this.typeormService.findOne(AttendanceEntity
      , {
        where: {
          userId,
          contextId,
          attendanceDate: date,
        },
      });
    if (!data) {
      return null;
    }
    return data;
  }

  async facetedSearch(attendanceRecords, facets, sort) {
    // for each facet provided (facet is a column in table) calculate absent_percentage and present_percentage along with present and absent count for unique records 

    const tree = {};
    const attendanceKeys = new Set<string>();
    // Populate attendanceKeys with distinct attendance values

    // for each data collect unique record
    attendanceRecords.forEach((item) => {
      const attendanceValue = item.attendance;
      if (attendanceValue) {
        attendanceKeys.add(attendanceValue);
      }
    });

    // Iterate over facets
    for (const facet of facets) {
      const { field } = facet;

      // Initialize main facet in tree
      tree[field] = {};

      // Iterate over data to count occurrences of each field value
      for (const item of attendanceRecords) {
        const value = item[field];
        const attendanceValue = item['attendance'];

        // If contextId doesn't exist in the tree, initialize it with an empty object
        if (!tree[field][value]) {
          tree[field][value] = {};
        }

        // Increment count for attendanceValue
        if (!tree[field][value][attendanceValue]) {
          tree[field][value][attendanceValue] = 1;
        } else {
          tree[field][value][attendanceValue]++;
        }
      }

      // Calculate percentage for each value
      for (const value in tree[field]) {
        const counts = tree[field][value];
        const totalCount = Object.values(counts).reduce(
          (acc: number, curr: unknown) => acc + (curr as number),
          0,
        );

        for (const key in counts) {
          const count = counts[key];
          const percentage = (count / Number(totalCount)) * 100; // Convert totalCount to a number
          counts[key + '_percentage'] = percentage.toFixed(2); // Round percentage to two decimal places
        }
      }

      // Assign default values for sorting
      for (const value in tree[field]) {
        for (const attendanceValue of attendanceKeys) {
          const percentageKey = `${attendanceValue}_percentage`;
          if (!tree[field][value].hasOwnProperty(percentageKey)) {
            tree[field][value][percentageKey] = '0.00'; // Set default value internally
          }
        }
      }

      // Validate sort keys
      if (sort) {
        const [sortField, sortOrder] = sort;
        const validSortKey = `${sortField.replace('_percentage', '')}_percentage`;

        if (
          !attendanceKeys.has(sortField.replace('_percentage', '')) &&
          sortField !== 'present_percentage' &&
          sortField !== 'absent_percentage'
        ) {
          return false;
        }

        // Sort the tree based on the provided sort parameter
        tree[field] = await this.sortTree(tree[field], validSortKey, sortOrder);
      }
    }

    // Remove default values from the response
    for (const field in tree) {
      for (const value in tree[field]) {
        for (const attendanceValue of attendanceKeys) {
          const percentageKey = `${attendanceValue}_percentage`;
          if (tree[field][value][percentageKey] === '0.00') {
            delete tree[field][value][percentageKey]; // Remove default value from response
          }
        }
      }
    }

    return tree;
  }

  // Helper function to sort the tree based on the provided sortField and sortOrder
  async sortTree(tree, sortField, sortOrder) {
    const sortedTree = {};

    // Convert the object keys (values of the sortField) into an array
    const keys = Object.keys(tree);

    // Sort the keys based on the sortField and sortOrder
    keys.sort((a, b) => {
      const valueA = parseFloat(tree[a][sortField] || '0.00'); // Convert string to float
      const valueB = parseFloat(tree[b][sortField] || '0.00'); // Convert string to float

      if (sortOrder === 'asc') {
        return valueA - valueB;
      } else {
        return valueB - valueA;
      }
    });

    // Populate the sortedTree with sorted data
    keys.forEach((key) => {
      sortedTree[key] = tree[key];
    });

    return sortedTree;
  }

  /* 
    Method to create,update or add attendance for valid user in attendance table
    @body an object of details consisting of attendance details of user (attendance dto)  
    @return updated details of attendance record 
    */

  public async updateAttendanceRecord(
    loginUserId: string | null,
    attendanceDto: AttendanceDto,
    res: Response,
  ) {
    let apiId = 'api.post.createAttendanceRecord';
    try {
      const attendanceFound = await this.updateAttendance(
        attendanceDto,
        loginUserId,
      );
      if (attendanceFound) {
        this.loggerService.log(
          'Attendance updated successfully',
          apiId,
          loginUserId
        );
        return APIResponse.success(
          res,
          apiId,
          { data: attendanceFound },
          HttpStatus.OK,
          'Attendance updated successfully',
        );
      } else {
        if (!attendanceDto.scope) {
          attendanceDto.scope = 'student';
        }
        attendanceDto.createdBy = loginUserId;
        attendanceDto.updatedBy = loginUserId;
        let attendanceCreated = await this.createAttendance(attendanceDto);
        this.loggerService.log(
          'Attendance created successfully',
          apiId,
          loginUserId
        );
        return APIResponse.success(
          res,
          apiId,
          { data: attendanceCreated },
          HttpStatus.CREATED,
          'Attendance created successfully',
        );
      }
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.error(
        'INTERNAL_SERVER_ERROR',
        errorMessage, apiId, loginUserId
      );
      return APIResponse.error(
        res,
        apiId,
        'Internal Server Error',
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /*Method to update attendance for userId
    @return updated attendance record based on attendanceId
    */
  public async updateAttendance(
    attendanceDto: AttendanceDto,
    loginUserId: string,
  ) {
    try {
      attendanceDto.updatedBy = loginUserId;
      let attendanceFound = await this.findAttendance(
        attendanceDto.userId,
        attendanceDto.contextId,
        attendanceDto.attendanceDate,
      );
      if (!attendanceFound) {
        return false;
      }
      let data = this.typeormService.merge(
        AttendanceEntity,
        attendanceFound,
        attendanceDto,
      );
      const updatedAttendanceRecord =
        await this.typeormService.save(AttendanceEntity, data);
      return updatedAttendanceRecord;
    } catch (error) {
      return error;
    }
  }

  public async createAttendance(attendanceDto: AttendanceDto) {
    try {
      const attendance = this.typeormService.create(AttendanceEntity, attendanceDto);
      const result = await this.typeormService.save(AttendanceEntity, attendance);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /*Method to add multiple attendance records in Attendance table
    @body Array of objects containing attendance details of user (AttendanceDto)
    */

  public async multipleAttendance(
    tenantId: string,
    userId: string | null,
    attendanceData: BulkAttendanceDTO,
    res: Response,
  ) {
    const loginUserId = userId;
    const results = [];
    const errors = [];
    let apiId = 'api.post.bulkAttendance';

    try {
      let count = 0;

      for (let attendance of attendanceData.userAttendance) {
        const userAttendance = new AttendanceDto({
          attendanceDate: attendanceData.attendanceDate,
          contextId: attendanceData?.contextId,
          context: attendanceData?.context,
          scope: attendanceData?.scope,
          attendance: attendance?.attendance,
          userId: attendance?.userId,
          tenantId: tenantId,
          remark: attendance?.remark,
          latitude: attendance?.latitude,
          longitude: attendance?.longitude,
          image: attendance?.image,
          metaData: attendance?.metaData,
          syncTime: attendance?.syncTime,
          session: attendance?.session,
          createdBy: loginUserId,
          updatedBy: loginUserId,
        });

        try {
          const attendanceRes = await this.updateAttendance(
            userAttendance,
            loginUserId,
          );
          if (!attendanceRes) {
            let createAttendance = await this.createAttendance(userAttendance);
            results.push({ status: 'created', attendance: createAttendance });
          } else {
            results.push({ status: 'updated', attendance: attendanceRes });
          }
          count++;
        } catch (e) {
          errors.push({ attendance, error: e.message });
        }
      }
      if (errors.length > 0) {
        if (!results.length) {
          this.loggerService.error(
            'BAD_REQUEST',
            `Attendance Can not be created or updated.Error is ${errors[0].error}`,
            apiId,
            userId
          );
          return APIResponse.error(
            res,
            apiId,
            'BAD_REQUEST',
            `Attendance Can not be created or updated.Error is ${errors[0].error}`,
            HttpStatus.BAD_REQUEST,
          );
        }
        this.loggerService.log(
          'Attendance created successfully',
          apiId,
          userId
        );
        return APIResponse.success(
          res,
          apiId,
          { count: count, errors: errors, successresults: results },
          HttpStatus.CREATED,
          'Bulk Attendance Processed with some errors',
        );
      } else {
        this.loggerService.log(
          'Attendance created successfully',
          apiId,
          userId
        );
        return APIResponse.success(
          res,
          apiId,
          { totalCount: count, responses: results },
          HttpStatus.CREATED,
          'Bulk Attendance Updated successfully',
        );
      }
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.error(
        'Internal Server Error',
        e.message,
        apiId,
        userId
      );
      return APIResponse.error(
        res,
        apiId,
        'Internal Server Error',
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
