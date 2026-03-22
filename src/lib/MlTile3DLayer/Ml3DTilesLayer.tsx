// This file is inspired by @mapcomponents/deck-gl's Ml3DTileLayer
// (https://github.com/mapcomponents/react-map-components-maplibre)
//
// Original work: Copyright (c) 2021 WhereGroup GmbH — MIT License
// Modified to use the custom Tile3DLayer2 class (Tiles3DLayer2.tsx) instead of
// deck.gl's built-in Tile3DLayer, enabling in-place layer replacement without
// restarting tile loading and exposing the updateTrigger prop.
//
// SPDX-License-Identifier: MIT

import { useContext, useEffect, useMemo, useRef } from 'react';
import { useMap } from '@mapcomponents/react-maplibre';
//import { Tile3DLayer, Tile3DLayerProps } from '@deck.gl/geo-layers';
import { default as Tile3DLayer, Tile3DLayer2Props } from './Tiles3DLayer2';
import { DeckGlContext } from '@mapcomponents/deck-gl';
import type { Layer } from '@deck.gl/core';

export interface Ml3DTileLayerProps extends Tile3DLayer2Props {
	/**
	 * Id of the target MapLibre instance in mapContext
	 */
	mapId?: string;
	/**
	 * Id of an existing layer in the mapLibre instance to help specify the layer order
	 * This layer will be visually beneath the layer with the "beforeId" id.
	 */
	beforeId?: string;
}

const Ml3DTileLayer = (props: Ml3DTileLayerProps) => {
	const { mapId, ...Ml3DTileProps } = props;
	const mapHook = useMap({ mapId: mapId });
	const deckGlContext = useContext(DeckGlContext);
	const layerRef = useRef<Layer | null>(null);

	const tile3dLayer = useMemo(() => {
		if (!Ml3DTileProps.data) return null;
		else
			return new Tile3DLayer({
				...Ml3DTileProps,
			});
	}, [
		Ml3DTileProps.data,
		Ml3DTileProps.id,
		Ml3DTileProps.pickable,
		Ml3DTileProps.onTileLoad,
		Ml3DTileProps.onTileUnload,
		Ml3DTileProps.loadOptions,
		Ml3DTileProps.loaders,
		Ml3DTileProps.visible,
		Ml3DTileProps.opacity,
		Ml3DTileProps.pointSize,
		Ml3DTileProps.beforeId,
		Ml3DTileProps.getFeatureColor,
		Ml3DTileProps.onClick,
		Ml3DTileProps.updateTrigger,
	]);

	// Add or replace the layer in the deck.gl layer array in-place.
	// This avoids remove+add which would destroy the tileset via MapboxOverlay.
	useEffect(() => {
		if (!mapHook.map || !tile3dLayer) return;

		const prev = layerRef.current;
		layerRef.current = tile3dLayer;

		deckGlContext.setDeckGlLayerArray((layers) => {
			if (prev) {
				// Replace old layer reference in-place
				return layers.map((l) => (l === prev ? tile3dLayer : l));
			}
			// First mount: append
			return [...layers, tile3dLayer];
		});
	}, [mapHook.map, tile3dLayer]);

	// Remove layer only on unmount
	useEffect(() => {
		return () => {
			const layer = layerRef.current;
			if (layer) {
				deckGlContext.setDeckGlLayerArray((layers) =>
					layers.filter((l) => l !== layer)
				);
				layerRef.current = null;
			}
		};
	}, []);

	return <></>;
};

export default Ml3DTileLayer;