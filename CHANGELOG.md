# Change Log

## [0.4.0] - 2025-11-26

### ✨ Major Features

#### � Component Tree View (NEW!)

- **Sidebar panel** showing hierarchical structure of RLT theme files
- **Smart file detection** - automatically recognizes file type and displays relevant sections
- **Supported files:**
  - `theme_description.json` - Shows theme info, layouts, localization
  - `component.json` - Shows component structure, blocks, styles, triggers
  - `layer.json` - Shows layer structure and blocks
  - `layout_description.json` - Shows all layouts with dimensions
  - `global_vars.json` - Shows all variables with values
- **Expandable tree structure** - drill down into nested objects and arrays
- **Smart icons** - different icons for components (🧩), blocks (📦), styles (💅), colors (🎨), etc.
- **Auto-refresh** - updates when switching files or saving changes
- **Quick navigation** - click on items to see their structure
- **Refresh button** - manual refresh option in toolbar

#### �🎨 Interactive Color Picker

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
- **Fixed status bar icon visibility issues:**
  - Icon now properly shows/hides based on file type
  - Shows only for JSON files
  - Added `show()` calls that were missing
  - Added refresh on document open events
  - Better subscription management for proper cleanup

### 📦 Technical Changes

- Refactored color detection logic with `isLayoutProperty()` method
- Added `ColorPickerProvider` with support for 8+ color formats
- Added `GlobalVarsInlayHintsProvider` with nested resolution support
- Added `ComponentTreeProvider` for hierarchical structure view
- File watchers for automatic updates on configuration changes
- Improved error handling with try-catch blocks in color provider
- Fixed `getValueFromGlobalVars` to handle object values correctly

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
