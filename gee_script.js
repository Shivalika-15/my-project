// ======================================
// AI-Assisted Water Extraction using NDWI + Random Forest
// ======================================

// 1. Define Area of Interest
var aoi = ee.Geometry.Rectangle([80.85, 26.75, 81.05, 26.95]);
Map.centerObject(aoi, 11);

// ======================================
// 2. Load Sentinel-2 Data (FIXED)
// ======================================
var image = ee.ImageCollection("COPERNICUS/S2_SR")
  .filterBounds(aoi)
  .filterDate('2023-01-01', '2023-12-31')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
  .select(['B2', 'B3', 'B4', 'B8'])   // ✅ IMPORTANT FIX
  .median();

// ======================================
// 3. NDWI Calculation
// ======================================
var ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI');

// Combine bands + NDWI
var finalImage = image.addBands(ndwi);

// ======================================
// 4. Display Layers
// ======================================

// True Color
Map.addLayer(image, {
  bands: ['B4', 'B3', 'B2'],
  min: 0,
  max: 3000
}, 'True Color');

// NDWI
Map.addLayer(ndwi, {
  min: -1,
  max: 1,
  palette: ['white', 'blue']
}, 'NDWI');

// ======================================
// 5. FIX: Convert MultiPoint → FeatureCollection
// ======================================

// Water points (class = 1)
var waterFC = ee.FeatureCollection(
  water.coordinates().map(function(coord) {
    return ee.Feature(ee.Geometry.Point(coord), {'class': 1});
  })
);

// Land points (class = 0)
var landFC = ee.FeatureCollection(
  land.coordinates().map(function(coord) {
    return ee.Feature(ee.Geometry.Point(coord), {'class': 0});
  })
);

// Merge
var trainingData = waterFC.merge(landFC);

// ======================================
// 6. Sample Training Data
// ======================================
var training = finalImage.sampleRegions({
  collection: trainingData,
  properties: ['class'],
  scale: 10
});

// ======================================
// 7. Train Random Forest
// ======================================
var classifier = ee.Classifier.smileRandomForest(50).train({
  features: training,
  classProperty: 'class',
  inputProperties: finalImage.bandNames()
});

// ======================================
// 8. Classification
// ======================================
var classified = finalImage.classify(classifier);

// Display classification
Map.addLayer(classified, {
  min: 0,
  max: 1,
  palette: ['white', 'blue']
}, 'Classification');

// ======================================
// 9. Smooth Result (REMOVE NOISE)
// ======================================
var smooth = classified.focal_mode();

Map.addLayer(smooth, {
  min: 0,
  max: 1,
  palette: ['white', 'blue']
}, 'Smoothed Classification');

// ======================================
// 10. Accuracy Assessment
// ======================================
var confusionMatrix = classifier.confusionMatrix();

print('Confusion Matrix:', confusionMatrix);
print('Overall Accuracy:', confusionMatrix.accuracy());
