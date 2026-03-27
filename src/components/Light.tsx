import { useEffect } from "react";
import { LightingEffect, AmbientLight, DirectionalLight } from "@deck.gl/core";
import { useDeckGl } from "@mapcomponents/deck-gl";

const effect = new LightingEffect({
  ambientLight: new AmbientLight({ color: [255, 255, 255], intensity: 1.8 }),
  sunLight: new DirectionalLight({
    color: [255, 240, 200],
    intensity: 2.0,
    direction: [-2, -4, -3],
  }),
});

export default function LightingSetup() {
  const { addEffect, removeEffect } = useDeckGl();

  useEffect(() => {
    addEffect(effect);
    return () => removeEffect(effect);
  }, []);

  return null;
}

