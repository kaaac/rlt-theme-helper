import * as vscode from 'vscode';

interface DataConverter {
    name: string;
    description: string;
    /** Parameter type, empty when the converter takes no parameter */
    parameter: string;
    example?: string;
}

// Data converters from the Flex Renderer manual (data-converters.md)
const dataConverters: DataConverter[] = [
    { name: 'StringToLowerString', description: 'Converts string to lower case', parameter: '', example: '"ABC" -> "abc"' },
    { name: 'StringToUpperString', description: 'Converts string to upper case', parameter: '', example: '"abc" -> "ABC"' },
    { name: 'StringEquals', description: 'Compares with another string', parameter: 'string', example: '"str1", "str1" -> true' },
    { name: 'StringNotEquals', description: 'Compares with another string for inequality', parameter: 'string', example: '"str1", "str1" -> false' },
    { name: 'EmptyObjectToFalse', description: 'Converts null or empty value to false', parameter: '', example: '"" -> false' },
    { name: 'EmptyObjectToTrue', description: 'Converts null or empty value to true', parameter: '', example: '"" -> true' },
    { name: 'BoolReverse', description: 'Inverts boolean value', parameter: '', example: 'true -> false' },
    { name: 'NumberZeroToEmpty', description: 'Converts 0 to empty string', parameter: '', example: '0 -> ""' },
    { name: 'NumberEquals', description: 'Compares with a number', parameter: 'number', example: '0, 5 -> false' },
    { name: 'NumberNotEquals', description: 'Compares with a number for inequality', parameter: 'number', example: '0, 5 -> true' },
    { name: 'NumberGreater', description: 'Checks if value is greater than parameter', parameter: 'number', example: '0, 5 -> false' },
    { name: 'NumberLess', description: 'Checks if value is less than parameter', parameter: 'number', example: '0, 5 -> true' },
    { name: 'NumberAbs', description: 'Returns absolute value', parameter: '', example: '-10 -> 10' },
    { name: 'NumberAdd', description: 'Adds parameter to value', parameter: 'int, float', example: '5, 2 -> 7' },
    { name: 'NumberSubtract', description: 'Subtracts parameter from value', parameter: 'int, float', example: '5, 2 -> 3' },
    { name: 'NumberMultiply', description: 'Multiplies value by parameter', parameter: 'int, float', example: '5, 2 -> 10' },
    { name: 'NumberDivide', description: 'Divides value by parameter', parameter: 'int, float', example: '5, 2 -> 3' },
    { name: 'DateToDayOfMonth', description: 'Returns day number of the date', parameter: 'locale (optional)', example: '01.12.2022 -> 1' },
    { name: 'DateToMonth', description: 'Returns month number of the date', parameter: 'locale (optional)', example: '01.12.2022 -> 12' },
    { name: 'DateToMonthInWords', description: 'Returns month name', parameter: 'locale (optional)', example: '01.12.2022, "es_ES" -> "diciembre"' },
    { name: 'DateToYear', description: 'Returns year of the date', parameter: 'locale (optional)', example: '01.12.2022 -> 2022' },
    { name: 'DateToTime', description: 'Returns time of the date', parameter: 'locale (optional)', example: '01.12.2022 0:00:00 -> "0:00"' },
    { name: 'TemperatureCelciusToFahrenheit', description: 'Converts Celsius to Fahrenheit', parameter: '' },
    { name: 'NumberGroupWithSeparator', description: 'Separates groups of digits with a custom character', parameter: 'string', example: '5500, "." -> 5.500' },
    { name: 'EnumEquals', description: 'Compares enumeration value with a string', parameter: 'string' },
    { name: 'StringAdd', description: 'Appends another string', parameter: 'string' },
    { name: 'StringFormat', description: 'Substitutes the parameter into the original string (replacing "SUB")', parameter: 'string', example: '"202SUB", "2" -> "2022"' },
    { name: 'StringFormatReverse', description: 'Substitutes the original string into the parameter string (replacing "SUB")', parameter: 'string', example: '"2", "202SUB" -> "2022"' },
    { name: 'PercentOf', description: 'Calculates percentage (value is part, parameter is total)', parameter: 'int', example: '10, 100 -> 10' },
    { name: 'PercentTo', description: 'Calculates percentage (value is total, parameter is part)', parameter: 'int', example: '100, 10 -> 10' },
    { name: 'NumberIsEven', description: 'Checks if number is even', parameter: '', example: '1 -> false' },
    { name: 'NumberIsOdd', description: 'Checks if number is odd', parameter: '', example: '1 -> true' },
    { name: 'NumberIsZero', description: 'Checks if number is zero', parameter: '', example: '0 -> true' },
    { name: 'NumberIsNotZero', description: 'Checks if number is not zero', parameter: '', example: '5 -> true' },
    { name: 'NumberToSignedString', description: 'Converts number to string with sign', parameter: '', example: '5 -> "+5", -3 -> "-3"' },
    { name: 'TruncateString', description: 'Truncates string to length, adding "..." if needed', parameter: 'int', example: '"Long string", 5 -> "Long..."' },
    { name: 'GetStringLength', description: 'Returns the length of a string as an integer', parameter: '', example: '"hello" -> 5, null -> 0' },
    { name: 'MaxStringLength', description: 'Truncates string to the specified length without adding "..."', parameter: 'int', example: '"abcdefghij", 5 -> "abcde"' },
    { name: 'DateCustomFormat', description: 'Custom format of date and/or time', parameter: 'Parameters=format:<format>; locale:<locale> (optional)', example: '"format:yyyy; locale:en-US" -> "2022"' }
];

export class DataConvertersCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] | undefined {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);

        if (!linePrefix.endsWith('Converter=')) {
            return undefined;
        }
        return dataConverters.map(converter => {
            const item = new vscode.CompletionItem(converter.name, vscode.CompletionItemKind.Function);
            item.detail = converter.parameter ? `${converter.description} (Parameter: ${converter.parameter})` : converter.description;
            if (converter.example) {
                item.documentation = new vscode.MarkdownString(`Example: \`${converter.example}\``);
            }
            return item;
        });
    }
}

export const DATA_CONVERTER_NAMES = dataConverters.map(converter => converter.name);
