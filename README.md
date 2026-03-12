<p align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/QGIS_logo_new.svg/1200px-QGIS_logo_new.svg.png" alt="QGIS" height="80"/>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="https://earthengine.google.com/static/images/earth-engine-logo.png" alt="Google Earth Engine" height="80"/>
</p>

<h1 align="center">🗺️ QGIS XYZ Appender</h1>

<p align="center">
  <strong>Quickly register Google Earth Engine tile URLs as XYZ connections in QGIS</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#usage">Usage</a> •
  <a href="#adding-layers">Adding Layers</a> •
  <a href="#removing-layers">Removing Layers</a> •
  <a href="#example">Example</a> •
  <a href="#author">Author</a>
</p>

---

## About

**QGIS XYZ Appender** is a Python script designed to run inside the QGIS Python Console. It takes Google Earth Engine (GEE) tile URLs and registers them as XYZ Tile connections in QGIS, making it easy to visualize Earth Engine outputs directly on the QGIS map canvas — no plugins required.

This is particularly useful for remote sensing workflows where you generate map tiles in GEE (e.g. flood maps, NDVI, MNDWI, true/false color composites) and want to view and overlay them in QGIS alongside other spatial data.

---

## Features

- 🔗 **Bulk register** GEE tile URLs as QGIS XYZ Tile connections in one go
- 🏷️ **Custom naming** — prefix layer names for easy identification and grouping (e.g. `Wami`, `Rufiji`, etc.)
- 🗑️ **Bulk remove** — clean up registered connections just as easily
- 🌍 **Works with any XYZ tile URL** — not limited to GEE; supports any `{z}/{x}/{y}` tile service
- ⚡ **No plugin installation needed** — runs directly in the QGIS Python Console
- 📡 **Supports all GEE layer types**: True Color, False Color, NDVI, NDWI, MNDWI, Flood Classification, and more

---

## How It Works

Google Earth Engine generates tile URLs in this format:

```
https://earthengine.googleapis.com/v1/projects/{project}/maps/{mapId}/tiles/{z}/{x}/{y}
```

This script registers those URLs into QGIS via `QSettings`, which stores XYZ tile connection metadata. After running the script and reloading connections, the layers appear under **Browser Panel → XYZ Tiles**, ready to be added to the map canvas.

---

## Usage

### Prerequisites

- **QGIS 3.x** (any recent version)
- Google Earth Engine tile URLs (generated from your GEE scripts)

### Steps

1. Open **QGIS**
2. Go to **Plugins → Python Console** (or press `Ctrl + Alt + P`)
3. Copy and paste the script into the console
4. Press **Enter** to run
5. Go to **Browser Panel → XYZ Tiles** to find your layers
6. Double-click any layer to add it to the map canvas

> 💡 **Tip:** If layers don't appear immediately, right-click **XYZ Tiles** in the Browser Panel and select **Refresh**.

---

## Adding Layers

Structure your layers as a list. Each entry contains: `[Name, URL, Max Zoom, Min Zoom]`

```python
xyzLayers = []

# Add your GEE tile layers
xyzLayers.append(["Wami True_Color_2025", "https://earthengine.googleapis.com/v1/projects/ee-hemedlungo/maps/b2ce37cb86e509a4e04c851b4fcbe244-4be889dcb756f26a78c72559b240af76/tiles/%7Bz%7D/%7Bx%7D/%7By%7D", "19", "0"])
xyzLayers.append(["Wami NDVI_2025", "https://earthengine.googleapis.com/v1/projects/ee-hemedlungo/maps/c165fb9f0bd8ee9844af5a072d79fe26-284970e0b15ee9289a1a850e1e03b053/tiles/%7Bz%7D/%7Bx%7D/%7By%7D", "19", "0"])
xyzLayers.append(["Wami Flood_Classification_2025", "https://earthengine.googleapis.com/v1/projects/ee-hemedlungo/maps/d8a768990ddf4d84f3872c9e305e6cc1-32b3b041ebf1c4f9f89c908e9c96dac0/tiles/%7Bz%7D/%7Bx%7D/%7By%7D", "19", "0"])

# Register all layers in QGIS
for layer in xyzLayers:
    name, url, zmax, zmin = layer
    QSettings().setValue("qgis/connections-xyz/%s/url" % (name), url)
    QSettings().setValue("qgis/connections-xyz/%s/zmax" % (name), zmax)
    QSettings().setValue("qgis/connections-xyz/%s/zmin" % (name), zmin)
    QSettings().setValue("qgis/connections-xyz/%s/authcfg" % (name), "")
    QSettings().setValue("qgis/connections-xyz/%s/username" % (name), "")
    QSettings().setValue("qgis/connections-xyz/%s/password" % (name), "")
    QSettings().setValue("qgis/connections-xyz/%s/referer" % (name), "")

iface.reloadConnections()
```

> **Note:** GEE tile URLs use URL-encoded placeholders: `%7Bz%7D/%7Bx%7D/%7By%7D` instead of `{z}/{x}/{y}`.

---

## Removing Layers

To remove all layers with a specific prefix (e.g. all "Wami" layers):

```python
from qgis.core import QSettings

s = QSettings()
s.beginGroup("qgis/connections-xyz")
for key in s.childGroups():
    if key.startswith("Wami"):
        s.remove(key)
s.endGroup()

iface.reloadConnections()
print("All Wami XYZ connections removed.")
```

---

## Example

A typical workflow for flood mapping in the Wami River Basin:

| Layer Type | Description |
|---|---|
| `True_Color` | Natural color satellite composite |
| `False_Color` | NIR-Red-Green composite for vegetation |
| `NDVI` | Normalized Difference Vegetation Index |
| `NDWI` | Normalized Difference Water Index |
| `MNDWI` | Modified Normalized Difference Water Index |
| `MNDWI_Difference` | Change in MNDWI between pre/post flood |
| `Flood_MNDWI_Threshold` | Flood extent from MNDWI threshold |
| `Flood_MNDWI_Difference` | Flood extent from MNDWI change detection |
| `Flood_Classification` | Combined flood classification |
| `Pre_Flood_True_Color` | Dry season reference image |
| `Post_Flood_True_Color` | Flood season image |
| `Permanent_Water_JRC` | JRC Global Surface Water permanent water mask |

---

## Supported Layer Sources

While designed for Google Earth Engine, this script works with **any XYZ tile service**:

```python
# Google Satellite
xyzLayers.append(["Google Satellite", "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", "19", "0"])

# OpenStreetMap
xyzLayers.append(["OpenStreetMap", "http://tile.openstreetmap.org/{z}/{x}/{y}.png", "19", "0"])

# CartoDB Dark Matter
xyzLayers.append(["CartoDB Dark", "http://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", "20", "0"])
```

---

## GEE Workflow

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Google Earth Engine │────▶│  Generate Tile   │────▶│  Copy Tile URLs │
│  (Code Editor)       │     │  Map URLs         │     │                 │
└─────────────────────┘     └──────────────────┘     └────────┬────────┘
                                                               │
                                                               ▼
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  View in QGIS       │◀────│  Run Script in   │◀────│  Paste URLs in  │
│  Map Canvas          │     │  Python Console   │     │  Python Script  │
└─────────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Author

**Heed725** — [GitHub Profile](https://github.com/Heed725)

Built for remote sensing and flood mapping workflows in Tanzania 🇹🇿

---

## License

This project is open source and available under the [MIT License](LICENSE).

---

<p align="center">
  Made with ❤️ for the QGIS and Google Earth Engine communities
</p>
