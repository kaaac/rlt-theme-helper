# Item Property Completion Provider

Provider autocomplete dla właściwości `Item.*` w plikach JSON (komponenty, layouty).

## Jak działa

1. **Wykrywa wpisywanie `Item.`** - aktywuje się po wciśnięciu kropki
2. **Szuka ItemsSource** - w bieżącym pliku (Table, ItemStack)
3. **Mapuje na klasę C#** - używa `mapping.json` do znalezienia odpowiedniej klasy
4. **Podpowiada właściwości** - ładuje schemat klasy z `api_models/`
5. **Wspiera zagnieżdżenie** - `Item.Driver.Name`, `Item.Team.Name` itp.

## Przykład użycia

### W pliku layoutu z Table:

```json
{
  "BlockType": "table",
  "TableOptions": {
    "ItemsSource": "{Session.Drivers}",
    "Columns": [
      {
        "Template": {
          "BlockType": "text",
          "Source": "{Item.}"  ← autocomplete tutaj!
        }
      }
    ]
  }
}
```

Po wpisaniu `Item.` pojawią się sugestie:
- `Item.Position` (number)
- `Item.PositionString` (string)
- `Item.Driver` (DriverRenderObject)
- `Item.Team` (TeamRenderData)
- ... (wszystkie 69 właściwości)

### Zagnieżdżone właściwości:

```json
"Source": "{Item.Driver.}"  ← autocomplete dla właściwości Driver
"Source": "{Item.Team.Name}"  ← autocomplete dla właściwości Team
```

## Mapowanie ItemsSource → Klasa

Provider używa `api_models/mapping.json`:

```json
{
  "Session.Drivers": "DriverSessionRenderData",
  "Session.Teams": "TeamRenderData"
}
```

## Obsługiwane struktury

### 1. Table z TableOptions
```json
{
  "BlockType": "table",
  "TableOptions": {
    "ItemsSource": "{Session.Drivers}"
  }
}
```

### 2. ItemStack z ItemStackOptions
```json
{
  "BlockType": "itemstack",
  "ItemStackOptions": {
    "ItemSource": "{Session.Drivers}"
  }
}
```

## Typy właściwości

Provider pokazuje różne ikony w zależności od typu:

- 📝 **Text** - string
- 🔢 **Value** - number
- ✓ **Constant** - boolean
- 📦 **Class** - complex types (Driver, Team, Car)
- 📚 **Enum** - collections (arrays)

## Informacje w podpowiedziach

Każda sugestia zawiera:
- **Nazwę właściwości** (np. `Position`)
- **Typ** (np. `number`, `string`, `DriverRenderObject`)
- **Opis** (wygenerowany automatycznie)
- **Marker** czy to typ złożony (można iść głębiej)

## Ograniczenia (v1)

- ✅ Działa w tym samym pliku (szuka ItemsSource w JSON)
- ❌ Nie szuka jeszcze w layoutach gdy komponent jest użyty gdzie indziej
- ✅ Wspiera zagnieżdżone właściwości (`Item.Driver.Name`)
- ✅ Działa z Table i ItemStack

## TODO (przyszłe wersje)

- [ ] Szukanie ItemsSource w layoutach dla komponentów
- [ ] Cache schematów dla wydajności
- [ ] Wsparcie dla innych struktur iterujących
- [ ] Hover tooltips z pełną dokumentacją
- [ ] Go to definition dla klas C#

## Pliki

- `Providers/ItemPropertyCompletionProvider.js` - główny provider
- `api_models/mapping.json` - mapowanie ItemsSource → klasa
- `api_models/autocomplete.json` - precomputed dane
- `api_models/*.json` - schematy poszczególnych klas
