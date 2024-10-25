const vscode = require('vscode');

const dataConverters = [
    { name: 'StringToLowerString', description: '' },
    { name: 'StringToUpperString', description: '' },
    { name: 'StringEquals', description: 'string comparison' },
    { name: 'StringNotEquals', description: 'string comparison' },
    { name: 'EmptyObjectToFalse', description: 'converting null or empty value to bool' },
    { name: 'EmptyObjectToTrue', description: 'converting null or empty value to bool' },
    { name: 'BoolReverse', description: '' },
    { name: 'NumberZeroToEmpty', description: '' },
    { name: 'NumberEquals', description: 'number comparison' },
    { name: 'NumberNotEquals', description: 'number comparison' },
    { name: 'NumberGreater', description: 'number comparison' },
    { name: 'NumberLess', description: 'number comparison' },
    { name: 'NumberAbs', description: 'absolute value of the number' },
    { name: 'NumberAdd', description: 'add parameter to value' },
    { name: 'NumberSubtract', description: 'subtract parameter from value' },
    { name: 'NumberMultiply', description: 'value and parameter multiplication' },
    { name: 'NumberDivide', description: 'dividing a value by a parameter' },
    { name: 'DateToDayOfMonth', description: 'day number of the date' },
    { name: 'DateToMonth', description: 'month number of the date' },
    { name: 'DateToMonthInWords', description: 'month of the date' },
    { name: 'DateToYear', description: 'year of the date' },
    { name: 'DateToTime', description: 'time of the date' },
    { name: 'TemperatureCelciusToFahrenheit', description: 'convert temperature from Celcius to Fahrenheit value' },
    { name: 'NumberGroupWithSeparator', description: 'separates groups of digits with a custom character' },
    { name: 'EnumEquals', description: 'compares the enumeration value with a string' },
    { name: 'StringAdd', description: 'adds another string to the string' },
    { name: 'StringFormat', description: 'substitutes the parameter- string in a special place of the original string (instead “SUB”)' },
    { name: 'StringFormatReverse', description: 'ubstitutes the original string in a special place of the parameter-string (instead “SUB”)' },
    { name: 'PercentOf', description: 'calculates the percentage. The initial value from which the percentage is calculated serves as the parameter' },
    { name: 'PercentTo', description: 'calculates the percentage. The initial value from which the percentage is calculated serves as the original value' },
    { name: 'NumberIsEven', description: '' },
    { name: 'NumberIsOdd', description: '' },
    { name: 'TruncateString', description: 'Truncate string to a certain length, adding "..." to the end if necessary' },
    { name: 'DateCustomFormat', description: 'Custom format of date and/or time.' },
];

class DataConvertersCompletionProvider {
    provideCompletionItems(document, position, token, context){
        const linePrefix = document.lineAt(position).text.substr(0, position.character);

        if(!linePrefix.endsWith('Converter=')){
            return undefined;
        }
        const completionItems = dataConverters.map(converter => {
            const item = new vscode.CompletionItem(converter.name, vscode.CompletionItemKind.Function);
            item.detail = converter.description;
            return item;
        });
        return completionItems;
    }
}

module.exports = DataConvertersCompletionProvider;