import { useCallback, useEffect, useState } from "react";
import { MlSceneGraphLayer } from "@mapcomponents/deck-gl";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

interface TreeFeature {
  type: "Feature";
  properties: {
    leaf_type?: string;
    height?: string | number;
    [key: string]: unknown;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number] | [number, number, number];
  };
}

const getPosition = (d: unknown): [number, number, number] => {
  const f = d as TreeFeature;
  const [lon, lat] = f.geometry.coordinates;
  return [lon, lat, 0];
};

interface TreeLayerProps {
  mapId?: string;
  sizeScale?: number;
}

const TreeLayer = ({ mapId, sizeScale = 15 }: TreeLayerProps) => {
  const [pineFeatures, setPineFeatures] = useState<TreeFeature[]>([]);
  const [broadleafFeatures, setBroadleafFeatures] = useState<TreeFeature[]>([]);
  const [selectedFeature, setSelectedFeature] = useState<TreeFeature | null>(null);

  const selectedProps = selectedFeature ? (selectedFeature.properties as Record<string, unknown>) : null;

  const onClick = useCallback((info: unknown) => {
    const pickInfo = info as { picked?: boolean; object?: TreeFeature };
    if (!pickInfo.picked || !pickInfo.object) return;
    const feature = pickInfo.object;
    setSelectedFeature((prev) =>
      JSON.stringify(prev?.geometry.coordinates) === JSON.stringify(feature.geometry.coordinates)
        ? null
        : feature
    );
  }, []);

  useEffect(() => {
    fetch("/assets/trees.geojson")
      .then((res) => res.json())
      .then((data: { features: TreeFeature[] }) => {
        const features = data.features;
        setPineFeatures(
          features.filter((f) => f.properties.leaf_type === "needleleaved")
        );
        setBroadleafFeatures(
          features.filter((f) => f.properties.leaf_type !== "needleleaved")
        );
      });
  }, []);

  const isSelected = useCallback(
    (f: TreeFeature) =>
      selectedFeature !== null &&
      JSON.stringify(f.geometry.coordinates) ===
        JSON.stringify(selectedFeature.geometry.coordinates),
    [selectedFeature]
  );

  const yellowColor: [number, number, number, number] = [255, 255, 0, 255];

  return (
    <>
      {pineFeatures.length > 0 && (
        <MlSceneGraphLayer
          id="pine-trees"
          mapId={mapId}
          data={pineFeatures.filter((f) => !isSelected(f)) as unknown[]}
          scenegraph="/assets/low_poly_pine.glb"
          getPosition={getPosition}
          getOrientation={[0, 0, 90]}
          sizeScale={sizeScale}
          _lighting="pbr"
          updateTriggers={{ data: selectedFeature }}
          pickable
          onClick={onClick}
        />
      )}
      {broadleafFeatures.length > 0 && (
        <MlSceneGraphLayer
          id="broadleaf-trees"
          mapId={mapId}
          data={broadleafFeatures.filter((f) => !isSelected(f)) as unknown[]}
          scenegraph="/assets/low_poly_tree.glb"
          getPosition={getPosition}
          getOrientation={[0, 0, 90]}
          sizeScale={sizeScale}
          _lighting="pbr"
          updateTriggers={{ data: selectedFeature }}
          pickable
          onClick={onClick}
        />
      )}
      {selectedFeature && (
        <MlSceneGraphLayer
          id="selected-tree"
          mapId={mapId}
          data={[selectedFeature] as unknown[]}
          scenegraph={
            selectedFeature.properties.leaf_type === "needleleaved"
              ? "/assets/low_poly_pine.glb"
              : "/assets/low_poly_tree.glb"
          }
          getPosition={getPosition}
          getOrientation={[0, 0, 90]}
          sizeScale={sizeScale}
          _lighting="flat"
          getColor={() => yellowColor}
          pickable
          onClick={onClick}
        />
      )}

      {selectedProps && (
        <Paper variant="outlined" sx={{ m: 2, overflow: "hidden" }}>
          <Box sx={{ px: 2, py: 1.5, bgcolor: "primary.main" }}>
            <Typography variant="subtitle2" sx={{ color: "primary.contrastText", fontWeight: 700 }}>
              Selected Tree
            </Typography>
          </Box>
          <Divider />
          <Box sx={{ px: 2, py: 1 }}>
            {Object.entries(selectedProps).map(([key, value]) => (
              <Box key={key} sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mr: 2, flexShrink: 0 }}>
                  {key}
                </Typography>
                <Typography variant="body2" sx={{ textAlign: "right", wordBreak: "break-all" }}>
                  {String(value)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      )}
    </>
  );
};

export default TreeLayer;
