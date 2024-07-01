# Change Log

## [0.2.2] - 2024-07-01

### Changes

- Added completion provider for styles defined globally and inside block-containers

## [0.2.1] - 2024-06-29

### Changes

- Added completion provider for Data Converters
- Extended json schema to allow define Components in block-containers
- Extended completion provider for global components to allow use with array of components in single file
- Extended completion provider for components defined in block-containers

## [0.2.0] - 2024-06-28

### Changes

- Added completion provider for global components
- Added completion provider for global variables
- Added ForceLiveriesLoading property to theme_description.json

## [0.1.13] - 2024-06-11

### Changes

- Fixed wrong $ref to TriggerPropertyItem properties

## [0.1.12] - 2024-05-29

### Changes

- Fixed properties for RequiredLogotypeVariants in theme_description.json

## [0.1.11] - 2024-05-14

### Changes

- Extended TriggerPropertyItem properties

## [0.1.10] - 2024-05-11

### Changes

- Added Status Bar Item with support information for the currently open file in the active editor
- Extended theme_description.json properties
- Changed main icon of extension

## [0.1.9] - 2024-05-07

### Changes

- Disabled additional properties for public_properties.json
- Changed schema for TableOptions property

## [0.1.8] - 2024-05-05

### Changes

- Adjusted Component related properties logic
- Disabled addtional properties for GridOptions, ItemStackOptions,
- Added examples for some properties
- Added Template deprecation message for ItemStackOptions
- Added string type value for MaxHeight, MaxWidth,
- other minor changes

## [0.1.7] - 2024-05-01

### Changes

- TextOptionsExtern marked as deprecated
- Property Component moved from ComponentOptions to main block, disabled additional properties
- Added Required StyleName for Style Block
- Added Object as allowed type for Trigger Values [#1](https://github.com/kaaac/rlt-theme-helper/issues/1)

## [0.1.6] - 2024-04-30

### Changes

- allowed use variable values in paddings, margins, itemstackoptions and more
- changed logic for layout_description schema
- changed component logic and properties for 0.9.5 renderer
- added schema for global_vars.json

## [0.1.5] - 2024-04-25

### Changes

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

### Changed

Adjusted possible types of data for blocks

- RenderIf - added possible type of value string with patter for variable
- TextOptions - Removed property Text from required list

and other minor fixes

## [0.0.2] - 2024-04-18

### Added

- Logic for nested blocks

## [0.0.1] - 2024-04-18

Initial release