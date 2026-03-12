from qgis.core import QSettings

xyzNames = [
    "Wami True_Color_2017",
    "Wami False_Color_2017",
    "Wami NDVI_2017",
    "Wami NDWI_2017",
    "Wami Pre_Flood_True_Color_2017",
    "Wami MNDWI_2017",
    "Wami Post_Flood_True_Color_2017",
    "Wami True_Color_2018",
    "Wami False_Color_2018",
    "Wami NDVI_2018",
    "Wami NDWI_2018",
    "Wami MNDWI_2018",
    "Wami Pre_Flood_True_Color_2018",
    "Wami Post_Flood_True_Color_2018",
    "Wami True_Color_2021",
    "Wami False_Color_2021",
    "Wami Pre_Flood_True_Color_2021",
    "Wami Post_Flood_True_Color_2021",
    "Wami MNDWI_Difference_2021",
    "Wami NDVI_2021",
    "Wami Flood_MNDWI_Threshold_2021",
    "Wami Flood_MNDWI_Difference_2021",
    "Wami NDWI_2021",
    "Wami Flood_Classification_2021",
    "Wami MNDWI_2021",
    "Wami True_Color_2022",
    "Wami False_Color_2022",
    "Wami NDVI_2022",
    "Wami Pre_Flood_True_Color_2022",
    "Wami Post_Flood_True_Color_2022",
    "Wami MNDWI_2022",
    "Wami NDWI_2022",
    "Wami MNDWI_Difference_2022",
    "Wami Flood_MNDWI_Difference_2022",
    "Wami Flood_MNDWI_Threshold_2022",
    "Wami Flood_Classification_2022",
    "Wami True_Color_2025",
    "Wami Pre_Flood_True_Color_2025",
    "Wami False_Color_2025",
    "Wami MNDWI_2025",
    "Wami NDWI_2025",
    "Wami NDVI_2025",
    "Wami Post_Flood_True_Color_2025",
    "Wami Flood_Classification_2025",
    "Wami Flood_MNDWI_Threshold_2025",
    "Wami Flood_MNDWI_Difference_2025",
    "Wami MNDWI_Difference_2025",
    "Wami Permanent_Water_JRC",
]

s = QSettings()
for name in xyzNames:
    s.remove("qgis/connections-xyz/%s" % (name))

iface.reloadConnections()
print(f"Done! Removed {len(xyzNames)} Wami XYZ connections.")
