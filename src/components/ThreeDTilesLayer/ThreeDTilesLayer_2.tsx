import { useCallback, useRef } from "react";
import Ml3DTileLayer from "../../lib/MlTile3DLayer/Ml3DTilesLayer";
import type { Tile3D } from "@loaders.gl/tiles";
import type { Color } from "@deck.gl/core";

type Props = {};

export default function ThreeDTilesLayer({}: Props) {
  const selectedRef = useRef<string | null>(null);

  const getFeatureColor = useCallback(
    (featureId: number, tile: Tile3D): Color => {
      const props = tile.content?.propertyTable?.[featureId];
      const surface = (props?.surface as string)?.toLowerCase();

      if (surface === "roof") {
        return [255, 80, 80];
      }
      return [235, 235, 235];
    },
    [],
  );

  return (
    <>
      <Ml3DTileLayer
        id="3d-tiles-layer"
        //data="https://sgx.geodatenzentrum.de/gdz_basemapde_3d_gebaeude/lod2_4978_null.json"
        data="http://localhost:9559/lod2_4978_null.json"
        getFeatureColor={() => [0,200,0]}
        //getFeatureColor={getFeatureColor}
        beforeId="waterway-name"
      />
    </>
  );
}
