const snippets = {
    BlockRoot: {
        body: [
            '{',
            '\t"BlockRoot" : $1',
            '}'
        ],
    },
    Canvas: {
        body: [
            '{',
            '\t"BlockType" : "Canvas",',
            '\t"Items" : [',
            '\t\t$1',
            '\t]',
            '}'
        ],
    },
    ColorizeBackground : {
        body: [
            '{',
            '\t"Enabled" : true,',
            '\t"Color" : "$1",',
            '\t"BlendPercentage" : "$2"',
            '}'
        ]
    },
    "Component - create" : {
        body: [
            '{',
            '\t"ComponentName" : "$1",',
            '\t"BlockType" : "$2",',
            '\t$3',
            '}'
        ],
        description: "Create new component"
    },
    "Component - use": {
        body: [
            '{',
            '\t"BlockType" : "component",',
            '\t"Component" : "$1"',
            '}'
        ],
        description: "Reuse existing component"
    },
    Dock : {
        body: [
            '{',
            '\t"BlockType" : "dock",',
            '\t"Orientation" : "$1",',
            '\t"Items" : [',
            '\t\t$2',
            '\t]',
            '}'
        ]
    },
    Image: {
        body: [
            '{',
            '\t"BlockType" : "image",',
            '\t"Source" : "$1",',
            '\t"ImageOptions" : {',
            '\t\t$2',
            '\t}',
            '}'
        ],
    },
    ItemStack : {
        body: [
            '{',
            '\t"BlockType" : "itemstack",',
            '\t"Orientation" : "$1",',
            '\t"ItemStackOptions" : {',
            '\t\t"ItemSource" : "$2",',
            '\t\t"ItemTemplate" : $3',
            '\t}',
            '}'
        ]
    },
    "Public Property" : {
        body: [
            '{',
            '\t"Name" : "$1",',
            '\t"PublicName" : "$2",',
            '\t"Type" : "$3",',
            '}'
        ]
    },
    Shape: {
        body: [
            '{',
            '\t"BlockType" : "shape",',
            '\t"ShapeOptions" : {',
            '\t\t"ShapeType" : "rectangle",',
            '\t\t"Fill" : "$2"',
            '\t}',
            '}'
        ],
    },
    Stack : {
        body: [
            '{',
            '\t"BlockType" : "stack",',
            '\t"Items" : [',
            '\t\t$1',
            '\t]',
            '}'
        ]
    },
    "Style - definition" : {
        body: [
            '{',
            '\t"StyleName" : "$1",',
            '\t"BlockType" : "$2",',
            '}'
        ]
    },
    Table: {
        body: [
            '{',
            '\t"BlockType" : "table",',
            '\t"TableOptions" : {',
            '\t\t"ItemsSource" : "$1",',
            '\t\t"HeaderTemplate" : $2,',
            '\t\t"Columns" : [',
            '\t\t\t$3',
            '\t\t]',
            '\t}',
            '}'
        ],
    },
    "Table-column": {
        body: [
            '{',
            '\t"Header" : "$1",',
            '\t"Template" : $2,',
            '}'
        ]
    },
    "Table-multicolumn": {
        body: [
            '{',
            '\t"MultiColumnHeadersSource" : "$1",',
            '\t"MultiColumnItemsSource" : $2,',
            '\t"MultiColumnHeaderTemplate" : $3,',
            '\t"Template" : $4,',
            '}'
        ]
    },
    Text: {
        body: [
            '{',
            '\t"BlockType" : "text",',
            '\t"Source" : "$1"',
            '}'
        ],
    },
    "Theme Description" : {
        body: [
            '{',
            '\t"Name" : "$1",',
            '\t"Author" : "$2",',
            '\t"ThemeId" : "$3",',
            '}'
        ],
        
    },
    "Theme Link" : {
        body : [
            '{',
            '\t"Url" : "$1",',
            '\t"Caption" : "$2"',
            '}'
        ]
    },
    "Trigger - single" : {
        body: [
            '{',
            '\t"Condition" : "$1",',
            '\t"Setters" :',
            '\t[',
            '\t\t{',
            '\t\t\t"Property" : "$2",',
            '\t\t\t"Value" : "$3",',
            '\t\t}',
            '}'
        ]
    },
    "Trigger - Setter" : {
        body: [
            '{',
            '\t"Property" : "$2",',
            '\t"Value" : "$3",',
            '}',
        ]
    }
};

module.exports = snippets;