import { AttendanceFiltersDto } from "./attendance-search.dto";
import { UserAttendanceDTO } from "./attendance.dto";


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
        scope: "self / student"
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
        scope: "self / student",
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
        facets: ["contextId"], // if facets are provided ,Sort Key for has to be present_percentage or absent_percentage
        sort: ["absent_percentage", "asc"]
    }
}

export const searchAttendanceExamples = getExamples(searchAttendanceDto);