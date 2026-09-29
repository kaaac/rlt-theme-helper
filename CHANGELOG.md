# Change Log

## [Unreleased]

### 🐛 Bug Fixes

- **Completions work while typing** - Component/Style/Trigger and `Item.` suggestions no longer disappear when the file is temporarily invalid JSON
- **Tolerant JSON parsing** - trailing commas and `//` inside strings (e.g. URLs) no longer break global variables, localizations or completions
- **One broken file no longer disables completions** - an invalid file in `styles/`, `triggers/` or `components/` is skipped instead of breaking suggestions for the whole theme
- **Multi-theme workspaces** - the theme is detected from the edited file (nearest `theme_description.json`), so opening a folder with several themes works
- **`Item.` in nested tables** - suggestions use the nearest `ItemsSource`, `Item` inside an `ItemSource` expression refers to the outer item, and bindings like `<{Var.Path}>` or `{Path, Converter=...}` are resolved
- Style suggestions no longer include component names from `Components` arrays
- Inlay hints: no duplicate hints for nested variables, no `[object Object]` values, hints refresh after editing `global_vars.json` or localizations
- **Add Global Variable** keeps comments and formatting of `global_vars.json` (and can be undone)
- **Missing API models** - the model generator now also reads C# `struct` and `record` types, adding `TyresStint`, `TyreStintInfo`, `TyreTypeInfo`, `TyreWear`, `DriverFeatureInfo`, `LayoutInfo`, `PointsValue` and `RatingValue` — `Item.` completion now works for stints and driver features, and `LayoutInfo.` completion works
- **Color swatches for variables** - a `{Variable}` that was the only variable in a multi-line JSON object got no color swatch
- **Nested variables** - `{Colors.{TeamName}}` is now resolved (the nested reference at the end of the expression was cut off)
- **Component/Style/Trigger completion on one line** - also works when other properties precede the key on the same line, e.g. `{ "BlockType": "text", "Style": "`

### 🔧 Technical Changes

- **TypeScript** - sources moved to `src/` and migrated to strict TypeScript, bundled with esbuild into `dist/extension.js` (`jsonc-parser` included, smaller VSIX)
- **Unit tests** - mocha tests for core modules and all providers, running in node against a sample theme in `test/fixtures` (`npm test`)
- **CI** - lint, typecheck, tests and build on every pull request
- New `core/` modules: theme context with cached global variables, localizations and name indexes (invalidated by a file watcher), shared variable/color resolution, `jsonc-parser` based JSON handling
- `Component`, `Style` and `Trigger` completion merged into one `NameCompletionProvider`
- `ItemPropertyCompletionProvider` simplified (syntax tree instead of manual path search, no per-keystroke logging)
- Extension no longer activates on every VS Code startup — only in workspaces containing `theme_description.json` or when a JSON file is opened
- Smaller VSIX package — development files (scripts, docs, CI, notes, source icons) are excluded
- Release workflow now builds the `.vsix` with `vsce` instead of zipping the repository
- Removed unused code (`completionProvider.js`, `SnippetCompletionProvider`)
- Fixed typos in data converter descriptions

## [0.5.1] - 2026-03-06

### ✨ New Features

- **Trigger Name Autocomplete** - Smart completion for `"Trigger"` property with suggestions from `triggers/` directory

### 🎯 Improvements

- **Source File Links** - Completion items for Components, Styles, and Triggers now include clickable links to their source files
- **Better Icons** - Style completions now display with color icon instead of generic value icon
- **Enhanced Documentation** - Completion items show whether they are defined globally (in dedicated folders) or locally (in current file)

### 🔧 Technical Changes

- Extended source tracking system for all completion providers
- Added `TriggerNameCompletionProvider` with Event completion kind
- Updated `extractPropertyNames` and `extractPropertyNamesFromCurrentFile` to track file paths
- Modified `getPropertyNames` to calculate and pass relative file paths

## [0.5.0] - 2026-03-06

### ✨ Major Features

#### 🔮 Item Property Autocomplete

- Intelligent autocomplete for `Item.*` properties based on `ItemsSource` context
- Powered by real C# API models from RacingLeagueTools renderer
- Support for 46 API classes with 1000+ properties:
  - Session: `DriverSessionRenderData`, `SessionRenderData`, `StandingsSessionRenderData`
  - Season: `DriverSeasonRenderData`, `TeamSeasonRenderData`, `EventRenderData`, `LineupRenderData`
  - Standings: `StandingsSeasonRenderData`, `DriverEventRenderData`, `TeamEventRenderData`
  - Championship: `DriverRenderData`, `TeamRenderData`, `CarRenderData`, `TrackRenderData`
  - Statistics, Penalties, League roles, and more
- Root object support: `{Session.`, `{Event.`, `{DriverInfo.`, `{Season.`, `{Standings.`
- Nested navigation with autocomplete at each level: `{Item.Team.Nation.Code}`
- Collection indexing: `{Item.Driver0.Name}`, `{Item.Driver1.Name}`
- Component → Layout discovery: finds `ItemsSource` from component usage in layouts
- Inheritance support: shows properties from base classes
- Context information display: shows object type, source, and navigation path
- Rich documentation with property types (string, int, bool, collections)
- Debug output panel "RLT Item Provider" for troubleshooting
- 36 ItemsSource → Class mappings for context detection
- Expression-bodied properties support (Driver0, Driver1, etc.)
- Fallback mappings for helper classes

### 📝 New Files

- `Providers/ItemPropertyCompletionProvider.js` - Main autocomplete provider
- `api_models/*.json` - 46 class schemas + mapping.json
- `Providers/ITEM_PROVIDER_README.md` - Detailed documentation

## [0.4.0] - 2025-11-26

### ✨ Major Features

#### 🎨 Interactive Color Picker

- Click on color box next to any color value to open color picker
- Support for multiple color formats:
  - `#RRGGBB` - Standard hex format
  - `#AARRGGBB` - RLT format with alpha channel first
  - `RRGGBB` / `AARRGGBB` - Hex without # (for Color/Foreground/Background properties)
  - `R,G,B` - Comma-separated RGB values
  - `R,G,B,A` - Comma-separated RGBA values
- Easy conversion between color formats via dropdown
- Visual color indicators appear next to all color values
- Smart detection excludes layout properties from color recognition
- Global variables that resolve to colors show as read-only color indicators

#### 💡 Global Variables Inline Hints

- Shows resolved values of variables as grayed-out inline hints
- Supports complex variable patterns:
  - `{VariableName}` - Simple variable reference
  - `{{VariableName}}` - Double brace format
  - `{Variable.Property}` - Nested property access with dot notation
  - `{Some{Nested}Value}` - Complex nested variable resolution
  - `[LocalizationKey]` - Localization strings from `localizations/*.json`
- Smart localization file selection based on `DefaultLocalizationId` in theme_description.json
- Color indicators for variables that resolve to color values
- Clickable links in tooltips to quickly navigate to source files
- Real-time updates when global_vars.json or localization files change

#### ⌨️ New Commands & Shortcuts

- **`Ctrl+K Ctrl+S`** - Show RLT Snippets (improved from old `Ctrl+Alt+R`)
- **`Ctrl+K Ctrl+V`** - Add Global Variable
  - Smart insertion: replaces selection with `{VariableName}` and uses selected text as value
  - Creates/updates `globals/global_vars.json` automatically
  - Opens file with value selected, ready to edit

### 🔧 Improvements

- Enhanced layout property detection with comprehensive keyword matching:
  - Excludes properties/variables containing: margin, padding, spacing, gap, offset, indent, size, width, height, radius, border, thickness, distance, position, coordinate
  - Case-insensitive matching prevents false color detection on layout values
- Improved JSON parsing with better error handling for files with comments
- Removed deprecated hover color provider (fully replaced by color picker)

### 📦 Technical Changes

- Refactored color detection logic with `isLayoutProperty()` method
- Added `ColorPickerProvider` with support for 8+ color formats
- Added `GlobalVarsInlayHintsProvider` with nested resolution support
- File watchers for automatic updates on configuration changes

## [0.3.2] - 2025-11-25

- Extended support for variables combinations
- Refactored extension.js structure for better code organization
- Updated .gitignore file
- Minor fixes

## [0.3.1] - 2024-10-25

- Removed unused commands
- Added hover color provider
- extended common scheme by HeightPercent and WidthPercent properties
- extended Trigger scheme by Trigger property for name
- some cleaning work on code

## [0.3.0] - 2024-07-18

- Added properties for ColorizeBackground json schema
- Added Snippet provider for blocks:
  - BlockRoot
  - Canvas
  - ColorizeBackground
  - Component (create)
  - Component (use)
  - Dock
  - Image
  - ItemStack
  - Public Property
  - Shape
  - Stack
  - Style (definition)
  - Table
  - Table - Column
  - Table - MultiColumn
  - Text
  - Theme Description
  - Theme Link
  - Trigger (single)
  - Trigger - Setter

## [0.2.2] - 2024-07-01

- Added completion provider for styles defined globally and inside block-containers

## [0.2.1] - 2024-06-29

- Added completion provider for Data Converters
- Extended json schema to allow define Components in block-containers
- Extended completion provider for global components to allow use with array of components in single file
- Extended completion provider for components defined in block-containers

## [0.2.0] - 2024-06-28

- Added completion provider for global components
- Added completion provider for global variables
- Added ForceLiveriesLoading property to theme_description.json

## [0.1.13] - 2024-06-11

- Fixed wrong $ref to TriggerPropertyItem properties

## [0.1.12] - 2024-05-29

- Fixed properties for RequiredLogotypeVariants in theme_description.json

## [0.1.11] - 2024-05-14

- Extended TriggerPropertyItem properties

## [0.1.10] - 2024-05-11

- Added Status Bar Item with support information for the currently open file in the active editor
- Extended theme_description.json properties
- Changed main icon of extension

## [0.1.9] - 2024-05-07

- Disabled additional properties for public_properties.json
- Changed schema for TableOptions property

## [0.1.8] - 2024-05-05

- Adjusted Component related properties logic
- Disabled addtional properties for GridOptions, ItemStackOptions,
- Added examples for some properties
- Added Template deprecation message for ItemStackOptions
- Added string type value for MaxHeight, MaxWidth,
- other minor changes

## [0.1.7] - 2024-05-01

- TextOptionsExtern marked as deprecated
- Property Component moved from ComponentOptions to main block, disabled additional properties
- Added Required StyleName for Style Block
- Added Object as allowed type for Trigger Values [#1](https://github.com/kaaac/rlt-theme-helper/issues/1)

## [0.1.6] - 2024-04-30

- allowed use variable values in paddings, margins, itemstackoptions and more
- changed logic for layout_description schema
- changed component logic and properties for 0.9.5 renderer
- added schema for global_vars.json

## [0.1.5] - 2024-04-25

More adjustments for 0.9.5 and other possible types of values for specific properties

## [0.1.4] - 2024-04-23

### Added

- localization support for 0.9.5

## [0.1.3] - 2024-04-21

### Fixed

- Dictionary type and properties

## [0.1.1-0.1.2] - 2024-04-21

### Changed

- Cleaning up the code

## [0.1.0] - 2024-04-20

### Changed and Added

Adjustments and additions to renderer api v0.9.5-preview1:

- changed filematch for layers
- support for theme_description.json
- support for style property
- support for public_properties.json

## [0.0.3] - 2024-04-18

Adjusted possible types of data for blocks

- RenderIf - added possible type of value string with patter for variable
- TextOptions - Removed property Text from required list

and other minor fixes

## [0.0.2] - 2024-04-18

Added Logic for nested blocks

## [0.0.1] - 2024-04-18

Initial release
