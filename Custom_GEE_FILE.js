/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var table = ee.FeatureCollection("projects/ee-hemedlungo/assets/Wami_Basin");
/***** End of imports. If edited, may not auto-convert in the playground. *****/

// ============================================================
// NDVI, NDWI, True Color, False Color & Flood Mapping
// Sentinel-2 SR Harmonized | Multi-year: 2017, 2018, 2021, 2022, 2025
// WITH getMap() tile URLs exported as CSV (open in Excel)
// ============================================================

var years = [2017, 2018, 2021, 2022, 2025];

// ---------- EXPORT SETTINGS ----------
var INDEX_SCALE = 30;
var FLOOD_SCALE = 20;
var RGB_SCALE = 30;
var MNDWI_DIFF_SCALE = 30;
var EXPORT_FOLDER = 'GEE_Exports';

var FORMAT_OPTIONS = {
  cloudOptimized: true
};

// ---- List to collect all URL features ----
var urlFeatures = [];

// Cloud masking using SCL band
function maskS2clouds(image) {
  var scl = image.select('SCL');
  var mask = scl.eq(4).or(scl.eq(5)).or(scl.eq(6));
  return image.updateMask(mask);
}

// Add NDVI, NDWI, MNDWI bands
var addIndices = function(image) {
  var nir = image.select('B8').multiply(0.0001);
  var red = image.select('B4').multiply(0.0001);
  var green = image.select('B3').multiply(0.0001);
  var swir = image.select('B11').multiply(0.0001);

  var ndvi = nir.subtract(red).divide(nir.add(red)).rename('NDVI');
  var ndwi = green.subtract(nir).divide(green.add(nir)).rename('NDWI');
  var mndwi = green.subtract(swir).divide(green.add(swir)).rename('MNDWI');

  return image.addBands([ndvi, ndwi, mndwi]);
};

// Permanent water mask (JRC)
var jrcWater = ee.Image('JRC/GSW1_4/GlobalSurfaceWater');
var permanentWater = jrcWater.select('occurrence').gt(80).clip(table);

// Visualization parameters
var trueColorVis = {bands: ['B4', 'B3', 'B2'], min: 0, max: 3000};
var falseColorVis = {bands: ['B8', 'B4', 'B3'], min: 0, max: 4000};
var ndviVis = {min: -0.1, max: 0.8, palette: ['d73027','f46d43','fdae61','fee08b','d9ef8b','a6d96a','66bd63','1a9850']};
var ndwiVis = {min: -0.5, max: 0.5, palette: ['ffffff','e0ecf4','bdd7e7','6baed6','3182bd','1361a9','08519c','023858']};
var mndwiVis = {min: -0.5, max: 0.5, palette: ['ffffff','deebf7','c6dbef','9ecae1','6baed6','3182bd','08519c','08306b']};
var mndwiDiffVis = {min: -0.5, max: 0.5, palette: ['8b0000','ff4500','ffffff','00bfff','00008b']};
var floodClassVis = {min: 0, max: 2, palette: ['ffffff','0000cc','ff0000']};

// ============================================================
// Helper: Collect getMap URL into the features list
// Uses callback to get the tile URL and creates a Feature
// ============================================================
function collectUrl(image, vis, yearStr, layerName) {
  image.getMap(vis, function(data) {
    print(layerName + ' ' + yearStr + ':', data.urlFormat);
    // Create a feature with properties for the CSV
    urlFeatures.push(ee.Feature(null, {
      'Year': yearStr,
      'Layer_Name': layerName,
      'Tile_URL': data.urlFormat
    }));
  });
}

// ============================================================
// LOOP THROUGH EACH YEAR
// ============================================================

years.forEach(function(year) {

  var yearStr = year.toString();
  var startDate = yearStr + '-01-01';
  var endDate = yearStr + '-12-31';

  var preFloodStart = yearStr + '-01-01';
  var preFloodEnd = yearStr + '-03-31';
  var postFloodStart = yearStr + '-07-01';
  var postFloodEnd = yearStr + '-09-30';

  // ---- FULL YEAR COMPOSITE ----
  var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(table)
      .filterDate(startDate, endDate)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
      .map(maskS2clouds);

  var s2WithIndices = s2.map(addIndices);
  var composite = s2WithIndices.mean().clip(table);
  var ndviComposite = composite.select('NDVI');
  var ndwiComposite = composite.select('NDWI');
  var mndwiComposite = composite.select('MNDWI');

  // ---- FLOOD MAPPING ----
  var preFlood = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(table)
      .filterDate(preFloodStart, preFloodEnd)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
      .map(maskS2clouds)
      .map(addIndices)
      .median()
      .clip(table);

  var postFlood = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(table)
      .filterDate(postFloodStart, postFloodEnd)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
      .map(maskS2clouds)
      .map(addIndices)
      .median()
      .clip(table);

  var preWater = preFlood.select('MNDWI').gt(0).rename('preWater');
  var postWater = postFlood.select('MNDWI').gt(0).rename('postWater');
  var floodExtent = postWater.and(preWater.not()).rename('flood');

  var mndwiDiff = postFlood.select('MNDWI')
      .subtract(preFlood.select('MNDWI'))
      .rename('MNDWI_diff');
  var floodDiff = mndwiDiff.gt(0.2).rename('flood_diff');

  var lowNDVI = postFlood.select('NDVI').lt(0.2);
  var combinedFlood = floodExtent.or(floodDiff.and(lowNDVI)).rename('flood_combined');
  var floodOnly = combinedFlood.and(permanentWater.not()).rename('flood_only');

  var floodClass = ee.Image(0)
      .where(permanentWater, 1)
      .where(floodOnly, 2)
      .clip(table)
      .rename('flood_class');

  // ---- FLOOD AREA ----
  var floodArea = floodOnly.multiply(ee.Image.pixelArea()).divide(1e6);
  var totalFloodArea = floodArea.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: table.geometry(),
    scale: FLOOD_SCALE,
    maxPixels: 1e13
  });

  print('--- ' + yearStr + ' ---');
  print('Image count:', s2.size());
  print('Flooded Area (sq km):', totalFloodArea.get('flood_only'));

  // ---- MAP DISPLAY ----
  Map.addLayer(composite, trueColorVis, 'True Color ' + yearStr, false);
  Map.addLayer(composite, falseColorVis, 'False Color ' + yearStr, false);
  Map.addLayer(ndviComposite, ndviVis, 'NDVI ' + yearStr, false);
  Map.addLayer(ndwiComposite, ndwiVis, 'NDWI ' + yearStr, false);
  Map.addLayer(mndwiComposite, mndwiVis, 'MNDWI ' + yearStr, false);
  Map.addLayer(preFlood, trueColorVis, 'Pre-Flood True Color ' + yearStr, false);
  Map.addLayer(postFlood, trueColorVis, 'Post-Flood True Color ' + yearStr, false);
  Map.addLayer(mndwiDiff, mndwiDiffVis, 'MNDWI Difference ' + yearStr, false);
  Map.addLayer(floodExtent.selfMask(), {palette: ['ff0000']}, 'Flood (MNDWI Threshold) ' + yearStr, false);
  Map.addLayer(floodDiff.selfMask(), {palette: ['ff6600']}, 'Flood (MNDWI Difference) ' + yearStr, false);
  Map.addLayer(floodClass, floodClassVis, 'Flood Classification ' + yearStr, false);

  // ============================================================
  // getMap() — Collect all tile URLs
  // ============================================================

  collectUrl(composite, trueColorVis, yearStr, 'True_Color');
  collectUrl(composite, falseColorVis, yearStr, 'False_Color');
  collectUrl(ndviComposite, ndviVis, yearStr, 'NDVI');
  collectUrl(ndwiComposite, ndwiVis, yearStr, 'NDWI');
  collectUrl(mndwiComposite, mndwiVis, yearStr, 'MNDWI');
  collectUrl(preFlood, trueColorVis, yearStr, 'Pre_Flood_True_Color');
  collectUrl(postFlood, trueColorVis, yearStr, 'Post_Flood_True_Color');
  collectUrl(mndwiDiff, mndwiDiffVis, yearStr, 'MNDWI_Difference');
  collectUrl(floodExtent.selfMask(), {min: 0, max: 1, palette: ['ff0000']}, yearStr, 'Flood_MNDWI_Threshold');
  collectUrl(floodDiff.selfMask(), {min: 0, max: 1, palette: ['ff6600']}, yearStr, 'Flood_MNDWI_Difference');
  collectUrl(floodClass, floodClassVis, yearStr, 'Flood_Classification');

  // ============================================================
  // IMAGE EXPORTS
  // ============================================================

  var ndviExport = ndviComposite.multiply(10000).toInt16();
  var ndwiExport = ndwiComposite.multiply(10000).toInt16();
  var mndwiExport = mndwiComposite.multiply(10000).toInt16();
  var mndwiDiffExport = mndwiDiff.multiply(10000).toInt16();

  var trueColorExport = composite.select(['B4', 'B3', 'B2'])
      .visualize({min: 0, max: 3000}).toUint8();
  var falseColorExport = composite.select(['B8', 'B4', 'B3'])
      .visualize({min: 0, max: 4000}).toUint8();

  var floodClassExport = floodClass.toByte();
  var floodExtentExport = floodOnly.toByte();

  Export.image.toDrive({image: floodClassExport, description: 'FloodMap_' + yearStr + '_S2_Harmonized', folder: EXPORT_FOLDER, region: table.geometry(), scale: FLOOD_SCALE, maxPixels: 1e13, fileFormat: 'GeoTIFF', formatOptions: FORMAT_OPTIONS});
  Export.image.toDrive({image: floodExtentExport, description: 'FloodExtent_' + yearStr + '_S2_Harmonized', folder: EXPORT_FOLDER, region: table.geometry(), scale: FLOOD_SCALE, maxPixels: 1e13, fileFormat: 'GeoTIFF', formatOptions: FORMAT_OPTIONS});
  Export.image.toDrive({image: mndwiDiffExport, description: 'MNDWI_Diff_' + yearStr + '_S2_Harmonized', folder: EXPORT_FOLDER, region: table.geometry(), scale: MNDWI_DIFF_SCALE, maxPixels: 1e13, fileFormat: 'GeoTIFF', formatOptions: FORMAT_OPTIONS});
  Export.image.toDrive({image: trueColorExport, description: 'TrueColor_' + yearStr + '_S2_Harmonized', folder: EXPORT_FOLDER, region: table.geometry(), scale: RGB_SCALE, maxPixels: 1e13, fileFormat: 'GeoTIFF', formatOptions: FORMAT_OPTIONS});
  Export.image.toDrive({image: falseColorExport, description: 'FalseColor_' + yearStr + '_S2_Harmonized', folder: EXPORT_FOLDER, region: table.geometry(), scale: RGB_SCALE, maxPixels: 1e13, fileFormat: 'GeoTIFF', formatOptions: FORMAT_OPTIONS});
  Export.image.toDrive({image: ndviExport, description: 'NDVI_' + yearStr + '_S2_Harmonized', folder: EXPORT_FOLDER, region: table.geometry(), scale: INDEX_SCALE, maxPixels: 1e13, fileFormat: 'GeoTIFF', formatOptions: FORMAT_OPTIONS});
  Export.image.toDrive({image: ndwiExport, description: 'NDWI_' + yearStr + '_S2_Harmonized', folder: EXPORT_FOLDER, region: table.geometry(), scale: INDEX_SCALE, maxPixels: 1e13, fileFormat: 'GeoTIFF', formatOptions: FORMAT_OPTIONS});
  Export.image.toDrive({image: mndwiExport, description: 'MNDWI_' + yearStr + '_S2_Harmonized', folder: EXPORT_FOLDER, region: table.geometry(), scale: INDEX_SCALE, maxPixels: 1e13, fileFormat: 'GeoTIFF', formatOptions: FORMAT_OPTIONS});

});

// ---- STATIC LAYERS ----
Map.centerObject(table, 10);
Map.addLayer(permanentWater.selfMask(), {palette: ['0000cc']}, 'Permanent Water (JRC)', false);
Map.addLayer(table, {color: 'yellow'}, 'Study Area');

// Permanent Water getMap
collectUrl(permanentWater.selfMask(), {min: 0, max: 1, palette: ['0000cc']}, 'Static', 'Permanent_Water_JRC');

// ============================================================
// EXPORT ALL TILE URLs AS CSV (open in Excel)
// ============================================================
// NOTE: getMap() uses async callbacks in the Code Editor.
// The urlFeatures list is populated asynchronously.
// We use ui.util.setTimeout to wait for all callbacks to complete
// before building the FeatureCollection and triggering the export.
// ============================================================

// Wait 30 seconds for all getMap callbacks to resolve, then export
ui.util.setTimeout(function() {

  print('============================================');
  print('Total URLs collected: ' + urlFeatures.length);
  print('============================================');

  if (urlFeatures.length > 0) {
    var urlCollection = ee.FeatureCollection(urlFeatures);

    // Print the table to console for quick reference
    print('URL Table:', urlCollection);

    // Export as CSV to Google Drive (open in Excel)
    Export.table.toDrive({
      collection: urlCollection,
      description: 'Tile_URLs_All_Years',
      folder: EXPORT_FOLDER,
      fileNamePrefix: 'Tile_URLs_All_Years',
      fileFormat: 'CSV',
      selectors: ['Year', 'Layer_Name', 'Tile_URL']
    });

    print('============================================');
    print('CSV export task created: Tile_URLs_All_Years');
    print('Columns: Year, Layer_Name, Tile_URL');
    print('Run the export task in the Tasks tab.');
    print('Open the CSV in Excel after download.');
    print('============================================');
  } else {
    print('WARNING: No URLs collected. Callbacks may still be running.');
    print('Try increasing the timeout value.');
  }

}, 30000); // 30-second delay to allow async getMap callbacks

print('============================================');
print('MULTI-YEAR FLOOD MAPPING COMPLETE (OPTIMIZED)');
print('Years processed: 2017, 2018, 2021, 2022, 2025');
print('Total image export tasks: ' + (years.length * 8) + ' (8 per year)');
print('URL CSV export will appear in Tasks tab after ~30 seconds.');
print('============================================');
