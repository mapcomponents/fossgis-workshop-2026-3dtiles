import Ml3DTileLayer from "../../lib/MlTile3DLayer/Ml3DTilesLayer";

type Props = {};

export default function ThreeDTilesLayer({}: Props) {
  return (
    <>
      <Ml3DTileLayer
        id="3d-tiles-layer"
        //data="https://sgx.geodatenzentrum.de/gdz_basemapde_3d_gebaeude/lod2_4978_null.json"
        data="http://localhost:9559/lod2_4978_null.json"
        //beforeId="waterway-name"
      />
    </>
  );
}
