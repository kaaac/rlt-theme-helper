function extractPropertyNames(json, propertyNames, property){
    if(Array.isArray(json)){
        json.forEach(item => extractPropertyNames(item, propertyNames, property));
    } else if (typeof json === 'object' && json != null){
        for (const key in json) {
            if (key === property && typeof json[key] === 'string'){
                if(!propertyNames.has(json[key])){
                    propertyNames.set(json[key],{
                        name: json[key],
                        details: 'Global'
                    });
                }
            } else {
                extractPropertyNames(json[key], propertyNames, property)
            }
        }
    }
}

module.exports = extractPropertyNames;