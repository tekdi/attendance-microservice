import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function IsValidDate(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            name: 'isValidDate',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: {
                validate(value: any) {
                    // Parse the value as a date
                    const date = new Date(value);
                    // Check if it's a valid date
                    return !isNaN(date.getTime()) && value === date.toISOString().split('T')[0];
                },
                defaultMessage(args: ValidationArguments) {
                    return `${args.property} must be a valid calendar date in the format yyyy-mm-dd.`;
                },
            },
        });
    };
}
