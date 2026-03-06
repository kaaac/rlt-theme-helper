function extractPropertyNames(json, propertyNames, property, filePath){
    if(Array.isArray(json)){
        json.forEach(item => extractPropertyNames(item, propertyNames, property, filePath));
    } else if (typeof json === 'object' && json != null){
        for (const key in json) {
            if (key === property && typeof json[key] === 'string'){
                if(!propertyNames.has(json[key])){
                    propertyNames.set(json[key],{
                        name: json[key],
                        details: 'Global',
                        source: filePath,
                        definition: json  // Przechowuj pełną definicję obiektu
                    });
                }
            } else if (key === 'Styles' && Array.isArray(json[key]) && property === 'StyleName') {
                // Wyciągaj TYLKO style (nie triggery) definiowane inline w property Styles
                json[key].forEach(style => {
                    if (typeof style === 'object' && style !== null) {
                        if (style[property] && typeof style[property] === 'string') {
                            if(!propertyNames.has(style[property])){
                                propertyNames.set(style[property],{
                                    name: style[property],
                                    details: 'Inline (Styles property)',
                                    source: filePath,
                                    definition: style  // Przechowuj pełną definicję
                                });
                            }
                        }
                    }
                });
            } else {
                extractPropertyNames(json[key], propertyNames, property, filePath)
            }
        }
    }
}

module.exports = extractPropertyNames;