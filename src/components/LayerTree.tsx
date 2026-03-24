import { useState } from "react";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Checkbox from "@mui/material/Checkbox";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";

import ThreeDTilesLayer from "./ThreeDTilesLayer/ThreeDTilesLayer_1";
//import TreeLayer from "./TreeLayer/TreeLayer_1";
//import HedgeLayer from "./HedgeLayer/HedgeLayer";

const LAYERS = [
  //{ id: "hedges", label: "Hedges", component: <HedgeLayer key="hedges" /> },
  { id: "tiles3d", label: "3D Buildings", component: <ThreeDTilesLayer key="tiles3d" /> },
  //{ id: "trees", label: "Trees", component: <TreeLayer sizeScale={0.5} key="trees" /> },
] as const;

export default function LayerTree() {
  const [visible, setVisible] = useState<Record<string, boolean>>(
    Object.fromEntries(LAYERS.map((l) => [l.id, true])),
  );

  const toggle = (id: string) => setVisible((v) => ({ ...v, [id]: !v[id] }));

  return (
    <>
      <Typography
        variant="overline"
        sx={{ px: 2, pt: 2, display: "block", color: "text.secondary" }}
      >
        Layers
      </Typography>
      <List dense disablePadding>
        {LAYERS.map((layer) => (
          <ListItem
            key={layer.id}
            onClick={() => toggle(layer.id)}
            sx={{ cursor: "pointer" }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Checkbox
                edge="start"
                checked={!!visible[layer.id]}
                disableRipple
                size="small"
              />
            </ListItemIcon>
            <ListItemText primary={layer.label} />
          </ListItem>
        ))}
      </List>
      <Divider sx={{ my: 1 }} />
      {LAYERS.map((layer) => visible[layer.id] && layer.component)}
    </>
  );
}
