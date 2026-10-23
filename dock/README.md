# Vetro dock

A glass dock for a rooted Samsung Tizen TV, written in C# against the TV's own EFL
libraries and run with the TV's `dotnet`. Vetro starts and stops it from its **Dock**
tab; it is off until you turn it on.

When it is on, the Home key opens this dock instead of Samsung's Home. The dock shows
the same apps, in the same order and with the same icons as Samsung's Home row, read
from the TV at start-up, and ends with Source and Settings.

## Layout

- `src/` the dock. `Core/` is pure logic (layout, catalog, input decoding) and has tests;
  `Native/` holds the P/Invoke surface; `Ui/` draws with EFL.
- `tests/` desktop tests of `Core/`: `cd tests && dotnet run`.
- `res/` the glass images and the generic Source/Settings/HDMI icons.
- `tools/` generators for those images (`make-glass.cjs`, `system_icons.py`).

## Build

```sh
dotnet build -c Release Launcher.csproj   # targets netcoreapp3.1, the runtime on the TV
```

Vetro's package build copies the result into `app/native/dock/`.
