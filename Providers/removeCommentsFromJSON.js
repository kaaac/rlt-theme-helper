function removeCommentsFromJSON(jsonString) {
    return jsonString
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '');
}

module.exports = removeCommentsFromJSON;