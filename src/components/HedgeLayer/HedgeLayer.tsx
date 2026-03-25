import { useEffect, useState } from "react";
import { MlGeoJsonLayer } from "@mapcomponents/react-maplibre";
import type { FeatureCollection } from "geojson";

export default function HedgeLayer() {
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    fetch("/assets/hedges.geojson")
      .then((res) => res.json())
      .then(setGeojson);
  }, []);

  if (!geojson) return null;

  return (
    <MlGeoJsonLayer
      layerId="hedge"
      geojson={geojson}
      type="line"
      insertBeforeLayer="waterway-name"
      options={{
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#4caf50",
          "line-width": 6,
          "line-opacity": 0.9,
        },
      }}
    />
  );
}
