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

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a complete list of changes and version history.
