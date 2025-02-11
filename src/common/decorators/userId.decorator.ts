import {
    createParamDecorator,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { jwtDecode } from 'jwt-decode';

export const GetUserId = createParamDecorator(
    (data: unknown, ctx: ExecutionContext): string => {
        const request = ctx.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) {
            throw new UnauthorizedException("Invalid or missing token");
        }

        try {
            const token = authHeader.split(' ')[1]; // Extract JWT token
            const decoded: any = jwtDecode(token); // Decode token

            if (!decoded?.sub) {
                throw new UnauthorizedException("Token missing user identifier (sub)");
            }

            return decoded.sub;
        } catch (error) {
            throw new UnauthorizedException("Auth token invalid");
        }
    },
);
