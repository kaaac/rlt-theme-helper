# RLT THEME HELPER

The extension adds hints about possible properties, consistent with the rules applicable to creating/editing themes for Racing League Tools

## Important

Current scope for extension is support for 0.9.5 version of RLT Themes

## Features

The extension adds hints and validation regarding possible properties, consistent with the rules applicable to creating/editing themes for Racing League Tools

### Hover Color Provider

Hover your mouse over color value to see result color

### Snippet Provider

Place your cursor in place where you want to start new block - in place where should be { and hit Ctrl+Alt+R. Choose block of your choice, navigate through defined placeholders using Tab.

Supported blocks:
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

### Json Validation with detailed properties for

  - blocks in layer.json files
  - components
  - global and public variables
  - layout definitions and theme definition
  - localization files

### Completion Providers

  - global variables - list of global variables with currently set values
    (hit Ctrl + Space to see list)
    ![image](https://github.com/kaaac/rlt-theme-helper/assets/74159167/64c94b7f-5af7-48d2-8384-cf1f0e958e47)


  - components - list of global and local components
    (hit Ctrl + Space to see list)
    ![image](https://github.com/kaaac/rlt-theme-helper/assets/74159167/cbfb9788-0c76-41f9-885a-aff59e7d7656)

  - styles
  - data converters

![extension](https://github.com/kaaac/rlt-theme-helper/assets/74159167/4fdfbaae-71fd-4fbb-bb1b-f728f8490696)


## How to Install

Go to Extensions in your VSCode, search "RLT Theme Helper", hit Install

## Known Issues

The project is in an early stage of development. Please report errors

## Release Notes

### 0.0.1

Initial release of RLT Theme Helper

### 0.0.2

Logic for nested block

### 0.0.3

Adjusted possible types of data for blocks

Example:
- RenderIf - added possible type of value string with patter for variable
- TextOptions - Removed property Text from required list

### 0.1.0

Adjustments and additions according to Renderer Api v0.9.5-preview1:
- changed filematch for layers
- support for theme_description.json
- support for style property
- support for public_properties.json

## 0.1.1-0.1.2

- Cleaning up the code

## 0.1.3 

### Fixed

- Dictionary type and properties

## 0.1.4

### Added

- localization support for 0.9.5

## 0.1.5

### Changes

More adjustments for 0.9.5 and other possible types of values for specific properties

## 0.1.6

### Changes

- allowed use variable values in paddings, margins, itemstackoptions and more
- changed logic for layout_description schema
- changed component logic and properties for 0.9.5 renderer
- added schema for global_vars.json


## 0.1.7

### Changes

- TextOptionsExtern marked as deprecated
- Property Component moved from ComponentOptions to main block, disabled additional properties
- Added Required StyleName for Style Block
- Added Object as allowed type for Trigger Values [#1](https://github.com/kaaac/rlt-theme-helper/issues/1)

## 0.1.8

### Changes

- Adjusted Component related properties logic
- Disabled addtional properties for GridOptions, ItemStackOptions,
- Added examples for some properties
- Added Template deprecation message for ItemStackOptions
- Added string type value for MaxHeight, MaxWidth,
- other minor changes

## 0.1.9 - 2024-05-07

### Changes

- Disabled additional properties for public_properties.json
- Changed schema for TableOptions property

## 0.1.10 - 2024-05-11

### Changes

- Added Status Bar Item with support information for the currently open file in the active editor
- Extended theme_description.json properties
- Changed main icon of extension

## 0.1.11 - 2024-05-14

### Changes

- Extended TriggerPropertyItem properties

## 0.1.12 - 2024-05-29

### Changes

- Fixed properties for RequiredLogotypeVariants in theme_description.json

## 0.1.13 - 2024-06-11

### Changes

- Fixed wrong $ref to TriggerPropertyItem properties

## 0.2.0 - 2024-06-28

### Changes

- Added completion provider for global components
- Added completion provider for global variables
- Added ForceLiveriesLoading property to theme_description.json

## 0.2.1 - 2024-06-29

### Changes

- Added completion provider for Data Converters
- Extended json schema to allow define Components in block-containers
- Extended completion provider for global components to allow use with array of components in single file
- Extended completion provider for components defined in block-containers

## 0.2.2 - 2024-07-01

### Changes

- Added completion provider for styles defined globally and inside block-containers

## 0.3.0 - 2024-07-18

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


## 0.3.1 - 2024-10-25

- Removed unused commands
- Added hover color provider
- extended common scheme by HeightPercent and WidthPercent properties
- extended Trigger scheme by Trigger property for name
- some cleaning work on code

---