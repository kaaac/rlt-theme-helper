function extractPropertyNamesFromCurrentFile(json, propertyNames, property, filePath) {
    if (Array.isArray(json)) {
        json.forEach(item => extractPropertyNamesFromCurrentFile(item, propertyNames, property, filePath));
    } else if (typeof json === 'object' && json !== null) {
        for (const key in json) {
            if (key === 'Components' && Array.isArray(json[key])) {
                // Specjalna obsługa dla Components (tylko ComponentName)
                json[key].forEach(component => {
                    if (component.ComponentName && typeof component.ComponentName === 'string') {
                        propertyNames.set(component.ComponentName, {
                            name: component.ComponentName,
                            details: 'Local',
                            source: filePath
                        });
                    }
                });
            } else if (key === 'Styles' && Array.isArray(json[key]) && property === 'StyleName') {
                // Wyciągaj TYLKO style (nie triggery) definiowane inline w property Styles
                json[key].forEach(style => {
                    if (typeof style === 'object' && style !== null && style[property] && typeof style[property] === 'string') {
                        if(!propertyNames.has(style[property])){
                            propertyNames.set(style[property], {
                                name: style[property],
                                details: 'Local (Styles property)',
                                source: filePath,
                                definition: style  // Przechowuj pełną definicję
                            });
                        }
                    }
                });
                // Rekurencyjnie przeszukuj obiekty w Styles
                json[key].forEach(style => extractPropertyNamesFromCurrentFile(style, propertyNames, property, filePath));
            } else if (key === property && typeof json[key] === 'string') {
                // Wyciągaj StyleName lub TriggerName z bieżącego pliku
                if(!propertyNames.has(json[key])){
                    propertyNames.set(json[key], {
                        name: json[key],
                        details: 'Local',
                        source: filePath,
                        definition: json  // Przechowuj pełną definicję
                    });
                }
            } else {
                extractPropertyNamesFromCurrentFile(json[key], propertyNames, property, filePath);
            }
        }
    }
}

module.exports = extractPropertyNamesFromCurrentFile;