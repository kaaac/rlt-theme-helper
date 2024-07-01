function extractPropertyNamesFromCurrentFile(json, propertyNames, property) {
    if (Array.isArray(json)) {
        json.forEach(item => extractPropertyNamesFromCurrentFile(item, propertyNames, property));
    } else if (typeof json === 'object' && json !== null) {
        for (const key in json) {
            if (key === 'Components' && Array.isArray(json[key])) {
                json[key].forEach(component => {
                    if (component.ComponentName && typeof component.ComponentName === 'string') {
                        propertyNames.set(component.ComponentName, {
                            name: component.ComponentName,
                            details: 'Local'
                        });
                    }
                });
            } else {
                extractPropertyNamesFromCurrentFile(json[key], propertyNames, property);
            }
        }
    }
}

module.exports = extractPropertyNamesFromCurrentFile;