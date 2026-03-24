import { AttendanceFiltersDto } from "./attendance-search.dto";
import { UserAttendanceDTO } from "./attendance.dto";
import { DeleteAttendanceRecordDTO } from "./bulk-delete-attendance.dto";


const getExamples = (obj) => {
    return Object.entries(
        obj,
    ).reduce(
        (acc, [key, value]) => {
            acc[key] = {
                summary: `Example for ${key}`,
                description: `Detailed example for ${key}`,
                value, // Use the example value as-is
            };
            return acc;
        },
        {} as Record<string, { summary: string; description: string; value: any }>,
    );
}

const createAttendanceDto: Record<string, {
    attendanceDate: string;
    attendance: string;
    remark: string;
    latitude: number;
    longitude: number;
    image: string;
    metaData: object;
    syncTime: string;
    session: string;
    context: string;
    contextId: string;
    scope: string;
}> = {
    CreateAttendance: {
        attendanceDate: "2024-12-09",
        attendance: "present / absent / on-leave",
        remark: "",
        latitude: 0,
        longitude: 0,
        image: "",
        metaData: {},
        syncTime: "",
        session: "Morning",
        context: "event / cohort",
        contextId: "dcb80783-0619-485f-b2a7-ec4df21e7a60",
        scope: "self / Learner"
    }
}

export const createAttendanceExamplesForSwagger = getExamples(createAttendanceDto)

const createBulkAttendanceDto: Record<string, {
    attendanceDate: string;
    contextId: string;
    context: string;
    scope: string;
    userAttendance: UserAttendanceDTO[]
}> = {
    CreateBulkAttendance: {
        attendanceDate: "2024-12-09",
        contextId: "dcb80783-0619-485f-b2a7-ec4df21e7a60",
        context: "cohort / event",
        scope: "self / Learner",
        userAttendance: [
            {
                userId: "2447aa0c-4111-4cb9-94d1-9898ef6975a1",
                attendance: "",
                remark: "string",
                latitude: 0,
                longitude: 0,
                image: "string",
                metaData: {},
                syncTime: "string",
                session: "string"
            }
        ]
    }
}

export const createBulkAttendanceExamplesForSwagger = getExamples(createBulkAttendanceDto)

/**
* @description Search attendance example with the following rules:
* - All fields are optional
* - When facets are provided, sort key must be either 'present_percentage' or 'absent_percentage'
* - Date format should follow ISO 8601
*/
const searchAttendanceDto: Record<string, {
    limit: number,
    page: number,
    filters: AttendanceFiltersDto,
    facets: string[],
    sort: [string, string]
}> = {
    // All keys are optional
    SearchAttendance: {
        limit: 0,
        page: 0,
        filters: {
            contextId: "2b73b482-d8bf-41a2-bd49-91a7a4abd7d4",
            fromDate: new Date("2024-11-07"),
            toDate: new Date("2024-11-13"),
            scope: "student",
            context: "cohort"
        },
        facets: ["contextId"],
        sort: ["absent_percentage", "asc"]
    }
}

export const searchAttendanceExamples = getExamples(searchAttendanceDto);

const bulkDeleteAttendanceDto: Record<string, {
    attendanceRecords: DeleteAttendanceRecordDTO[]
}> = {
    SingleDelete: {
        attendanceRecords: [
            {
                userId: "2447aa0c-4111-4cb9-94d1-9898ef6975a1",
                contextId: "dcb80783-0619-485f-b2a7-ec4df21e7a60",
                date: "2024-12-09"
            }
        ]
    },
    MultipleContextsWithArray: {
        attendanceRecords: [
            {
                userId: "2447aa0c-4111-4cb9-94d1-9898ef6975a1",
                contextIds: [
                    "dcb80783-0619-485f-b2a7-ec4df21e7a60",
                    "edc91894-1720-596g-c3b8-fd5eg32f8b7d",
                    "fea02905-2831-6a7h-d4c9-ge6fh43g9c8e"
                ],
                date: "2024-12-09"
            }
        ]
    },
    MultipleUsersWithContextArrays: {
        attendanceRecords: [
            {
                userId: "2447aa0c-4111-4cb9-94d1-9898ef6975a1",
                contextIds: [
                    "dcb80783-0619-485f-b2a7-ec4df21e7a60",
                    "edc91894-1720-596g-c3b8-fd5eg32f8b7d"
                ],
                date: "2024-12-09"
            },
            {
                userId: "3558bb1d-5222-5dc0-a5e2-af5eg22f6b7c",
                contextIds: [
                    "dcb80783-0619-485f-b2a7-ec4df21e7a60",
                    "fea02905-2831-6a7h-d4c9-ge6fh43g9c8e"
                ],
                date: "2024-12-10"
            }
        ]
    },
    MixedFormat: {
        attendanceRecords: [
            {
                userId: "2447aa0c-4111-4cb9-94d1-9898ef6975a1",
                contextIds: ["dcb80783-0619-485f-b2a7-ec4df21e7a60", "edc91894-1720-596g-c3b8-fd5eg32f8b7d"],
                date: "2024-12-09"
            },
            {
                userId: "3558bb1d-5222-5dc0-a5e2-af5eg22f6b7c",
                contextId: "dcb80783-0619-485f-b2a7-ec4df21e7a60",
                date: "2024-12-10"
            }
        ]
    },
    BulkDelete: {
        attendanceRecords: [
            {
                userId: "2447aa0c-4111-4cb9-94d1-9898ef6975a1",
                contextId: "dcb80783-0619-485f-b2a7-ec4df21e7a60",
                date: "2024-12-09"
            },
            {
                userId: "3558bb1d-5222-5dc0-a5e2-af5eg22f6b7c",
                contextId: "dcb80783-0619-485f-b2a7-ec4df21e7a60",
                date: "2024-12-10"
            },
            {
                userId: "4669cc2e-6333-6ed1-b6f3-bg6fh33g7c8d",
                contextId: "edc91894-1720-596g-c3b8-fd5eg32f8b7d",
                date: "2024-12-11"
            }
        ]
    },
    BulkDeleteMultipleContexts: {
        attendanceRecords: [
            {
                userId: "2447aa0c-4111-4cb9-94d1-9898ef6975a1",
                contextId: "dcb80783-0619-485f-b2a7-ec4df21e7a60",
                date: "2024-12-09"
            },
            {
                userId: "2447aa0c-4111-4cb9-94d1-9898ef6975a1",
                contextId: "edc91894-1720-596g-c3b8-fd5eg32f8b7d",
                date: "2024-12-09"
            },
            {
                userId: "3558bb1d-5222-5dc0-a5e2-af5eg22f6b7c",
                contextId: "dcb80783-0619-485f-b2a7-ec4df21e7a60",
                date: "2024-12-10"
            },
            {
                userId: "3558bb1d-5222-5dc0-a5e2-af5eg22f6b7c",
                contextId: "edc91894-1720-596g-c3b8-fd5eg32f8b7d",
                date: "2024-12-10"
            }
        ]
    }
}

export const bulkDeleteAttendanceExamplesForSwagger = getExamples(bulkDeleteAttendanceDto);