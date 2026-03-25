import { useEffect, useState } from "react";
import { MlSceneGraphLayer } from "@mapcomponents/deck-gl";

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

  return (
    <>
      {pineFeatures.length > 0 && (
        <MlSceneGraphLayer
          id="pine-trees"
          mapId={mapId}
          data={pineFeatures}
          scenegraph="/assets/low_poly_pine.glb"
          getPosition={getPosition}
          getOrientation={[0, 0, 90]}
          sizeScale={sizeScale}
          _lighting="pbr"
          pickable
        />
      )}
      {broadleafFeatures.length > 0 && (
        <MlSceneGraphLayer
          id="broadleaf-trees"
          mapId={mapId}
          data={broadleafFeatures}
          scenegraph="/assets/low_poly_tree.glb"
          getPosition={getPosition}
          getOrientation={[0, 0, 90]}
          sizeScale={sizeScale}
          _lighting="pbr"
          pickable
        />
      )}
    </>
  );
};

export default TreeLayer;
