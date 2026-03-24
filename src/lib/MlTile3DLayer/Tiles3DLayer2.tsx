// This file is derived from deck.gl's Tile3DLayer
// (https://github.com/visgl/deck.gl/blob/master/modules/geo-layers/src/tile-3d-layer/tile-3d-layer.ts)
//
// Original work: Copyright (c) Vis.gl contributors — MIT License
// Modified work: per-feature GPU picking, per-feature color via getFeatureColor,
//   glTF→MESH conversion with EXT_structural_metadata property table support,
//   and enhanced PickingInfo type (Enhanced3DTilePickingInfo).
//
// SPDX-License-Identifier: MIT

import {Geometry} from '@luma.gl/engine';
import {
  Accessor,
  Color,
  CompositeLayer,
  CompositeLayerProps,
  COORDINATE_SYSTEM,
  FilterContext,
  GetPickingInfoParams,
  Layer,
  LayersList,
  log,
  PickingInfo,
  UpdateParameters,
  Viewport,
  DefaultProps,
} from '@deck.gl/core';
import {PointCloudLayer} from '@deck.gl/layers';
import {ScenegraphLayer} from '@deck.gl/mesh-layers';
// Internal MeshLayer supports featureIds + PBR; the public SimpleMeshLayer does not.
import MeshLayer from '../../../node_modules/@deck.gl/geo-layers/dist/mesh-layer/mesh-layer.js';
import {load} from '@loaders.gl/core';
import type {MeshAttributes} from '@loaders.gl/schema';
import {Tileset3D, Tile3D, TILE_TYPE} from '@loaders.gl/tiles';
import {Tiles3DLoader} from '@loaders.gl/3d-tiles';

export type Enhanced3DTilePickingInfo = PickingInfo & {
  sourceTile: Tile3D | null;
  featureId?: number;
  featureProperties?: Record<string, unknown>;
};

const SINGLE_DATA = [0];

export type Tile3DLayer2Props<DataT = unknown> = _Tile3DLayer2Props<DataT> &
  CompositeLayerProps;

type _Tile3DLayer2Props<DataT> = {
  data: string;
  getPointColor?: Accessor<DataT, Color>;
  pointSize?: number;
  /** @deprecated Use `loaders` instead */
  loader?: typeof Tiles3DLoader;
  onTilesetLoad?: (tileset: Tileset3D) => void;
  onTileLoad?: (tile: Tile3D) => void;
  onTileUnload?: (tile: Tile3D) => void;
  onTileError?: (tile: Tile3D, url: string, message: string) => void;
  /** Per-feature color function. Receives featureId and owning Tile3D. Returns [r,g,b] or [r,g,b,a] in 0–255. */
  getFeatureColor?: (featureId: number, tile: Tile3D) => Color;
  /** Tile-level fallback color for MESH tiles when getFeatureColor is not provided. */
  _getMeshColor?: (tile: Tile3D) => Color;
  /** Bump to force a per-feature color rebuild without restarting tile loading. */
  updateTrigger?: number;
};

const defaultProps: DefaultProps<Tile3DLayer2Props> = {
  getPointColor: {type: 'accessor', value: [0, 0, 0, 255]},
  pointSize: 1.0,
  data: '',
  loader: Tiles3DLoader,
  onTilesetLoad: {type: 'function', value: () => {}},
  onTileLoad: {type: 'function', value: () => {}},
  onTileUnload: {type: 'function', value: () => {}},
  onTileError: {type: 'function', value: () => {}},
  getFeatureColor: {type: 'function', value: null, optional: true} as any,
  _getMeshColor: {type: 'function', value: () => [255, 255, 255]},
  updateTrigger: 0,
};

/**
 * Drop-in replacement for deck.gl's Tile3DLayer with per-feature GPU picking
 * and per-feature mesh coloring. onClick/onHover receive featureId and
 * featureProperties in addition to the tile object.
 */
export default class Tile3DLayer2<
  DataT = any,
  ExtraPropsT extends {} = {},
> extends CompositeLayer<ExtraPropsT & Required<_Tile3DLayer2Props<DataT>>> {
  static defaultProps = defaultProps;
  static layerName = 'Tile3DLayer2';

  declare state: {
    activeViewports: Record<string, Viewport>;
    frameNumber?: number;
    lastUpdatedViewports: Record<string, Viewport> | null;
    layerMap: Record<string, {tile: Tile3D; layer?: Layer | null; needsUpdate?: boolean}>;
    tileset3d: Tileset3D | null;
  };

  initializeState(): void {
    if ('onTileLoadFail' in this.props) {
      log.removed('onTileLoadFail', 'onTileError')();
    }
    this.state = {
      layerMap: {},
      tileset3d: null,
      activeViewports: {},
      lastUpdatedViewports: null,
    };
  }

  get isLoaded(): boolean {
    return Boolean(this.state?.tileset3d?.isLoaded() && super.isLoaded);
  }

  shouldUpdateState({changeFlags}: UpdateParameters<this>): boolean {
    return changeFlags.somethingChanged;
  }

  updateState({props, oldProps, changeFlags}: UpdateParameters<this>): void {
    if (props.data && props.data !== oldProps.data) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this._loadTileset(props.data);
    }
    if (changeFlags.viewportChanged) {
      const {activeViewports} = this.state;
      if (Object.keys(activeViewports).length) {
        this._updateTileset(activeViewports);
        this.state.lastUpdatedViewports = activeViewports;
        this.state.activeViewports = {};
      }
    }
    if (changeFlags.propsChanged) {
      for (const key in this.state.layerMap) {
        this.state.layerMap[key].needsUpdate = true;
      }
      this.setNeedsUpdate();
    }
  }

  activateViewport(viewport: Viewport): void {
    const {activeViewports, lastUpdatedViewports} = this.state;
    this.internalState!.viewport = viewport;
    activeViewports[viewport.id] = viewport;
    const lastViewport = lastUpdatedViewports?.[viewport.id];
    if (!lastViewport || !viewport.equals(lastViewport)) {
      this.setChangeFlags({viewportChanged: true});
      this.setNeedsUpdate();
    }
  }

  getPickingInfo({info, sourceLayer}: GetPickingInfoParams): Enhanced3DTilePickingInfo {
    const sourceTile: Tile3D | null = sourceLayer
      ? (sourceLayer.props as any).tile ?? null
      : null;

    const result = info as Enhanced3DTilePickingInfo;
    result.sourceTile = sourceTile;

    if (info.picked && sourceTile) {
      result.object = sourceTile;
      const featureIds: ArrayLike<number> | undefined = sourceTile.content?.featureIds;
      if (featureIds && featureIds.length > 0) {
        const featureId = info.index;
        if (featureId != null && featureId >= 0) {
          result.featureId = featureId;
          result.featureProperties = resolveFeatureProperties(sourceTile, featureId);
        }
      }
    }

    return result;
  }

  filterSubLayer({layer, viewport}: FilterContext): boolean {
    const {tile} = layer.props as unknown as {tile: Tile3D};
    return tile.selected && tile.viewportIds.includes(viewport.id);
  }

  protected _updateAutoHighlight(info: PickingInfo): void {
    const sourceTile = (info as Enhanced3DTilePickingInfo).sourceTile;
    const layerCache = sourceTile ? this.state.layerMap[sourceTile.id] : null;
    if (layerCache?.layer) {
      (layerCache.layer as any).updateAutoHighlight(info);
    }
  }

  private async _loadTileset(tilesetUrl: string): Promise<void> {
    const {loadOptions = {}} = this.props;
    // @ts-ignore — support both deprecated `loader` and `loaders`
    const loaders = this.props.loader || this.props.loaders;
    const loader = Array.isArray(loaders) ? loaders[0] : loaders;

    const options: any = {loadOptions: {...loadOptions}};
    let actualTilesetUrl = tilesetUrl;

    if (loader?.preload) {
      const preloadOptions = await loader.preload(tilesetUrl, loadOptions);
      if (preloadOptions.url) actualTilesetUrl = preloadOptions.url;
      if (preloadOptions.headers) {
        options.loadOptions.fetch = {
          ...options.loadOptions.fetch,
          headers: preloadOptions.headers,
        };
      }
      Object.assign(options, preloadOptions);
    }

    const tilesetJson = await load(actualTilesetUrl, loader, options.loadOptions);
    const tileset3d = new Tileset3D(tilesetJson, {
      onTileLoad: this._onTileLoad.bind(this),
      onTileUnload: this._onTileUnload.bind(this),
      onTileError: this.props.onTileError,
      ...options,
    });

    this.setState({tileset3d, layerMap: {}});
    this._updateTileset(this.state.activeViewports);
    this.props.onTilesetLoad(tileset3d);
  }

  private _onTileLoad(tileHeader: Tile3D): void {
    this._convertScenegraphToMesh(tileHeader);
    this.props.onTileLoad(tileHeader);
    this._updateTileset(this.state.lastUpdatedViewports);
    this.setNeedsUpdate();
  }

  private _onTileUnload(tileHeader: Tile3D): void {
    delete this.state.layerMap[tileHeader.id];
    this.props.onTileUnload(tileHeader);
  }

  private _updateTileset(viewports: Record<string, Viewport> | null): void {
    if (!viewports) return;
    const {tileset3d} = this.state;
    const {timeline} = this.context;
    if (!timeline || !Object.keys(viewports).length || !tileset3d) return;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    tileset3d.selectTiles(Object.values(viewports)).then((frameNumber) => {
      if (this.state.frameNumber !== frameNumber) {
        this.setState({frameNumber});
      }
    });
  }

  /** Converts glTF SCENEGRAPH tiles to MESH in-place to enable per-feature picking and coloring. */
  private _convertScenegraphToMesh(tileHeader: Tile3D): void {
    const content = tileHeader.content;
    if (!content?.gltf || content.attributes) return;

    const gltf = content.gltf;
    const prim = gltf.meshes?.[0]?.primitives?.[0];
    if (!prim?.attributes?.POSITION) return;

    const posAttr = prim.attributes.POSITION;
    const normAttr = prim.attributes.NORMAL;
    const featureIdRaw =
      prim.attributes._FEATURE_ID_0 ||
      prim.attributes._BATCHID ||
      prim.attributes.BATCHID;

    const rawPositions: Float32Array = posAttr.value || posAttr;
    const rawNormals: Float32Array | undefined = normAttr?.value || normAttr;
    const indices = prim.indices?.value || prim.indices;

    const node = gltf.nodes?.find((n: any) => n.mesh != null);
    const nodeMatrix: number[] | undefined = node?.matrix;
    const positions = new Float32Array(rawPositions.length);
    const normals = rawNormals ? new Float32Array(rawNormals.length) : undefined;

    if (nodeMatrix && !isIdentityMatrix(nodeMatrix)) {
      // Apply glTF node transform (affine: M * [x, y, z, 1])
      for (let i = 0; i < rawPositions.length; i += 3) {
        const x = rawPositions[i], y = rawPositions[i + 1], z = rawPositions[i + 2];
        positions[i]     = nodeMatrix[0] * x + nodeMatrix[4] * y + nodeMatrix[8]  * z + nodeMatrix[12];
        positions[i + 1] = nodeMatrix[1] * x + nodeMatrix[5] * y + nodeMatrix[9]  * z + nodeMatrix[13];
        positions[i + 2] = nodeMatrix[2] * x + nodeMatrix[6] * y + nodeMatrix[10] * z + nodeMatrix[14];
      }
      // Apply upper-3x3 to normals (no translation)
      if (rawNormals && normals) {
        for (let i = 0; i < rawNormals.length; i += 3) {
          const x = rawNormals[i], y = rawNormals[i + 1], z = rawNormals[i + 2];
          normals[i]     = nodeMatrix[0] * x + nodeMatrix[4] * y + nodeMatrix[8]  * z;
          normals[i + 1] = nodeMatrix[1] * x + nodeMatrix[5] * y + nodeMatrix[9]  * z;
          normals[i + 2] = nodeMatrix[2] * x + nodeMatrix[6] * y + nodeMatrix[10] * z;
        }
      }
    } else {
      positions.set(rawPositions);
      if (rawNormals && normals) normals.set(rawNormals);
    }

    content.attributes = {
      positions: {size: 3, value: positions},
      ...(normals ? {normals: {size: 3, value: normals}} : {}),
    };
    content.indices = indices || undefined;
    if (prim.material) content.material = prim.material;

    if (featureIdRaw) {
      const rawValues = featureIdRaw.value || featureIdRaw;
      const featureIds = new Uint32Array(rawValues.length);
      for (let i = 0; i < rawValues.length; i++) featureIds[i] = rawValues[i];
      content.featureIds = featureIds;
    }

    // Build per-feature property table from EXT_structural_metadata.
    // loaders.gl resolves the binary arrays into typed JS arrays at load time.
    const pt = gltf.extensions?.EXT_structural_metadata?.propertyTables?.[0];
    if (pt) {
      content.propertyTable = Array.from({length: pt.count || 0}, (_, i) => {
        const row: Record<string, unknown> = {};
        for (const [key, prop] of Object.entries(pt.properties || {})) {
          const data = (prop as any).data;
          if (Array.isArray(data)) row[key] = data[i];
        }
        return row;
      });
    }

    (tileHeader as any).type = TILE_TYPE.MESH;
  }

  private _getSubLayer(
    tileHeader: Tile3D,
    oldLayer?: Layer,
  ): MeshLayer<DataT> | PointCloudLayer<DataT> | ScenegraphLayer<DataT> | null {
    if (!tileHeader.content) return null;
    switch (tileHeader.type as TILE_TYPE) {
      case TILE_TYPE.POINTCLOUD:
        return this._makePointCloudLayer(tileHeader, oldLayer as PointCloudLayer<DataT>);
      case TILE_TYPE.SCENEGRAPH:
        return this._make3DModelLayer(tileHeader);
      case TILE_TYPE.MESH:
        return this._makeSimpleMeshLayer(tileHeader, oldLayer as MeshLayer<DataT>);
      default:
        throw new Error(`Tile3DLayer2: unsupported tile type ${tileHeader.content.type}`);
    }
  }

  private _makePointCloudLayer(
    tileHeader: Tile3D,
    oldLayer?: PointCloudLayer<DataT>,
  ): PointCloudLayer<DataT> | null {
    const {attributes, pointCount, constantRGBA, cartographicOrigin, modelMatrix} =
      tileHeader.content;
    const {positions, normals, colors} = attributes;
    if (!positions) return null;

    const data = (oldLayer && oldLayer.props.data) || {
      header: {vertexCount: pointCount},
      attributes: {POSITION: positions, NORMAL: normals, COLOR_0: colors},
    };

    const {pointSize, getPointColor} = this.props;
    const SubLayerClass = this.getSubLayerClass('pointcloud', PointCloudLayer);
    return new SubLayerClass(
      {pointSize},
      this.getSubLayerProps({id: 'pointcloud'}),
      {
        id: `${this.id}-pointcloud-${tileHeader.id}`,
        tile: tileHeader,
        data,
        coordinateSystem: COORDINATE_SYSTEM.METER_OFFSETS,
        coordinateOrigin: cartographicOrigin,
        modelMatrix,
        getColor: constantRGBA || getPointColor,
        _offset: 0,
      },
    );
  }

  private _make3DModelLayer(tileHeader: Tile3D): ScenegraphLayer<DataT> {
    const {gltf, instances, cartographicOrigin, modelMatrix} = tileHeader.content;
    const SubLayerClass = this.getSubLayerClass('scenegraph', ScenegraphLayer);
    return new SubLayerClass(
      {_lighting: 'pbr'},
      this.getSubLayerProps({id: 'scenegraph'}),
      {
        id: `${this.id}-scenegraph-${tileHeader.id}`,
        tile: tileHeader,
        data: instances || SINGLE_DATA,
        scenegraph: gltf,
        coordinateSystem: COORDINATE_SYSTEM.METER_OFFSETS,
        coordinateOrigin: cartographicOrigin,
        modelMatrix,
        getTransformMatrix: (instance: any) => instance.modelMatrix,
        getPosition: [0, 0, 0],
        _offset: 0,
      },
    );
  }

  private _makeSimpleMeshLayer(
    tileHeader: Tile3D,
    oldLayer?: MeshLayer<DataT>,
  ): MeshLayer<DataT> {
    const content = tileHeader.content;
    const {
      attributes,
      indices,
      modelMatrix,
      cartographicOrigin,
      coordinateSystem = COORDINATE_SYSTEM.METER_OFFSETS,
      material,
      featureIds,
    } = content;

    const {getFeatureColor, _getMeshColor} = this.props;
    const mergedAttributes = buildMeshGeometry(attributes, featureIds, getFeatureColor, tileHeader);
    const geometry =
      (!getFeatureColor && oldLayer && oldLayer.props.mesh) ||
      new Geometry({topology: 'triangle-list', attributes: mergedAttributes, indices});

    const SubLayerClass = this.getSubLayerClass('mesh', MeshLayer);
    return new SubLayerClass(
      this.getSubLayerProps({id: 'mesh'}),
      {
        id: `${this.id}-mesh-${tileHeader.id}`,
        tile: tileHeader,
        mesh: geometry,
        data: SINGLE_DATA,
        getColor: getFeatureColor != null ? [255, 255, 255, 255] : _getMeshColor(tileHeader),
        // Spread material into a new object so MeshLayer.updateState always calls
        // updatePbrMaterialUniforms() after a geometry rebuild (binds GPU sampler to new model).
        pbrMaterial: {...(material || {})},
        modelMatrix,
        coordinateOrigin: cartographicOrigin,
        coordinateSystem,
        featureIds,
        _offset: 0,
      },
    );
  }

  renderLayers(): Layer | null | LayersList {
    const {tileset3d, layerMap} = this.state;
    if (!tileset3d) return null;

    return (tileset3d.tiles as Tile3D[])
      .map((tile) => {
        const layerCache = (layerMap[tile.id] = layerMap[tile.id] || {tile});
        let {layer} = layerCache;
        if (tile.selected) {
          if (!layer) {
            layer = this._getSubLayer(tile);
          } else if (layerCache.needsUpdate) {
            layer = this._getSubLayer(tile, layer as Layer);
            layerCache.needsUpdate = false;
          }
        }
        layerCache.layer = layer;
        return layer;
      })
      .filter(Boolean) as LayersList;
  }
}

function resolveFeatureProperties(
  tile: Tile3D,
  featureId: number,
): Record<string, unknown> | undefined {
  const content = tile.content;
  if (!content) return undefined;

  // 3D Tiles 1.1 — propertyTable built from EXT_structural_metadata
  const propertyTable: Record<string, unknown>[] | undefined = content.propertyTable;
  if (propertyTable) return propertyTable[featureId] as Record<string, unknown> | undefined;

  // 3D Tiles 1.0 — batchTableJson (column-oriented arrays indexed by featureId)
  const batchTableJson: Record<string, ArrayLike<unknown>> | undefined = content.batchTableJson;
  if (batchTableJson) {
    const properties: Record<string, unknown> = {};
    for (const key of Object.keys(batchTableJson)) {
      const col = batchTableJson[key];
      if (Array.isArray(col) || ArrayBuffer.isView(col)) {
        properties[key] = (col as any)[featureId];
      }
    }
    return properties;
  }

  return undefined;
}

function buildMeshGeometry(
  contentAttributes: MeshAttributes,
  featureIds: ArrayLike<number> | undefined,
  getFeatureColor: ((featureId: number, tile: Tile3D) => Color) | null | undefined,
  tileHeader: Tile3D,
): MeshAttributes {
  const attributes: MeshAttributes = {
    positions: {
      ...contentAttributes.positions,
      // Always copy into a fresh array — geometry creation may mutate the buffer
      value: new Float32Array(contentAttributes.positions.value as ArrayLike<number>),
    },
  };

  if (contentAttributes.normals) attributes.normals = contentAttributes.normals;
  if (contentAttributes.texCoords) attributes.texCoords = contentAttributes.texCoords;
  if (contentAttributes.uvRegions) attributes.uvRegions = contentAttributes.uvRegions;

  if (getFeatureColor && featureIds && featureIds.length > 0) {
    const colorBuffer = new Uint8Array(featureIds.length * 4);
    for (let i = 0; i < featureIds.length; i++) {
      const color = getFeatureColor(featureIds[i], tileHeader);
      colorBuffer[i * 4]     = color[0];
      colorBuffer[i * 4 + 1] = color[1];
      colorBuffer[i * 4 + 2] = color[2];
      colorBuffer[i * 4 + 3] = color[3] ?? 255;
    }
    attributes.colors = {size: 4, value: colorBuffer, normalized: true};
  } else if (getFeatureColor) {
    // No featureIds — color all vertices uniformly via featureId 0
    const vertexCount =
      (contentAttributes.positions.value as ArrayLike<number>).length /
      (contentAttributes.positions.size || 3);
    const color = getFeatureColor(0, tileHeader);
    const colorBuffer = new Uint8Array(vertexCount * 4);
    for (let i = 0; i < vertexCount; i++) {
      colorBuffer[i * 4]     = color[0];
      colorBuffer[i * 4 + 1] = color[1];
      colorBuffer[i * 4 + 2] = color[2];
      colorBuffer[i * 4 + 3] = color[3] ?? 255;
    }
    attributes.colors = {size: 4, value: colorBuffer, normalized: true};
  } else if (contentAttributes.colors) {
    attributes.colors = contentAttributes.colors;
  }

  return attributes;
}

const IDENTITY_4X4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function isIdentityMatrix(m: ArrayLike<number>): boolean {
  if (m.length !== 16) return false;
  for (let i = 0; i < 16; i++) {
    if (Math.abs(m[i] - IDENTITY_4X4[i]) > 1e-6) return false;
  }
  return true;
}
