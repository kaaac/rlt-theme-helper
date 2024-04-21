# RLT THEME HELPER

The extension adds hints about possible properties, consistent with the rules applicable to creating/editing themes for Racing League Tools

## Features

The extension adds hints and validation regarding possible properties, consistent with the rules applicable to creating/editing themes for Racing League Tools

Supports:
  - blocks in layer.json files
  - components
  - global and public variables
  - layout definitions and theme definition
  - validation of the correctness of the entered data types

![extension](https://github.com/kaaac/rlt-theme-helper/assets/74159167/4fdfbaae-71fd-4fbb-bb1b-f728f8490696)


## How to Install

Go to Extensions in your VSCode, search "RLT Theme Helper", hit Install

## Requirements

## Extension Settings

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

---
