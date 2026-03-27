import { useCallback, useRef, useState } from "react";
import { Enhanced3DTilePickingInfo } from "../../lib/MlTile3DLayer/Tiles3DLayer2";
import Ml3DTileLayer from "../../lib/MlTile3DLayer/Ml3DTilesLayer";
import type { Tile3D } from "@loaders.gl/tiles";
import type { Color } from "@deck.gl/core";

type Props = {};

export default function ThreeDTilesLayer({}: Props) {
  const [colorVersion, setColorVersion] = useState(0);
  const selectedRef = useRef<string | null>(null);

  const getFeatureColor = useCallback(
    (featureId: number, tile: Tile3D): Color => {
      const props = tile.content?.propertyTable?.[featureId];
      const gmlId = props?.gml_id as string | undefined;
      const surface = (props?.surface as string)?.toLowerCase();

      if (selectedRef.current && gmlId === selectedRef.current) {
        return [0, 200, 0];
      }
      if (surface === "roof") {
        return [255, 80, 80];
      }
      return [235, 235, 235];
    },
    [],
  );

  const onClick = useCallback((info: unknown) => {
    const pickInfo = info as Enhanced3DTilePickingInfo;
    if (!pickInfo.picked) return;

    const gmlId = pickInfo.featureProperties?.gml_id as string | undefined;
    if (gmlId) {
      const isDeselect = selectedRef.current === gmlId;
      selectedRef.current = isDeselect ? null : gmlId;
      setColorVersion((v) => v + 1);
    }
  }, []);

  return (
    <>
      <Ml3DTileLayer
        id="3d-tiles-layer"
        data="https://sgx.geodatenzentrum.de/gdz_basemapde_3d_gebaeude/lod2_4978_null.json"
        pickable={true}
        getFeatureColor={getFeatureColor}
        //onClick={onClick}
        onClick={(info) => console.log(info)}
        updateTrigger={colorVersion}
        beforeId="waterway-name"
      />
    </>
  );
}
