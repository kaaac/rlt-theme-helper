export interface Snippet {
    body: string[];
    description?: string;
}

const snippets: Record<string, Snippet> = {
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
            '\t"BlockType" : "canvas",',
            '\t"Items" : [',
            '\t\t$1',
            '\t]',
            '}'
        ],
    },
    "Chart - lines" : {
        body: [
            '{',
            '\t"BlockType" : "canvas",',
            '\t"ItemStackOptions" : {',
            '\t\t"ItemSource" : "${1:{Session.Drivers\\}}",',
            '\t\t"ItemTemplate" : {',
            '\t\t\t"BlockType" : "shape",',
            '\t\t\t"Width" : ${2:1400},',
            '\t\t\t"Height" : ${3:720},',
            '\t\t\t"ShapeOptions" : {',
            '\t\t\t\t"ShapeType" : "polyline",',
            '\t\t\t\t"Points" : "${4:{Item.LapPositions\\}}",',
            '\t\t\t\t"PointX" : "${5:Lap}",',
            '\t\t\t\t"PointY" : "${6:Position}",',
            '\t\t\t\t"Scale" : { "InvertY" : ${7:true}, "Inset" : ${8:18} },',
            '\t\t\t\t"Stroke" : { "Color" : "${9:{Item.Team.Color\\}}", "Thickness" : ${10:4}, "LineJoin" : "round" }',
            '\t\t\t}',
            '\t\t}',
            '\t}',
            '}'
        ],
        description: "Line chart: one polyline per item drawn on a canvas (0.9.9)"
    },
    "Chart - bars" : {
        body: [
            '{',
            '\t"BlockType" : "canvas",',
            '\t"ItemStackOptions" : {',
            '\t\t"ItemSource" : "${1:{Session.Drivers\\}}",',
            '\t\t"ItemTemplate" : {',
            '\t\t\t"BlockType" : "shape",',
            '\t\t\t"Width" : ${2:900},',
            '\t\t\t"Height" : ${3:200},',
            '\t\t\t"ShapeOptions" : {',
            '\t\t\t\t"ShapeType" : "rectangle",',
            '\t\t\t\t"X1" : "{ItemIndex}",',
            '\t\t\t\t"X2" : "{ItemIndex}",',
            '\t\t\t\t"Y1" : 0,',
            '\t\t\t\t"Y2" : "${4:{Item.DriverPoints.FloatValue\\}}",',
            '\t\t\t\t"GapX" : ${5:8},',
            '\t\t\t\t"Fill" : "${6:{Item.Team.Color\\}}",',
            '\t\t\t\t"Scale" : { "XMin" : 0, "XMax" : "${7:{Session.DriversCount, Converter=NumberSubtract, Parameter=1\\}}", "YMin" : 0, "YMax" : ${8:30}, "BandX" : true }',
            '\t\t\t}',
            '\t\t}',
            '\t}',
            '}'
        ],
        description: "Bar chart: one rectangle per item on a band X axis (0.9.9)"
    },
    ColorizeBackground : {
        body: [
            '{',
            '\t"Enabled" : true,',
            '\t"Color" : "$1",',
            '\t"BlendPercentage" : ${2:50}',
            '}'
        ]
    },
    "Colorize - image mask" : {
        body: [
            '{',
            '\t"Enabled" : true,',
            '\t"ColorImage" : "$1",',
            '\t"ColorImageMode" : "${2|Luminance,Alpha|}"',
            '}'
        ],
        description: "Colorize with an image overlay or layer mask"
    },
    "Component - create" : {
        body: [
            '{',
            '\t"ComponentName" : "$1",',
            '\t"BlockType" : "$2"$3',
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
            '\t"Orientation" : "${1|Horizontal,Vertical|}",',
            '\t"Items" : [',
            '\t\t$2',
            '\t]',
            '}'
        ]
    },
    Grid : {
        body: [
            '{',
            '\t"BlockType" : "grid",',
            '\t"GridOptions" : {',
            '\t\t"Rows" : [',
            '\t\t\t{ "Height" : ${1:100} },',
            '\t\t\t{ "IsStretchHeight" : true }',
            '\t\t],',
            '\t\t"Cols" : [',
            '\t\t\t{ "Width" : ${2:100} },',
            '\t\t\t{ "IsStretchWidth" : true }',
            '\t\t]',
            '\t},',
            '\t"Items" : [',
            '\t\t$3',
            '\t]',
            '}'
        ],
        description: "Grid with rows and columns (children use GridRow / GridCol)"
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
            '\t"Orientation" : "${1|Horizontal,Vertical|}",',
            '\t"ItemStackOptions" : {',
            '\t\t"ItemSource" : "$2",',
            '\t\t"ItemTemplate" : $3',
            '\t}',
            '}'
        ]
    },
    "Layout Description" : {
        body: [
            '{',
            '\t"LayoutName" : "$1",',
            '\t"RenderType" : "${2|RaceResults,QualResults,CombinedQualResults,DriverStandings,TeamStandings,Lineups,Calendar,DriverSessionStatistics,DriverSeasonStatistics,DriverSession,DriverInfo,PenaltySeasonStatistics,PenaltyItem,PenaltyItems,DeepRatingsSeason,Teammates,TeamStandingsMultiseason,TeamStatistics,TeamsStatistics,DriverStatistics,DriversStatistics,TrackStatistics,TracksStatistics|}",',
            '\t"RenderVersion" : ${3:1},',
            '\t"RenderCaption" : "$4"',
            '}'
        ],
        description: "layout_description.json"
    },
    Localization : {
        body: [
            '{',
            '\t"Id" : "${1:en-US}",',
            '\t"Name" : "${2:English}",',
            '\t"Strings" : {',
            '\t\t"$3" : "$4"',
            '\t}',
            '}'
        ],
        description: "Localization file (localizations/*.json)"
    },
    "Public Property" : {
        body: [
            '{',
            '\t"Name" : "$1",',
            '\t"PublicName" : "$2",',
            '\t"Type" : "$3"',
            '}'
        ]
    },
    Shape: {
        body: [
            '{',
            '\t"BlockType" : "shape",',
            '\t"ShapeOptions" : {',
            '\t\t"ShapeType" : "${1|rectangle,ellipse|}",',
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
            '\t"BlockType" : "$2"',
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
            '\t"Template" : $2',
            '}'
        ]
    },
    "Table-multicolumn": {
        body: [
            '{',
            '\t"MultiColumnHeadersSource" : "$1",',
            '\t"MultiColumnItemsSource" : "$2",',
            '\t"MultiColumnHeaderTemplate" : $3,',
            '\t"MultiColumnLimit" : ${4:10},',
            '\t"Template" : $5',
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
            '\t"ThemeId" : "$1",',
            '\t"Name" : "$2",',
            '\t"Author" : "$3"',
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
    "Trigger - external" : {
        body: [
            '{',
            '\t"TriggerName" : "$1",',
            '\t"Condition" : "$2",',
            '\t"Setters" : [',
            '\t\t{',
            '\t\t\t"Property" : "$3",',
            '\t\t\t"Value" : "$4"',
            '\t\t}',
            '\t]',
            '}'
        ],
        description: "Named trigger for triggers/ files, used with \"Trigger\": \"name\""
    },
    "Trigger - single" : {
        body: [
            '{',
            '\t"Condition" : "$1",',
            '\t"Setters" : [',
            '\t\t{',
            '\t\t\t"Property" : "$2",',
            '\t\t\t"Value" : "$3"',
            '\t\t}',
            '\t]',
            '}'
        ]
    },
    "Trigger - Setter" : {
        body: [
            '{',
            '\t"Property" : "$1",',
            '\t"Value" : "$2"',
            '}',
        ]
    }
};

export default snippets;
